import { useEffect, useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, BarChart3, FilePlus, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/csvExport';
import DailySummaryForm from '@/components/daily-summary/DailySummaryForm';
import DailySummaryCharts, { type DailySummaryRow } from '@/components/daily-summary/DailySummaryCharts';
import BranchComparison from '@/components/daily-summary/BranchComparison';

export default function DailySummary() {
  const { user } = useAuth();
  const { organizations, branches } = useOrgBranch();

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr';
  const isManager = user?.role === 'manager';

  // Date range (default: current calendar month)
  const today = new Date();
  const [from, setFrom] = useState<Date>(startOfMonth(today));
  const [to, setTo] = useState<Date>(endOfMonth(today));

  // Admin selectors
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const visibleBranches = useMemo(() => {
    if (isManager && user?.branchId) {
      return branches.filter(b => b.id === user.branchId);
    }
    if (selectedOrg === 'all') return branches;
    return branches.filter(b => b.organization_id === selectedOrg);
  }, [branches, isManager, user, selectedOrg]);

  const [rows, setRows] = useState<DailySummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [managerTab, setManagerTab] = useState<'entry' | 'analytics'>('entry');

  // Hide range/export when manager is on the Entry tab (single-date entry only)
  const hideRangeFilters = isManager && managerTab === 'entry';

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      let query = supabase
        .from('daily_summaries')
        .select('*')
        .gte('summary_date', format(from, 'yyyy-MM-dd'))
        .lte('summary_date', format(to, 'yyyy-MM-dd'))
        .order('summary_date', { ascending: true });

      if (isManager && user.branchId) {
        query = query.eq('branch_id', user.branchId);
      } else if (isAdmin) {
        if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
        else if (selectedOrg !== 'all') query = query.eq('organization_id', selectedOrg);
      }

      const { data, error } = await query;
      if (error) {
        toast.error('Failed to load daily summaries');
        console.error(error);
      } else {
        setRows((data || []) as DailySummaryRow[]);
      }
      setLoading(false);
    };
    load();
  }, [user, isAdmin, isManager, from, to, selectedOrg, selectedBranch, refreshKey]);

  // Manager view requires a known branch
  if (isManager && !user?.branchId) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Your account is not linked to a branch. Please contact your administrator.
        </CardContent></Card>
      </div>
    );
  }

  // Determine the effective branch and org for the form (manager only)
  const formBranchId = isManager ? user!.branchId! : '';
  const formOrgId = isManager ? user!.organizationId || branches.find(b => b.id === formBranchId)?.organization_id || '' : '';

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Sales Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isManager
              ? 'Enter and review your branch daily figures with live visualizations.'
              : 'Review daily store figures across branches and compare performance.'}
          </p>
        </div>

        {/* Date range + export — hidden on Manager Entry tab */}
        {!hideRangeFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  From: {format(from, 'PP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={from} onSelect={(d) => d && setFrom(d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  To: {format(to, 'PP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={to} onSelect={(d) => d && setTo(d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() => {
                const branchName = (id: string) => branches.find(b => b.id === id)?.name || id;
                const exportRows = [...rows]
                  .sort((a, b) => a.summary_date.localeCompare(b.summary_date))
                  .map(r => ({
                    date: r.summary_date,
                    branch: branchName(r.branch_id),
                    shop_sale: Number(r.shop_sale).toFixed(2),
                    fuel_sale: Number(r.fuel_sale).toFixed(2),
                    net_sale: Number(r.net_sale).toFixed(2),
                    customer_count: r.customer_count,
                    fuel_volume: Number(r.fuel_volume).toFixed(2),
                    cash_sale: Number(r.cash_sale).toFixed(2),
                    atm_loaded: Number(r.atm_loaded).toFixed(2),
                    store_paid_outs: Number(r.store_paid_outs).toFixed(2),
                    cash_deposit: Number(r.cash_deposit).toFixed(2),
                    notes: r.notes ?? '',
                  }));
                downloadCSV(
                  `daily-summary_${format(from, 'yyyy-MM-dd')}_to_${format(to, 'yyyy-MM-dd')}.csv`,
                  exportRows,
                  [
                    { key: 'date', label: 'Date' },
                    { key: 'branch', label: 'Branch' },
                    { key: 'shop_sale', label: 'Shop sale (Gross) (£)' },
                    { key: 'fuel_sale', label: 'Fuel Sale (£)' },
                    { key: 'net_sale', label: 'Shop sale (Net) (£)' },
                    { key: 'customer_count', label: 'Customers' },
                    { key: 'fuel_volume', label: 'Fuel volume (Liter)' },
                    { key: 'cash_sale', label: 'Cash Sale (£)' },
                    { key: 'atm_loaded', label: 'ATM Loaded (£)' },
                    { key: 'store_paid_outs', label: 'Store Paid Outs (£)' },
                    { key: 'cash_deposit', label: 'Cash Deposit (£)' },
                    { key: 'notes', label: 'Notes' },
                  ]
                );
                toast.success('CSV exported');
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* Manager view */}
      {isManager && (
        <Tabs value={managerTab} onValueChange={(v) => setManagerTab(v as 'entry' | 'analytics')} className="space-y-4">
          <TabsList>
            <TabsTrigger value="entry"><FilePlus className="h-4 w-4 mr-2" /> Entry</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-2" /> My Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="entry">
            <DailySummaryForm
              branchId={formBranchId}
              organizationId={formOrgId}
              onSaved={() => setRefreshKey(k => k + 1)}
            />
          </TabsContent>
          <TabsContent value="analytics">
            {loading ? <LoadingState /> : <DailySummaryCharts rows={rows} />}
          </TabsContent>
        </Tabs>
      )}

      {/* Admin view */}
      {isAdmin && (
        <Tabs defaultValue="branch" className="space-y-4">
          <TabsList>
            <TabsTrigger value="branch">Branch View</TabsTrigger>
            <TabsTrigger value="comparison">Consolidated Comparison</TabsTrigger>
          </TabsList>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Organization</div>
                <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); setSelectedBranch('all'); }}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Branch</div>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {visibleBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <TabsContent value="branch">
            {loading ? <LoadingState /> : (
              selectedBranch === 'all' ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                  Select a specific branch above to view its detailed daily entries and visualizations.
                </CardContent></Card>
              ) : (
                <DailySummaryCharts rows={rows} />
              )
            )}
          </TabsContent>

          <TabsContent value="comparison">
            {loading ? <LoadingState /> : (
              <BranchComparison rows={rows} branches={visibleBranches} />
            )}
          </TabsContent>
        </Tabs>
      )}

      {!isAdmin && !isManager && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          You do not have access to Sales Analysis.
        </CardContent></Card>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <Card><CardContent className="py-12 flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
    </CardContent></Card>
  );
}
