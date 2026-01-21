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
  Calendar, RefreshCw, Search, Loader2, Download, FileSpreadsheet
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
}

interface EmployeeBalance {
  employee: Employee;
  globalRef: number;
  employeeRef: number;
  weekly_contracted_hours: number;
  contract_type: string;
  holiday_entitlement_days: number;
  total_worked_hours: number;
  total_worked_with_holiday: number;
  weeks_worked: number;
  holiday_entitlement: number;
  holiday_hours_taken: number;
  holiday_hours_remaining: number;
  annum_per_hour: string;
  notes: string;
  monthly_actual: number[];
  monthly_holiday: number[];
  actualTotal: number;
  holidayTotal: number;
  // SUMIF columns
  sumif_actual: number;
  sumif_differences_actual: number;
  sumif_holiday: number;
  sumif_differences_holiday: number;
}

// UK Fiscal Year months (April - March)
const MONTHS = ['April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MONTHS_SHORT = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
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
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [filterViewMode, setFilterViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');

  // Get fiscal year label
  const getFiscalYearLabel = () => {
    const yearStart = parseISO(selectedYear);
    const yearEnd = addMonths(yearStart, 11);
    return `From ${format(yearStart, 'MMMM yyyy')} to ${format(yearEnd, 'MMMM yyyy')}`;
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

      // Group employees by branch for employee REF numbering
      const branchGroups: Record<string, Employee[]> = {};
      employees.forEach(emp => {
        const branchName = emp.branch?.name || 'Unassigned';
        if (!branchGroups[branchName]) branchGroups[branchName] = [];
        branchGroups[branchName].push(emp as Employee);
      });

      let globalRef = 1;
      const calculatedBalances: EmployeeBalance[] = [];

      Object.entries(branchGroups).forEach(([branchName, branchEmployees]) => {
        branchEmployees.forEach((emp, empIdx) => {
          const empTimesheets = timesheets?.filter(t => t.employee_id === emp.id) || [];
          const contract = contractMap.get(emp.id);
          const weeklyHours = contract?.weekly_contracted_hours || DEFAULT_WEEKLY_HOURS;
          const holidayDays = contract?.holiday_entitlement_days || DEFAULT_HOLIDAY_DAYS;
          const contractType = contract?.contract_type || (weeklyHours >= 35 ? 'Full-Time' : 'Part-Time');
          const carryForward = carryForwardMap.get(emp.id) || 0;
          
          // Monthly breakdown (fiscal year Apr-Mar)
          const monthly_actual: number[] = MONTHS.map((_, idx) => {
            const monthDate = addMonths(yearStart, idx);
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            
            return empTimesheets.filter(t => {
              const weekStart = parseISO(t.week_start_date);
              return weekStart >= monthStart && weekStart <= monthEnd;
            }).reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0);
          });

          const monthly_holiday: number[] = MONTHS.map((_, idx) => {
            const monthDate = addMonths(yearStart, idx);
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            
            return empTimesheets.filter(t => {
              const weekStart = parseISO(t.week_start_date);
              return weekStart >= monthStart && weekStart <= monthEnd;
            }).reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0);
          });

          const actualTotal = monthly_actual.reduce((sum, v) => sum + v, 0);
          const holidayTotal = monthly_holiday.reduce((sum, v) => sum + v, 0);
          
          // Total worked hours WITH holiday (for No of Weeks calculation)
          const totalWorkedWithHoliday = actualTotal + holidayTotal;
          
          const hoursPerDay = weeklyHours / 5;
          const totalHolidayHoursPerYear = holidayDays * hoursPerDay;
          
          // Weeks worked = Total hours with holiday / Weekly contracted hours
          const weeksWorked = weeklyHours > 0 ? totalWorkedWithHoliday / weeklyHours : 0;
          
          // Holiday entitlement = (Annual Holiday Hours / 52) × Weeks Worked
          const holidayEntitlement = (totalHolidayHoursPerYear / WEEKS_PER_YEAR) * weeksWorked;
          
          // Holiday remaining = Entitlement + Carry Forward - Taken
          const holidayRemaining = holidayEntitlement + carryForward - holidayTotal;
          
          // Annum per hour (salary reference)
          const annumPerHour = weeklyHours >= 35 ? `£${(weeklyHours * 52 * 12).toLocaleString()}.00` : '';

          // SUMIF columns (matching Excel)
          const sumif_actual = actualTotal;
          const sumif_differences_actual = 0; // Difference tracking
          const sumif_holiday = holidayTotal;
          const sumif_differences_holiday = 0;

          calculatedBalances.push({
            employee: emp as Employee,
            globalRef: globalRef++,
            employeeRef: empIdx + 1,
            weekly_contracted_hours: weeklyHours,
            contract_type: contractType,
            holiday_entitlement_days: holidayDays,
            total_worked_hours: actualTotal,
            total_worked_with_holiday: totalWorkedWithHoliday,
            weeks_worked: weeksWorked,
            holiday_entitlement: holidayEntitlement,
            holiday_hours_taken: holidayTotal,
            holiday_hours_remaining: holidayRemaining,
            annum_per_hour: annumPerHour,
            notes: '',
            monthly_actual,
            monthly_holiday,
            actualTotal,
            holidayTotal,
            sumif_actual,
            sumif_differences_actual,
            sumif_holiday,
            sumif_differences_holiday
          });
        });
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
    entitlement: filteredBalances.reduce((sum, b) => sum + b.holiday_entitlement, 0),
    taken: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_taken, 0),
    remaining: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_remaining, 0),
    // Monthly totals
    monthlyActual: MONTHS.map((_, i) => filteredBalances.reduce((sum, b) => sum + b.monthly_actual[i], 0)),
    monthlyHoliday: MONTHS.map((_, i) => filteredBalances.reduce((sum, b) => sum + b.monthly_holiday[i], 0))
  }), [filteredBalances]);

  const exportToCSV = () => {
    if (viewMode === 'ref') {
      // REF view export (matching Excel Page 2)
      const headers = ['REF', 'Employee REF', 'EMPLOYEE NAME', 'SHOP NAME', 'TOTAL HOURS', 'HOLIDAY HOURS', 'ANNUM / PER HOUR', 'NOTES'];
      const rows: string[][] = [headers];
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        branchBalances.forEach((b) => {
          rows.push([
            String(b.globalRef),
            String(b.employeeRef),
            `${b.employee.first_name} ${b.employee.last_name}`,
            branchName,
            b.total_worked_hours > 0 ? b.total_worked_hours.toFixed(1) : '',
            b.holiday_hours_taken > 0 ? b.holiday_hours_taken.toFixed(1) : '',
            b.annum_per_hour,
            b.notes
          ]);
        });
      });

      const csv = rows.map(row => row.join(',')).join('\n');
      downloadCSV(csv, `Holiday_Hours_REF_${format(parseISO(selectedYear), 'yyyy')}.csv`);
    } else {
      // Monthly view export (matching Excel Page 1)
      const headers = [
        'No', 'Staff Name', 'Location', 'Contract Type',
        'Total Worked Hours With Holiday Hours', 'No of Weeks', 'Holiday Entitlement',
        ...MONTHS_SHORT, 'Total', // Actual Working Hours
        ...MONTHS_SHORT, 'Total', // Holiday Hours Taken
        'Holiday Hours Remaining', '', 'SUMIF', '', '', ''
      ];
      
      const subHeaders = [
        '', '', '', '',
        '', '', '',
        ...MONTHS_SHORT.map(() => ''), '', // Actual
        ...MONTHS_SHORT.map(() => ''), '', // Holiday
        '', '', 'Actual Hours', 'Differences', 'Holiday Hours', 'Differences'
      ];

      const rows: string[][] = [headers, subHeaders];
      let rowNum = 1;
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        // Branch header row
        rows.push([branchName, ...Array(headers.length - 1).fill('')]);
        
        const branchTotals = {
          workedWithHoliday: 0,
          weeks: 0,
          entitlement: 0,
          monthlyActual: MONTHS.map(() => 0),
          actualTotal: 0,
          monthlyHoliday: MONTHS.map(() => 0),
          holidayTotal: 0,
          remaining: 0
        };
        
        branchBalances.forEach(b => {
          rows.push([
            String(rowNum++),
            `${b.employee.first_name} ${b.employee.last_name}`,
            branchName,
            b.contract_type === 'Full-Time' ? '' : 'PT',
            b.total_worked_with_holiday.toFixed(2),
            b.weeks_worked.toFixed(2),
            b.holiday_entitlement.toFixed(2),
            ...b.monthly_actual.map(v => v > 0 ? v.toFixed(1) : ''),
            b.actualTotal.toFixed(1),
            ...b.monthly_holiday.map(v => v > 0 ? v.toFixed(1) : ''),
            b.holidayTotal.toFixed(1),
            b.holiday_hours_remaining.toFixed(2),
            '',
            b.sumif_actual > 0 ? b.sumif_actual.toFixed(1) : '-',
            '-',
            b.sumif_holiday > 0 ? b.sumif_holiday.toFixed(1) : '-',
            '-'
          ]);
          
          branchTotals.workedWithHoliday += b.total_worked_with_holiday;
          branchTotals.weeks += b.weeks_worked;
          branchTotals.entitlement += b.holiday_entitlement;
          b.monthly_actual.forEach((v, i) => branchTotals.monthlyActual[i] += v);
          branchTotals.actualTotal += b.actualTotal;
          b.monthly_holiday.forEach((v, i) => branchTotals.monthlyHoliday[i] += v);
          branchTotals.holidayTotal += b.holidayTotal;
          branchTotals.remaining += b.holiday_hours_remaining;
        });
        
        // Empty rows after branch (matching Excel spacing)
        rows.push(Array(headers.length).fill(''));
      });

      // Grand total row
      rows.push([
        'Grand Total', '', '', '',
        totals.workedWithHoliday.toFixed(2),
        '',
        totals.entitlement.toFixed(2),
        ...totals.monthlyActual.map(v => v.toFixed(1)),
        totals.worked.toFixed(1),
        ...totals.monthlyHoliday.map(v => v.toFixed(1)),
        totals.taken.toFixed(1),
        totals.remaining.toFixed(2),
        '', '', '', '', ''
      ]);

      const csv = rows.map(row => row.join(',')).join('\n');
      downloadCSV(csv, `Holiday_Hours_Working_${format(parseISO(selectedYear), 'yyyy')}_Full.csv`);
    }
    toast.success('Exported to CSV');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header - matching Excel "Staff Holiday Working" title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Staff Holiday Working
          </h2>
          <p className="text-muted-foreground">{getFiscalYearLabel()}</p>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Entitlement</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totals.entitlement.toFixed(1)}h</p>
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
        /* REF Summary View - Matching Excel Page 2 format */
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-950/30">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm">HOLIDAY HOURS REFERENCE</h3>
              <p className="text-sm text-muted-foreground">DATE: {format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
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
                    <TableHead className="font-bold min-w-[200px]">NOTES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => (
                    <React.Fragment key={branchName}>
                      {branchBalances.map((b) => (
                        <TableRow key={b.employee.id} className="hover:bg-muted/30">
                          <TableCell className="text-center font-medium">{b.globalRef}</TableCell>
                          <TableCell className="text-center">{b.employeeRef}</TableCell>
                          <TableCell className="font-medium">
                            {b.employee.first_name} {b.employee.last_name}
                          </TableCell>
                          <TableCell>{branchName}</TableCell>
                          <TableCell className="text-center font-bold">
                            {b.total_worked_hours > 0 ? b.total_worked_hours.toFixed(1) : ''}
                          </TableCell>
                          <TableCell className="text-center font-bold text-orange-600">
                            {b.holiday_hours_taken > 0 ? b.holiday_hours_taken.toFixed(1) : ''}
                          </TableCell>
                          <TableCell className="text-center">
                            {b.annum_per_hour}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{b.notes}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
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
        /* Full Monthly View - Matching Excel Page 1 format exactly */
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">{getFiscalYearLabel().toUpperCase()}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[2600px]">
              <Table className="text-[10px]">
                <TableHeader>
                  {/* Header Row 1 - Main category headers */}
                  <TableRow className="bg-muted/70 border-b-2">
                    <TableHead className="sticky left-0 bg-muted/70 z-20 w-10 text-center font-bold" rowSpan={2}>No</TableHead>
                    <TableHead className="sticky left-10 bg-muted/70 z-20 min-w-[150px] font-bold" rowSpan={2}>Staff Name</TableHead>
                    <TableHead className="bg-muted/70 min-w-[100px] font-bold" rowSpan={2}>Location</TableHead>
                    <TableHead className="text-center bg-muted/70 font-bold" rowSpan={2}>Contract Type</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900 font-bold" rowSpan={2}>Total Worked Hours With Holiday Hours</TableHead>
                    <TableHead className="text-center bg-muted/70 font-bold" rowSpan={2}>No of Weeks</TableHead>
                    <TableHead className="text-center bg-yellow-100 dark:bg-yellow-900 font-bold" rowSpan={2}>Holiday Entitlement</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-blue-100 dark:bg-blue-900 font-bold border-x">Actual Working Hours</TableHead>
                    <TableHead className="text-center bg-blue-200 dark:bg-blue-800 font-bold" rowSpan={2}>Total</TableHead>
                    <TableHead colSpan={MONTHS.length} className="text-center bg-orange-100 dark:bg-orange-900 font-bold border-x">Holiday Hours Taken</TableHead>
                    <TableHead className="text-center bg-orange-200 dark:bg-orange-800 font-bold" rowSpan={2}>Total</TableHead>
                    <TableHead className="text-center bg-green-200 dark:bg-green-800 font-bold" rowSpan={2}>Holiday Hours Remaining</TableHead>
                    <TableHead className="w-4" rowSpan={2}></TableHead>
                    <TableHead colSpan={4} className="text-center bg-gray-200 dark:bg-gray-700 font-bold">SUMIF</TableHead>
                  </TableRow>
                  {/* Header Row 2 - Month headers */}
                  <TableRow className="bg-muted/50">
                    {MONTHS_SHORT.map(m => <TableHead key={`a-${m}`} className="text-center bg-blue-50 dark:bg-blue-950 font-semibold w-14">{m}</TableHead>)}
                    {MONTHS_SHORT.map(m => <TableHead key={`h-${m}`} className="text-center bg-orange-50 dark:bg-orange-950 font-semibold w-14">{m}</TableHead>)}
                    <TableHead className="text-center bg-gray-100 dark:bg-gray-800 font-semibold w-16">Actual Hours</TableHead>
                    <TableHead className="text-center bg-gray-100 dark:bg-gray-800 font-semibold w-16">Differences</TableHead>
                    <TableHead className="text-center bg-gray-100 dark:bg-gray-800 font-semibold w-16">Holiday Hours</TableHead>
                    <TableHead className="text-center bg-gray-100 dark:bg-gray-800 font-semibold w-16">Differences</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => {
                    // Calculate branch SUMIF totals
                    const branchTotals = {
                      workedWithHoliday: 0,
                      weeks: 0,
                      entitlement: 0,
                      monthlyActual: MONTHS.map(() => 0),
                      actualTotal: 0,
                      monthlyHoliday: MONTHS.map(() => 0),
                      holidayTotal: 0,
                      remaining: 0
                    };
                    
                    branchBalances.forEach(b => {
                      branchTotals.workedWithHoliday += b.total_worked_with_holiday;
                      branchTotals.weeks += b.weeks_worked;
                      branchTotals.entitlement += b.holiday_entitlement;
                      branchTotals.actualTotal += b.actualTotal;
                      branchTotals.holidayTotal += b.holidayTotal;
                      branchTotals.remaining += b.holiday_hours_remaining;
                      b.monthly_actual.forEach((v, i) => branchTotals.monthlyActual[i] += v);
                      b.monthly_holiday.forEach((v, i) => branchTotals.monthlyHoliday[i] += v);
                    });

                    return (
                      <React.Fragment key={branchName}>
                        {branchBalances.map((b, idx) => (
                          <TableRow key={b.employee.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10 text-center">{idx + 1}</TableCell>
                            <TableCell className="sticky left-10 bg-background z-10 font-medium">
                              {b.employee.first_name} {b.employee.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{branchName}</TableCell>
                            <TableCell className="text-center">
                              {b.contract_type !== 'Full-Time' && (
                                <Badge variant="outline" className="text-[9px] px-1">PT</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center bg-purple-50/50 dark:bg-purple-950/30 font-bold">
                              {b.total_worked_with_holiday.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">{b.weeks_worked.toFixed(2)}</TableCell>
                            <TableCell className="text-center bg-yellow-50/50 dark:bg-yellow-950/30 font-bold">
                              {b.holiday_entitlement.toFixed(2)}
                            </TableCell>
                            {b.monthly_actual.map((v, i) => (
                              <TableCell key={`a-${i}`} className="text-center bg-blue-50/30 dark:bg-blue-950/30">
                                {v > 0 ? v.toFixed(1) : ''}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-blue-100/70 dark:bg-blue-900/70">
                              {b.actualTotal.toFixed(1)}
                            </TableCell>
                            {b.monthly_holiday.map((v, i) => (
                              <TableCell key={`h-${i}`} className="text-center bg-orange-50/30 dark:bg-orange-950/30">
                                {v > 0 ? v.toFixed(1) : ''}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-orange-100/70 dark:bg-orange-900/70 text-orange-700">
                              {b.holidayTotal.toFixed(1)}
                            </TableCell>
                            <TableCell className={`text-center font-bold ${b.holiday_hours_remaining >= 0 ? 'bg-green-100/70 dark:bg-green-900/70 text-green-700' : 'bg-red-100/70 dark:bg-red-900/70 text-red-700'}`}>
                              {b.holiday_hours_remaining.toFixed(2)}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center bg-gray-50 dark:bg-gray-900">
                              {b.sumif_actual > 0 ? b.sumif_actual.toFixed(1) : '-'}
                            </TableCell>
                            <TableCell className="text-center bg-gray-50 dark:bg-gray-900">-</TableCell>
                            <TableCell className="text-center bg-gray-50 dark:bg-gray-900">
                              {b.sumif_holiday > 0 ? b.sumif_holiday.toFixed(1) : '-'}
                            </TableCell>
                            <TableCell className="text-center bg-gray-50 dark:bg-gray-900">-</TableCell>
                          </TableRow>
                        ))}
                        {/* Empty rows after each branch (matching Excel spacing) */}
                        <TableRow className="h-2">
                          <TableCell colSpan={7 + MONTHS.length * 2 + 6}></TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total Row */}
                  {filteredBalances.length > 0 && (
                    <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                      <TableCell></TableCell>
                      <TableCell className="sticky left-10 bg-primary/20 z-10 text-sm">Grand Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-sm bg-purple-200 dark:bg-purple-700">
                        {totals.workedWithHoliday.toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center text-sm bg-yellow-200 dark:bg-yellow-700">
                        {totals.entitlement.toFixed(2)}
                      </TableCell>
                      {totals.monthlyActual.map((v, i) => (
                        <TableCell key={i} className="text-center bg-blue-200 dark:bg-blue-700">
                          {v > 0 ? v.toFixed(1) : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-center text-sm bg-blue-300 dark:bg-blue-600">
                        {totals.worked.toFixed(1)}
                      </TableCell>
                      {totals.monthlyHoliday.map((v, i) => (
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
                      <TableCell></TableCell>
                      <TableCell className="text-center bg-gray-200 dark:bg-gray-700"></TableCell>
                      <TableCell className="text-center bg-gray-200 dark:bg-gray-700"></TableCell>
                      <TableCell className="text-center bg-gray-200 dark:bg-gray-700">{totals.taken.toFixed(1)}</TableCell>
                      <TableCell className="text-center bg-gray-200 dark:bg-gray-700"></TableCell>
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
