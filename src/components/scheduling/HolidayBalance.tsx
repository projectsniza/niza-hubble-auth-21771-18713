import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Calendar, Clock, Umbrella, RefreshCw, Search, TrendingUp, Loader2, Download, FileSpreadsheet
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
  employee_ref?: string;
  weekly_contracted_hours: number;
  contract_type: string;
  holiday_entitlement_days: number;
  total_worked_hours: number;
  total_sick_hours: number;
  total_adjustment_hours: number;
  total_worked_with_holiday: number;
  weeks_worked: number;
  hours_per_day: number;
  total_holiday_hours_per_year: number;
  holiday_hours_earned: number;
  holiday_hours_taken: number;
  holiday_hours_remaining: number;
  carry_forward: number;
  annum_per_hour: number;
  difference: number;
  monthly_data: MonthlyBreakdown[];
  notes: string;
}

// UK Fiscal Year months (April - March)
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MONTHS_FULL = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
const DEFAULT_WEEKLY_HOURS = 40;
const DEFAULT_HOLIDAY_DAYS = 28;
const WEEKS_PER_YEAR = 52;

export function HolidayBalance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025-04-01');
  const [viewMode, setViewMode] = useState<'ref' | 'monthly'>('ref');
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
    return `${format(yearStart, 'MMMM yyyy')} to ${format(yearEnd, 'MMMM yyyy')}`;
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
        .select('employee_id, weekly_contracted_hours, holiday_entitlement_days, contract_type')
        .is('effective_to', null);

      const { data: holidayBalances } = await supabase
        .from('holiday_balances')
        .select('employee_id, carry_forward_hours');

      const contractMap = new Map(contracts?.map(c => [c.employee_id, c]) || []);
      const carryForwardMap = new Map(holidayBalances?.map(h => [h.employee_id, h.carry_forward_hours || 0]) || []);

      const calculatedBalances: EmployeeBalance[] = employees.map((emp, index) => {
        const empTimesheets = timesheets?.filter(t => t.employee_id === emp.id) || [];
        const contract = contractMap.get(emp.id);
        const weeklyHours = contract?.weekly_contracted_hours || DEFAULT_WEEKLY_HOURS;
        const holidayDays = contract?.holiday_entitlement_days || DEFAULT_HOLIDAY_DAYS;
        const contractType = contract?.contract_type || (weeklyHours >= 35 ? 'Full-Time' : 'Part-Time');
        const carryForward = carryForwardMap.get(emp.id) || 0;
        
        const totalWorkedHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0);
        const totalHolidayTaken = empTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0);
        const totalSickHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0);
        const totalAdjustmentHours = empTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0);
        
        // Total worked hours WITH holiday (for SUMIF calculation)
        const totalWorkedWithHoliday = totalWorkedHours + totalHolidayTaken;
        
        const hoursPerDay = weeklyHours / 5;
        const totalHolidayHoursPerYear = holidayDays * hoursPerDay;
        
        // Weeks worked = Total hours / Weekly contracted hours
        const weeksWorked = weeklyHours > 0 ? totalWorkedWithHoliday / weeklyHours : 0;
        
        // Holiday earned = (Annual Holiday Hours / 52) × Weeks Worked
        const holidayEarned = (totalHolidayHoursPerYear / WEEKS_PER_YEAR) * weeksWorked;
        
        // Holiday remaining = Earned + Carry Forward - Taken
        const holidayRemaining = holidayEarned + carryForward - totalHolidayTaken;
        
        // Annum per hour rate (for payroll reference)
        const annumPerHour = totalHolidayHoursPerYear > 0 ? totalWorkedHours / totalHolidayHoursPerYear : 0;

        // Monthly breakdown
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
          employee_ref: `${index + 1}`,
          weekly_contracted_hours: weeklyHours,
          contract_type: contractType,
          holiday_entitlement_days: holidayDays,
          total_worked_hours: totalWorkedHours,
          total_sick_hours: totalSickHours,
          total_adjustment_hours: totalAdjustmentHours,
          total_worked_with_holiday: totalWorkedWithHoliday,
          weeks_worked: weeksWorked,
          hours_per_day: hoursPerDay,
          total_holiday_hours_per_year: totalHolidayHoursPerYear,
          holiday_hours_earned: holidayEarned,
          holiday_hours_taken: totalHolidayTaken,
          holiday_hours_remaining: holidayRemaining,
          carry_forward: carryForward,
          annum_per_hour: annumPerHour,
          difference: holidayRemaining,
          monthly_data: monthlyData,
          notes: ''
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

  // Filtering
  const filteredBalances = useMemo(() => balances.filter(b => {
    const emp = b.employee;
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterViewMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterViewMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  }), [balances, searchQuery, canViewFilters, filterViewMode, selectedOrg, selectedBranch]);

  // Group by branch (Location)
  const groupedByBranch = useMemo(() => filteredBalances.reduce((acc, balance) => {
    const branchName = balance.employee.branch?.name || 'Unassigned';
    if (!acc[branchName]) acc[branchName] = [];
    acc[branchName].push(balance);
    return acc;
  }, {} as Record<string, EmployeeBalance[]>), [filteredBalances]);

  // Summary totals
  const totals = useMemo(() => ({
    worked: filteredBalances.reduce((sum, b) => sum + b.total_worked_hours, 0),
    workedWithHoliday: filteredBalances.reduce((sum, b) => sum + b.total_worked_with_holiday, 0),
    earned: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_earned, 0),
    taken: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_taken, 0),
    remaining: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_remaining, 0),
    sick: filteredBalances.reduce((sum, b) => sum + b.total_sick_hours, 0),
    carryForward: filteredBalances.reduce((sum, b) => sum + b.carry_forward, 0),
  }), [filteredBalances]);

  const exportToCSV = () => {
    if (viewMode === 'ref') {
      // REF view export (simple summary)
      const headers = ['REF', 'Employee REF', 'EMPLOYEE NAME', 'SHOP NAME', 'TOTAL HOURS', 'HOLIDAY HOURS', 'ANNUM / PER HOUR', 'NOTES'];
      const rows: (string | number)[][] = [];
      let refNum = 1;
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        branchBalances.forEach((b, idx) => {
          rows.push([
            refNum++,
            idx + 1,
            `${b.employee.first_name} ${b.employee.last_name}`,
            branchName,
            b.total_worked_hours.toFixed(1),
            b.holiday_hours_taken.toFixed(1),
            b.annum_per_hour > 0 ? `£${(b.annum_per_hour * 10).toFixed(2)}` : '',
            b.notes
          ]);
        });
      });

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Holiday_Hours_REF_${format(parseISO(selectedYear), 'yyyy')}.csv`;
      a.click();
    } else {
      // Monthly view export (full breakdown)
      const headers = [
        'No', 'Staff Name', 'Location', 'Contract Type', 
        'Total Worked Hours With Holiday Hours', 'No of Weeks', 'Holiday Entitlement',
        ...MONTHS.map(m => m), 'Total', // Actual Working Hours
        ...MONTHS.map(m => m), 'Total', // Holiday Hours Taken
        'Holiday Hours Remaining'
      ];
      
      const rows: (string | number)[][] = [];
      let rowNum = 1;
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        rows.push([`📍 ${branchName}`, ...Array(headers.length - 1).fill('')]);
        
        branchBalances.forEach(b => {
          rows.push([
            rowNum++,
            `${b.employee.first_name} ${b.employee.last_name}`,
            branchName,
            b.contract_type,
            b.total_worked_with_holiday.toFixed(2),
            b.weeks_worked.toFixed(2),
            b.holiday_hours_earned.toFixed(2),
            ...b.monthly_data.map(m => m.actual > 0 ? m.actual.toFixed(1) : '-'),
            b.total_worked_hours.toFixed(1),
            ...b.monthly_data.map(m => m.holiday > 0 ? m.holiday.toFixed(1) : '-'),
            b.holiday_hours_taken.toFixed(1),
            b.holiday_hours_remaining.toFixed(2)
          ]);
        });
      });

      // Grand total row
      const grandMonthlyActual = MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].actual, 0));
      const grandMonthlyHoliday = MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].holiday, 0));
      
      rows.push([
        '', 'GRAND TOTAL', '', '',
        totals.workedWithHoliday.toFixed(2),
        '',
        totals.earned.toFixed(2),
        ...grandMonthlyActual.map(v => v.toFixed(1)),
        totals.worked.toFixed(1),
        ...grandMonthlyHoliday.map(v => v.toFixed(1)),
        totals.taken.toFixed(1),
        totals.remaining.toFixed(2)
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Holiday_Hours_Working_${format(parseISO(selectedYear), 'yyyy')}_Full.csv`;
      a.click();
    }
    toast.success('Exported to CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Staff Holiday Working
          </h2>
          <p className="text-muted-foreground">From {getFiscalYearLabel()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'ref' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="ref">REF Summary</TabsTrigger>
              <TabsTrigger value="monthly">Full Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
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
        <OrgBranchFilter 
          organizations={organizations} 
          branches={branches} 
          viewMode={filterViewMode}
          selectedOrg={selectedOrg} 
          selectedBranch={selectedBranch} 
          onViewModeChange={setFilterViewMode}
          onOrgChange={setSelectedOrg} 
          onBranchChange={setSelectedBranch} 
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
          <div className="text-center">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Worked</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totals.worked.toFixed(0)}h</p>
          </div>
        </Card>
        <Card className="p-4 bg-purple-50 dark:bg-purple-950/30">
          <div className="text-center">
            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">With Holiday</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totals.workedWithHoliday.toFixed(0)}h</p>
          </div>
        </Card>
        <Card className="p-4 bg-green-50 dark:bg-green-950/30">
          <div className="text-center">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Earned</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totals.earned.toFixed(1)}h</p>
          </div>
        </Card>
        <Card className="p-4 bg-orange-50 dark:bg-orange-950/30">
          <div className="text-center">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Taken</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{totals.taken.toFixed(1)}h</p>
          </div>
        </Card>
        <Card className="p-4 bg-teal-50 dark:bg-teal-950/30">
          <div className="text-center">
            <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">Remaining</p>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{totals.remaining.toFixed(1)}h</p>
          </div>
        </Card>
        <Card className="p-4 bg-red-50 dark:bg-red-950/30">
          <div className="text-center">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Sick</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{totals.sick.toFixed(0)}h</p>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'ref' ? (
        /* REF Summary View - Simple table like Excel Page 2 */
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">HOLIDAY HOURS REFERENCE - {format(new Date(), 'EEEE, MMMM d, yyyy')}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-yellow-100 dark:bg-yellow-900/30">
                    <TableHead className="font-bold text-center w-16">REF</TableHead>
                    <TableHead className="font-bold text-center w-20">Employee REF</TableHead>
                    <TableHead className="font-bold min-w-[200px]">EMPLOYEE NAME</TableHead>
                    <TableHead className="font-bold min-w-[150px]">SHOP NAME</TableHead>
                    <TableHead className="font-bold text-center">TOTAL HOURS</TableHead>
                    <TableHead className="font-bold text-center">HOLIDAY HOURS</TableHead>
                    <TableHead className="font-bold text-center">ANNUM / PER HOUR</TableHead>
                    <TableHead className="font-bold min-w-[150px]">NOTES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let globalRef = 1;
                    return Object.entries(groupedByBranch).map(([branchName, branchBalances]) => (
                      <React.Fragment key={branchName}>
                        <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                          <TableCell colSpan={8} className="font-bold text-primary py-2">
                            📍 {branchName} ({branchBalances.length} staff)
                          </TableCell>
                        </TableRow>
                        {branchBalances.map((b, idx) => {
                          const ref = globalRef++;
                          return (
                            <TableRow key={b.employee.id} className="hover:bg-muted/30">
                              <TableCell className="text-center font-medium">{ref}</TableCell>
                              <TableCell className="text-center">{idx + 1}</TableCell>
                              <TableCell className="font-medium">
                                {b.employee.first_name} {b.employee.last_name}
                              </TableCell>
                              <TableCell>{branchName}</TableCell>
                              <TableCell className="text-center font-bold">
                                {b.total_worked_hours > 0 ? b.total_worked_hours.toFixed(1) : '-'}
                              </TableCell>
                              <TableCell className="text-center font-bold text-orange-600">
                                {b.holiday_hours_taken > 0 ? b.holiday_hours_taken.toFixed(1) : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                {b.annum_per_hour > 0 ? `£${(b.weekly_contracted_hours * 52 * 12).toLocaleString()}.00` : ''}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{b.notes}</TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()}
                  {/* Grand Total */}
                  {filteredBalances.length > 0 && (
                    <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                      <TableCell colSpan={4} className="text-right text-lg">GRAND TOTAL:</TableCell>
                      <TableCell className="text-center text-lg">{totals.worked.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg text-orange-600">{totals.taken.toFixed(1)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      ) : (
        /* Full Monthly View - Complete breakdown like Excel Page 1 */
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">HOLIDAY HOURS WORKING - {getFiscalYearLabel().toUpperCase()}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[2400px]">
              <Table className="text-[10px]">
                <TableHeader>
                  {/* Header Row 1 - Category Headers */}
                  <TableRow className="bg-muted/70 border-b-2">
                    <TableHead className="sticky left-0 bg-muted/70 z-20 w-10 text-center" rowSpan={2}>No</TableHead>
                    <TableHead className="sticky left-10 bg-muted/70 z-20 min-w-[130px]" rowSpan={2}>Staff Name</TableHead>
                    <TableHead className="bg-muted/70 min-w-[100px]" rowSpan={2}>Location</TableHead>
                    <TableHead className="text-center bg-muted/70" rowSpan={2}>Contract Type</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900" rowSpan={2}>Total Worked Hours With Holiday Hours</TableHead>
                    <TableHead className="text-center bg-muted/70" rowSpan={2}>No of Weeks</TableHead>
                    <TableHead className="text-center bg-yellow-100 dark:bg-yellow-900" rowSpan={2}>Holiday Entitlement</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-blue-100 dark:bg-blue-900 font-bold border-x">Actual Working Hours</TableHead>
                    <TableHead className="text-center bg-blue-200 dark:bg-blue-800 font-bold" rowSpan={2}>Total</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-orange-100 dark:bg-orange-900 font-bold border-x">Holiday Hours Taken</TableHead>
                    <TableHead className="text-center bg-orange-200 dark:bg-orange-800 font-bold" rowSpan={2}>Total</TableHead>
                    <TableHead className="text-center bg-green-200 dark:bg-green-800 font-bold" rowSpan={2}>Holiday Hours Remaining</TableHead>
                  </TableRow>
                  {/* Header Row 2 - Month Headers */}
                  <TableRow className="bg-muted/50">
                    {MONTHS.map(m => <TableHead key={`a-${m}`} className="text-center bg-blue-50 dark:bg-blue-950 font-semibold w-14">{m}</TableHead>)}
                    {MONTHS.map(m => <TableHead key={`h-${m}`} className="text-center bg-orange-50 dark:bg-orange-950 font-semibold w-14">{m}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => {
                    // Calculate branch SUMIF totals
                    const branchTotals = {
                      workedWithHoliday: 0, weeks: 0, entitlement: 0, worked: 0, taken: 0, remaining: 0,
                      monthlyActual: MONTHS.map(() => 0),
                      monthlyHoliday: MONTHS.map(() => 0)
                    };
                    
                    branchBalances.forEach(b => {
                      branchTotals.workedWithHoliday += b.total_worked_with_holiday;
                      branchTotals.weeks += b.weeks_worked;
                      branchTotals.entitlement += b.holiday_hours_earned;
                      branchTotals.worked += b.total_worked_hours;
                      branchTotals.taken += b.holiday_hours_taken;
                      branchTotals.remaining += b.holiday_hours_remaining;
                      b.monthly_data.forEach((m, idx) => {
                        branchTotals.monthlyActual[idx] += m.actual;
                        branchTotals.monthlyHoliday[idx] += m.holiday;
                      });
                    });

                    return (
                      <React.Fragment key={branchName}>
                        <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                          <TableCell colSpan={7 + MONTHS.length * 2 + 3} className="font-bold text-primary py-2">
                            📍 {branchName} ({branchBalances.length} staff)
                          </TableCell>
                        </TableRow>
                        {branchBalances.map((b, idx) => (
                          <TableRow key={b.employee.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10 text-center">{idx + 1}</TableCell>
                            <TableCell className="sticky left-10 bg-background z-10 font-medium">
                              {b.employee.first_name} {b.employee.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{branchName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[9px] px-1">
                                {b.contract_type === 'Full-Time' ? 'FT' : 'PT'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center bg-purple-50/50 dark:bg-purple-950/30 font-bold">
                              {b.total_worked_with_holiday.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">{b.weeks_worked.toFixed(2)}</TableCell>
                            <TableCell className="text-center bg-yellow-50/50 dark:bg-yellow-950/30 font-bold">
                              {b.holiday_hours_earned.toFixed(2)}
                            </TableCell>
                            {b.monthly_data.map(m => (
                              <TableCell key={`a-${m.month}`} className="text-center bg-blue-50/30 dark:bg-blue-950/30">
                                {m.actual > 0 ? m.actual.toFixed(1) : '-'}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-blue-100/70 dark:bg-blue-900/70">
                              {b.total_worked_hours.toFixed(1)}
                            </TableCell>
                            {b.monthly_data.map(m => (
                              <TableCell key={`h-${m.month}`} className="text-center bg-orange-50/30 dark:bg-orange-950/30">
                                {m.holiday > 0 ? m.holiday.toFixed(1) : '-'}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-orange-100/70 dark:bg-orange-900/70 text-orange-700">
                              {b.holiday_hours_taken.toFixed(1)}
                            </TableCell>
                            <TableCell className={`text-center font-bold ${b.holiday_hours_remaining >= 0 ? 'bg-green-100/70 dark:bg-green-900/70 text-green-700' : 'bg-red-100/70 dark:bg-red-900/70 text-red-700'}`}>
                              {b.holiday_hours_remaining.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Branch SUMIF Subtotal */}
                        <TableRow className="bg-muted/60 border-b-2 font-bold">
                          <TableCell></TableCell>
                          <TableCell className="sticky left-10 bg-muted/60 z-10 text-primary text-[11px]">
                            SUBTOTAL - {branchName}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center bg-purple-100 dark:bg-purple-800">
                            {branchTotals.workedWithHoliday.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">{branchTotals.weeks.toFixed(2)}</TableCell>
                          <TableCell className="text-center bg-yellow-100 dark:bg-yellow-800">
                            {branchTotals.entitlement.toFixed(2)}
                          </TableCell>
                          {branchTotals.monthlyActual.map((v, i) => (
                            <TableCell key={i} className="text-center bg-blue-100 dark:bg-blue-800">
                              {v > 0 ? v.toFixed(1) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-center bg-blue-200 dark:bg-blue-700">
                            {branchTotals.worked.toFixed(1)}
                          </TableCell>
                          {branchTotals.monthlyHoliday.map((v, i) => (
                            <TableCell key={i} className="text-center bg-orange-100 dark:bg-orange-800">
                              {v > 0 ? v.toFixed(1) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-center bg-orange-200 dark:bg-orange-700 text-orange-700">
                            {branchTotals.taken.toFixed(1)}
                          </TableCell>
                          <TableCell className={`text-center ${branchTotals.remaining >= 0 ? 'bg-green-200 dark:bg-green-700 text-green-700' : 'bg-red-200 dark:bg-red-700 text-red-700'}`}>
                            {branchTotals.remaining.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total */}
                  {filteredBalances.length > 0 && (() => {
                    const grandMonthlyActual = MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].actual, 0));
                    const grandMonthlyHoliday = MONTHS.map((_, idx) => filteredBalances.reduce((sum, b) => sum + b.monthly_data[idx].holiday, 0));
                    const grandWeeks = filteredBalances.reduce((sum, b) => sum + b.weeks_worked, 0);
                    
                    return (
                      <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                        <TableCell></TableCell>
                        <TableCell className="sticky left-10 bg-primary/20 z-10 text-sm">GRAND TOTAL</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-center text-sm bg-purple-200 dark:bg-purple-700">
                          {totals.workedWithHoliday.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">{grandWeeks.toFixed(2)}</TableCell>
                        <TableCell className="text-center text-sm bg-yellow-200 dark:bg-yellow-700">
                          {totals.earned.toFixed(2)}
                        </TableCell>
                        {grandMonthlyActual.map((v, i) => (
                          <TableCell key={i} className="text-center bg-blue-200 dark:bg-blue-700">
                            {v > 0 ? v.toFixed(1) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center text-sm bg-blue-300 dark:bg-blue-600">
                          {totals.worked.toFixed(1)}
                        </TableCell>
                        {grandMonthlyHoliday.map((v, i) => (
                          <TableCell key={i} className="text-center bg-orange-200 dark:bg-orange-700">
                            {v > 0 ? v.toFixed(1) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center text-sm bg-orange-300 dark:bg-orange-600">
                          {totals.taken.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-center text-sm ${totals.remaining >= 0 ? 'bg-green-300 dark:bg-green-600' : 'bg-red-300 dark:bg-red-600'}`}>
                          {totals.remaining.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })()}
                  {filteredBalances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7 + MONTHS.length * 2 + 3} className="text-center py-8 text-muted-foreground">
                        No employees found
                      </TableCell>
                    </TableRow>
                  )}
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
