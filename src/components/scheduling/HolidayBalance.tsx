import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar, RefreshCw, Search, Loader2, Download, FileSpreadsheet, Edit3, Save, ChevronLeft, ChevronRight
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format, parseISO, addMonths, startOfMonth, endOfMonth, subMonths } from 'date-fns';
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

interface PayrollNote {
  id?: string;
  employee_id: string;
  month_date: string;
  annum_per_hour: string | null;
  notes: string | null;
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
}

const MONTHS = ['April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MONTHS_SHORT = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const DEFAULT_WEEKLY_HOURS = 40;
const DEFAULT_HOLIDAY_DAYS = 28;
const WEEKS_PER_YEAR = 52;

export function HolidayBalance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [payrollNotes, setPayrollNotes] = useState<Record<string, PayrollNote>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025-04-01');
  const [viewMode, setViewMode] = useState<'ref' | 'monthly'>('ref');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [filterViewMode, setFilterViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeBalance | null>(null);
  const [editAnnum, setEditAnnum] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [currentRefMonth, setCurrentRefMonth] = useState<Date>(new Date());
  
  const canViewFilters = user?.role === 'super_admin' || user?.role === 'hr';

  const getFiscalYearLabel = () => {
    const yearStart = parseISO(selectedYear);
    const yearEnd = addMonths(yearStart, 11);
    return `From ${format(yearStart, 'MMMM yyyy')} to ${format(yearEnd, 'MMMM yyyy')}`;
  };

  const getRefMonthLabel = () => {
    return format(currentRefMonth, 'dd/MM/yyyy');
  };

  useEffect(() => {
    fetchData();
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }
  }, [selectedYear]);

  useEffect(() => {
    if (viewMode === 'ref') {
      fetchPayrollNotes();
    }
  }, [viewMode, currentRefMonth]);

  const fetchOrganizationsAndBranches = async () => {
    const [orgsRes, branchesRes] = await Promise.all([
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('branches').select('id, name, organization_id').order('name')
    ]);
    setOrganizations(orgsRes.data || []);
    setBranches(branchesRes.data || []);
  };

  const fetchPayrollNotes = async () => {
    const monthDate = format(startOfMonth(currentRefMonth), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('employee_payroll_notes')
      .select('*')
      .eq('month_date', monthDate);
    
    const notesMap: Record<string, PayrollNote> = {};
    data?.forEach(note => {
      notesMap[note.employee_id] = note;
    });
    setPayrollNotes(notesMap);
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

      // Fetch timesheets for the fiscal year. We extend the lower bound by ~10 days
      // so we also catch weeks whose Monday falls before Apr 1 but whose days
      // straddle into the fiscal year (and the upper bound similarly forward).
      const fetchStart = new Date(yearStart.getFullYear(), yearStart.getMonth(), yearStart.getDate() - 10);
      const fetchEnd = new Date(yearEnd.getFullYear(), yearEnd.getMonth(), yearEnd.getDate() + 10);
      const { data: timesheets, error: tsError } = await supabase
        .from('timesheets')
        .select('id, employee_id, week_start_date')
        .gte('week_start_date', format(fetchStart, 'yyyy-MM-dd'))
        .lt('week_start_date', format(fetchEnd, 'yyyy-MM-dd'));

      if (tsError) throw tsError;

      // Per-day entries — bucket by entry_date so weeks straddling the 21st
      // (payroll cycle boundary) split correctly between cycles.
      const tsIds = (timesheets || []).map(t => t.id);
      const tsToEmp = new Map<string, string>();
      (timesheets || []).forEach(t => tsToEmp.set(t.id, t.employee_id));

      let entries: Array<{ timesheet_id: string; entry_date: string; actual_hours: number | null; holiday_hours: number | null }> = [];
      if (tsIds.length) {
        const chunkSize = 500;
        for (let i = 0; i < tsIds.length; i += chunkSize) {
          const slice = tsIds.slice(i, i + chunkSize);
          const { data: ents, error: entError } = await supabase
            .from('timesheet_entries')
            .select('timesheet_id, entry_date, actual_hours, holiday_hours')
            .in('timesheet_id', slice);
          if (entError) throw entError;
          if (ents) entries = entries.concat(ents as any);
        }
      }

      const entriesByEmpDate = new Map<string, Map<string, { w: number; h: number }>>();
      entries.forEach(e => {
        const empId = tsToEmp.get(e.timesheet_id);
        if (!empId) return;
        let dateMap = entriesByEmpDate.get(empId);
        if (!dateMap) { dateMap = new Map(); entriesByEmpDate.set(empId, dateMap); }
        const cur = dateMap.get(e.entry_date) || { w: 0, h: 0 };
        cur.w += Number(e.actual_hours) || 0;
        cur.h += Number(e.holiday_hours) || 0;
        dateMap.set(e.entry_date, cur);
      });

      const { data: contracts } = await supabase
        .from('employee_contracts')
        .select('employee_id, weekly_contracted_hours, holiday_entitlement_days, contract_type')
        .is('effective_to', null);

      const { data: holidayBalances } = await supabase
        .from('holiday_balances')
        .select('employee_id, carry_forward_hours');

      const contractMap = new Map(contracts?.map(c => [c.employee_id, c]) || []);
      const carryForwardMap = new Map(holidayBalances?.map(h => [h.employee_id, h.carry_forward_hours || 0]) || []);

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
          const contract = contractMap.get(emp.id);
          const weeklyHours = contract?.weekly_contracted_hours || DEFAULT_WEEKLY_HOURS;
          const holidayDays = contract?.holiday_entitlement_days || DEFAULT_HOLIDAY_DAYS;
          const contractType = contract?.contract_type || (weeklyHours >= 35 ? 'Full-Time' : 'Part-Time');
          const carryForward = carryForwardMap.get(emp.id) || 0;

          const empDateMap = entriesByEmpDate.get(emp.id);
          const sumRange = (startStr: string, endStr: string): { w: number; h: number } => {
            if (!empDateMap) return { w: 0, h: 0 };
            let w = 0, h = 0;
            empDateMap.forEach((v, dateStr) => {
              if (dateStr >= startStr && dateStr <= endStr) { w += v.w; h += v.h; }
            });
            return { w, h };
          };

          const monthly_actual: number[] = MONTHS.map((_, idx) => {
            const monthDate = addMonths(yearStart, idx);
            const payrollStart = format(new Date(monthDate.getFullYear(), monthDate.getMonth(), 21), 'yyyy-MM-dd');
            const payrollEnd = format(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 20), 'yyyy-MM-dd');
            return sumRange(payrollStart, payrollEnd).w;
          });

          const monthly_holiday: number[] = MONTHS.map((_, idx) => {
            const monthDate = addMonths(yearStart, idx);
            const payrollStart = format(new Date(monthDate.getFullYear(), monthDate.getMonth(), 21), 'yyyy-MM-dd');
            const payrollEnd = format(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 20), 'yyyy-MM-dd');
            return sumRange(payrollStart, payrollEnd).h;
          });

          const actualTotal = monthly_actual.reduce((sum, v) => sum + v, 0);
          const holidayTotal = monthly_holiday.reduce((sum, v) => sum + v, 0);
          const totalWorkedWithHoliday = actualTotal + holidayTotal;
          
          const hoursPerDay = weeklyHours / 5;
          const totalHolidayHoursPerYear = holidayDays * hoursPerDay;
          const weeksWorked = weeklyHours > 0 ? totalWorkedWithHoliday / weeklyHours : 0;
          const holidayEntitlement = (totalHolidayHoursPerYear / WEEKS_PER_YEAR) * weeksWorked;
          const holidayRemaining = holidayEntitlement + carryForward - holidayTotal;

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
            annum_per_hour: '',
            notes: '',
            monthly_actual,
            monthly_holiday,
            actualTotal,
            holidayTotal
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

  const openEditPanel = (balance: EmployeeBalance) => {
    setEditingEmployee(balance);
    const note = payrollNotes[balance.employee.id];
    setEditAnnum(note?.annum_per_hour || '');
    setEditNotes(note?.notes || '');
    setShowEditPanel(true);
  };

  const savePayrollNote = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      const monthDate = format(startOfMonth(currentRefMonth), 'yyyy-MM-dd');
      const existingNote = payrollNotes[editingEmployee.employee.id];

      if (existingNote?.id) {
        await supabase.from('employee_payroll_notes').update({
          annum_per_hour: editAnnum || null,
          notes: editNotes || null
        }).eq('id', existingNote.id);
      } else {
        await supabase.from('employee_payroll_notes').insert({
          employee_id: editingEmployee.employee.id,
          month_date: monthDate,
          annum_per_hour: editAnnum || null,
          notes: editNotes || null,
          created_by: user?.id
        });
      }

      toast.success('Saved successfully');
      setShowEditPanel(false);
      fetchPayrollNotes();
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const filteredBalances = useMemo(() => balances.filter(b => {
    const emp = b.employee;
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterViewMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterViewMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  }), [balances, searchQuery, canViewFilters, filterViewMode, selectedOrg, selectedBranch]);

  const groupedByBranch = useMemo(() => filteredBalances.reduce((acc, balance) => {
    const branchName = balance.employee.branch?.name || 'Unassigned';
    if (!acc[branchName]) acc[branchName] = [];
    acc[branchName].push(balance);
    return acc;
  }, {} as Record<string, EmployeeBalance[]>), [filteredBalances]);

  const totals = useMemo(() => ({
    worked: filteredBalances.reduce((sum, b) => sum + b.total_worked_hours, 0),
    workedWithHoliday: filteredBalances.reduce((sum, b) => sum + b.total_worked_with_holiday, 0),
    entitlement: filteredBalances.reduce((sum, b) => sum + b.holiday_entitlement, 0),
    taken: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_taken, 0),
    remaining: filteredBalances.reduce((sum, b) => sum + b.holiday_hours_remaining, 0),
    monthlyActual: MONTHS.map((_, i) => filteredBalances.reduce((sum, b) => sum + b.monthly_actual[i], 0)),
    monthlyHoliday: MONTHS.map((_, i) => filteredBalances.reduce((sum, b) => sum + b.monthly_holiday[i], 0))
  }), [filteredBalances]);

  const exportToCSV = () => {
    let headers: string[];
    let rows: string[][];

    if (viewMode === 'ref') {
      headers = ['REF', 'Employee REF', 'EMPLOYEE NAME', 'SHOP NAME', 'TOTAL HOURS', 'HOLIDAY HOURS', 'ANNUM / PER HOUR', 'NOTES'];
      rows = [headers];
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        branchBalances.forEach((b) => {
          const note = payrollNotes[b.employee.id];
          rows.push([
            String(b.globalRef),
            String(b.employeeRef),
            `${b.employee.first_name} ${b.employee.last_name}`,
            branchName,
            b.total_worked_hours > 0 ? b.total_worked_hours.toFixed(1) : '',
            b.holiday_hours_taken > 0 ? b.holiday_hours_taken.toFixed(1) : '',
            note?.annum_per_hour || '',
            note?.notes || ''
          ]);
        });
        rows.push(Array(8).fill(''));
      });
    } else {
      headers = [
        'No', 'Staff Name', 'Location', 'Contract Type',
        'Total Worked Hours With Holiday Hours', 'No of Weeks', 'Holiday Entitlement',
        ...MONTHS_SHORT, 'Total',
        ...MONTHS_SHORT, 'Total',
        'Holiday Hours Remaining'
      ];
      
      rows = [headers];
      let rowNum = 1;
      
      Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
        rows.push([branchName, ...Array(headers.length - 1).fill('')]);
        
        branchBalances.forEach(b => {
          rows.push([
            String(rowNum++),
            `${b.employee.first_name} ${b.employee.last_name}`,
            branchName,
            b.contract_type === 'Full-Time' ? 'FT' : 'PT',
            b.total_worked_with_holiday.toFixed(2),
            b.weeks_worked.toFixed(2),
            b.holiday_entitlement.toFixed(2),
            ...b.monthly_actual.map(v => v > 0 ? v.toFixed(1) : ''),
            b.actualTotal.toFixed(1),
            ...b.monthly_holiday.map(v => v > 0 ? v.toFixed(1) : ''),
            b.holidayTotal.toFixed(1),
            b.holiday_hours_remaining.toFixed(2)
          ]);
        });
        rows.push(Array(headers.length).fill(''));
      });
    }

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = viewMode === 'ref' 
      ? `Holiday_Hours_REF_${format(currentRefMonth, 'MMM_yyyy')}.csv`
      : `Holiday_Hours_Working_${format(parseISO(selectedYear), 'yyyy')}_Full.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <Card className="border-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/10 to-cyan-500/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Staff Holiday Working</h1>
                <p className="text-muted-foreground">
                  {viewMode === 'ref' ? `DATE: ${getRefMonthLabel()}` : getFiscalYearLabel()}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'ref' | 'monthly')} className="bg-background rounded-lg p-1 shadow-sm">
                <TabsList className="grid grid-cols-2 gap-1">
                  <TabsTrigger value="ref" className="text-sm">REF Summary</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-sm">Full Monthly</TabsTrigger>
                </TabsList>
              </Tabs>

              {viewMode === 'ref' ? (
                <div className="flex items-center gap-1 bg-background rounded-lg p-1 shadow-sm">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentRefMonth(subMonths(currentRefMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm font-medium min-w-[100px] text-center">{format(currentRefMonth, 'MMM yyyy')}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentRefMonth(addMonths(currentRefMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-44 bg-background shadow-sm"><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-04-01">Apr 2024 - Mar 2025</SelectItem>
                    <SelectItem value="2025-04-01">Apr 2025 - Mar 2026</SelectItem>
                    <SelectItem value="2026-04-01">Apr 2026 - Mar 2027</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="sm" onClick={recalculateAll} disabled={recalculating} className="shadow-sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                Recalculate
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV} className="shadow-sm">
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
        <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Staff Count</p>
            <p className="text-2xl font-bold">{filteredBalances.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">Total Worked</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{totals.worked.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">Entitlement</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{totals.entitlement.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">Taken</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{totals.taken.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold uppercase tracking-wide">Remaining</p>
            <p className="text-xl font-bold text-cyan-700 dark:text-cyan-300">{totals.remaining.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search employees..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="pl-10 bg-background shadow-sm" 
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <NizaLoaderInline />
        </div>
      ) : viewMode === 'ref' ? (
        /* REF Summary View - Matches Excel Page 2 */
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-emerald-500/5 to-transparent border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600" />
              DATE: {format(currentRefMonth, 'EEEE, MMMM dd, yyyy')} • Niza Enterprise Ltd
            </CardTitle>
          </CardHeader>
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-16 text-center font-bold">REF</TableHead>
                    <TableHead className="w-20 text-center font-bold">Employee REF</TableHead>
                    <TableHead className="min-w-[200px] font-bold">EMPLOYEE NAME</TableHead>
                    <TableHead className="min-w-[120px] font-bold">SHOP NAME</TableHead>
                    <TableHead className="w-24 text-center font-bold bg-blue-50 dark:bg-blue-950/50">TOTAL HOURS</TableHead>
                    <TableHead className="w-24 text-center font-bold bg-amber-50 dark:bg-amber-950/50">HOLIDAY HOURS</TableHead>
                    <TableHead className="w-28 text-center font-bold bg-emerald-50 dark:bg-emerald-950/50">ANNUM / PER HOUR</TableHead>
                    <TableHead className="min-w-[250px] font-bold">NOTES</TableHead>
                    <TableHead className="w-16 text-center">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => (
                    <React.Fragment key={branchName}>
                      {branchBalances.map((b, idx) => {
                        const note = payrollNotes[b.employee.id];
                        return (
                          <TableRow key={b.employee.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <TableCell className="text-center font-medium">{b.globalRef}</TableCell>
                            <TableCell className="text-center">{b.employeeRef}</TableCell>
                            <TableCell className="font-medium">
                              {b.employee.first_name} {b.employee.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{branchName}</TableCell>
                            <TableCell className="text-center bg-blue-50/50 dark:bg-blue-950/30 font-semibold text-blue-700 dark:text-blue-300">
                              {b.total_worked_hours > 0 ? b.total_worked_hours.toFixed(1) : ''}
                            </TableCell>
                            <TableCell className="text-center bg-amber-50/50 dark:bg-amber-950/30 font-semibold text-amber-600">
                              {b.holiday_hours_taken > 0 ? b.holiday_hours_taken.toFixed(1) : ''}
                            </TableCell>
                            <TableCell className="text-center bg-emerald-50/50 dark:bg-emerald-950/30 font-medium text-emerald-700 dark:text-emerald-300">
                              {note?.annum_per_hour || ''}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {note?.notes || ''}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditPanel(b)}>
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Spacer row between branches */}
                      <TableRow className="h-4 hover:bg-transparent">
                        <TableCell colSpan={9} className="p-0" />
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      ) : (
        /* Full Monthly View - Matches Excel Page 1 */
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-emerald-500/5 to-transparent border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Staff Holiday Working - {getFiscalYearLabel()}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="w-full">
            <div className="min-w-[2400px]">
              <Table className="text-[10px]">
                <TableHeader>
                  {/* Header Row 1 - Categories */}
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                    <TableHead className="w-10 text-center font-bold sticky left-0 bg-muted/30 z-10">No</TableHead>
                    <TableHead className="min-w-[150px] font-bold sticky left-10 bg-muted/30 z-10">Staff Name</TableHead>
                    <TableHead className="w-24 font-bold">Location</TableHead>
                    <TableHead className="w-16 text-center font-bold">Type</TableHead>
                    <TableHead className="w-24 text-center font-bold bg-slate-100 dark:bg-slate-800">Total Worked + Holiday</TableHead>
                    <TableHead className="w-16 text-center font-bold bg-slate-100 dark:bg-slate-800">Weeks</TableHead>
                    <TableHead className="w-20 text-center font-bold bg-emerald-50 dark:bg-emerald-950/50">Entitlement</TableHead>
                    {/* Actual Working Hours */}
                    {MONTHS_SHORT.map((m, i) => (
                      <TableHead key={`actual-${i}`} className="w-14 text-center font-bold bg-blue-50 dark:bg-blue-950/30">{m}</TableHead>
                    ))}
                    <TableHead className="w-16 text-center font-bold bg-blue-100 dark:bg-blue-900/50">Total</TableHead>
                    {/* Holiday Hours Taken */}
                    {MONTHS_SHORT.map((m, i) => (
                      <TableHead key={`holiday-${i}`} className="w-14 text-center font-bold bg-amber-50 dark:bg-amber-950/30">{m}</TableHead>
                    ))}
                    <TableHead className="w-16 text-center font-bold bg-amber-100 dark:bg-amber-900/50">Total</TableHead>
                    <TableHead className="w-20 text-center font-bold bg-cyan-100 dark:bg-cyan-900/50">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => {
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
                      b.monthly_actual.forEach((v, i) => branchTotals.monthlyActual[i] += v);
                      branchTotals.actualTotal += b.actualTotal;
                      b.monthly_holiday.forEach((v, i) => branchTotals.monthlyHoliday[i] += v);
                      branchTotals.holidayTotal += b.holidayTotal;
                      branchTotals.remaining += b.holiday_hours_remaining;
                    });

                    return (
                      <React.Fragment key={branchName}>
                        {/* Branch Header */}
                        <TableRow className="bg-primary/5 hover:bg-primary/10">
                          <TableCell colSpan={32} className="py-2 font-semibold text-primary text-xs sticky left-0">
                            📍 {branchName} <Badge variant="secondary" className="ml-2 text-[9px]">{branchBalances.length}</Badge>
                          </TableCell>
                        </TableRow>
                        {/* Employee Rows */}
                        {branchBalances.map((b, idx) => (
                          <TableRow key={b.employee.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <TableCell className="text-center sticky left-0 bg-inherit z-10">{idx + 1}</TableCell>
                            <TableCell className="font-medium sticky left-10 bg-inherit z-10">
                              {b.employee.first_name} {b.employee.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{branchName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={b.contract_type === 'Full-Time' ? 'default' : 'secondary'} className="text-[8px] px-1">
                                {b.contract_type === 'Full-Time' ? 'FT' : 'PT'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center bg-slate-50/50 dark:bg-slate-800/30 font-medium">
                              {b.total_worked_with_holiday.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center bg-slate-50/50 dark:bg-slate-800/30">
                              {b.weeks_worked.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center bg-emerald-50/50 dark:bg-emerald-950/30 font-medium text-emerald-700 dark:text-emerald-300">
                              {b.holiday_entitlement.toFixed(2)}
                            </TableCell>
                            {/* Actual Working Hours by month */}
                            {b.monthly_actual.map((v, i) => (
                              <TableCell key={`actual-${i}`} className="text-center bg-blue-50/30 dark:bg-blue-950/20">
                                {v > 0 ? v.toFixed(1) : ''}
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-blue-100/50 dark:bg-blue-900/30 font-bold text-blue-700 dark:text-blue-300">
                              {b.actualTotal.toFixed(1)}
                            </TableCell>
                            {/* Holiday Hours by month */}
                            {b.monthly_holiday.map((v, i) => (
                              <TableCell key={`holiday-${i}`} className="text-center bg-amber-50/30 dark:bg-amber-950/20">
                                {v > 0 ? v.toFixed(1) : ''}
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-amber-100/50 dark:bg-amber-900/30 font-bold text-amber-600">
                              {b.holidayTotal.toFixed(1)}
                            </TableCell>
                            <TableCell className={`text-center font-bold ${b.holiday_hours_remaining >= 0 ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/30' : 'text-rose-600 bg-rose-50/50 dark:bg-rose-950/30'}`}>
                              {b.holiday_hours_remaining.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Branch Subtotal */}
                        <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50 text-[9px]">
                          <TableCell className="sticky left-0 bg-muted/50 z-10" />
                          <TableCell className="sticky left-10 bg-muted/50 z-10">SUBTOTAL</TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell className="text-center">{branchTotals.workedWithHoliday.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{branchTotals.weeks.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{branchTotals.entitlement.toFixed(1)}</TableCell>
                          {branchTotals.monthlyActual.map((v, i) => (
                            <TableCell key={`sub-actual-${i}`} className="text-center">{v > 0 ? v.toFixed(1) : ''}</TableCell>
                          ))}
                          <TableCell className="text-center">{branchTotals.actualTotal.toFixed(1)}</TableCell>
                          {branchTotals.monthlyHoliday.map((v, i) => (
                            <TableCell key={`sub-holiday-${i}`} className="text-center">{v > 0 ? v.toFixed(1) : ''}</TableCell>
                          ))}
                          <TableCell className="text-center">{branchTotals.holidayTotal.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{branchTotals.remaining.toFixed(1)}</TableCell>
                        </TableRow>
                        {/* Spacer */}
                        <TableRow className="h-2 hover:bg-transparent">
                          <TableCell colSpan={32} className="p-0" />
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total */}
                  <TableRow className="bg-primary/10 font-bold hover:bg-primary/10 text-[10px]">
                    <TableCell className="sticky left-0 bg-primary/10 z-10" />
                    <TableCell className="sticky left-10 bg-primary/10 z-10">GRAND TOTAL</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-center">{totals.workedWithHoliday.toFixed(1)}</TableCell>
                    <TableCell />
                    <TableCell className="text-center text-emerald-700">{totals.entitlement.toFixed(1)}</TableCell>
                    {totals.monthlyActual.map((v, i) => (
                      <TableCell key={`grand-actual-${i}`} className="text-center">{v > 0 ? v.toFixed(1) : ''}</TableCell>
                    ))}
                    <TableCell className="text-center text-blue-700">{totals.worked.toFixed(1)}</TableCell>
                    {totals.monthlyHoliday.map((v, i) => (
                      <TableCell key={`grand-holiday-${i}`} className="text-center">{v > 0 ? v.toFixed(1) : ''}</TableCell>
                    ))}
                    <TableCell className="text-center text-amber-600">{totals.taken.toFixed(1)}</TableCell>
                    <TableCell className="text-center text-cyan-700">{totals.remaining.toFixed(1)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      {/* Edit Side Panel for Notes/Annum */}
      <Sheet open={showEditPanel} onOpenChange={setShowEditPanel}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-emerald-600" />
              Edit Payroll Notes
            </SheetTitle>
            <SheetDescription>
              {editingEmployee?.employee.first_name} {editingEmployee?.employee.last_name} • {format(currentRefMonth, 'MMMM yyyy')}
            </SheetDescription>
          </SheetHeader>
          
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label>ANNUM / PER HOUR</Label>
              <Input 
                placeholder="e.g., £27,500.00 or £12.50"
                value={editAnnum}
                onChange={(e) => setEditAnnum(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Annual salary or hourly rate</p>
            </div>
            
            <div className="space-y-2">
              <Label>NOTES</Label>
              <Textarea 
                placeholder="e.g., Please add Management Allowance of £602.36"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">Payroll instructions or notes</p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-medium">{editingEmployee?.total_worked_hours.toFixed(1) || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Holiday Hours</span>
                <span className="font-medium">{editingEmployee?.holiday_hours_taken.toFixed(1) || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Holiday Remaining</span>
                <span className="font-medium">{editingEmployee?.holiday_hours_remaining.toFixed(2) || 0}</span>
              </div>
            </div>
          </div>

          <SheetFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditPanel(false)}>Cancel</Button>
            <Button onClick={savePayrollNote} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
