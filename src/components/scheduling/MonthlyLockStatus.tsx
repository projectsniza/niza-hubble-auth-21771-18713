import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Unlock, CheckCircle2, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';

interface BranchRow {
  id: string;
  name: string;
  organization_id: string;
  organization_name?: string;
}

interface LockRow {
  id: string;
  branch_id: string;
  month_start: string;
  locked_at: string;
  lock_message: string | null;
  locked_by: string;
  locker_name?: string;
}

const getPayrollMonthStart = (month: Date) => new Date(month.getFullYear(), month.getMonth(), 21);

export function MonthlyLockStatus() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => getPayrollMonthStart(currentMonth), [currentMonth]);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const periodLabel = `${format(monthStart, 'dd MMM')} – ${format(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 20), 'dd MMM yyyy')}`;

  useEffect(() => {
    fetchData();
  }, [monthStartStr]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchesRes, locksRes] = await Promise.all([
        supabase.from('branches').select('id, name, organization_id, organization:organizations(name)').order('name'),
        supabase.from('timesheet_month_locks').select('*').eq('month_start', monthStartStr),
      ]);
      const flat: BranchRow[] = (branchesRes.data || []).map((b: any) => ({
        id: b.id, name: b.name, organization_id: b.organization_id, organization_name: b.organization?.name,
      }));
      setBranches(flat);

      const lockRows = locksRes.data || [];
      const lockerIds = Array.from(new Set(lockRows.map((l: any) => l.locked_by)));
      const profiles = lockerIds.length
        ? (await supabase.from('profiles').select('id, name').in('id', lockerIds)).data || []
        : [];
      const nameMap = new Map(profiles.map((p: any) => [p.id, p.name]));
      setLocks(lockRows.map((l: any) => ({ ...l, locker_name: nameMap.get(l.locked_by) || 'Unknown' })));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (lockId: string, branchName: string) => {
    if (!confirm(`Unlock monthly schedule for ${branchName}?`)) return;
    const { error } = await supabase.from('timesheet_month_locks').delete().eq('id', lockId);
    if (error) { toast.error(error.message); return; }
    toast.success(`${branchName} unlocked`);
    fetchData();
  };

  const lockByBranch = useMemo(() => {
    const m = new Map<string, LockRow>();
    locks.forEach(l => m.set(l.branch_id, l));
    return m;
  }, [locks]);

  const filtered = branches.filter(b => {
    const q = search.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || (b.organization_name || '').toLowerCase().includes(q);
  });

  const lockedCount = filtered.filter(b => lockByBranch.has(b.id)).length;
  const pendingCount = filtered.length - lockedCount;

  if (user?.role !== 'super_admin') return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Monthly Lock Status
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Payroll period: {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[120px] text-center">{format(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 20), 'MMM yyyy')}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">Total branches</p>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{lockedCount}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Closed & submitted</p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{pendingCount}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Pending closure</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search branch or organization..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border divide-y">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No branches found</div>
          ) : (
            filtered.map(b => {
              const lock = lockByBranch.get(b.id);
              return (
                <div key={b.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.organization_name || '—'}</p>
                    {lock?.lock_message && (
                      <p className="text-xs italic text-muted-foreground mt-1 line-clamp-2 max-w-md">"{lock.lock_message}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lock ? (
                      <>
                        <div className="text-right">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Closed
                          </Badge>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            by {lock.locker_name} • {format(new Date(lock.locked_at), 'dd MMM HH:mm')}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUnlock(lock.id, b.name)} className="gap-1">
                          <Unlock className="h-3 w-3" />
                          Unlock
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
