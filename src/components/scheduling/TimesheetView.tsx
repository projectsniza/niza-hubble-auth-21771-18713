import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, ChevronRight, Save, Check, 
  Download, Loader2, Users, Plus, Search, Calendar, Clock,
  FileSpreadsheet, Edit3, CheckCircle2, XCircle, X
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { TimesheetMonthLock } from './TimesheetMonthLock';
import { MonthCloseReminder } from './MonthCloseReminder';
import { TempStaffSection } from './TempStaffSection';
import { Lock } from 'lucide-react';
import { snapToHalfHour, isHalfHourAligned, HALF_HOUR_TIME_STEP } from '@/lib/timeSnap';
import { FullMonthEntryView } from './FullMonthEntryView';

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
const DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Payroll period: 21st of selected month to 20th of next month
const getPayrollPeriod = (month: Date) => {
  const year = month.getFullYear();
  const m = month.getMonth();
  return {
    start: new Date(year, m, 21),
    end: new Date(year, m + 1, 20),
  };
};

const getPayrollWeeks = (month: Date) => {
  const { start, end } = getPayrollPeriod(month);
  // Include the week that contains the payroll start date (Monday-based),
  // even if that Monday falls before the 21st. This ensures entries on the
  // 21st/22nd (Sat/Sun) appear in Week 1 of the monthly consolidation.
  const firstWeekMonday = startOfWeek(start, { weekStartsOn: 1 });
  const weeks = eachWeekOfInterval({ start: firstWeekMonday, end }, { weekStartsOn: 1 });
  return weeks.slice(0, 6);
};

const getCurrentPayrollWeekIndex = (weeks: Date[]) => {
  const today = new Date();
  const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const index = weeks.findIndex(w => format(w, 'yyyy-MM-dd') === format(todayWeekStart, 'yyyy-MM-dd'));
  return index >= 0 ? index : 0;
};

const isDateInPayrollPeriod = (date: Date, payrollMonth: Date) => {
  const { start, end } = getPayrollPeriod(payrollMonth);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d >= start && d <= end;
};

export function TimesheetView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState<'weekly' | 'monthly'>('weekly');
  const [entryView, setEntryView] = useState<'full' | 'single'>(() => (localStorage.getItem('scheduling.entryView') as any) || 'full');
  useEffect(() => { localStorage.setItem('scheduling.entryView', entryView); }, [entryView]);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    // Payroll cycle is 21st → 20th. Before the 21st we are still in the previous month's payroll.
    return today.getDate() < 21 ? subMonths(today, 1) : today;
  });
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(() => {
    const today = new Date();
    const base = today.getDate() < 21 ? subMonths(today, 1) : today;
    const weeks = getPayrollWeeks(base);
    return getCurrentPayrollWeekIndex(weeks);
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [allMonthTimesheets, setAllMonthTimesheets] = useState<Timesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [lastMonthAdjustment, setLastMonthAdjustment] = useState<Record<string, number>>({});
  const [inlineEditing, setInlineEditing] = useState<Record<string, Record<string, { start: string; end: string }>>>({});
  const [isMonthLocked, setIsMonthLocked] = useState<boolean>(false);
  // Per-branch weekly hour targets (Super Admin configures via the "Hour Targets" tab)
  const [branchTargets, setBranchTargets] = useState<Record<string, { target: number; low: number; high: number }>>({});
  // Per-branch temporary-staff hours for the current week (used in target indicator + summary)
  const [tempHoursByBranch, setTempHoursByBranch] = useState<Record<string, number>>({});
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');
  
  const monthWeeks = useMemo(() => getPayrollWeeks(currentMonth), [currentMonth]);
  const currentWeekStart = monthWeeks[selectedWeekIndex] || monthWeeks[0];
  const weekEnd = currentWeekStart ? endOfWeek(currentWeekStart, { weekStartsOn: 1 }) : new Date();
  const weekDays = currentWeekStart ? eachDayOfInterval({ start: currentWeekStart, end: weekEnd }) : [];

  useEffect(() => {
    fetchData();
    if (canViewFilters) fetchOrganizationsAndBranches();
  }, [currentMonth, selectedWeekIndex]);

  // Fetch weekly hour targets (one row per branch) — accessible to all roles via RLS
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('branch_weekly_hour_targets')
        .select('branch_id, target_hours, low_threshold_hours, high_threshold_hours');
      const map: Record<string, { target: number; low: number; high: number }> = {};
      (data || []).forEach((t: any) => {
        map[t.branch_id] = {
          target: Number(t.target_hours) || 0,
          low: Number(t.low_threshold_hours) || 0,
          high: Number(t.high_threshold_hours) || 0,
        };
      });
      setBranchTargets(map);
    })();
  }, []);

  // Fetch temp-staff actual hours per branch for the currently-viewed week
  useEffect(() => {
    if (!currentWeekStart) return;
    (async () => {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('temporary_timesheet_entries')
        .select('branch_id, actual_hours')
        .eq('week_start_date', weekStartStr);
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        map[row.branch_id] = (map[row.branch_id] || 0) + (Number(row.actual_hours) || 0);
      });
      setTempHoursByBranch(map);
    })();
  }, [currentWeekStart && format(currentWeekStart, 'yyyy-MM-dd')]);

  // Determine the branch in scope for the lock check
  const lockBranchId = user?.role === 'manager' ? user?.branchId || null : (selectedBranch || null);
  const canBypassLock = user?.role === 'super_admin';
  const editingDisabled = isMonthLocked && !canBypassLock;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lockBranchId) { setIsMonthLocked(false); return; }
      const monthStartStr = format(getPayrollPeriod(currentMonth).start, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('timesheet_month_locks')
        .select('id')
        .eq('branch_id', lockBranchId)
        .eq('month_start', monthStartStr)
        .maybeSingle();
      if (!cancelled) setIsMonthLocked(!!data);
    })();
    return () => { cancelled = true; };
  }, [lockBranchId, currentMonth]);

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
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
      const payroll = getPayrollPeriod(currentMonth);
      const prevPayroll = getPayrollPeriod(subMonths(currentMonth, 1));

      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, status, branch:branches(name)')
        .in('status', ['active', 'onboarding', 'on_leave'])
        .order('first_name');

      setEmployees(employeesData || []);


      const { data: weekTimesheetsData } = await supabase
        .from('timesheets')
        .select('*, employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))')
        .eq('week_start_date', weekStartStr);

      const timesheetsWithEntries = await Promise.all(
        (weekTimesheetsData || []).map(async (ts) => {
          const { data: entriesData } = await supabase
            .from('timesheet_entries')
            .select('*')
            .eq('timesheet_id', ts.id)
            .order('entry_date');
          return { ...ts, entries: entriesData || [] };
        })
      );
      setTimesheets(timesheetsWithEntries);

      // Use Monday of the week containing the payroll start so partial first
      // week (e.g. Sat 21 / Sun 22 with Mon-start 16) is included.
      const monthRangeStart = startOfWeek(payroll.start, { weekStartsOn: 1 });
      const prevMonthRangeStart = startOfWeek(prevPayroll.start, { weekStartsOn: 1 });

      const { data: monthTimesheetsData } = await supabase
        .from('timesheets')
        .select('*, employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))')
        .gte('week_start_date', format(monthRangeStart, 'yyyy-MM-dd'))
        .lte('week_start_date', format(payroll.end, 'yyyy-MM-dd'));

      // Fetch entries for ALL month timesheets so partial weeks (week 1 starting
      // before 21st, week 6 extending past 20th) can be summed by date.
      const monthTsList = monthTimesheetsData || [];
      const monthTsIds = monthTsList.map((t: any) => t.id);
      let entriesByTs: Record<string, any[]> = {};
      if (monthTsIds.length) {
        const { data: allEntries } = await supabase
          .from('timesheet_entries')
          .select('*')
          .in('timesheet_id', monthTsIds);
        (allEntries || []).forEach((e: any) => {
          (entriesByTs[e.timesheet_id] ||= []).push(e);
        });
      }
      const monthTsWithEntries = monthTsList.map((t: any) => ({ ...t, entries: entriesByTs[t.id] || [] }));

      setAllMonthTimesheets(monthTsWithEntries);


      const { data: prevMonthData } = await supabase
        .from('timesheets')
        .select('employee_id, total_adjustment_hours')
        .gte('week_start_date', format(prevMonthRangeStart, 'yyyy-MM-dd'))
        .lte('week_start_date', format(prevPayroll.end, 'yyyy-MM-dd'));
      
      const adjustments: Record<string, number> = {};
      prevMonthData?.forEach(t => {
        adjustments[t.employee_id] = (adjustments[t.employee_id] || 0) + (Number(t.total_adjustment_hours) || 0);
      });
      setLastMonthAdjustment(adjustments);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch timesheet data');
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
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create timesheet';
      toast.error(message);
      return false;
    }
  };

  const [creatingAll, setCreatingAll] = useState(false);
  
  const createAllTimesheets = async () => {
    const employeesWithoutTimesheet = filteredEmployees.filter(
      emp => !timesheets.some(t => t.employee_id === emp.id)
    );
    if (employeesWithoutTimesheet.length === 0) {
      toast.info('All employees already have timesheets for this week');
      return;
    }
    setCreatingAll(true);
    let count = 0;
    for (const emp of employeesWithoutTimesheet) {
      const success = await createTimesheetForEmployee(emp);
      if (success) count++;
    }
    toast.success(`Created ${count} timesheets`);
    setCreatingAll(false);
    fetchData();
  };

  const openTimesheetEditor = async (timesheet: Timesheet) => {
    const { data: entriesData } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', timesheet.id)
      .order('entry_date');

    setSelectedTimesheet(timesheet);
    setEntries(entriesData || []);
    setShowEditPanel(true);
  };

  // Open timesheet editor for a specific employee and week (for monthly view)
  const openTimesheetEditorForWeek = async (employeeId: string, weekIdx: number) => {
    const weekStart = monthWeeks[weekIdx];
    if (!weekStart) return;

    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    
    // Find existing timesheet
    const existingTimesheet = allMonthTimesheets.find(
      ts => ts.employee_id === employeeId && ts.week_start_date === weekStartStr
    );

    if (existingTimesheet) {
      // Open existing timesheet
      const { data: entriesData } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('timesheet_id', existingTimesheet.id)
        .order('entry_date');

      setSelectedTimesheet(existingTimesheet);
      setEntries(entriesData || []);
      setShowEditPanel(true);
    } else {
      // Create timesheet for this week
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) {
        toast.error('Employee not found');
        return;
      }

      const wkEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const wkDays = eachDayOfInterval({ start: weekStart, end: wkEnd });

      try {
        const { data: timesheet, error } = await supabase
          .from('timesheets')
          .insert({
            employee_id: employee.id,
            organization_id: employee.organization_id,
            branch_id: employee.branch_id,
            week_start_date: weekStartStr,
            week_end_date: format(wkEnd, 'yyyy-MM-dd'),
            status: 'draft',
            created_by: user?.id
          })
          .select()
          .single();

        if (error) throw error;

        const entryInserts = wkDays.map((day, idx) => ({
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

        // Fetch and open the new timesheet
        const { data: newEntriesData } = await supabase
          .from('timesheet_entries')
          .select('*')
          .eq('timesheet_id', timesheet.id)
          .order('entry_date');

        setSelectedTimesheet({ ...timesheet, employee });
        setEntries(newEntriesData || []);
        setShowEditPanel(true);
        fetchData(); // Refresh data
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create timesheet';
        toast.error(message);
      }
    }
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
    
    if ((field === 'shift_start_time' || field === 'shift_end_time' || field === 'break_duration_minutes') 
        && updated[index].shift_start_time && updated[index].shift_end_time) {
      const start = updated[index].shift_start_time!;
      const end = updated[index].shift_end_time!;
      const breakMins = updated[index].break_duration_minutes || 0;
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      let totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
      if (totalMins < 0) totalMins += 24 * 60;
      updated[index].actual_hours = Math.round(totalMins / 60 * 100) / 100;
    }
    setEntries(updated);
  };

  const saveTimesheet = async () => {
    if (!selectedTimesheet) return;
    if (editingDisabled) { toast.error('This payroll period is locked.'); return; }
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
      setShowEditPanel(false);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save timesheet';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const approveTimesheet = async (timesheetId: string) => {
    if (editingDisabled) { toast.error('This payroll period is locked.'); return; }
    try {
      await supabase.from('timesheets').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id
      }).eq('id', timesheetId);

      const timesheet = timesheets.find(t => t.id === timesheetId);
      if (timesheet) {
        try {
          await supabase.rpc('calculate_holiday_balance', { p_employee_id: timesheet.employee_id });
        } catch {}
      }
      toast.success('Timesheet approved');
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve timesheet';
      toast.error(message);
    }
  };

  // Inline time update
  const handleInlineTimeChange = useCallback((timesheetId: string, dayOfWeek: string, field: 'start' | 'end', value: string) => {
    if (editingDisabled) {
      toast.error('This payroll period is locked. Contact a Super Admin to unlock.');
      return;
    }
    setInlineEditing(prev => ({
      ...prev,
      [timesheetId]: {
        ...prev[timesheetId],
        [dayOfWeek]: {
          ...(prev[timesheetId]?.[dayOfWeek] || { start: '', end: '' }),
          [field]: value
        }
      }
    }));
  }, [editingDisabled]);

  const saveInlineTime = useCallback(async (timesheet: Timesheet, dayOfWeek: string, opts?: { clear?: boolean; keepEditing?: boolean }) => {
    if (editingDisabled) {
      toast.error('This payroll period is locked.');
      return;
    }
    const edit = inlineEditing[timesheet.id]?.[dayOfWeek];
    const entry = timesheet.entries?.find(e => e.day_of_week === dayOfWeek);
    if (!entry?.id) return;

    let startTime: string | null;
    let endTime: string | null;

    if (opts?.clear) {
      startTime = null;
      endTime = null;
    } else {
      if (!edit) return;
      // Use edit values when present (including empty string => null), otherwise fall back to existing
      startTime = edit.start !== undefined && edit.start !== ''
        ? edit.start
        : (edit.start === '' ? null : entry.shift_start_time || null);
      endTime = edit.end !== undefined && edit.end !== ''
        ? edit.end
        : (edit.end === '' ? null : entry.shift_end_time || null);
    }

    let actualHours = 0;
    if (startTime && endTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      let totalMins = (endH * 60 + endM) - (startH * 60 + startM);
      if (totalMins < 0) totalMins += 24 * 60;
      actualHours = Math.round(totalMins / 60 * 100) / 100;
    }

    await supabase.from('timesheet_entries').update({
      shift_start_time: startTime,
      shift_end_time: endTime,
      actual_hours: actualHours
    }).eq('id', entry.id);

    // Do NOT manually update total_worked_hours here — the database trigger
    // (update_timesheet_totals_trigger) recalculates totals from all entries
    // automatically. Manually overwriting from a possibly-stale local
    // `timesheet.entries` snapshot caused race conditions where 0.5h / 1h
    // appeared "deducted" when multiple cells were edited in quick succession.

    // Read the freshly recalculated totals from the DB so the UI reflects
    // the authoritative trigger-computed values.
    const { data: refreshed } = await supabase
      .from('timesheets')
      .select('total_worked_hours, total_holiday_hours, total_sick_hours, total_adjustment_hours')
      .eq('id', timesheet.id)
      .maybeSingle();

    const totalWorked = Number(refreshed?.total_worked_hours) || 0;

    // Optimistically update local timesheets state — no full refetch (prevents refresh that interrupts editing)
    setTimesheets(prev => prev.map(ts => {
      if (ts.id !== timesheet.id) return ts;
      return {
        ...ts,
        total_worked_hours: totalWorked,
        total_holiday_hours: Number(refreshed?.total_holiday_hours ?? ts.total_holiday_hours) || 0,
        total_sick_hours: Number(refreshed?.total_sick_hours ?? ts.total_sick_hours) || 0,
        total_adjustment_hours: Number(refreshed?.total_adjustment_hours ?? ts.total_adjustment_hours) || 0,
        entries: ts.entries?.map(e =>
          e.day_of_week === dayOfWeek
            ? { ...e, shift_start_time: startTime, shift_end_time: endTime, actual_hours: actualHours }
            : e
        ),
      };
    }));

    if (!opts?.keepEditing) {
      setInlineEditing(prev => {
        const newState = { ...prev };
        if (newState[timesheet.id]) {
          delete newState[timesheet.id][dayOfWeek];
        }
        return newState;
      });
    }

    if (opts?.clear) toast.success('Shift cleared');
  }, [inlineEditing, editingDisabled]);

  const resetInlineTime = useCallback(async (timesheet: Timesheet, dayOfWeek: string) => {
    // Clear local edit state first
    setInlineEditing(prev => {
      const newState = { ...prev };
      if (newState[timesheet.id]) delete newState[timesheet.id][dayOfWeek];
      return newState;
    });
    await saveInlineTime(timesheet, dayOfWeek, { clear: true });
  }, [saveInlineTime]);

  const filteredEmployees = useMemo(() => employees.filter(emp => {
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  }), [employees, searchQuery, canViewFilters, filterMode, selectedOrg, selectedBranch]);

  const employeesWithoutTimesheet = useMemo(() => filteredEmployees.filter(
    emp => !timesheets.some(t => t.employee_id === emp.id)
  ), [filteredEmployees, timesheets]);

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

  const groupedTimesheets = useMemo(() => {
    // Deduplicate timesheets where the same employee (by name within a branch)
    // appears more than once for the week. Keep the row with the highest
    // total activity (worked+holiday+sick+adj). This avoids showing duplicate
    // names like "MOHAMMED ARSHAD" twice when there are duplicate employee
    // records in the database.
    const dedupMap = new Map<string, Timesheet>();
    filteredTimesheets.forEach(ts => {
      const branchName = ts.employee?.branch?.name || 'Unassigned';
      const fullName = `${ts.employee?.first_name || ''} ${ts.employee?.last_name || ''}`.trim().toUpperCase();
      const key = `${branchName}::${fullName}`;
      const existing = dedupMap.get(key);
      const tsTotal = (Number(ts.total_worked_hours) || 0) + (Number(ts.total_holiday_hours) || 0) + (Number(ts.total_sick_hours) || 0) + (Number(ts.total_adjustment_hours) || 0);
      if (!existing) {
        dedupMap.set(key, ts);
      } else {
        const exTotal = (Number(existing.total_worked_hours) || 0) + (Number(existing.total_holiday_hours) || 0) + (Number(existing.total_sick_hours) || 0) + (Number(existing.total_adjustment_hours) || 0);
        if (tsTotal > exTotal) dedupMap.set(key, ts);
      }
    });
    const dedupedTimesheets = Array.from(dedupMap.values());

    const grouped = dedupedTimesheets.reduce((acc, ts) => {
      const branchName = ts.employee?.branch?.name;
      // Skip employees with no branch (avoids stray "Unassigned" group when
      // viewing a specific branch — e.g. WELCOME SHEPERDSBush).
      if (!branchName) return acc;
      if (!acc[branchName]) acc[branchName] = { timesheets: [], totals: { worked: 0, holiday: 0, sick: 0, adj: 0, total: 0 } };
      acc[branchName].timesheets.push(ts);
      const worked = Number(ts.total_worked_hours) || 0;
      const holiday = Number(ts.total_holiday_hours) || 0;
      const sick = Number(ts.total_sick_hours) || 0;
      const adj = Number(ts.total_adjustment_hours) || 0;
      acc[branchName].totals.worked += worked;
      acc[branchName].totals.holiday += holiday;
      acc[branchName].totals.sick += sick;
      acc[branchName].totals.adj += adj;
      acc[branchName].totals.total += worked + holiday + sick + adj;
      return acc;
    }, {} as Record<string, { timesheets: Timesheet[]; totals: { worked: number; holiday: number; sick: number; adj: number; total: number } }>);
    return grouped;
  }, [filteredTimesheets]);


  const weeklyGrandTotals = useMemo(() => ({
    worked: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0),
    holiday: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0),
    sick: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0),
    adj: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0)
  }), [filteredTimesheets]);

  const monthlyConsolidation = useMemo(() => {
    const consolidation: Record<string, {
      employee: Employee;
      weeklyHours: number[];
      totalHours: number;
      lastMonthAdj: number;
      totalHrs: number;
      holidayHrs: number;
      sickHrs: number;
    }> = {};

    filteredEmployees.forEach(emp => {
      consolidation[emp.id] = {
        employee: emp,
        weeklyHours: monthWeeks.map(() => 0),
        totalHours: 0,
        lastMonthAdj: lastMonthAdjustment[emp.id] || 0,
        totalHrs: 0,
        holidayHrs: 0,
        sickHrs: 0
      };
    });

    const payroll = getPayrollPeriod(currentMonth);

    // Apply same scope filters (org/branch/search) used elsewhere
    const scopedMonthTs = allMonthTimesheets.filter(ts => {
      const emp = ts.employee;
      if (!emp) return false;
      const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (!canViewFilters) return true;
      if (filterMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
      if (filterMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
      return true;
    });

    scopedMonthTs.forEach(ts => {
      // Auto-include employees that have timesheets in this payroll period but
      // are missing from the active employees list (e.g. MOHAMMED ARSHAD with
      // a non-active status). Skip if no employee record was joined or no branch.
      if (!consolidation[ts.employee_id]) {
        if (!ts.employee || !ts.employee.branch?.name) return;
        consolidation[ts.employee_id] = {
          employee: ts.employee as Employee,
          weeklyHours: monthWeeks.map(() => 0),
          totalHours: 0,
          lastMonthAdj: lastMonthAdjustment[ts.employee_id] || 0,
          totalHrs: 0,
          holidayHrs: 0,
          sickHrs: 0,
        };
      }

      const weekIdx = monthWeeks.findIndex(w => format(w, 'yyyy-MM-dd') === ts.week_start_date);

      // Sum entries restricted to dates within the payroll period (21st → 20th).
      // Partial weeks (week 1 may start before 21st, week 6 may extend past 20th)
      // must only count in-period days.
      const entries = (ts as any).entries as Array<any> | undefined;
      let worked = 0, holiday = 0, sick = 0;
      if (entries && entries.length) {
        entries.forEach((e: any) => {
          const d = parseISO(e.entry_date);
          const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (dd < payroll.start || dd > payroll.end) return;
          worked += Number(e.actual_hours) || 0;
          holiday += Number(e.holiday_hours) || 0;
          sick += Number(e.sick_hours) || 0;
        });
      } else {
        // Fallback to stored totals when entries weren't loaded
        worked = Number(ts.total_worked_hours) || 0;
        holiday = Number(ts.total_holiday_hours) || 0;
        sick = Number(ts.total_sick_hours) || 0;
      }

      if (weekIdx >= 0) {
        consolidation[ts.employee_id].weeklyHours[weekIdx] += worked;
      }
      consolidation[ts.employee_id].totalHours += worked;
      consolidation[ts.employee_id].holidayHrs += holiday;
      consolidation[ts.employee_id].sickHrs += sick;
    });

    Object.values(consolidation).forEach(emp => {
      emp.totalHrs = emp.totalHours + emp.lastMonthAdj;
    });

    const grouped: Record<string, typeof consolidation> = {};
    Object.entries(consolidation).forEach(([empId, data]) => {
      const branchName = data.employee.branch?.name;
      if (!branchName) return; // hide Unassigned
      if (!grouped[branchName]) grouped[branchName] = {};
      grouped[branchName][empId] = data;
    });

    return { consolidation, grouped };
  }, [filteredEmployees, allMonthTimesheets, monthWeeks, lastMonthAdjustment, currentMonth, searchQuery, canViewFilters, filterMode, selectedOrg, selectedBranch]);


  const monthlyGrandTotals = useMemo(() => {
    const values = Object.values(monthlyConsolidation.consolidation);
    return {
      weeklyTotals: monthWeeks.map((_, i) => values.reduce((sum, v) => sum + v.weeklyHours[i], 0)),
      totalHours: values.reduce((sum, v) => sum + v.totalHours, 0),
      totalHrs: values.reduce((sum, v) => sum + v.totalHrs, 0),
      holidayHrs: values.reduce((sum, v) => sum + v.holidayHrs, 0),
      sickHrs: values.reduce((sum, v) => sum + v.sickHrs, 0)
    };
  }, [monthlyConsolidation, monthWeeks]);

  const exportToCSV = async () => {
    const headers = viewTab === 'weekly' 
      ? ['', 'NAME', 'FROM (BRANCH)', ...DAYS_SHORT.flatMap(d => [d, '']), 'HOURS', 'HOLIDAY', 'SICK', 'ADJ+/-', 'TOTAL']
      : ['', 'NAME', ...monthWeeks.map((_, i) => `WEEK ${i + 1}`), 'TOTAL', '(+/-) LAST MONTH', 'TOTAL HRS', 'HOLIDAY HRS', 'SICK'];
    
    const rows: string[][] = [headers];
    
    if (viewTab === 'weekly') {
      // Pre-fetch temporary staff for all branches in scope, for the current week
      const branchIds = Object.values(groupedTimesheets)
        .map(d => d.timesheets[0]?.employee?.branch_id || (d as any).branchId)
        .filter(Boolean);
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
      const weekEndDate = new Date(currentWeekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEndStr = format(weekEndDate, 'yyyy-MM-dd');

      let tempsByBranch: Record<string, any[]> = {};
      let tempEntriesByTemp: Record<string, any[]> = {};
      let sourceBranchNames: Record<string, string> = {};

      try {
        // Get temps for all branches we currently view (filter by branch name match later)
        const { data: allTemps } = await supabase
          .from('temporary_employees')
          .select('*')
          .lte('start_date', weekEndStr)
          .or(`end_date.is.null,end_date.gte.${weekStartStr}`);
        const temps = (allTemps || []) as any[];

        if (temps.length > 0) {
          const tempIds = temps.map(t => t.id);
          const { data: tEntries } = await supabase
            .from('temporary_timesheet_entries')
            .select('*')
            .in('temporary_employee_id', tempIds)
            .eq('week_start_date', weekStartStr);
          (tEntries || []).forEach((e: any) => {
            (tempEntriesByTemp[e.temporary_employee_id] ||= []).push(e);
          });

          // Resolve source branch names
          const srcIds = Array.from(new Set(temps.map(t => t.source_branch_id).filter(Boolean)));
          if (srcIds.length) {
            const { data: srcBranches } = await supabase
              .from('branches').select('id, name').in('id', srcIds);
            (srcBranches || []).forEach((b: any) => { sourceBranchNames[b.id] = b.name; });
          }

          // Group by host branch_id
          temps.forEach(t => { (tempsByBranch[t.branch_id] ||= []).push(t); });
        }
      } catch (err) {
        console.error('Failed to load temp staff for export', err);
      }

      const dayCols = DAYS_OF_WEEK.length * 2; // start/end per day

      Object.entries(groupedTimesheets).forEach(([branchName, data]) => {
        const branchId = data.timesheets[0]?.employee?.branch_id;
        rows.push([branchName, ...Array(headers.length - 1).fill('')]);

        // Regular employees
        data.timesheets.forEach(t => {
          const dayEntries = t.entries || [];
          const total = Number(t.total_worked_hours) + Number(t.total_holiday_hours) + Number(t.total_sick_hours) + Number(t.total_adjustment_hours || 0);
          rows.push([
            '', 
            `${t.employee?.first_name} ${t.employee?.last_name}`.toUpperCase(),
            '', // FROM (BRANCH) — empty for permanent staff
            ...DAYS_OF_WEEK.flatMap((day) => {
              const entry = dayEntries.find(e => e.day_of_week === day);
              return [entry?.shift_start_time || '', entry?.shift_end_time || ''];
            }),
            String(t.total_worked_hours || 0),
            t.total_holiday_hours ? String(t.total_holiday_hours) : '',
            t.total_sick_hours ? String(t.total_sick_hours) : '',
            t.total_adjustment_hours ? String(t.total_adjustment_hours) : '',
            String(total.toFixed(1))
          ]);
        });

        // Temporary staff for this branch — same row format
        const branchTemps = branchId ? (tempsByBranch[branchId] || []) : [];
        let tempWorked = 0;
        branchTemps.forEach((temp: any) => {
          const tEntries = tempEntriesByTemp[temp.id] || [];
          const fromLabel = temp.source_branch_id
            ? (sourceBranchNames[temp.source_branch_id] || 'Other branch')
            : (temp.source_name || '');
          const worked = tEntries.reduce((s: number, e: any) => s + (Number(e.actual_hours) || 0), 0);
          tempWorked += worked;
          rows.push([
            '',
            `[TEMP] ${temp.first_name} ${temp.last_name || ''}`.toUpperCase().trim(),
            fromLabel,
            ...DAYS_OF_WEEK.flatMap((day) => {
              const entry = tEntries.find((e: any) => e.day_of_week === day);
              return [entry?.shift_start_time || '', entry?.shift_end_time || ''];
            }),
            worked ? worked.toFixed(1) : '',
            '', '', '',
            worked ? worked.toFixed(1) : '0.0',
          ]);
        });

        const totalWorked = data.totals.worked + tempWorked;
        const grandTotal = data.totals.total + tempWorked;
        rows.push(['', 'SUBTOTAL', '', ...Array(dayCols).fill(''), 
          String(totalWorked.toFixed(1)),
          String(data.totals.holiday.toFixed(1)),
          String(data.totals.sick.toFixed(1)),
          String(data.totals.adj.toFixed(1)),
          String(grandTotal.toFixed(1))
        ]);
      });
    } else {
      Object.entries(monthlyConsolidation.grouped).forEach(([branchName, branchData]) => {
        rows.push([branchName, ...Array(headers.length - 1).fill('')]);
        Object.values(branchData).forEach(emp => {
          rows.push([
            '',
            `${emp.employee.first_name} ${emp.employee.last_name}`.toUpperCase(),
            ...emp.weeklyHours.map(h => h > 0 ? h.toFixed(1) : '-'),
            emp.totalHours.toFixed(1),
            emp.lastMonthAdj !== 0 ? emp.lastMonthAdj.toFixed(1) : '-',
            emp.totalHrs.toFixed(1),
            emp.holidayHrs > 0 ? emp.holidayHrs.toFixed(1) : '-',
            emp.sickHrs > 0 ? emp.sickHrs.toFixed(1) : '-'
          ]);
        });
      });
    }

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = viewTab === 'weekly' 
      ? `TimeSheet_Week${selectedWeekIndex + 1}_${format(currentMonth, 'MMM_yy')}.csv`
      : `TimeSheet_${format(currentMonth, 'MMMM_yyyy')}_Consolidated.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const formatTimeDisplay = (time: string | null) => {
    if (!time) return '';
    try {
      const [h, m] = time.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <Card className="border-0 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Staff Attendance Details</h1>
                <p className="text-muted-foreground">
                  Payroll: {format(getPayrollPeriod(currentMonth).start, 'dd MMM yyyy')} – {format(getPayrollPeriod(currentMonth).end, 'dd MMM yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'weekly' | 'monthly')} className="bg-background rounded-lg p-1 shadow-sm">
                <TabsList className="grid grid-cols-2 gap-1">
                  <TabsTrigger value="weekly" className="text-sm">Weekly Entry</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-sm">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-1 bg-background rounded-lg p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedWeekIndex(0); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm font-medium min-w-[100px] text-center">{format(getPayrollPeriod(currentMonth).end, 'MMM yyyy')}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedWeekIndex(0); }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {viewTab === 'weekly' && (
                <div className="flex items-center gap-1 bg-background rounded-lg p-1 shadow-sm">
                  <Button size="sm" variant={entryView === 'full' ? 'default' : 'ghost'} className="h-7 text-xs" onClick={() => setEntryView('full')}>Full View</Button>
                  <Button size="sm" variant={entryView === 'single' ? 'default' : 'ghost'} className="h-7 text-xs" onClick={() => setEntryView('single')}>Weekly View</Button>
                </div>
              )}

              {viewTab === 'weekly' && entryView === 'single' && (
                <Select value={String(selectedWeekIndex)} onValueChange={(v) => setSelectedWeekIndex(Number(v))}>
                  <SelectTrigger className="w-28 bg-background shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthWeeks.map((_, idx) => (
                      <SelectItem key={idx} value={String(idx)}>WEEK {idx + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Button variant="outline" size="sm" onClick={exportToCSV} className="shadow-sm">
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
              
              {/* Monthly Lock/Submit */}
              <TimesheetMonthLock
                branchId={user?.role === 'manager' ? user?.branchId || null : (selectedBranch || null)}
                organizationId={user?.role === 'manager' ? user?.organizationId : selectedOrg || null}
                monthStart={getPayrollPeriod(currentMonth).start}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <MonthCloseReminder branchId={lockBranchId} />

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
        <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Staff</p>
              <p className="text-xl font-bold">{filteredEmployees.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">Hours</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {(viewTab === 'weekly' ? weeklyGrandTotals.worked : monthlyGrandTotals.totalHours).toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">Holiday</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {(viewTab === 'weekly' ? weeklyGrandTotals.holiday : monthlyGrandTotals.holidayHrs).toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide">Sick</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">
              {(viewTab === 'weekly' ? weeklyGrandTotals.sick : monthlyGrandTotals.sickHrs).toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {(viewTab === 'weekly' 
                ? (weeklyGrandTotals.worked + weeklyGrandTotals.holiday + weeklyGrandTotals.sick + weeklyGrandTotals.adj)
                : monthlyGrandTotals.totalHrs
              ).toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search employees..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-10 bg-background shadow-sm" 
          />
        </div>
        {viewTab === 'weekly' && employeesWithoutTimesheet.length > 0 && (
          <Button onClick={createAllTimesheets} disabled={creatingAll} className="shadow-sm">
            {creatingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {creatingAll ? 'Creating...' : `Create All (${employeesWithoutTimesheet.length})`}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <NizaLoaderInline />
        </div>
      ) : viewTab === 'weekly' && entryView === 'full' ? (
        <FullMonthEntryView
          currentMonth={currentMonth}
          filterMode={filterMode}
          selectedOrg={selectedOrg}
          selectedBranch={selectedBranch}
          onJumpToWeek={(wi) => { setEntryView('single'); setSelectedWeekIndex(wi); }}
        />
      ) : viewTab === 'weekly' ? (
        <>
        {/* Weekly View */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/5 to-transparent border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              <Calendar className="h-4 w-4 text-primary" />
              WEEK {selectedWeekIndex + 1} • {currentWeekStart && format(currentWeekStart, 'dd MMM')} - {weekEnd && format(weekEnd, 'dd MMM yyyy')}
              {editingDisabled && (
                <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-800 text-[10px] gap-1">
                  <Lock className="h-3 w-3" /> Locked — Read-Only
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="w-full">
            <div className="min-w-[1400px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-40 sticky left-0 bg-muted/30 z-10 font-bold">NAME</TableHead>
                     {weekDays.map((day, i) => {
                      const inPayroll = isDateInPayrollPeriod(day, currentMonth);
                      return (
                        <TableHead key={i} colSpan={2} className={`text-center border-x min-w-[100px] ${inPayroll ? 'bg-muted/20' : 'bg-muted/50 opacity-50'}`}>
                          <div className="font-bold">{DAYS_SHORT[i]}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{format(day, 'dd/MM')}</div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="text-center bg-blue-50 dark:bg-blue-950/50 font-bold min-w-[60px]">HOURS</TableHead>
                    <TableHead className="text-center bg-amber-50 dark:bg-amber-950/50 font-bold min-w-[60px]">HOLIDAY</TableHead>
                    <TableHead className="text-center bg-rose-50 dark:bg-rose-950/50 font-bold min-w-[60px]">SICK</TableHead>
                    <TableHead className="text-center bg-purple-50 dark:bg-purple-950/50 font-bold min-w-[60px]">ADJ+/-</TableHead>
                    <TableHead className="text-center bg-emerald-50 dark:bg-emerald-950/50 font-bold min-w-[60px]">TOTAL</TableHead>
                    <TableHead className="text-center min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedTimesheets).map(([branchName, data]) => (
                    <React.Fragment key={branchName}>
                      {/* Branch Header */}
                      <TableRow className="bg-primary/5 hover:bg-primary/10">
                        <TableCell colSpan={21} className="py-2 font-semibold text-primary text-xs sticky left-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>📍 {branchName}</span>
                            <Badge variant="secondary" className="text-[10px]">{data.timesheets.length} staff</Badge>
                            {(() => {
                              const branchId = data.timesheets[0]?.employee?.branch_id;
                              const target = branchId ? branchTargets[branchId] : undefined;
                              const tempHrs = branchId ? (tempHoursByBranch[branchId] || 0) : 0;
                              const scheduled = data.totals.worked + tempHrs;
                              if (!target || target.target <= 0) {
                                return tempHrs > 0 ? (
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                    +{tempHrs.toFixed(1)}h temp
                                  </Badge>
                                ) : null;
                              }
                              const isLow = target.low > 0 && scheduled < target.low;
                              const isHigh = target.high > 0 && scheduled > target.high;
                              const status = isHigh ? 'high' : isLow ? 'low' : 'ok';
                              const colorCls = status === 'high'
                                ? 'bg-rose-100 text-rose-700 border-rose-300'
                                : status === 'low'
                                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-300';
                              const label = status === 'high' ? 'HIGH' : status === 'low' ? 'LOW' : 'ON TARGET';
                              const tooltip = `Scheduled: ${scheduled.toFixed(1)}h (perm ${data.totals.worked.toFixed(1)}h${tempHrs > 0 ? ` + temp ${tempHrs.toFixed(1)}h` : ''}) • Target ${target.target}h • Low ≤ ${target.low}h • High ≥ ${target.high}h`;
                              return (
                                <>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold border ${colorCls}`}
                                    title={tooltip}
                                  >
                                    {scheduled.toFixed(1)}h / {target.target}h • {label}
                                  </Badge>
                                  {tempHrs > 0 && (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200" title="Temporary staff hours included in scheduled total">
                                      incl. {tempHrs.toFixed(1)}h temp
                                    </Badge>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Employee Rows */}
                      {data.timesheets.map((ts, idx) => {
                        const total = Number(ts.total_worked_hours) + Number(ts.total_holiday_hours) + Number(ts.total_sick_hours) + Number(ts.total_adjustment_hours || 0);
                        return (
                          <TableRow key={ts.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <TableCell className="sticky left-0 bg-inherit z-10 font-medium">
                              {ts.employee?.first_name?.toUpperCase()}
                            </TableCell>
                            {DAYS_OF_WEEK.map((day, dayIdx) => {
                              const entry = ts.entries?.find(e => e.day_of_week === day);
                              const editingDay = inlineEditing[ts.id]?.[day];
                              const hasEdit = !!editingDay;
                              const inPayroll = isDateInPayrollPeriod(weekDays[dayIdx], currentMonth);
                              
                              // Determine cell background based on entry type or hours
                              const holidayHours = Number(entry?.holiday_hours) || 0;
                              const sickHours = Number(entry?.sick_hours) || 0;
                              const isHoliday = holidayHours > 0;
                              const isSick = sickHours > 0;
                              
                              const cellBgClass = !inPayroll
                                ? 'bg-muted/60 opacity-40'
                                : isHoliday 
                                  ? 'bg-amber-100/70 dark:bg-amber-900/30' 
                                  : isSick 
                                    ? 'bg-rose-100/70 dark:bg-rose-900/30' 
                                    : '';
                              
                              const hasShiftData = !!(entry?.shift_start_time || entry?.shift_end_time);
                              return (
                                <React.Fragment key={dayIdx}>
                                  <TableCell className={`text-center px-1 border-l text-[10px] ${cellBgClass}`}>
                                    {!inPayroll && !hasShiftData ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : hasEdit ? (
                                      <Input
                                        type="time"
                                        step={HALF_HOUR_TIME_STEP}
                                        value={editingDay?.start ?? entry?.shift_start_time ?? ''}
                                        data-shift-cell={`${ts.id}-${day}`}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          /* time alignment warning removed - any minute allowed by default */
                                          handleInlineTimeChange(ts.id, day, 'start', snapToHalfHour(v));
                                        }}
                                        className="h-6 text-[10px] p-1 w-full"
                                        onBlur={(e) => {
                                          const next = e.relatedTarget as HTMLElement | null;
                                          if (next?.getAttribute?.('data-shift-cell') === `${ts.id}-${day}`) return;
                                          if (next?.getAttribute?.('data-reset-cell') === `${ts.id}-${day}`) return;
                                          saveInlineTime(ts, day);
                                        }}
                                      />
                                    ) : (
                                      <span 
                                        className={`cursor-pointer hover:bg-primary/10 px-1 py-0.5 rounded ${!inPayroll ? 'italic opacity-70' : ''}`}
                                        onClick={() => handleInlineTimeChange(ts.id, day, 'start', entry?.shift_start_time || '')}
                                        title={!inPayroll ? 'Date is outside current payroll period (21st–20th cycle) but a shift was recorded here' : ''}
                                      >
                                        {formatTimeDisplay(entry?.shift_start_time || null) || (isHoliday ? 'HOL' : isSick ? 'SICK' : '-')}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className={`text-center px-1 border-r text-[10px] ${cellBgClass}`}>
                                    {!inPayroll && !hasShiftData ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : hasEdit ? (
                                      <div className="flex items-center gap-0.5">
                                        <Input
                                          type="time"
                                          step={HALF_HOUR_TIME_STEP}
                                          value={editingDay?.end ?? entry?.shift_end_time ?? ''}
                                          data-shift-cell={`${ts.id}-${day}`}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            /* time alignment warning removed - any minute allowed by default */
                                            handleInlineTimeChange(ts.id, day, 'end', snapToHalfHour(v));
                                          }}
                                          className="h-6 text-[10px] p-1 w-full"
                                          onBlur={(e) => {
                                            const next = e.relatedTarget as HTMLElement | null;
                                            if (next?.getAttribute?.('data-shift-cell') === `${ts.id}-${day}`) return;
                                            if (next?.getAttribute?.('data-reset-cell') === `${ts.id}-${day}`) return;
                                            saveInlineTime(ts, day);
                                          }}
                                        />
                                        <button
                                          type="button"
                                          data-reset-cell={`${ts.id}-${day}`}
                                          title="Clear shift"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => resetInlineTime(ts, day)}
                                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive shrink-0"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span 
                                        className={`cursor-pointer hover:bg-primary/10 px-1 py-0.5 rounded ${!inPayroll ? 'italic opacity-70' : ''}`}
                                        onClick={() => handleInlineTimeChange(ts.id, day, 'end', entry?.shift_end_time || '')}
                                        title={!inPayroll ? 'Date is outside current payroll period (21st–20th cycle) but a shift was recorded here' : ''}
                                      >
                                        {formatTimeDisplay(entry?.shift_end_time || null) || (isHoliday ? `${holidayHours}h` : isSick ? `${sickHours}h` : '-')}
                                      </span>
                                    )}
                                  </TableCell>
                                </React.Fragment>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                              {ts.total_worked_hours > 0 ? ts.total_worked_hours : 0}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-amber-50/50 dark:bg-amber-950/30 text-amber-600">
                              {ts.total_holiday_hours > 0 ? ts.total_holiday_hours : ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-rose-50/50 dark:bg-rose-950/30 text-rose-600">
                              {ts.total_sick_hours > 0 ? ts.total_sick_hours : ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-purple-50/50 dark:bg-purple-950/30 text-purple-600">
                              {ts.total_adjustment_hours ? ts.total_adjustment_hours : ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                              {total.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  onClick={() => openTimesheetEditor(ts)}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                {ts.status !== 'approved' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-emerald-600"
                                    onClick={() => approveTimesheet(ts.id)}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Branch Subtotal */}
                      <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                        <TableCell className="sticky left-0 bg-muted/50 z-10 text-xs">SUBTOTAL</TableCell>
                        <TableCell colSpan={14} />
                        <TableCell className="text-center bg-blue-100/50 dark:bg-blue-900/30">{data.totals.worked.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-amber-100/50 dark:bg-amber-900/30">{data.totals.holiday.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-rose-100/50 dark:bg-rose-900/30">{data.totals.sick.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-purple-100/50 dark:bg-purple-900/30">{data.totals.adj.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-emerald-100/50 dark:bg-emerald-900/30">{data.totals.total.toFixed(1)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
        <TempStaffSection
          branchId={lockBranchId}
          organizationId={user?.role === 'manager' ? user?.organizationId || null : (selectedOrg || null)}
          weekStart={currentWeekStart}
          weekDays={weekDays}
          isLocked={editingDisabled}
          isDateInPayroll={(d) => isDateInPayrollPeriod(d, currentMonth)}
        />
        </>
      ) : (
        /* Monthly Consolidation View */
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/5 to-transparent border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Monthly Consolidation - {format(getPayrollPeriod(currentMonth).end, 'MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="w-full">
            <div className="min-w-[1200px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-40 sticky left-0 bg-muted/30 z-10 font-bold">NAME</TableHead>
                    {monthWeeks.map((_, i) => (
                      <TableHead key={i} className="text-center font-bold min-w-[70px]">WEEK {i + 1}</TableHead>
                    ))}
                    <TableHead className="text-center font-bold bg-slate-100 dark:bg-slate-800">TOTAL</TableHead>
                    <TableHead className="text-center font-bold bg-purple-50 dark:bg-purple-950/50">(+/-) LAST MONTH</TableHead>
                    <TableHead className="text-center font-bold bg-emerald-50 dark:bg-emerald-950/50">TOTAL HRS</TableHead>
                    <TableHead className="text-center font-bold bg-amber-50 dark:bg-amber-950/50">HOLIDAY HRS</TableHead>
                    <TableHead className="text-center font-bold bg-rose-50 dark:bg-rose-950/50">SICK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(monthlyConsolidation.grouped).map(([branchName, branchData]) => {
                    const branchTotals = {
                      weeks: monthWeeks.map(() => 0),
                      total: 0,
                      lastMonth: 0,
                      totalHrs: 0,
                      holiday: 0,
                      sick: 0
                    };
                    Object.values(branchData).forEach(emp => {
                      emp.weeklyHours.forEach((h, i) => branchTotals.weeks[i] += h);
                      branchTotals.total += emp.totalHours;
                      branchTotals.lastMonth += emp.lastMonthAdj;
                      branchTotals.totalHrs += emp.totalHrs;
                      branchTotals.holiday += emp.holidayHrs;
                      branchTotals.sick += emp.sickHrs;
                    });

                    return (
                      <React.Fragment key={branchName}>
                        <TableRow className="bg-primary/5 hover:bg-primary/10">
                          <TableCell colSpan={12} className="py-2 font-semibold text-primary text-xs sticky left-0">
                            📍 {branchName}
                          </TableCell>
                        </TableRow>
                        {Object.values(branchData).map((emp, idx) => (
                          <TableRow key={emp.employee.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <TableCell className="sticky left-0 bg-inherit z-10 font-medium">
                              {emp.employee.first_name?.toUpperCase()}
                            </TableCell>
                            {emp.weeklyHours.map((h, i) => (
                              <TableCell 
                                key={i} 
                                className="text-center cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => openTimesheetEditorForWeek(emp.employee.id, i)}
                                title={`Click to edit Week ${i + 1}`}
                              >
                                {h > 0 ? h.toFixed(1) : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-slate-50 dark:bg-slate-800/50">
                              {emp.totalHours.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center bg-purple-50/50 dark:bg-purple-950/30">
                              {emp.lastMonthAdj !== 0 ? emp.lastMonthAdj.toFixed(1) : '-'}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
                              {emp.totalHrs.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center bg-amber-50/50 dark:bg-amber-950/30 text-amber-600">
                              {emp.holidayHrs > 0 ? emp.holidayHrs.toFixed(1) : '-'}
                            </TableCell>
                            <TableCell className="text-center bg-rose-50/50 dark:bg-rose-950/30 text-rose-600">
                              {emp.sickHrs > 0 ? emp.sickHrs.toFixed(1) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Branch Subtotal */}
                        <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                          <TableCell className="sticky left-0 bg-muted/50 z-10 text-xs">SUBTOTAL</TableCell>
                          {branchTotals.weeks.map((w, i) => (
                            <TableCell key={i} className="text-center">{w.toFixed(1)}</TableCell>
                          ))}
                          <TableCell className="text-center bg-slate-100/50">{branchTotals.total.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-purple-100/50">{branchTotals.lastMonth !== 0 ? branchTotals.lastMonth.toFixed(1) : '-'}</TableCell>
                          <TableCell className="text-center bg-emerald-100/50">{branchTotals.totalHrs.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-amber-100/50">{branchTotals.holiday.toFixed(1)}</TableCell>
                          <TableCell className="text-center bg-rose-100/50">{branchTotals.sick.toFixed(1)}</TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total */}
                  <TableRow className="bg-primary/10 font-bold hover:bg-primary/10">
                    <TableCell className="sticky left-0 bg-primary/10 z-10">GRAND TOTAL</TableCell>
                    {monthlyGrandTotals.weeklyTotals.map((w, i) => (
                      <TableCell key={i} className="text-center">{w.toFixed(1)}</TableCell>
                    ))}
                    <TableCell className="text-center">{monthlyGrandTotals.totalHours.toFixed(1)}</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center text-emerald-700 dark:text-emerald-300">{monthlyGrandTotals.totalHrs.toFixed(1)}</TableCell>
                    <TableCell className="text-center text-amber-600">{monthlyGrandTotals.holidayHrs.toFixed(1)}</TableCell>
                    <TableCell className="text-center text-rose-600">{monthlyGrandTotals.sickHrs.toFixed(1)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      {/* Edit Side Panel */}
      <Sheet open={showEditPanel} onOpenChange={setShowEditPanel}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Edit Timesheet
            </SheetTitle>
            <SheetDescription>
              {selectedTimesheet?.employee?.first_name} {selectedTimesheet?.employee?.last_name} • Week {selectedWeekIndex + 1}
            </SheetDescription>
          </SheetHeader>
          
          <div className="py-6 space-y-6">
            {/* Apply to All Days / Clear All Buttons */}
            <div className="flex gap-2">
              {entries.length > 0 && entries[0]?.shift_start_time && entries[0]?.shift_end_time && (
                <div className="flex-1 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Apply to All Days</p>
                      <p className="text-xs text-muted-foreground">
                        Copy {entries[0].day_of_week}'s timing ({formatTimeDisplay(entries[0].shift_start_time)} - {formatTimeDisplay(entries[0].shift_end_time)}) to all days
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const firstEntry = entries[0];
                        if (!firstEntry.shift_start_time || !firstEntry.shift_end_time) return;
                        
                        const updated = entries.map((entry, idx) => {
                          if (idx === 0) return entry;
                          
                          const newEntry = { ...entry };
                          newEntry.shift_start_time = firstEntry.shift_start_time;
                          newEntry.shift_end_time = firstEntry.shift_end_time;
                          newEntry.break_duration_minutes = firstEntry.break_duration_minutes;
                          
                          // Recalculate hours
                          const start = newEntry.shift_start_time!;
                          const end = newEntry.shift_end_time!;
                          const breakMins = newEntry.break_duration_minutes || 0;
                          const [startH, startM] = start.split(':').map(Number);
                          const [endH, endM] = end.split(':').map(Number);
                          let totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
                          if (totalMins < 0) totalMins += 24 * 60;
                          newEntry.actual_hours = Math.round(totalMins / 60 * 100) / 100;
                          
                          return newEntry;
                        });
                        setEntries(updated);
                        toast.success('Timing applied to all days');
                      }}
                    >
                      Apply to All
                    </Button>
                  </div>
                </div>
              )}
              
              {entries.some(e => e.shift_start_time || e.shift_end_time || e.actual_hours > 0) && (
                <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      const updated = entries.map(entry => ({
                        ...entry,
                        shift_start_time: null,
                        shift_end_time: null,
                        break_duration_minutes: 0,
                        actual_hours: 0
                      }));
                      setEntries(updated);
                      toast.success('All days cleared');
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              )}
            </div>

            {entries.map((entry, idx) => (
              <div key={idx} className="space-y-3 p-4 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{entry.day_of_week}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{format(parseISO(entry.entry_date), 'dd MMM yyyy')}</span>
                    {(entry.shift_start_time || entry.shift_end_time) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const updated = [...entries];
                          updated[idx] = {
                            ...updated[idx],
                            shift_start_time: null,
                            shift_end_time: null,
                            break_duration_minutes: 0,
                            actual_hours: 0
                          };
                          setEntries(updated);
                        }}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start Time</Label>
                    <Input 
                      type="time" 
                      step={HALF_HOUR_TIME_STEP}
                      value={entry.shift_start_time || ''} 
                      onChange={(e) => {
                        const v = e.target.value;
                        /* time alignment warning removed - any minute allowed by default */
                        updateEntry(idx, 'shift_start_time', snapToHalfHour(v) || null);
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Time</Label>
                    <Input 
                      type="time" 
                      step={HALF_HOUR_TIME_STEP}
                      value={entry.shift_end_time || ''} 
                      onChange={(e) => {
                        const v = e.target.value;
                        /* time alignment warning removed - any minute allowed by default */
                        updateEntry(idx, 'shift_end_time', snapToHalfHour(v) || null);
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Hours</Label>
                    <Input 
                      type="number" 
                      step="0.5"
                      value={entry.actual_hours === 0 ? '' : entry.actual_hours} 
                      onChange={(e) => updateEntry(idx, 'actual_hours', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="mt-1 text-center"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Holiday</Label>
                    <Input 
                      type="number" 
                      step="0.5"
                      value={entry.holiday_hours === 0 ? '' : entry.holiday_hours} 
                      onChange={(e) => updateEntry(idx, 'holiday_hours', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="mt-1 text-center"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Sick</Label>
                    <Input 
                      type="number" 
                      step="0.5"
                      value={entry.sick_hours === 0 ? '' : entry.sick_hours} 
                      onChange={(e) => updateEntry(idx, 'sick_hours', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="mt-1 text-center"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ADJ+/-</Label>
                    <Input 
                      type="number" 
                      step="0.5"
                      value={entry.adjustment_hours === 0 ? '' : entry.adjustment_hours} 
                      onChange={(e) => updateEntry(idx, 'adjustment_hours', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="mt-1 text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SheetFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditPanel(false)}>Cancel</Button>
            <Button onClick={saveTimesheet} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
