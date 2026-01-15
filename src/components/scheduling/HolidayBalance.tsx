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
  adj: number;
}

interface EmployeeBalance {
  employee: Employee;
  weekly_contracted_hours: number;
  holiday_entitlement_days: number;
  total_worked_hours: number;
  total_sick_hours: number;
  total_adjustment_hours: number;
  weeks_worked: number;
  hours_per_day: number;
  total_holiday_hours_per_year: number;
  holiday_hours_earned: number;
  holiday_hours_taken: number;
  holiday_hours_remaining: number;
  carry_forward: number;
  bank_holiday_hours: number;
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

  // Get fiscal year label
  const getFiscalYearLabel = () => {
    const yearStart = parseISO(selectedYear);
    const yearEnd = addMonths(yearStart, 11);
    return `${format(yearStart, 'MMM yyyy')} - ${format(yearEnd, 'MMM yyyy')}`;
  };

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
        .select('employee_id, total_worked_hours, total_holiday_hours, total_sick_hours, total_adjustment_hours, week_start_date')
        .gte('week_start_date', format(yearStart, 'yyyy-MM-dd'))
        .lt('week_start_date', format(yearEnd, 'yyyy-MM-dd'));

      if (tsError) throw tsError;

      const { data: contracts } = await supabase
        .from('employee_contracts')
        .select('employee_id, weekly_contracted_hours, holiday_entitlement_days')
        .is('effective_to', null);

      const { data: holidayBalances } = await supabase
        .from('holiday_balances')
        .select('employee_id, carry_forward_hours');

      const contractMap = new Map(contracts?.map(c => [c.employee_id, c]) || []);
      const carryForwardMap = new Map(holidayBalances?.map(h => [h.employee_id, h.carry_forward_hours || 0]) || []);

      const calculatedBalances: EmployeeBalance[] = employees.map(emp => {
        const empTimesheets = timesheets?.filter(t => t.employee_id === emp.id) || [];
        const contract = contractMap.get(emp.id);
        const weeklyHours = contract?.weekly_contracted_hours || DEFAULT_WEEKLY_HOURS;
        const holidayDays = contract?.holiday_entitlement_days || DEFAULT_HOLIDAY_DAYS;
        const carryForward = carryForwardMap.get(emp.id) || 0;
        
        const totalWorkedHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0);
        const totalHolidayTaken = empTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0);
        const totalSickHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0);
        const totalAdjustmentHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0);
        
        // Bank holiday hours (8 hours per UK bank holiday, typically 8 days = 64 hours)
        const bankHolidayHours = 0; // Will be calculated if bank_holiday entries exist
        
        const hoursPerDay = weeklyHours / 5;
        const totalHolidayHoursPerYear = holidayDays * hoursPerDay;
        const totalHoursForAccrual = totalWorkedHours + totalHolidayTaken + totalSickHours;
        const weeksWorked = weeklyHours > 0 ? totalHoursForAccrual / weeklyHours : 0;
        const holidayEarned = (totalHolidayHoursPerYear / 52) * weeksWorked;
        const holidayRemaining = holidayEarned + carryForward - totalHolidayTaken;

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
            sick: monthTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0),
            adj: monthTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0)
          };
        });

        return {
          employee: emp as Employee,
          weekly_contracted_hours: weeklyHours,
          holiday_entitlement_days: holidayDays,
          total_worked_hours: totalWorkedHours,
          total_sick_hours: totalSickHours,
          total_adjustment_hours: totalAdjustmentHours,
          weeks_worked: weeksWorked,
          hours_per_day: hoursPerDay,
          total_holiday_hours_per_year: totalHolidayHoursPerYear,
          holiday_hours_earned: holidayEarned,
          holiday_hours_taken: totalHolidayTaken,
          holiday_hours_remaining: holidayRemaining,
          carry_forward: carryForward,
          bank_holiday_hours: bankHolidayHours,
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

  // Calculate totals per column
  const totalEarned = filteredBalances.reduce((sum, b) => sum + b.holiday_hours_earned, 0);
  const totalTaken = filteredBalances.reduce((sum, b) => sum + b.holiday_hours_taken, 0);
  const totalRemaining = filteredBalances.reduce((sum, b) => sum + b.holiday_hours_remaining, 0);
  const totalWorked = filteredBalances.reduce((sum, b) => sum + b.total_worked_hours, 0);
  const totalSick = filteredBalances.reduce((sum, b) => sum + b.total_sick_hours, 0);
  const totalCarryForward = filteredBalances.reduce((sum, b) => sum + b.carry_forward, 0);

  const getBalanceStatus = (remaining: number, earned: number) => {
    if (earned === 0) return 'neutral';
    const percentage = (remaining / earned) * 100;
    if (percentage >= 50) return 'good';
    if (percentage >= 20) return 'warning';
    return 'critical';
  };

  const exportToCSV = () => {
    if (viewMode === 'monthly') {
      // Monthly export with SUMIF columns
      const headers = ['No', 'Staff Name', 'Location', 'Type', 'W.Hrs', 'H.Ent', 'C/F',
        ...MONTHS.map(m => `Act-${m}`), 'TTL Worked', 'Weeks',
        ...MONTHS.map(m => `Hol-${m}`), 'TTL Taken',
        ...MONTHS.map(m => `Sick-${m}`), 'TTL Sick',
        'Earned', 'Diff'];
      
      const rows: (string | number)[][] = [];
      let rowNum = 1;
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        rows.push([`📍 ${branchName}`, '', '', '', '', '', '', ...Array(MONTHS.length * 3 + 6).fill('')]);
        
        const branchTotals = {
          worked: 0, taken: 0, sick: 0, earned: 0, diff: 0,
          monthlyActual: MONTHS.map(() => 0),
          monthlyHoliday: MONTHS.map(() => 0),
          monthlySick: MONTHS.map(() => 0)
        };
        
        branchBalances.forEach(b => {
          branchTotals.worked += b.total_worked_hours;
          branchTotals.taken += b.holiday_hours_taken;
          branchTotals.sick += b.total_sick_hours;
          branchTotals.earned += b.holiday_hours_earned;
          branchTotals.diff += b.difference;
          b.monthly_data.forEach((m, idx) => {
            branchTotals.monthlyActual[idx] += m.actual;
            branchTotals.monthlyHoliday[idx] += m.holiday;
            branchTotals.monthlySick[idx] += m.sick;
          });
          
          rows.push([
            rowNum++, `${b.employee.first_name} ${b.employee.last_name}`, branchName,
            b.weekly_contracted_hours >= 35 ? 'FT' : 'PT', b.weekly_contracted_hours, b.holiday_entitlement_days, b.carry_forward.toFixed(1),
            ...b.monthly_data.map(m => m.actual > 0 ? m.actual.toFixed(1) : '-'),
            b.total_worked_hours.toFixed(1), b.weeks_worked.toFixed(2),
            ...b.monthly_data.map(m => m.holiday > 0 ? m.holiday.toFixed(1) : '-'),
            b.holiday_hours_taken.toFixed(1),
            ...b.monthly_data.map(m => m.sick > 0 ? m.sick.toFixed(1) : '-'),
            b.total_sick_hours.toFixed(1),
            b.holiday_hours_earned.toFixed(2), b.difference.toFixed(2)
          ]);
        });
        
        // Branch subtotal
        rows.push([
          '', `SUBTOTAL - ${branchName}`, '', '', '', '', '',
          ...branchTotals.monthlyActual.map(v => v.toFixed(1)),
          branchTotals.worked.toFixed(1), '',
          ...branchTotals.monthlyHoliday.map(v => v.toFixed(1)),
          branchTotals.taken.toFixed(1),
          ...branchTotals.monthlySick.map(v => v.toFixed(1)),
          branchTotals.sick.toFixed(1),
          branchTotals.earned.toFixed(2), branchTotals.diff.toFixed(2)
        ]);
      });
      
      // Grand total
      const grandTotals = {
        monthlyActual: MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].actual, 0)),
        monthlyHoliday: MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].holiday, 0)),
        monthlySick: MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].sick, 0))
      };
      rows.push([
        '', 'GRAND TOTAL', '', '', '', '', '',
        ...grandTotals.monthlyActual.map(v => v.toFixed(1)),
        totalWorked.toFixed(1), '',
        ...grandTotals.monthlyHoliday.map(v => v.toFixed(1)),
        totalTaken.toFixed(1),
        ...grandTotals.monthlySick.map(v => v.toFixed(1)),
        totalSick.toFixed(1),
        totalEarned.toFixed(2), totalRemaining.toFixed(2)
      ]);
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Holiday_Hours_Working_${format(parseISO(selectedYear), 'yyyy')}_Monthly.csv`;
      a.click();
    } else {
      // Summary export
      const headers = ['No', 'Staff Name', 'Location', 'Contract', 'Weekly Hrs', 'Entitlement', 'C/F', 'Worked Hrs', 'Sick Hrs', 'Weeks', 'Earned', 'Taken', 'Remaining'];
      const rows: (string | number)[][] = [];
      let rowNum = 1;
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        rows.push([`📍 ${branchName}`, '', '', '', '', '', '', '', '', '', '', '', '']);
        branchBalances.forEach(b => {
          rows.push([
            rowNum++, `${b.employee.first_name} ${b.employee.last_name}`, branchName,
            b.weekly_contracted_hours >= 35 ? 'FT' : 'PT', b.weekly_contracted_hours, b.holiday_entitlement_days, b.carry_forward.toFixed(1),
            b.total_worked_hours.toFixed(1), b.total_sick_hours.toFixed(1), b.weeks_worked.toFixed(2),
            b.holiday_hours_earned.toFixed(2), b.holiday_hours_taken.toFixed(1), b.holiday_hours_remaining.toFixed(2)
          ]);
        });
      });
      
      rows.push(['', 'GRAND TOTAL', '', '', '', '', totalCarryForward.toFixed(1), totalWorked.toFixed(1), totalSick.toFixed(1), '', totalEarned.toFixed(2), totalTaken.toFixed(1), totalRemaining.toFixed(2)]);
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Holiday_Hours_${format(parseISO(selectedYear), 'yyyy')}_Summary.csv`;
      a.click();
    }
    toast.success('Exported to CSV');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Holiday Hours Working - {getFiscalYearLabel()}</h2>
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Total Worked</p><p className="text-2xl font-bold">{totalWorked.toFixed(0)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Earned</p><p className="text-2xl font-bold">{totalEarned.toFixed(1)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center"><Umbrella className="h-5 w-5 text-orange-600" /></div><div><p className="text-sm text-muted-foreground">Taken</p><p className="text-2xl font-bold">{totalTaken.toFixed(1)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center"><Calendar className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Remaining</p><p className="text-2xl font-bold">{totalRemaining.toFixed(1)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><Clock className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Total Sick</p><p className="text-2xl font-bold">{totalSick.toFixed(0)}h</p></div></div></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : viewMode === 'monthly' ? (
        <Card>
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-bold text-sm">HOLIDAY HOURS WORKING - {getFiscalYearLabel()} (UK Fiscal Year)</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[2200px]">
              <Table className="text-[10px]">
                <TableHeader>
                  {/* Header Row 1 - Category Headers */}
                  <TableRow className="bg-muted/70 border-b-2">
                    <TableHead className="sticky left-0 bg-muted/70 z-20 w-8" rowSpan={2}>No</TableHead>
                    <TableHead className="sticky left-8 bg-muted/70 z-20 min-w-[130px]" rowSpan={2}>Staff Name</TableHead>
                    <TableHead className="bg-muted/70" rowSpan={2}>Location</TableHead>
                    <TableHead className="text-center bg-muted/70" rowSpan={2}>Type</TableHead>
                    <TableHead className="text-center bg-muted/70" rowSpan={2}>W.Hrs</TableHead>
                    <TableHead className="text-center bg-muted/70" rowSpan={2}>H.Ent</TableHead>
                    <TableHead className="text-center bg-yellow-100 dark:bg-yellow-900" rowSpan={2}>C/F</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-blue-100 dark:bg-blue-900 font-bold border-x">ACTUAL HOURS WORKED</TableHead>
                    <TableHead className="text-center bg-blue-200 dark:bg-blue-800 font-bold" rowSpan={2}>TTL</TableHead>
                    <TableHead className="text-center bg-blue-200 dark:bg-blue-800 font-bold" rowSpan={2}>Wks</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-orange-100 dark:bg-orange-900 font-bold border-x">HOLIDAY HOURS TAKEN</TableHead>
                    <TableHead className="text-center bg-orange-200 dark:bg-orange-800 font-bold" rowSpan={2}>TTL</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-red-100 dark:bg-red-900 font-bold border-x">SICK HOURS</TableHead>
                    <TableHead className="text-center bg-red-200 dark:bg-red-800 font-bold" rowSpan={2}>TTL</TableHead>
                    <TableHead className="text-center bg-green-200 dark:bg-green-800 font-bold" rowSpan={2}>Earned</TableHead>
                    <TableHead className="text-center bg-purple-200 dark:bg-purple-800 font-bold" rowSpan={2}>Diff</TableHead>
                  </TableRow>
                  {/* Header Row 2 - Month Headers */}
                  <TableRow className="bg-muted/50">
                    {MONTHS.map(m => <TableHead key={`a-${m}`} className="text-center bg-blue-50 dark:bg-blue-950 font-semibold w-11">{m}</TableHead>)}
                    {MONTHS.map(m => <TableHead key={`h-${m}`} className="text-center bg-orange-50 dark:bg-orange-950 font-semibold w-11">{m}</TableHead>)}
                    {MONTHS.map(m => <TableHead key={`s-${m}`} className="text-center bg-red-50 dark:bg-red-950 font-semibold w-11">{m}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => {
                    // Calculate branch SUMIF totals
                    const branchTotals = {
                      worked: 0, taken: 0, sick: 0, earned: 0, diff: 0, weeks: 0, carryForward: 0,
                      monthlyActual: MONTHS.map(() => 0),
                      monthlyHoliday: MONTHS.map(() => 0),
                      monthlySick: MONTHS.map(() => 0)
                    };
                    branchBalances.forEach(b => {
                      branchTotals.worked += b.total_worked_hours;
                      branchTotals.taken += b.holiday_hours_taken;
                      branchTotals.sick += b.total_sick_hours;
                      branchTotals.earned += b.holiday_hours_earned;
                      branchTotals.diff += b.difference;
                      branchTotals.weeks += b.weeks_worked;
                      branchTotals.carryForward += b.carry_forward;
                      b.monthly_data.forEach((m, idx) => {
                        branchTotals.monthlyActual[idx] += m.actual;
                        branchTotals.monthlyHoliday[idx] += m.holiday;
                        branchTotals.monthlySick[idx] += m.sick;
                      });
                    });

                    return (
                      <React.Fragment key={branchName}>
                        <TableRow className="bg-primary/10 border-t-2 border-primary/20">
                          <TableCell colSpan={7 + MONTHS.length * 3 + 6} className="font-bold text-primary py-2">📍 {branchName} ({branchBalances.length} staff)</TableCell>
                        </TableRow>
                        {branchBalances.map((b, idx) => (
                          <TableRow key={b.employee.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10 text-center">{idx + 1}</TableCell>
                            <TableCell className="sticky left-8 bg-background z-10 font-medium">{b.employee.first_name} {b.employee.last_name}</TableCell>
                            <TableCell className="text-muted-foreground">{branchName}</TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-[9px] px-1">{b.weekly_contracted_hours >= 35 ? 'FT' : 'PT'}</Badge></TableCell>
                            <TableCell className="text-center">{b.weekly_contracted_hours}</TableCell>
                            <TableCell className="text-center">{b.holiday_entitlement_days}</TableCell>
                            <TableCell className="text-center bg-yellow-50/50 dark:bg-yellow-950/50">{b.carry_forward > 0 ? b.carry_forward.toFixed(1) : '-'}</TableCell>
                            {b.monthly_data.map(m => <TableCell key={`a-${m.month}`} className="text-center bg-blue-50/30 dark:bg-blue-950/30">{m.actual > 0 ? m.actual.toFixed(1) : '-'}</TableCell>)}
                            <TableCell className="text-center font-bold bg-blue-100/70 dark:bg-blue-900/70">{b.total_worked_hours.toFixed(1)}</TableCell>
                            <TableCell className="text-center bg-blue-100/70 dark:bg-blue-900/70">{b.weeks_worked.toFixed(2)}</TableCell>
                            {b.monthly_data.map(m => <TableCell key={`h-${m.month}`} className="text-center bg-orange-50/30 dark:bg-orange-950/30">{m.holiday > 0 ? m.holiday.toFixed(1) : '-'}</TableCell>)}
                            <TableCell className="text-center font-bold bg-orange-100/70 dark:bg-orange-900/70 text-orange-700">{b.holiday_hours_taken.toFixed(1)}</TableCell>
                            {b.monthly_data.map(m => <TableCell key={`s-${m.month}`} className="text-center bg-red-50/30 dark:bg-red-950/30">{m.sick > 0 ? m.sick.toFixed(1) : '-'}</TableCell>)}
                            <TableCell className="text-center font-bold bg-red-100/70 dark:bg-red-900/70 text-red-700">{b.total_sick_hours.toFixed(1)}</TableCell>
                            <TableCell className="text-center font-bold bg-green-100/70 dark:bg-green-900/70 text-green-700">{b.holiday_hours_earned.toFixed(2)}</TableCell>
                            <TableCell className={`text-center font-bold ${b.difference >= 0 ? 'bg-green-100/70 dark:bg-green-900/70 text-green-700' : 'bg-red-100/70 dark:bg-red-900/70 text-red-700'}`}>{b.difference.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Branch SUMIF Subtotal Row */}
                        <TableRow className="bg-muted/60 border-b-2 border-primary/20 font-bold">
                          <TableCell></TableCell>
                          <TableCell className="sticky left-8 bg-muted/60 z-10 text-primary text-[11px]">SUBTOTAL - {branchName}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center bg-yellow-100 dark:bg-yellow-900">{branchTotals.carryForward.toFixed(1)}</TableCell>
                          {branchTotals.monthlyActual.map((v, i) => <TableCell key={i} className="text-center bg-blue-100 dark:bg-blue-900">{v > 0 ? v.toFixed(1) : '-'}</TableCell>)}
                          <TableCell className="text-center bg-blue-200 dark:bg-blue-800">{branchTotals.worked.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-blue-200 dark:bg-blue-800">{branchTotals.weeks.toFixed(2)}</TableCell>
                          {branchTotals.monthlyHoliday.map((v, i) => <TableCell key={i} className="text-center bg-orange-100 dark:bg-orange-900">{v > 0 ? v.toFixed(1) : '-'}</TableCell>)}
                          <TableCell className="text-center bg-orange-200 dark:bg-orange-800 text-orange-700">{branchTotals.taken.toFixed(1)}</TableCell>
                          {branchTotals.monthlySick.map((v, i) => <TableCell key={i} className="text-center bg-red-100 dark:bg-red-900">{v > 0 ? v.toFixed(1) : '-'}</TableCell>)}
                          <TableCell className="text-center bg-red-200 dark:bg-red-800 text-red-700">{branchTotals.sick.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-green-200 dark:bg-green-800 text-green-700">{branchTotals.earned.toFixed(2)}</TableCell>
                          <TableCell className={`text-center ${branchTotals.diff >= 0 ? 'bg-green-200 dark:bg-green-800 text-green-700' : 'bg-red-200 dark:bg-red-800 text-red-700'}`}>{branchTotals.diff.toFixed(2)}</TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total Row */}
                  {filteredBalances.length > 0 && (() => {
                    const grandTotals = {
                      monthlyActual: MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].actual, 0)),
                      monthlyHoliday: MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].holiday, 0)),
                      monthlySick: MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].sick, 0)),
                      weeks: filteredBalances.reduce((sum, b) => sum + b.weeks_worked, 0)
                    };
                    return (
                      <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                        <TableCell></TableCell>
                        <TableCell className="sticky left-8 bg-primary/20 z-10 text-sm">GRAND TOTAL</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center bg-yellow-200 dark:bg-yellow-800">{totalCarryForward.toFixed(1)}</TableCell>
                        {grandTotals.monthlyActual.map((v, i) => <TableCell key={i} className="text-center bg-blue-200 dark:bg-blue-800">{v > 0 ? v.toFixed(1) : '-'}</TableCell>)}
                        <TableCell className="text-center text-sm bg-blue-300 dark:bg-blue-700">{totalWorked.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-blue-300 dark:bg-blue-700">{grandTotals.weeks.toFixed(2)}</TableCell>
                        {grandTotals.monthlyHoliday.map((v, i) => <TableCell key={i} className="text-center bg-orange-200 dark:bg-orange-800">{v > 0 ? v.toFixed(1) : '-'}</TableCell>)}
                        <TableCell className="text-center text-sm bg-orange-300 dark:bg-orange-700">{totalTaken.toFixed(1)}</TableCell>
                        {grandTotals.monthlySick.map((v, i) => <TableCell key={i} className="text-center bg-red-200 dark:bg-red-800">{v > 0 ? v.toFixed(1) : '-'}</TableCell>)}
                        <TableCell className="text-center text-sm bg-red-300 dark:bg-red-700">{totalSick.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-sm bg-green-300 dark:bg-green-700">{totalEarned.toFixed(2)}</TableCell>
                        <TableCell className={`text-center text-sm ${totalRemaining >= 0 ? 'bg-green-300 dark:bg-green-700' : 'bg-red-300 dark:bg-red-700'}`}>{totalRemaining.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })()}
                  {filteredBalances.length === 0 && <TableRow><TableCell colSpan={7 + MONTHS.length * 3 + 6} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      ) : (
        <Card>
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-bold text-sm">HOLIDAY ENTITLEMENT SUMMARY - {getFiscalYearLabel()}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1100px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 w-8 font-bold">No</TableHead>
                    <TableHead className="sticky left-8 bg-muted/50 z-10 min-w-[140px] font-bold">Staff Name</TableHead>
                    <TableHead className="font-bold">Location</TableHead>
                    <TableHead className="text-center font-bold">Contract</TableHead>
                    <TableHead className="text-center font-bold">W.Hrs</TableHead>
                    <TableHead className="text-center font-bold">H.Ent</TableHead>
                    <TableHead className="text-center bg-yellow-100 dark:bg-yellow-900 font-bold">C/F</TableHead>
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900 font-bold">Worked</TableHead>
                    <TableHead className="text-center bg-red-100 dark:bg-red-900 font-bold">Sick</TableHead>
                    <TableHead className="text-center font-bold">Weeks</TableHead>
                    <TableHead className="text-center bg-green-100 dark:bg-green-900 font-bold">Earned</TableHead>
                    <TableHead className="text-center bg-orange-100 dark:bg-orange-900 font-bold">Taken</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900 font-bold">Remaining</TableHead>
                    <TableHead className="text-center font-bold">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => {
                    const branchTotals = {
                      worked: branchBalances.reduce((s, b) => s + b.total_worked_hours, 0),
                      sick: branchBalances.reduce((s, b) => s + b.total_sick_hours, 0),
                      earned: branchBalances.reduce((s, b) => s + b.holiday_hours_earned, 0),
                      taken: branchBalances.reduce((s, b) => s + b.holiday_hours_taken, 0),
                      remaining: branchBalances.reduce((s, b) => s + b.holiday_hours_remaining, 0),
                      carryForward: branchBalances.reduce((s, b) => s + b.carry_forward, 0)
                    };
                    
                    return (
                      <React.Fragment key={branchName}>
                        <TableRow className="bg-primary/10 border-t-2 border-primary/20">
                          <TableCell colSpan={14} className="font-bold text-primary py-2">📍 {branchName} ({branchBalances.length} staff)</TableCell>
                        </TableRow>
                        {branchBalances.map((b, idx) => {
                          const status = getBalanceStatus(b.holiday_hours_remaining, b.holiday_hours_earned);
                          const pct = b.holiday_hours_earned > 0 ? (b.holiday_hours_taken / b.holiday_hours_earned) * 100 : 0;
                          return (
                            <TableRow key={b.employee.id} className="hover:bg-muted/30">
                              <TableCell className="sticky left-0 bg-background z-10 text-center">{idx + 1}</TableCell>
                              <TableCell className="sticky left-8 bg-background z-10 font-medium">{b.employee.first_name} {b.employee.last_name}</TableCell>
                              <TableCell className="text-muted-foreground">{b.employee.branch?.name || '-'}</TableCell>
                              <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{b.weekly_contracted_hours >= 35 ? 'FT' : 'PT'}</Badge></TableCell>
                              <TableCell className="text-center">{b.weekly_contracted_hours}</TableCell>
                              <TableCell className="text-center">{b.holiday_entitlement_days}</TableCell>
                              <TableCell className="text-center bg-yellow-50/50 dark:bg-yellow-950/50">{b.carry_forward > 0 ? b.carry_forward.toFixed(1) : '-'}</TableCell>
                              <TableCell className="text-center font-medium bg-blue-50/50 dark:bg-blue-950/50">{b.total_worked_hours.toFixed(1)}</TableCell>
                              <TableCell className="text-center font-medium text-red-600 bg-red-50/50 dark:bg-red-950/50">{b.total_sick_hours.toFixed(1)}</TableCell>
                              <TableCell className="text-center">{b.weeks_worked.toFixed(1)}</TableCell>
                              <TableCell className="text-center font-bold text-green-600 bg-green-50/50 dark:bg-green-950/50">{b.holiday_hours_earned.toFixed(1)}</TableCell>
                              <TableCell className="text-center font-bold text-orange-600 bg-orange-50/50 dark:bg-orange-950/50">{b.holiday_hours_taken.toFixed(1)}</TableCell>
                              <TableCell className="text-center"><span className={`font-bold ${status === 'good' ? 'text-green-600' : status === 'warning' ? 'text-yellow-600' : status === 'critical' ? 'text-red-600' : ''}`}>{b.holiday_hours_remaining.toFixed(1)}</span></TableCell>
                              <TableCell className="min-w-[100px]"><Progress value={Math.min(pct, 100)} className="h-2" /><p className="text-[9px] text-muted-foreground text-center mt-1">{pct.toFixed(0)}%</p></TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Branch Subtotal */}
                        <TableRow className="bg-muted/50 border-b-2 border-primary/20 font-bold">
                          <TableCell></TableCell>
                          <TableCell className="sticky left-8 bg-muted/50 z-10 text-primary">SUBTOTAL - {branchName}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center bg-yellow-100 dark:bg-yellow-900">{branchTotals.carryForward.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-blue-100 dark:bg-blue-900">{branchTotals.worked.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-red-100 dark:bg-red-900 text-red-700">{branchTotals.sick.toFixed(1)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center bg-green-100 dark:bg-green-900 text-green-700">{branchTotals.earned.toFixed(2)}</TableCell>
                          <TableCell className="text-center bg-orange-100 dark:bg-orange-900 text-orange-700">{branchTotals.taken.toFixed(1)}</TableCell>
                          <TableCell className={`text-center ${branchTotals.remaining >= 0 ? 'bg-green-100 dark:bg-green-900 text-green-700' : 'bg-red-100 dark:bg-red-900 text-red-700'}`}>{branchTotals.remaining.toFixed(2)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total */}
                  {filteredBalances.length > 0 && (
                    <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                      <TableCell></TableCell>
                      <TableCell className="sticky left-8 bg-primary/20 z-10 text-lg">GRAND TOTAL</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-lg bg-yellow-200 dark:bg-yellow-800">{totalCarryForward.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-blue-200 dark:bg-blue-800">{totalWorked.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-red-200 dark:bg-red-800">{totalSick.toFixed(1)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-lg bg-green-200 dark:bg-green-800">{totalEarned.toFixed(2)}</TableCell>
                      <TableCell className="text-center text-lg bg-orange-200 dark:bg-orange-800">{totalTaken.toFixed(1)}</TableCell>
                      <TableCell className={`text-center text-lg ${totalRemaining >= 0 ? 'bg-green-200 dark:bg-green-800' : 'bg-red-200 dark:bg-red-800'}`}>{totalRemaining.toFixed(2)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                  {filteredBalances.length === 0 && <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
