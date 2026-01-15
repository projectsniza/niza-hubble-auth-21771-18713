import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Calendar, Clock, Umbrella, RefreshCw, Search,
  TrendingUp, Loader2, Download
} from 'lucide-react';
import { format, parseISO, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  branch_id: string;
  branch?: { name: string };
}

interface MonthlyBreakdown {
  month: string;
  actual: number;
  holiday: number;
  sick: number;
}

interface EmployeeBalance {
  employee: Employee;
  weekly_contracted_hours: number;
  holiday_entitlement_days: number;
  total_worked_hours: number;
  total_sick_hours: number;
  weeks_worked: number;
  hours_per_day: number;
  total_holiday_hours_per_year: number;
  holiday_hours_earned: number;
  holiday_hours_taken: number;
  holiday_hours_remaining: number;
  difference: number;
  monthly_data: MonthlyBreakdown[];
}

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const DEFAULT_WEEKLY_HOURS = 40;
const DEFAULT_HOLIDAY_DAYS = 28;

export function HolidayBalance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025-04-01');
  const [viewMode, setViewMode] = useState<'summary' | 'monthly'>('summary');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterViewMode, setFilterViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');

  useEffect(() => {
    fetchData();
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }
  }, [selectedYear]);

  const fetchOrganizationsAndBranches = async () => {
    const [orgsRes, branchesRes] = await Promise.all([
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('branches').select('id, name, organization_id').order('name')
    ]);
    setOrganizations(orgsRes.data || []);
    setBranches(branchesRes.data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
        .eq('status', 'active')
        .order('first_name');

      if (empError) throw empError;
      if (!employees || employees.length === 0) {
        setBalances([]);
        setLoading(false);
        return;
      }

      const yearStart = parseISO(selectedYear);
      const yearEnd = addMonths(yearStart, 12);

      const { data: timesheets, error: tsError } = await supabase
        .from('timesheets')
        .select('employee_id, total_worked_hours, total_holiday_hours, total_sick_hours, week_start_date')
        .gte('week_start_date', format(yearStart, 'yyyy-MM-dd'))
        .lt('week_start_date', format(yearEnd, 'yyyy-MM-dd'));

      if (tsError) throw tsError;

      const { data: contracts } = await supabase
        .from('employee_contracts')
        .select('employee_id, weekly_contracted_hours, holiday_entitlement_days')
        .is('effective_to', null);

      const contractMap = new Map(contracts?.map(c => [c.employee_id, c]) || []);

      const calculatedBalances: EmployeeBalance[] = employees.map(emp => {
        const empTimesheets = timesheets?.filter(t => t.employee_id === emp.id) || [];
        const contract = contractMap.get(emp.id);
        const weeklyHours = contract?.weekly_contracted_hours || DEFAULT_WEEKLY_HOURS;
        const holidayDays = contract?.holiday_entitlement_days || DEFAULT_HOLIDAY_DAYS;
        
        const totalWorkedHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0);
        const totalHolidayTaken = empTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0);
        const totalSickHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0);
        
        const hoursPerDay = weeklyHours / 5;
        const totalHolidayHoursPerYear = holidayDays * hoursPerDay;
        const totalHoursForAccrual = totalWorkedHours + totalHolidayTaken + totalSickHours;
        const weeksWorked = weeklyHours > 0 ? totalHoursForAccrual / weeklyHours : 0;
        const holidayEarned = (totalHolidayHoursPerYear / 52) * weeksWorked;
        const holidayRemaining = holidayEarned - totalHolidayTaken;

        const monthlyData: MonthlyBreakdown[] = MONTHS.map((monthName, idx) => {
          const monthDate = addMonths(yearStart, idx);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          
          const monthTimesheets = empTimesheets.filter(t => {
            const weekStart = parseISO(t.week_start_date);
            return weekStart >= monthStart && weekStart <= monthEnd;
          });

          return {
            month: monthName,
            actual: monthTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0),
            holiday: monthTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0),
            sick: monthTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0)
          };
        });

        return {
          employee: emp as Employee,
          weekly_contracted_hours: weeklyHours,
          holiday_entitlement_days: holidayDays,
          total_worked_hours: totalWorkedHours,
          total_sick_hours: totalSickHours,
          weeks_worked: weeksWorked,
          hours_per_day: hoursPerDay,
          total_holiday_hours_per_year: totalHolidayHoursPerYear,
          holiday_hours_earned: holidayEarned,
          holiday_hours_taken: totalHolidayTaken,
          holiday_hours_remaining: holidayRemaining,
          difference: holidayRemaining,
          monthly_data: monthlyData
        };
      });

      setBalances(calculatedBalances);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch holiday data');
    } finally {
      setLoading(false);
    }
  };

  const recalculateAll = async () => {
    setRecalculating(true);
    await fetchData();
    toast.success('All balances recalculated');
    setRecalculating(false);
  };

  const filteredBalances = balances.filter(b => {
    const emp = b.employee;
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterViewMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterViewMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  });

  const groupedByBranch = filteredBalances.reduce((acc, balance) => {
    const branchName = balance.employee.branch?.name || 'Unassigned';
    if (!acc[branchName]) acc[branchName] = [];
    acc[branchName].push(balance);
    return acc;
  }, {} as Record<string, EmployeeBalance[]>);

  const totalEarned = filteredBalances.reduce((sum, b) => sum + b.holiday_hours_earned, 0);
  const totalTaken = filteredBalances.reduce((sum, b) => sum + b.holiday_hours_taken, 0);
  const totalRemaining = filteredBalances.reduce((sum, b) => sum + b.holiday_hours_remaining, 0);

  const getBalanceStatus = (remaining: number, earned: number) => {
    if (earned === 0) return 'neutral';
    const percentage = (remaining / earned) * 100;
    if (percentage >= 50) return 'good';
    if (percentage >= 20) return 'warning';
    return 'critical';
  };

  const exportToCSV = () => {
    const headers = ['No', 'Staff Name', 'Location', 'Contract', 'Weekly Hrs', 'Entitlement', 'Worked Hrs', 'Weeks', 'Earned', 'Taken', 'Remaining'];
    const rows = filteredBalances.map((b, idx) => [
      idx + 1, `${b.employee.first_name} ${b.employee.last_name}`, b.employee.branch?.name || '',
      b.weekly_contracted_hours >= 35 ? 'FT' : 'PT', b.weekly_contracted_hours, b.holiday_entitlement_days,
      b.total_worked_hours.toFixed(1), b.weeks_worked.toFixed(2), b.holiday_hours_earned.toFixed(2),
      b.holiday_hours_taken.toFixed(1), b.holiday_hours_remaining.toFixed(2)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Holiday_Hours_${format(parseISO(selectedYear), 'yyyy')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Holiday Hours Working</h2>
          <p className="text-muted-foreground">Pro-rata: (Annual Holiday Hours ÷ 52) × Weeks Worked</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={viewMode} onValueChange={(v: 'summary' | 'monthly') => setViewMode(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-04-01">Apr 2024 - Mar 2025</SelectItem>
              <SelectItem value="2025-04-01">Apr 2025 - Mar 2026</SelectItem>
              <SelectItem value="2026-04-01">Apr 2026 - Mar 2027</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button variant="outline" onClick={recalculateAll} disabled={recalculating}>
            {recalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {canViewFilters && (
        <OrgBranchFilter organizations={organizations} branches={branches} viewMode={filterViewMode}
          selectedOrg={selectedOrg} selectedBranch={selectedBranch} onViewModeChange={setFilterViewMode}
          onOrgChange={setSelectedOrg} onBranchChange={setSelectedBranch} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Earned</p><p className="text-2xl font-bold">{totalEarned.toFixed(1)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Umbrella className="h-5 w-5 text-orange-600" /></div><div><p className="text-sm text-muted-foreground">Taken</p><p className="text-2xl font-bold">{totalTaken.toFixed(1)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Calendar className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Remaining</p><p className="text-2xl font-bold">{totalRemaining.toFixed(1)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><Clock className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Employees</p><p className="text-2xl font-bold">{filteredBalances.length}</p></div></div></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : viewMode === 'monthly' ? (
        <Card>
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-bold">Holiday Hours Working - {format(parseISO(selectedYear), 'MMM yyyy')} to {format(addMonths(parseISO(selectedYear), 11), 'MMM yyyy')}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1800px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 w-8">No</TableHead>
                    <TableHead className="sticky left-8 bg-muted/50 z-10 min-w-[140px]">Staff Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">W.Hrs</TableHead>
                    <TableHead className="text-center">H.Ent</TableHead>
                    {MONTHS.map(m => <TableHead key={`a-${m}`} className="text-center bg-blue-50 dark:bg-blue-950">{m}</TableHead>)}
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900">TTL</TableHead>
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900">Wks</TableHead>
                    {MONTHS.map(m => <TableHead key={`h-${m}`} className="text-center bg-orange-50 dark:bg-orange-950">{m}</TableHead>)}
                    <TableHead className="text-center bg-orange-100 dark:bg-orange-900">TTL</TableHead>
                    <TableHead className="text-center bg-green-100 dark:bg-green-900">Earned</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => (
                    <React.Fragment key={branchName}>
                      <TableRow className="bg-primary/10"><TableCell colSpan={32} className="font-bold text-primary">📍 {branchName}</TableCell></TableRow>
                      {branchBalances.map((b, idx) => (
                        <TableRow key={b.employee.id}>
                          <TableCell className="sticky left-0 bg-background">{idx + 1}</TableCell>
                          <TableCell className="sticky left-8 bg-background font-medium">{b.employee.first_name} {b.employee.last_name}</TableCell>
                          <TableCell className="text-muted-foreground">{branchName}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{b.weekly_contracted_hours >= 35 ? 'FT' : 'PT'}</Badge></TableCell>
                          <TableCell className="text-center">{b.weekly_contracted_hours}</TableCell>
                          <TableCell className="text-center">{b.holiday_entitlement_days}</TableCell>
                          {b.monthly_data.map(m => <TableCell key={`a-${m.month}`} className="text-center bg-blue-50/50">{m.actual > 0 ? m.actual.toFixed(1) : '-'}</TableCell>)}
                          <TableCell className="text-center font-bold bg-blue-100">{b.total_worked_hours.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-blue-100">{b.weeks_worked.toFixed(2)}</TableCell>
                          {b.monthly_data.map(m => <TableCell key={`h-${m.month}`} className="text-center bg-orange-50/50">{m.holiday > 0 ? m.holiday.toFixed(1) : '-'}</TableCell>)}
                          <TableCell className="text-center font-bold bg-orange-100">{b.holiday_hours_taken.toFixed(1)}</TableCell>
                          <TableCell className="text-center font-bold bg-green-100 text-green-700">{b.holiday_hours_earned.toFixed(2)}</TableCell>
                          <TableCell className={`text-center font-bold ${b.difference >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.difference.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                  {filteredBalances.length === 0 && <TableRow><TableCell colSpan={32} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Contract</TableHead>
                <TableHead className="text-center">Weekly Hrs</TableHead>
                <TableHead className="text-center">Entitlement</TableHead>
                <TableHead className="text-center">Worked Hrs</TableHead>
                <TableHead className="text-center">Weeks</TableHead>
                <TableHead className="text-center">Earned</TableHead>
                <TableHead className="text-center">Taken</TableHead>
                <TableHead className="text-center">Remaining</TableHead>
                <TableHead className="text-center">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.map((b) => {
                const status = getBalanceStatus(b.holiday_hours_remaining, b.holiday_hours_earned);
                const pct = b.holiday_hours_earned > 0 ? (b.holiday_hours_taken / b.holiday_hours_earned) * 100 : 0;
                return (
                  <TableRow key={b.employee.id}>
                    <TableCell className="font-medium">{b.employee.first_name} {b.employee.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.employee.branch?.name || '-'}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{b.weekly_contracted_hours >= 35 ? 'Full-time' : 'Part-time'}</Badge></TableCell>
                    <TableCell className="text-center">{b.weekly_contracted_hours}</TableCell>
                    <TableCell className="text-center">{b.holiday_entitlement_days} days</TableCell>
                    <TableCell className="text-center">{b.total_worked_hours.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{b.weeks_worked.toFixed(1)}</TableCell>
                    <TableCell className="text-center font-medium text-blue-600">{b.holiday_hours_earned.toFixed(1)}</TableCell>
                    <TableCell className="text-center font-medium text-orange-600">{b.holiday_hours_taken.toFixed(1)}</TableCell>
                    <TableCell className="text-center"><span className={`font-bold ${status === 'good' ? 'text-green-600' : status === 'warning' ? 'text-yellow-600' : status === 'critical' ? 'text-red-600' : ''}`}>{b.holiday_hours_remaining.toFixed(1)}</span></TableCell>
                    <TableCell className="min-w-[120px]"><Progress value={Math.min(pct, 100)} className="h-2" /><p className="text-xs text-muted-foreground text-center">{pct.toFixed(0)}% used</p></TableCell>
                  </TableRow>
                );
              })}
              {filteredBalances.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
