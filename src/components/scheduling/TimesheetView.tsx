import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  ChevronLeft, ChevronRight, Save, Check, 
  Download, Loader2, Users, Plus, Search, Printer, Calendar
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, addMonths, subMonths, getWeek } from 'date-fns';
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

interface TimesheetEntry {
  id?: string;
  entry_date: string;
  day_of_week: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  break_duration_minutes: number;
  actual_hours: number;
  holiday_hours: number;
  sick_hours: number;
  adjustment_hours: number;
  entry_type: string;
  notes: string;
}

interface Timesheet {
  id: string;
  employee_id: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
  total_worked_hours: number;
  total_holiday_hours: number;
  total_sick_hours: number;
  total_adjustment_hours: number;
  notes: string | null;
  employee?: Employee;
  entries?: TimesheetEntry[];
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Get UK fiscal year (April - March)
const getFiscalYear = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month < 3) {
    return { start: year - 1, end: year, startDate: new Date(year - 1, 3, 1), endDate: new Date(year, 2, 31) };
  }
  return { start: year, end: year + 1, startDate: new Date(year, 3, 1), endDate: new Date(year + 1, 2, 31) };
};

// Get month name for fiscal year (Apr=0, Mar=11)
const FISCAL_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

export function TimesheetView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState<'weekly' | 'monthly'>('weekly');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [monthlyTimesheets, setMonthlyTimesheets] = useState<Timesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [lastMonthAdjustment, setLastMonthAdjustment] = useState<Record<string, number>>({});
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');
  const fiscalYear = getFiscalYear(currentMonth);
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  useEffect(() => {
    if (viewTab === 'weekly') fetchWeeklyData();
    else fetchMonthlyData();
    if (canViewFilters) fetchOrganizationsAndBranches();
  }, [currentWeekStart, currentMonth, viewTab]);

  const fetchOrganizationsAndBranches = async () => {
    const [orgsRes, branchesRes] = await Promise.all([
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('branches').select('id, name, organization_id').order('name')
    ]);
    setOrganizations(orgsRes.data || []);
    setBranches(branchesRes.data || []);
  };

  const fetchWeeklyData = async () => {
    setLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
        .in('status', ['active', 'onboarding'])
        .order('first_name');

      setEmployees(employeesData || []);

      const { data: timesheetsData } = await supabase
        .from('timesheets')
        .select('*, employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))')
        .eq('week_start_date', weekStartStr);

      // Fetch entries for each timesheet
      const timesheetsWithEntries = await Promise.all(
        (timesheetsData || []).map(async (ts) => {
          const { data: entriesData } = await supabase
            .from('timesheet_entries')
            .select('*')
            .eq('timesheet_id', ts.id)
            .order('entry_date');
          return { ...ts, entries: entriesData || [] };
        })
      );

      setTimesheets(timesheetsWithEntries);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch timesheet data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
        .in('status', ['active', 'onboarding'])
        .order('first_name');

      setEmployees(employeesData || []);

      const { data: timesheetsData } = await supabase
        .from('timesheets')
        .select('*, employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))')
        .gte('week_start_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('week_start_date', format(monthEnd, 'yyyy-MM-dd'));

      setMonthlyTimesheets(timesheetsData || []);

      // Fetch previous month data for (+/-) LAST MONTH column
      const prevMonthStart = startOfMonth(subMonths(currentMonth, 1));
      const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));
      const { data: prevMonthData } = await supabase
        .from('timesheets')
        .select('employee_id, total_adjustment_hours')
        .gte('week_start_date', format(prevMonthStart, 'yyyy-MM-dd'))
        .lte('week_start_date', format(prevMonthEnd, 'yyyy-MM-dd'));
      
      const adjustments: Record<string, number> = {};
      prevMonthData?.forEach(t => {
        adjustments[t.employee_id] = (adjustments[t.employee_id] || 0) + (Number(t.total_adjustment_hours) || 0);
      });
      setLastMonthAdjustment(adjustments);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      toast.error('Failed to fetch monthly data');
    } finally {
      setLoading(false);
    }
  };

  const createTimesheetForEmployee = async (employee: Employee) => {
    try {
      const { data: timesheet, error } = await supabase
        .from('timesheets')
        .insert({
          employee_id: employee.id,
          organization_id: employee.organization_id,
          branch_id: employee.branch_id,
          week_start_date: format(currentWeekStart, 'yyyy-MM-dd'),
          week_end_date: format(weekEnd, 'yyyy-MM-dd'),
          status: 'draft',
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      const entryInserts = weekDays.map((day, idx) => ({
        timesheet_id: timesheet.id,
        entry_date: format(day, 'yyyy-MM-dd'),
        day_of_week: DAYS_OF_WEEK[idx],
        entry_type: 'work',
        actual_hours: 0,
        holiday_hours: 0,
        sick_hours: 0,
        adjustment_hours: 0,
        break_duration_minutes: 0
      }));

      await supabase.from('timesheet_entries').insert(entryInserts);
      toast.success('Timesheet created');
      fetchWeeklyData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create timesheet';
      toast.error(message);
    }
  };

  const createAllTimesheets = async () => {
    const employeesWithoutTimesheet = filteredEmployees.filter(
      emp => !timesheets.some(t => t.employee_id === emp.id)
    );
    for (const emp of employeesWithoutTimesheet) {
      await createTimesheetForEmployee(emp);
    }
    toast.success(`Created ${employeesWithoutTimesheet.length} timesheets`);
  };

  const openTimesheetEditor = async (timesheet: Timesheet) => {
    const { data: entriesData } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', timesheet.id)
      .order('entry_date');

    setSelectedTimesheet(timesheet);
    setEntries(entriesData || []);
    setShowEditDialog(true);
  };

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: string | number | null) => {
    const updated = [...entries];
    const entry = { ...updated[index] };
    
    switch (field) {
      case 'shift_start_time':
      case 'shift_end_time':
      case 'day_of_week':
      case 'entry_date':
      case 'entry_type':
      case 'notes':
        entry[field] = value as string;
        break;
      case 'break_duration_minutes':
      case 'actual_hours':
      case 'holiday_hours':
      case 'sick_hours':
      case 'adjustment_hours':
        entry[field] = value as number;
        break;
    }
    
    updated[index] = entry;
    
    // Auto-calculate hours from start/end times
    if ((field === 'shift_start_time' || field === 'shift_end_time' || field === 'break_duration_minutes') 
        && updated[index].shift_start_time && updated[index].shift_end_time) {
      const start = updated[index].shift_start_time!;
      const end = updated[index].shift_end_time!;
      const breakMins = updated[index].break_duration_minutes || 0;
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      let totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
      if (totalMins < 0) totalMins += 24 * 60; // Overnight shift
      updated[index].actual_hours = Math.round(totalMins / 60 * 100) / 100;
    }
    setEntries(updated);
  };

  const saveTimesheet = async () => {
    if (!selectedTimesheet) return;
    setSaving(true);
    try {
      const totalWorked = entries.reduce((sum, e) => sum + (Number(e.actual_hours) || 0), 0);
      const totalHoliday = entries.reduce((sum, e) => sum + (Number(e.holiday_hours) || 0), 0);
      const totalSick = entries.reduce((sum, e) => sum + (Number(e.sick_hours) || 0), 0);
      const totalAdj = entries.reduce((sum, e) => sum + (Number(e.adjustment_hours) || 0), 0);

      for (const entry of entries) {
        if (entry.id) {
          await supabase.from('timesheet_entries').update({
            shift_start_time: entry.shift_start_time,
            shift_end_time: entry.shift_end_time,
            break_duration_minutes: entry.break_duration_minutes,
            actual_hours: entry.actual_hours,
            holiday_hours: entry.holiday_hours,
            sick_hours: entry.sick_hours,
            adjustment_hours: entry.adjustment_hours,
            entry_type: entry.entry_type,
            notes: entry.notes
          }).eq('id', entry.id);
        }
      }

      await supabase.from('timesheets').update({
        total_worked_hours: totalWorked,
        total_holiday_hours: totalHoliday,
        total_sick_hours: totalSick,
        total_adjustment_hours: totalAdj
      }).eq('id', selectedTimesheet.id);

      toast.success('Timesheet saved');
      setShowEditDialog(false);
      fetchWeeklyData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save timesheet';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const approveTimesheet = async (timesheetId: string) => {
    try {
      await supabase.from('timesheets').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id
      }).eq('id', timesheetId);

      const timesheet = timesheets.find(t => t.id === timesheetId);
      if (timesheet) {
        await supabase.rpc('calculate_holiday_balance', { p_employee_id: timesheet.employee_id });
      }
      toast.success('Timesheet approved');
      fetchWeeklyData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve timesheet';
      toast.error(message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'submitted': return <Badge variant="outline" className="border-blue-500 text-blue-600">Submitted</Badge>;
      case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filtering
  const filteredEmployees = useMemo(() => employees.filter(emp => {
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  }), [employees, searchQuery, canViewFilters, filterMode, selectedOrg, selectedBranch]);

  const employeesWithoutTimesheet = filteredEmployees.filter(
    emp => !timesheets.some(t => t.employee_id === emp.id)
  );

  const filteredTimesheets = useMemo(() => timesheets.filter(t => {
    const emp = t.employee;
    if (!emp) return true;
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  }), [timesheets, searchQuery, canViewFilters, filterMode, selectedOrg, selectedBranch]);

  // Group by branch with SUMIF totals
  const groupedTimesheets = useMemo(() => filteredTimesheets.reduce((acc, ts) => {
    const branchName = ts.employee?.branch?.name || 'Unassigned';
    if (!acc[branchName]) acc[branchName] = { timesheets: [], totals: { worked: 0, holiday: 0, sick: 0, adj: 0 } };
    acc[branchName].timesheets.push(ts);
    acc[branchName].totals.worked += Number(ts.total_worked_hours) || 0;
    acc[branchName].totals.holiday += Number(ts.total_holiday_hours) || 0;
    acc[branchName].totals.sick += Number(ts.total_sick_hours) || 0;
    acc[branchName].totals.adj += Number(ts.total_adjustment_hours) || 0;
    return acc;
  }, {} as Record<string, { timesheets: Timesheet[]; totals: { worked: number; holiday: number; sick: number; adj: number } }>), [filteredTimesheets]);

  // Grand totals
  const grandTotals = useMemo(() => ({
    worked: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0),
    holiday: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0),
    sick: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0),
    adj: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0)
  }), [filteredTimesheets]);

  // Monthly view data - matching Excel format
  const getMonthlyEmployeeData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const weeksInMonth = eachWeekOfInterval(
      { start: monthStart, end: endOfMonth(currentMonth) },
      { weekStartsOn: 1 }
    );

    const aggregated: Record<string, { 
      employee: Employee; 
      weeklyHours: (number | null)[];
      totalHours: number;
      totalHoliday: number;
      totalSick: number;
      lastMonthAdj: number;
      grandTotal: number;
    }> = {};

    monthlyTimesheets.forEach(ts => {
      if (!ts.employee) return;
      const empId = ts.employee_id;
      
      if (!aggregated[empId]) {
        aggregated[empId] = {
          employee: ts.employee,
          weeklyHours: weeksInMonth.map(() => null),
          totalHours: 0,
          totalHoliday: 0,
          totalSick: 0,
          lastMonthAdj: lastMonthAdjustment[empId] || 0,
          grandTotal: 0
        };
      }

      const weekIdx = weeksInMonth.findIndex(w => format(w, 'yyyy-MM-dd') === ts.week_start_date);
      if (weekIdx >= 0) {
        aggregated[empId].weeklyHours[weekIdx] = Number(ts.total_worked_hours) || 0;
      }
      
      aggregated[empId].totalHours += Number(ts.total_worked_hours) || 0;
      aggregated[empId].totalHoliday += Number(ts.total_holiday_hours) || 0;
      aggregated[empId].totalSick += Number(ts.total_sick_hours) || 0;
    });

    // Calculate grand totals
    Object.values(aggregated).forEach(emp => {
      emp.grandTotal = emp.totalHours + emp.lastMonthAdj;
    });

    // Group by branch
    const grouped: Record<string, typeof aggregated> = {};
    Object.entries(aggregated).forEach(([empId, data]) => {
      const branchName = data.employee.branch?.name || 'Unassigned';
      if (!grouped[branchName]) grouped[branchName] = {};
      grouped[branchName][empId] = data;
    });

    return { aggregated, grouped, weeksInMonth };
  }, [monthlyTimesheets, currentMonth, lastMonthAdjustment]);

  const weekTotals = useMemo(() => ({
    worked: entries.reduce((sum, e) => sum + (Number(e.actual_hours) || 0), 0),
    holiday: entries.reduce((sum, e) => sum + (Number(e.holiday_hours) || 0), 0),
    sick: entries.reduce((sum, e) => sum + (Number(e.sick_hours) || 0), 0),
    adj: entries.reduce((sum, e) => sum + (Number(e.adjustment_hours) || 0), 0)
  }), [entries]);

  const exportToCSV = () => {
    if (viewTab === 'weekly') {
      const headers = ['No', 'Staff Name', 'Location', ...DAYS_SHORT.flatMap(d => [`${d} Start`, `${d} End`]), 'HOURS', 'HOLIDAY', 'SICK', 'ADJ+/-', 'TOTAL', 'Status'];
      const rows: (string | number)[][] = [];
      let rowNum = 1;
      
      Object.entries(groupedTimesheets).forEach(([branchName, data]) => {
        rows.push([`📍 ${branchName}`, '', '', ...Array(DAYS_SHORT.length * 2 + 5).fill('')]);
        data.timesheets.forEach(t => {
          const dayEntries = t.entries || [];
          const total = Number(t.total_worked_hours) + Number(t.total_holiday_hours) + Number(t.total_sick_hours) + Number(t.total_adjustment_hours || 0);
          rows.push([
            rowNum++, 
            `${t.employee?.first_name} ${t.employee?.last_name}`, 
            branchName,
            ...DAYS_SHORT.flatMap((_, i) => {
              const entry = dayEntries[i];
              return [entry?.shift_start_time || '-', entry?.shift_end_time || '-'];
            }),
            t.total_worked_hours, 
            t.total_holiday_hours, 
            t.total_sick_hours, 
            t.total_adjustment_hours || 0, 
            total.toFixed(1), 
            t.status
          ]);
        });
        // Branch subtotal
        rows.push([
          '', `SUBTOTAL - ${branchName}`, '', ...Array(DAYS_SHORT.length * 2).fill(''),
          data.totals.worked.toFixed(1), data.totals.holiday.toFixed(1), data.totals.sick.toFixed(1), data.totals.adj.toFixed(1),
          (data.totals.worked + data.totals.holiday + data.totals.sick + data.totals.adj).toFixed(1), ''
        ]);
      });
      // Grand total
      rows.push([
        '', 'GRAND TOTAL', '', ...Array(DAYS_SHORT.length * 2).fill(''),
        grandTotals.worked.toFixed(1), grandTotals.holiday.toFixed(1), grandTotals.sick.toFixed(1), grandTotals.adj.toFixed(1),
        (grandTotals.worked + grandTotals.holiday + grandTotals.sick + grandTotals.adj).toFixed(1), ''
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TimeSheet_${format(currentWeekStart, 'yyyy-MM-dd')}.csv`;
      a.click();
    } else {
      // Monthly consolidation export matching Excel format
      const { grouped, weeksInMonth } = getMonthlyEmployeeData;
      const headers = ['NAME', ...weeksInMonth.map((_, i) => `WEEK ${i + 1}`), 'TOTAL', '(+/-) LAST MONTH', 'TOTAL HRS', 'HOLIDAY HRS', 'SICK'];
      const rows: (string | number)[][] = [];
      
      Object.entries(grouped).forEach(([branchName, branchData]) => {
        rows.push([`📍 ${branchName}`, ...Array(weeksInMonth.length + 5).fill('')]);
        const branchTotals = { weeks: weeksInMonth.map(() => 0), total: 0, lastMonth: 0, holiday: 0, sick: 0 };
        
        Object.values(branchData).forEach(emp => {
          rows.push([
            `${emp.employee.first_name} ${emp.employee.last_name}`,
            ...emp.weeklyHours.map(h => h !== null ? h.toFixed(1) : '-'),
            emp.totalHours.toFixed(1),
            emp.lastMonthAdj !== 0 ? emp.lastMonthAdj.toFixed(1) : '-',
            emp.grandTotal.toFixed(1),
            emp.totalHoliday > 0 ? emp.totalHoliday.toFixed(1) : '-',
            emp.totalSick > 0 ? emp.totalSick.toFixed(1) : '-'
          ]);
          emp.weeklyHours.forEach((h, i) => { if (h) branchTotals.weeks[i] += h; });
          branchTotals.total += emp.totalHours;
          branchTotals.lastMonth += emp.lastMonthAdj;
          branchTotals.holiday += emp.totalHoliday;
          branchTotals.sick += emp.totalSick;
        });
        
        rows.push([
          `SUBTOTAL - ${branchName}`,
          ...branchTotals.weeks.map(w => w.toFixed(1)),
          branchTotals.total.toFixed(1),
          branchTotals.lastMonth !== 0 ? branchTotals.lastMonth.toFixed(1) : '-',
          (branchTotals.total + branchTotals.lastMonth).toFixed(1),
          branchTotals.holiday.toFixed(1),
          branchTotals.sick.toFixed(1)
        ]);
      });

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TimeSheet_${format(currentMonth, 'MMMM_yyyy')}_Consolidated.csv`;
      a.click();
    }
    toast.success('Exported to CSV');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Staff Attendance Details
          </h2>
          <p className="text-muted-foreground">
            {viewTab === 'weekly' 
              ? `For the month of ${format(currentWeekStart, 'MMMM yy')}`
              : `Monthly Consolidation - ${format(currentMonth, 'MMMM yyyy')}`
            }
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'weekly' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly Entry</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Consolidation</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewTab === 'weekly' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-2 bg-muted rounded-md text-center text-sm font-medium min-w-[180px]">
                WEEK {getWeek(currentWeekStart)} • {format(currentWeekStart, 'dd/MM')} - {format(weekEnd, 'dd/MM/yyyy')}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-2 bg-muted rounded-md text-center text-sm font-medium min-w-[140px]">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <Button variant="outline" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </div>
      </div>

      {canViewFilters && (
        <OrgBranchFilter 
          organizations={organizations} 
          branches={branches} 
          viewMode={filterMode}
          selectedOrg={selectedOrg} 
          selectedBranch={selectedBranch} 
          onViewModeChange={setFilterMode}
          onOrgChange={setSelectedOrg} 
          onBranchChange={setSelectedBranch} 
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Staff</p>
              <p className="text-2xl font-bold">{filteredEmployees.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
          <div className="text-center">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">HOURS</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{grandTotals.worked.toFixed(1)}</p>
          </div>
        </Card>
        <Card className="p-4 bg-orange-50 dark:bg-orange-950/30">
          <div className="text-center">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">HOLIDAY</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{grandTotals.holiday.toFixed(1)}</p>
          </div>
        </Card>
        <Card className="p-4 bg-red-50 dark:bg-red-950/30">
          <div className="text-center">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">SICK</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{grandTotals.sick.toFixed(1)}</p>
          </div>
        </Card>
        <Card className="p-4 bg-green-50 dark:bg-green-950/30">
          <div className="text-center">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">TOTAL</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {(grandTotals.worked + grandTotals.holiday + grandTotals.sick + grandTotals.adj).toFixed(1)}
            </p>
          </div>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        {viewTab === 'weekly' && employeesWithoutTimesheet.length > 0 && (
          <Button onClick={createAllTimesheets}>
            <Plus className="h-4 w-4 mr-2" />Create All ({employeesWithoutTimesheet.length})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewTab === 'weekly' ? (
        /* Weekly View - Excel Format */
        <Card className="overflow-hidden print:shadow-none">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">
              WEEK {getWeek(currentWeekStart)} • {format(currentWeekStart, 'EEEE dd/MM/yyyy')} to {format(weekEnd, 'EEEE dd/MM/yyyy')}
            </h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1400px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 w-8 font-bold text-center">#</TableHead>
                    <TableHead className="sticky left-8 bg-muted/50 z-10 min-w-[130px] font-bold">NAME</TableHead>
                    {weekDays.map((day, i) => (
                      <TableHead key={i} colSpan={2} className="text-center font-bold border-x bg-muted/30">
                        <div>{DAYS_SHORT[i].toUpperCase()}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{format(day, 'dd/MM/yyyy')}</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900/50 font-bold">HOURS</TableHead>
                    <TableHead className="text-center bg-orange-100 dark:bg-orange-900/50 font-bold">HOLIDAY</TableHead>
                    <TableHead className="text-center bg-red-100 dark:bg-red-900/50 font-bold">SICK</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900/50 font-bold">ADJ+/-</TableHead>
                    <TableHead className="text-center bg-green-100 dark:bg-green-900/50 font-bold">TOTAL</TableHead>
                    <TableHead className="text-center font-bold print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedTimesheets).map(([branchName, data]) => (
                    <React.Fragment key={branchName}>
                      {/* Branch Header */}
                      <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                        <TableCell colSpan={22} className="font-bold text-primary py-2">
                          📍 {branchName} ({data.timesheets.length} staff)
                        </TableCell>
                      </TableRow>
                      {data.timesheets.map((ts, idx) => {
                        const dayEntries = ts.entries || [];
                        const total = Number(ts.total_worked_hours) + Number(ts.total_holiday_hours) + Number(ts.total_sick_hours) + Number(ts.total_adjustment_hours || 0);
                        return (
                          <TableRow key={ts.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10 text-center font-medium">{idx + 1}</TableCell>
                            <TableCell className="sticky left-8 bg-background z-10 font-bold">
                              {ts.employee?.first_name?.toUpperCase()} {ts.employee?.last_name?.toUpperCase()}
                            </TableCell>
                            {weekDays.map((_, dayIdx) => {
                              const entry = dayEntries.find(e => e.day_of_week === DAYS_OF_WEEK[dayIdx]);
                              return (
                                <React.Fragment key={dayIdx}>
                                  <TableCell className="text-center text-[10px] border-l">
                                    {entry?.shift_start_time ? format(parseISO(`2000-01-01T${entry.shift_start_time}`), 'h:mm a') : ''}
                                  </TableCell>
                                  <TableCell className="text-center text-[10px] border-r">
                                    {entry?.shift_end_time ? format(parseISO(`2000-01-01T${entry.shift_end_time}`), 'h:mm a') : ''}
                                  </TableCell>
                                </React.Fragment>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/30">
                              {ts.total_worked_hours > 0 ? `$${ts.total_worked_hours}` : '$0'}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-orange-50/50 dark:bg-orange-950/30 text-orange-600">
                              {ts.total_holiday_hours > 0 ? `$${ts.total_holiday_hours}` : ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-red-50/50 dark:bg-red-950/30 text-red-600">
                              {ts.total_sick_hours > 0 ? `$${ts.total_sick_hours}` : ''}
                            </TableCell>
                            <TableCell className={`text-center font-bold bg-purple-50/50 dark:bg-purple-950/30 ${(ts.total_adjustment_hours || 0) < 0 ? 'text-red-600' : (ts.total_adjustment_hours || 0) > 0 ? 'text-green-600' : ''}`}>
                              {ts.total_adjustment_hours ? `$${ts.total_adjustment_hours}` : ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-green-50/50 dark:bg-green-950/30">
                              ${total.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center print:hidden">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="outline" onClick={() => openTimesheetEditor(ts)}>Edit</Button>
                                {ts.status !== 'approved' && (
                                  <Button size="sm" variant="default" onClick={() => approveTimesheet(ts.id)}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Branch Subtotal */}
                      <TableRow className="bg-muted/60 border-b-2 font-bold">
                        <TableCell></TableCell>
                        <TableCell className="sticky left-8 bg-muted/60 z-10"></TableCell>
                        <TableCell colSpan={14}></TableCell>
                        <TableCell className="text-center bg-blue-100 dark:bg-blue-800">${data.totals.worked.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-orange-100 dark:bg-orange-800 text-orange-700">${data.totals.holiday.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-red-100 dark:bg-red-800 text-red-700">${data.totals.sick.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-purple-100 dark:bg-purple-800">${data.totals.adj.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-green-100 dark:bg-green-800">
                          ${(data.totals.worked + data.totals.holiday + data.totals.sick + data.totals.adj).toFixed(1)}
                        </TableCell>
                        <TableCell className="print:hidden"></TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                  
                  {/* Employees without timesheets */}
                  {employeesWithoutTimesheet.map((emp) => (
                    <TableRow key={emp.id} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell className="font-medium text-muted-foreground">{emp.first_name} {emp.last_name}</TableCell>
                      <TableCell colSpan={18} className="text-center text-muted-foreground italic">No timesheet created</TableCell>
                      <TableCell className="text-center print:hidden">
                        <Button size="sm" variant="outline" onClick={() => createTimesheetForEmployee(emp)}>
                          <Plus className="h-3 w-3 mr-1" />Create
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Grand Total */}
                  {filteredTimesheets.length > 0 && (
                    <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                      <TableCell></TableCell>
                      <TableCell className="sticky left-8 bg-primary/20 z-10 text-lg">GRAND TOTAL</TableCell>
                      <TableCell colSpan={14}></TableCell>
                      <TableCell className="text-center text-lg bg-blue-200 dark:bg-blue-700">${grandTotals.worked.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-orange-200 dark:bg-orange-700">${grandTotals.holiday.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-red-200 dark:bg-red-700">${grandTotals.sick.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-purple-200 dark:bg-purple-700">${grandTotals.adj.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-green-200 dark:bg-green-700">
                        ${(grandTotals.worked + grandTotals.holiday + grandTotals.sick + grandTotals.adj).toFixed(1)}
                      </TableCell>
                      <TableCell className="print:hidden"></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      ) : (
        /* Monthly Consolidation View - matching Excel format */
        <Card className="overflow-hidden print:shadow-none">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">MONTHLY CONSOLIDATION - {format(currentMonth, 'MMMM yyyy').toUpperCase()}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1200px]">
              {(() => {
                const { grouped, weeksInMonth } = getMonthlyEmployeeData;
                const monthlyGrandTotals = { weeks: weeksInMonth.map(() => 0), total: 0, lastMonth: 0, grandTotal: 0, holiday: 0, sick: 0 };
                
                return (
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[160px] font-bold">NAME</TableHead>
                        {weeksInMonth.map((w, idx) => (
                          <TableHead key={idx} className="text-center font-bold min-w-[70px]">
                            <div>WEEK {idx + 1}</div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center bg-blue-100 dark:bg-blue-900/50 font-bold">TOTAL</TableHead>
                        <TableHead className="text-center bg-yellow-100 dark:bg-yellow-900/50 font-bold">(+/-) LAST MONTH</TableHead>
                        <TableHead className="text-center bg-green-100 dark:bg-green-900/50 font-bold">TOTAL HRS</TableHead>
                        <TableHead className="text-center bg-orange-100 dark:bg-orange-900/50 font-bold">HOLIDAY HRS</TableHead>
                        <TableHead className="text-center bg-red-100 dark:bg-red-900/50 font-bold">SICK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(grouped).map(([branchName, branchData]) => {
                        const branchTotals = { weeks: weeksInMonth.map(() => 0), total: 0, lastMonth: 0, grandTotal: 0, holiday: 0, sick: 0 };
                        const dataArray = Object.values(branchData);
                        
                        dataArray.forEach(d => {
                          d.weeklyHours.forEach((h, i) => { if (h) branchTotals.weeks[i] += h; });
                          branchTotals.total += d.totalHours;
                          branchTotals.lastMonth += d.lastMonthAdj;
                          branchTotals.grandTotal += d.grandTotal;
                          branchTotals.holiday += d.totalHoliday;
                          branchTotals.sick += d.totalSick;
                        });
                        
                        monthlyGrandTotals.weeks.forEach((_, i) => { monthlyGrandTotals.weeks[i] += branchTotals.weeks[i]; });
                        monthlyGrandTotals.total += branchTotals.total;
                        monthlyGrandTotals.lastMonth += branchTotals.lastMonth;
                        monthlyGrandTotals.grandTotal += branchTotals.grandTotal;
                        monthlyGrandTotals.holiday += branchTotals.holiday;
                        monthlyGrandTotals.sick += branchTotals.sick;

                        return (
                          <React.Fragment key={branchName}>
                            <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                              <TableCell colSpan={weeksInMonth.length + 6} className="font-bold text-primary py-2">
                                📍 {branchName} ({dataArray.length} staff)
                              </TableCell>
                            </TableRow>
                            {dataArray.map((emp, idx) => (
                              <TableRow key={emp.employee.id} className="hover:bg-muted/30">
                                <TableCell className="sticky left-0 bg-background z-10 font-bold">
                                  {emp.employee.first_name?.toUpperCase()} {emp.employee.last_name?.toUpperCase()}
                                </TableCell>
                                {emp.weeklyHours.map((h, i) => (
                                  <TableCell key={i} className="text-center">
                                    {h !== null && h > 0 ? h.toFixed(1) : '-'}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/30">
                                  {emp.totalHours.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-center bg-yellow-50/50 dark:bg-yellow-950/30">
                                  {emp.lastMonthAdj !== 0 ? emp.lastMonthAdj.toFixed(1) : '-'}
                                </TableCell>
                                <TableCell className="text-center font-bold bg-green-50/50 dark:bg-green-950/30">
                                  {emp.grandTotal.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-center bg-orange-50/50 dark:bg-orange-950/30 text-orange-600">
                                  {emp.totalHoliday > 0 ? emp.totalHoliday.toFixed(1) : '-'}
                                </TableCell>
                                <TableCell className="text-center bg-red-50/50 dark:bg-red-950/30 text-red-600">
                                  {emp.totalSick > 0 ? emp.totalSick.toFixed(1) : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Branch Subtotal */}
                            <TableRow className="bg-muted/60 border-b-2 font-bold">
                              <TableCell className="sticky left-0 bg-muted/60 z-10 text-primary">SUBTOTAL</TableCell>
                              {branchTotals.weeks.map((w, i) => (
                                <TableCell key={i} className="text-center">{w.toFixed(1)}</TableCell>
                              ))}
                              <TableCell className="text-center bg-blue-100 dark:bg-blue-800">{branchTotals.total.toFixed(1)}</TableCell>
                              <TableCell className="text-center bg-yellow-100 dark:bg-yellow-800">
                                {branchTotals.lastMonth !== 0 ? branchTotals.lastMonth.toFixed(1) : '-'}
                              </TableCell>
                              <TableCell className="text-center bg-green-100 dark:bg-green-800">{branchTotals.grandTotal.toFixed(1)}</TableCell>
                              <TableCell className="text-center bg-orange-100 dark:bg-orange-800">{branchTotals.holiday.toFixed(1)}</TableCell>
                              <TableCell className="text-center bg-red-100 dark:bg-red-800">{branchTotals.sick.toFixed(1)}</TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                      {/* Grand Total */}
                      <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                        <TableCell className="sticky left-0 bg-primary/20 z-10 text-lg">GRAND TOTAL</TableCell>
                        {monthlyGrandTotals.weeks.map((w, i) => (
                          <TableCell key={i} className="text-center text-lg">{w.toFixed(1)}</TableCell>
                        ))}
                        <TableCell className="text-center text-lg bg-blue-200 dark:bg-blue-700">{monthlyGrandTotals.total.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-lg bg-yellow-200 dark:bg-yellow-700">
                          {monthlyGrandTotals.lastMonth !== 0 ? monthlyGrandTotals.lastMonth.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-center text-lg bg-green-200 dark:bg-green-700">{monthlyGrandTotals.grandTotal.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-lg bg-orange-200 dark:bg-orange-700">{monthlyGrandTotals.holiday.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-lg bg-red-200 dark:bg-red-700">{monthlyGrandTotals.sick.toFixed(1)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                );
              })()}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Edit Timesheet - {selectedTimesheet?.employee?.first_name} {selectedTimesheet?.employee?.last_name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Week of {selectedTimesheet ? format(parseISO(selectedTimesheet.week_start_date), 'dd/MM/yyyy') : ''}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Day</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="text-center font-bold">Start Time</TableHead>
                  <TableHead className="text-center font-bold">End Time</TableHead>
                  <TableHead className="text-center font-bold">Break (min)</TableHead>
                  <TableHead className="text-center bg-blue-100 dark:bg-blue-900 font-bold">Hours</TableHead>
                  <TableHead className="text-center bg-orange-100 dark:bg-orange-900 font-bold">Holiday</TableHead>
                  <TableHead className="text-center bg-red-100 dark:bg-red-900 font-bold">Sick</TableHead>
                  <TableHead className="text-center bg-purple-100 dark:bg-purple-900 font-bold">ADJ+/-</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={entry.id || idx} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{entry.day_of_week}</TableCell>
                    <TableCell>{format(parseISO(entry.entry_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        value={entry.shift_start_time || ''}
                        onChange={(e) => updateEntry(idx, 'shift_start_time', e.target.value)}
                        className="w-28 text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        value={entry.shift_end_time || ''}
                        onChange={(e) => updateEntry(idx, 'shift_end_time', e.target.value)}
                        className="w-28 text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={entry.break_duration_minutes || 0}
                        onChange={(e) => updateEntry(idx, 'break_duration_minutes', Number(e.target.value))}
                        className="w-20 text-center"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-center bg-blue-50/50 dark:bg-blue-950/30">
                      <Input
                        type="number"
                        value={entry.actual_hours || 0}
                        onChange={(e) => updateEntry(idx, 'actual_hours', Number(e.target.value))}
                        className="w-20 text-center font-bold"
                        step="0.25"
                      />
                    </TableCell>
                    <TableCell className="text-center bg-orange-50/50 dark:bg-orange-950/30">
                      <Input
                        type="number"
                        value={entry.holiday_hours || 0}
                        onChange={(e) => updateEntry(idx, 'holiday_hours', Number(e.target.value))}
                        className="w-20 text-center"
                        step="0.25"
                      />
                    </TableCell>
                    <TableCell className="text-center bg-red-50/50 dark:bg-red-950/30">
                      <Input
                        type="number"
                        value={entry.sick_hours || 0}
                        onChange={(e) => updateEntry(idx, 'sick_hours', Number(e.target.value))}
                        className="w-20 text-center"
                        step="0.25"
                      />
                    </TableCell>
                    <TableCell className="text-center bg-purple-50/50 dark:bg-purple-950/30">
                      <Input
                        type="number"
                        value={entry.adjustment_hours || 0}
                        onChange={(e) => updateEntry(idx, 'adjustment_hours', Number(e.target.value))}
                        className="w-20 text-center"
                        step="0.25"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {/* Week Totals */}
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell colSpan={5} className="text-right">WEEK TOTALS:</TableCell>
                  <TableCell className="text-center bg-blue-100 dark:bg-blue-800">{weekTotals.worked.toFixed(1)}</TableCell>
                  <TableCell className="text-center bg-orange-100 dark:bg-orange-800">{weekTotals.holiday.toFixed(1)}</TableCell>
                  <TableCell className="text-center bg-red-100 dark:bg-red-800">{weekTotals.sick.toFixed(1)}</TableCell>
                  <TableCell className="text-center bg-purple-100 dark:bg-purple-800">{weekTotals.adj.toFixed(1)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={saveTimesheet} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
