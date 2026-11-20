import React, { useState, useEffect, useMemo } from 'react';
import { currentHolidayYearStart, holidayYearOptions } from '@/lib/holidayYear';
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
  Calendar, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Download, Edit3, FileBarChart,
  Loader2, RefreshCw, Save, Search, Table2, Users
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format, parseISO, addMonths, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { chunkValues, fetchAllPages } from '@/lib/supabasePagination';
import { calculateEntryWorkedHours } from '@/lib/timesheetCalculations';
import { buildReportWorkbook, buildTrackerWorkbook, downloadWorkbook, reportFileName, trackerFileName } from '@/lib/holidayExport';
import HolidayKpis from './holiday/HolidayKpis';
import BalancesView from './holiday/BalancesView';
import TrackerView from './holiday/TrackerView';
import { MONTH_NAMES, holidayPositionOf, payrollPeriodLabel, statusOf, toExportRows } from './holiday/holidayData';

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

export interface EmployeeBalance {
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
const DEFAULT_WEEKLY_HOURS = 40;
const DEFAULT_HOLIDAY_DAYS = 28;
const WEEKS_PER_YEAR = 52;
// Statutory holiday entitlement in weeks (UK 5.6 weeks), as used in the
// "Holiday Working" sheet: Entitlement = (Total worked hours incl. holiday / 52) * 5.6
const HOLIDAY_WEEKS = 5.6;

/**
 * Payroll-month window for column `idx` (0 = April ... 11 = March) of the holiday year,
 * matching the holiday sheet:
 *  - April : 1 Apr  -> 20 Apr          (year starts on 1 April)
 *  - May..Feb : 21st of previous month -> 20th of the month
 *  - March : 21 Feb -> 31 Mar          (year closes on 31 March)
 * Together the 12 windows cover exactly 1 April - 31 March with no gaps or overlaps.
 */
const holidayMonthWindow = (yearStart: Date, idx: number): { start: string; end: string } => {
  const y = yearStart.getFullYear();
  const m = yearStart.getMonth();
  const start = idx === 0 ? new Date(y, m, 1) : new Date(y, m + idx - 1, 21);
  const end = idx === 11 ? new Date(y, m + 12, 0) : new Date(y, m + idx, 20);
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
};

export function HolidayBalance() {
  const { user } = useAuth();
  const canExport = ['super_admin', 'admin', 'hr'].includes(user?.role || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [payrollNotes, setPayrollNotes] = useState<Record<string, PayrollNote>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(currentHolidayYearStart());
  const [view, setView] = useState<'balances' | 'tracker' | 'ref'>('balances');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Overdrawn' | 'Low' | 'OK'>('all');
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

  useEffect(() => {
    fetchData();
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }
  }, [selectedYear]);

  useEffect(() => {
    if (view === 'ref') {
      fetchPayrollNotes();
    }
  }, [view, currentRefMonth]);

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
      const employees = await fetchAllPages<any>((from, to) => {
        let query = supabase.from('employees')
          .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
          .eq('status', 'active');
        if (user?.role === 'manager' && user.branchId) query = query.eq('branch_id', user.branchId);
        if (user?.branchIds?.length) query = query.in('branch_id', user.branchIds);
        return query.order('id').range(from, to);
      });
      if (!employees || employees.length === 0) {
        setBalances([]);
        setLoading(false);
        return;
      }

      const yearStart = parseISO(selectedYear);
      const yearEnd = addMonths(yearStart, 12); // exclusive: 1 April of the next year

      // Fetch timesheets for the fiscal year. We extend the lower bound by ~10 days
      // so we also catch weeks whose Monday falls before Apr 1 but whose days
      // straddle into the fiscal year (and the upper bound similarly forward).
      const fetchStart = new Date(yearStart.getFullYear(), yearStart.getMonth(), yearStart.getDate() - 10);
      const fetchEnd = new Date(yearEnd.getFullYear(), yearEnd.getMonth(), yearEnd.getDate() + 10);
      const timesheets = await fetchAllPages<any>((from, to) => supabase
        .from('timesheets')
        .select('id, employee_id, week_start_date')
        .gte('week_start_date', format(fetchStart, 'yyyy-MM-dd'))
        .lt('week_start_date', format(fetchEnd, 'yyyy-MM-dd'))
        .order('id').range(from, to));

      // Per-day entries — bucket by entry_date so weeks straddling the 21st
      // (payroll cycle boundary) split correctly between cycles.
      const tsIds = (timesheets || []).map(t => t.id);
      const tsToEmp = new Map<string, string>();
      (timesheets || []).forEach(t => tsToEmp.set(t.id, t.employee_id));

      let entries: any[] = [];
      if (tsIds.length) {
        for (const slice of chunkValues(tsIds)) {
          entries = entries.concat(await fetchAllPages((from, to) => supabase.from('timesheet_entries')
            .select('timesheet_id, entry_date, actual_hours, shift_start_time, shift_end_time, break_duration_minutes, holiday_hours, sick_hours')
            .in('timesheet_id', slice).order('id').range(from, to)) as any);
        }
      }

      // Same rules as Weekly Timesheets / Monthly Hours (read-only reuse, no change to them):
      //  - worked hours per day come from calculateEntryWorkedHours (shift times minus break,
      //    falling back to the stored actual hours)
      //  - if an employee has more than one entry for the same day, only the entry with the
      //    most activity counts, so duplicates are never added twice
      const bestByEmpDate = new Map<string, { empId: string; entry: any; activity: number }>();
      entries.forEach(e => {
        const empId = tsToEmp.get(e.timesheet_id);
        if (!empId) return;
        const activity = calculateEntryWorkedHours(e) + (Number(e.holiday_hours) || 0) + (Number(e.sick_hours) || 0);
        const key = `${empId}|${e.entry_date}`;
        const existing = bestByEmpDate.get(key);
        if (!existing || activity > existing.activity) bestByEmpDate.set(key, { empId, entry: e, activity });
      });

      const entriesByEmpDate = new Map<string, Map<string, { w: number; h: number }>>();
      bestByEmpDate.forEach(({ empId, entry }) => {
        let dateMap = entriesByEmpDate.get(empId);
        if (!dateMap) { dateMap = new Map(); entriesByEmpDate.set(empId, dateMap); }
        dateMap.set(entry.entry_date, {
          w: calculateEntryWorkedHours(entry),
          h: Number(entry.holiday_hours) || 0,
        });
      });

      const employeeIds = employees.map(employee => employee.id);
      const contracts: any[] = [];
      const holidayBalances: any[] = [];
      for (const employeeIdChunk of chunkValues(employeeIds)) {
        contracts.push(...await fetchAllPages((from, to) => supabase.from('employee_contracts')
          .select('employee_id, weekly_contracted_hours, holiday_entitlement_days, contract_type')
          .in('employee_id', employeeIdChunk).is('effective_to', null).order('id').range(from, to)));
        holidayBalances.push(...await fetchAllPages((from, to) => supabase.from('holiday_balances')
          .select('employee_id, carry_forward_hours').in('employee_id', employeeIdChunk)
          .order('id').range(from, to)));
      }

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

          const monthWindows = MONTHS.map((_, idx) => holidayMonthWindow(yearStart, idx));
          const monthSums = monthWindows.map(w => sumRange(w.start, w.end));
          // Actual worked hours (holiday hours are NOT included, as in the sheet)
          const monthly_actual: number[] = monthSums.map(m => m.w);
          // Holiday hours taken
          const monthly_holiday: number[] = monthSums.map(m => m.h);

          // Holiday sheet logic:
          //   E  Total Worked Hours With Holiday Hours = actual worked hours + holiday hours taken
          //   F  No of Weeks = 52
          //   G  Holiday Entitlement = (E / F) * 5.6
          //   AH Holiday Hours Remaining = G - holiday hours taken (+ any carried-forward hours)
          const actualTotal = monthly_actual.reduce((sum, v) => sum + v, 0);
          const holidayTotal = monthly_holiday.reduce((sum, v) => sum + v, 0);
          const totalWorkedWithHoliday = actualTotal + holidayTotal;
          const weeksWorked = WEEKS_PER_YEAR;
          const holidayEntitlement = (totalWorkedWithHoliday / WEEKS_PER_YEAR) * HOLIDAY_WEEKS;
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

  // Everyone the signed-in person may see, narrowed by the organisation / branch filter.
  // This is what the Excel exports use.
  const scopedBalances = useMemo(() => balances.filter(b => {
    const emp = b.employee;
    if (!canViewFilters) return true;
    if (filterViewMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterViewMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  }), [balances, canViewFilters, filterViewMode, selectedOrg, selectedBranch]);

  // What is listed on screen: the same, plus the search box and the status chips.
  const filteredBalances = useMemo(() => scopedBalances.filter(b => {
    const emp = b.employee;
    if (!`${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && statusOf(b) !== statusFilter) return false;
    return true;
  }), [scopedBalances, searchQuery, statusFilter]);

  const groupedByBranch = useMemo(() => filteredBalances.reduce((acc, balance) => {
    const branchName = balance.employee.branch?.name || 'Unassigned';
    if (!acc[branchName]) acc[branchName] = [];
    acc[branchName].push(balance);
    return acc;
  }, {} as Record<string, EmployeeBalance[]>), [filteredBalances]);

  const statusCounts = useMemo(() => {
    const counts = { all: scopedBalances.length, Overdrawn: 0, Low: 0, OK: 0 };
    scopedBalances.forEach(b => {
      const s = statusOf(b);
      if (s === 'Overdrawn' || s === 'Low' || s === 'OK') counts[s] += 1;
    });
    return counts;
  }, [scopedBalances]);

  // Payroll month shown on the "Payroll REF" tab (0 = April ... 11 = March) and the holiday year it belongs to.
  const refPosition = useMemo(() => holidayPositionOf(currentRefMonth), [currentRefMonth]);

  // Moving the REF month into another holiday year loads that year's hours.
  useEffect(() => {
    if (view === 'ref' && refPosition.yearStart !== selectedYear) setSelectedYear(refPosition.yearStart);
  }, [view, refPosition.yearStart, selectedYear]);

  const changeView = (next: string) => {
    if (next === 'ref') {
      // open the REF tab on a month inside the year that is currently selected
      const pos = holidayPositionOf(currentRefMonth);
      if (pos.yearStart !== selectedYear) {
        const startYear = parseInt(selectedYear.slice(0, 4), 10);
        const today = new Date();
        setCurrentRefMonth(holidayPositionOf(today).yearStart === selectedYear ? today : new Date(startYear + 1, 2, 15));
      }
    }
    setView(next as 'balances' | 'tracker' | 'ref');
  };

  const scopeLabel = (() => {
    if (filterViewMode === 'branch' && selectedBranch) return branches.find(b => b.id === selectedBranch)?.name || 'Selected branch';
    if (filterViewMode === 'organization' && selectedOrg) return organizations.find(o => o.id === selectedOrg)?.name || 'Selected organisation';
    return 'All staff';
  })();

  const runExport = (kind: 'tracker' | 'report') => {
    if (!canExport) {
      toast.error('Only Super Admin, Admin, and HR can export holiday balances.');
      return;
    }
    if (scopedBalances.length === 0) {
      toast.error('There is nobody to export for this selection.');
      return;
    }
    try {
      const rows = toExportRows(scopedBalances);
      const meta = { yearStart: selectedYear, scopeLabel, generatedAt: new Date() };
      if (kind === 'tracker') downloadWorkbook(buildTrackerWorkbook(rows, meta), trackerFileName(selectedYear));
      else downloadWorkbook(buildReportWorkbook(rows, meta), reportFileName(selectedYear));
      toast.success(kind === 'tracker' ? 'Holiday Tracker downloaded' : 'Balance Report downloaded');
    } catch (error) {
      console.error('Holiday export failed:', error);
      toast.error('Could not create the Excel file');
    }
  };

  // Payroll REF: the hours for ONE payroll month, as on the monthly sheets of the Holiday Hours workbook.
  const refIdx = refPosition.idx;
  const refStartYear = parseInt(refPosition.yearStart.slice(0, 4), 10);
  const refPeriod = payrollPeriodLabel(refIdx, refStartYear);

  const exportRefCsv = () => {
    if (!canExport) {
      toast.error('Only Super Admin, Admin, and HR can export holiday balances.');
      return;
    }
    const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows: string[][] = [['REF', 'Employee REF', 'EMPLOYEE NAME', 'SHOP NAME', 'TOTAL HOURS', 'HOLIDAY HOURS', 'ANNUM / PER HOUR', 'NOTES']];
    Object.entries(groupedByBranch).forEach(([branchName, branchBalances]) => {
      branchBalances.forEach((b) => {
        const note = payrollNotes[b.employee.id];
        const worked = b.monthly_actual[refIdx];
        const holiday = b.monthly_holiday[refIdx];
        rows.push([
          String(b.globalRef),
          String(b.employeeRef),
          `${b.employee.first_name} ${b.employee.last_name}`,
          branchName,
          worked > 0 ? worked.toFixed(1) : '',
          holiday > 0 ? holiday.toFixed(1) : '',
          note?.annum_per_hour || '',
          note?.notes || ''
        ]);
      });
      rows.push(Array(8).fill(''));
    });
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Holiday_Hours_REF_${format(currentRefMonth, 'MMM_yyyy')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const STATUS_CHIPS: Array<{ key: 'all' | 'Overdrawn' | 'Low' | 'OK'; label: string }> = [
    { key: 'all', label: 'Everyone' },
    { key: 'Overdrawn', label: 'Overdrawn' },
    { key: 'Low', label: 'Low' },
    { key: 'OK', label: 'OK' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/10 to-cyan-500/5">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                <CalendarDays className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Holiday Balance</h1>
                <p className="text-sm text-muted-foreground">
                  {view === 'ref' ? `Payroll month: ${MONTH_NAMES[refIdx]} · ${refPeriod}` : getFiscalYearLabel()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {view === 'ref' ? (
                <div className="flex items-center gap-1 rounded-lg bg-background p-1 shadow-sm">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous month" onClick={() => setCurrentRefMonth(subMonths(currentRefMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[110px] px-3 text-center text-sm font-medium">{format(currentRefMonth, 'MMM yyyy')}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next month" onClick={() => setCurrentRefMonth(addMonths(currentRefMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-48 bg-background shadow-sm" aria-label="Holiday year"><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    {holidayYearOptions().map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="sm" onClick={recalculateAll} disabled={recalculating} className="shadow-sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {canExport && (view === 'ref' ? (
                <Button variant="outline" size="sm" onClick={exportRefCsv} className="shadow-sm">
                  <Download className="mr-2 h-4 w-4" />Export CSV
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="bg-emerald-600 shadow-sm hover:bg-emerald-700">
                      <Download className="mr-2 h-4 w-4" />Export<ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Excel files for {scopeLabel}, {getFiscalYearLabel().toLowerCase()}
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => runExport('tracker')} className="items-start gap-3 py-2.5">
                      <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <div className="font-medium">Holiday Tracker</div>
                        <div className="text-xs text-muted-foreground">Same layout as the HDAY_TRACKER sheet in the Time Sheet workbook</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => runExport('report')} className="items-start gap-3 py-2.5">
                      <FileBarChart className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <div>
                        <div className="font-medium">Balance Report</div>
                        <div className="text-xs text-muted-foreground">Summary, one line per person, hours by month, with status colours</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
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

      {view !== 'ref' && <HolidayKpis balances={filteredBalances} />}

      {/* Tabs, search and status chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={changeView}>
          <TabsList>
            <TabsTrigger value="balances" className="gap-2"><Users className="h-4 w-4" />Balances</TabsTrigger>
            <TabsTrigger value="tracker" className="gap-2"><Table2 className="h-4 w-4" />Monthly tracker</TabsTrigger>
            <TabsTrigger value="ref" className="gap-2"><ClipboardList className="h-4 w-4" />Payroll REF</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {view !== 'ref' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(chip.key)}
                  aria-pressed={statusFilter === chip.key}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === chip.key ? 'border-emerald-600 bg-emerald-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {chip.label} <span className="opacity-70">{statusCounts[chip.key]}</span>
                </button>
              ))}
            </div>
          )}
          <div className="relative w-full min-w-[200px] sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-background pl-10 shadow-sm" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><NizaLoaderInline /></div>
      ) : view === 'balances' ? (
        <BalancesView groupedByBranch={groupedByBranch} yearStart={selectedYear} />
      ) : view === 'tracker' ? (
        <TrackerView groupedByBranch={groupedByBranch} />
      ) : (
        /* Payroll REF: one payroll month, with the annum / per-hour figure and notes for payroll */
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b bg-gradient-to-r from-emerald-500/5 to-transparent px-4 py-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-emerald-600" />
              Payroll month {MONTH_NAMES[refIdx]} {refPeriod.slice(-4)} · {refPeriod}
              <span className="font-normal text-muted-foreground">· Niza Enterprise Ltd</span>
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
                    <TableHead className="w-24 bg-blue-50 text-center font-bold dark:bg-blue-950/50">TOTAL HOURS</TableHead>
                    <TableHead className="w-24 bg-amber-50 text-center font-bold dark:bg-amber-950/50">HOLIDAY HOURS</TableHead>
                    <TableHead className="w-28 bg-emerald-50 text-center font-bold dark:bg-emerald-950/50">ANNUM / PER HOUR</TableHead>
                    <TableHead className="min-w-[250px] font-bold">NOTES</TableHead>
                    <TableHead className="w-16 text-center">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedByBranch).map(([branchName, branchBalances]) => (
                    <React.Fragment key={branchName}>
                      {branchBalances.map((b, idx) => {
                        const note = payrollNotes[b.employee.id];
                        const worked = b.monthly_actual[refIdx];
                        const holiday = b.monthly_holiday[refIdx];
                        return (
                          <TableRow key={b.employee.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <TableCell className="text-center font-medium">{b.globalRef}</TableCell>
                            <TableCell className="text-center">{b.employeeRef}</TableCell>
                            <TableCell className="font-medium">{b.employee.first_name} {b.employee.last_name}</TableCell>
                            <TableCell className="text-muted-foreground">{branchName}</TableCell>
                            <TableCell className="bg-blue-50/50 text-center font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                              {worked > 0 ? worked.toFixed(1) : ''}
                            </TableCell>
                            <TableCell className="bg-amber-50/50 text-center font-semibold text-amber-600 dark:bg-amber-950/30">
                              {holiday > 0 ? holiday.toFixed(1) : ''}
                            </TableCell>
                            <TableCell className="bg-emerald-50/50 text-center font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {note?.annum_per_hour || ''}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{note?.notes || ''}</TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Edit payroll notes" onClick={() => openEditPanel(b)}>
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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

          <div className="space-y-6 py-6">
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

            <div className="space-y-2 rounded-lg bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours this payroll month</span>
                <span className="font-medium">{(editingEmployee?.monthly_actual[refIdx] ?? 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Holiday hours this payroll month</span>
                <span className="font-medium">{(editingEmployee?.monthly_holiday[refIdx] ?? 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Holiday remaining (year)</span>
                <span className="font-medium">{editingEmployee?.holiday_hours_remaining.toFixed(2) || 0}</span>
              </div>
            </div>
          </div>

          <SheetFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditPanel(false)}>Cancel</Button>
            <Button onClick={savePayrollNote} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
