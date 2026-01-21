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
  Download, Loader2, Users, Plus, Search, Printer, Calendar, Edit
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

// Get month weeks (up to 6 weeks per month as in Excel)
const getMonthWeeks = (month: Date) => {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
  return weeks.slice(0, 6); // Max 6 weeks
};

export function TimesheetView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState<'weekly' | 'monthly'>('weekly');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [allMonthTimesheets, setAllMonthTimesheets] = useState<Timesheet[]>([]);
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
  
  // Calculate weeks in current month
  const monthWeeks = useMemo(() => getMonthWeeks(currentMonth), [currentMonth]);
  const currentWeekStart = monthWeeks[selectedWeekIndex] || monthWeeks[0];
  const weekEnd = currentWeekStart ? endOfWeek(currentWeekStart, { weekStartsOn: 1 }) : new Date();
  const weekDays = currentWeekStart ? eachDayOfInterval({ start: currentWeekStart, end: weekEnd }) : [];

  useEffect(() => {
    fetchData();
    if (canViewFilters) fetchOrganizationsAndBranches();
  }, [currentMonth, selectedWeekIndex]);

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
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
        .in('status', ['active', 'onboarding'])
        .order('first_name');

      setEmployees(employeesData || []);

      // Fetch current week timesheets with entries
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

      // Fetch all month timesheets for consolidation view
      const { data: monthTimesheetsData } = await supabase
        .from('timesheets')
        .select('*, employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))')
        .gte('week_start_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('week_start_date', format(monthEnd, 'yyyy-MM-dd'));
      
      setAllMonthTimesheets(monthTimesheetsData || []);

      // Fetch previous month adjustment for (+/-) LAST MONTH column
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

  const createAllTimesheets = async () => {
    const employeesWithoutTimesheet = filteredEmployees.filter(
      emp => !timesheets.some(t => t.employee_id === emp.id)
    );
    let count = 0;
    for (const emp of employeesWithoutTimesheet) {
      const success = await createTimesheetForEmployee(emp);
      if (success) count++;
    }
    toast.success(`Created ${count} timesheets`);
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
    
    // Auto-calculate hours from start/end times (handles overnight shifts)
    if ((field === 'shift_start_time' || field === 'shift_end_time' || field === 'break_duration_minutes') 
        && updated[index].shift_start_time && updated[index].shift_end_time) {
      const start = updated[index].shift_start_time!;
      const end = updated[index].shift_end_time!;
      const breakMins = updated[index].break_duration_minutes || 0;
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      let totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
      if (totalMins < 0) totalMins += 24 * 60; // Overnight shift handling
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
      fetchData();
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

  // Group by branch with SUMIF totals (matching Excel format)
  const groupedTimesheets = useMemo(() => {
    const grouped = filteredTimesheets.reduce((acc, ts) => {
      const branchName = ts.employee?.branch?.name || 'Unassigned';
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

  // Weekly totals from current week (for summary cards)
  const weeklyGrandTotals = useMemo(() => ({
    worked: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0),
    holiday: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0),
    sick: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0),
    adj: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0)
  }), [filteredTimesheets]);

  // Monthly consolidation data - matches Excel "NAME | WEEK 1 | WEEK 2 | ... | WEEK 6 | TOTAL | (+/-) LAST MONTH | TOTAL HRS | HOLIDAY HRS | SICK"
  const monthlyConsolidation = useMemo(() => {
    const consolidation: Record<string, {
      employee: Employee;
      weeklyHours: (number)[];
      totalHours: number;
      lastMonthAdj: number;
      totalHrs: number;
      holidayHrs: number;
      sickHrs: number;
    }> = {};

    // Initialize for all filtered employees
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

    // Aggregate timesheets by week
    allMonthTimesheets.forEach(ts => {
      if (!consolidation[ts.employee_id]) return;
      
      const weekIdx = monthWeeks.findIndex(w => format(w, 'yyyy-MM-dd') === ts.week_start_date);
      if (weekIdx >= 0) {
        consolidation[ts.employee_id].weeklyHours[weekIdx] = Number(ts.total_worked_hours) || 0;
      }
      
      consolidation[ts.employee_id].totalHours += Number(ts.total_worked_hours) || 0;
      consolidation[ts.employee_id].holidayHrs += Number(ts.total_holiday_hours) || 0;
      consolidation[ts.employee_id].sickHrs += Number(ts.total_sick_hours) || 0;
    });

    // Calculate total hrs (total + last month adjustment)
    Object.values(consolidation).forEach(emp => {
      emp.totalHrs = emp.totalHours + emp.lastMonthAdj;
    });

    // Group by branch
    const grouped: Record<string, typeof consolidation> = {};
    Object.entries(consolidation).forEach(([empId, data]) => {
      const branchName = data.employee.branch?.name || 'Unassigned';
      if (!grouped[branchName]) grouped[branchName] = {};
      grouped[branchName][empId] = data;
    });

    return { consolidation, grouped };
  }, [filteredEmployees, allMonthTimesheets, monthWeeks, lastMonthAdjustment]);

  // Monthly grand totals
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

  const exportToCSV = () => {
    if (viewTab === 'weekly') {
      // Weekly export with start/end times
      const headers = ['', 'NAME', ...DAYS_SHORT.flatMap(d => [d, '']), 'HOURS', 'HOLIDAY', 'SICK', 'ADJ+/-', 'TOTAL'];
      const subHeaders = ['', '', ...weekDays.flatMap(d => [format(d, 'dd/MM/yyyy'), '']), '', '', '', '', ''];
      const rows: string[][] = [headers, subHeaders];
      
      Object.entries(groupedTimesheets).forEach(([branchName, data]) => {
        rows.push([`${branchName}`, ...Array(headers.length - 1).fill('')]);
        data.timesheets.forEach(t => {
          const dayEntries = t.entries || [];
          const total = Number(t.total_worked_hours) + Number(t.total_holiday_hours) + Number(t.total_sick_hours) + Number(t.total_adjustment_hours || 0);
          rows.push([
            '', 
            `${t.employee?.first_name} ${t.employee?.last_name}`.toUpperCase(),
            ...DAYS_OF_WEEK.flatMap((day) => {
              const entry = dayEntries.find(e => e.day_of_week === day);
              return [entry?.shift_start_time || '', entry?.shift_end_time || ''];
            }),
            `$${t.total_worked_hours || 0}`,
            t.total_holiday_hours ? `$${t.total_holiday_hours}` : '',
            t.total_sick_hours ? `$${t.total_sick_hours}` : '',
            t.total_adjustment_hours ? `$${t.total_adjustment_hours}` : '',
            `$${total.toFixed(1)}`
          ]);
        });
        // Branch subtotal
        rows.push([
          '', '', ...Array(DAYS_SHORT.length * 2).fill(''),
          `$${data.totals.worked.toFixed(1)}`,
          `$${data.totals.holiday.toFixed(1)}`,
          `$${data.totals.sick.toFixed(1)}`,
          data.totals.adj ? `$${data.totals.adj.toFixed(1)}` : '',
          `$${data.totals.total.toFixed(1)}`
        ]);
      });

      const csv = rows.map(row => row.join(',')).join('\n');
      downloadCSV(csv, `TimeSheet_Week${selectedWeekIndex + 1}_${format(currentMonth, 'MMM_yy')}.csv`);
    } else {
      // Monthly consolidation export
      const headers = ['', 'NAME', ...monthWeeks.map((_, i) => `WEEK ${i + 1}`), 'TOTAL', '(+/-) LAST MONTH', 'TOTAL HRS', 'HOLIDAY HRS', '', 'SICK'];
      const rows: string[][] = [headers];
      
      Object.entries(monthlyConsolidation.grouped).forEach(([branchName, branchData]) => {
        rows.push([branchName, ...Array(headers.length - 1).fill('')]);
        
        const branchTotals = { weeks: monthWeeks.map(() => 0), total: 0, lastMonth: 0, totalHrs: 0, holiday: 0, sick: 0 };
        
        Object.values(branchData).forEach(emp => {
          rows.push([
            '',
            `${emp.employee.first_name} ${emp.employee.last_name}`.toUpperCase(),
            ...emp.weeklyHours.map(h => h > 0 ? h.toFixed(1) : '-'),
            emp.totalHours.toFixed(1),
            emp.lastMonthAdj !== 0 ? emp.lastMonthAdj.toFixed(1) : '-',
            emp.totalHrs.toFixed(1),
            emp.holidayHrs > 0 ? `$${emp.holidayHrs.toFixed(1)}` : '-',
            '',
            emp.sickHrs > 0 ? `$${emp.sickHrs.toFixed(1)}` : '-'
          ]);
          emp.weeklyHours.forEach((h, i) => branchTotals.weeks[i] += h);
          branchTotals.total += emp.totalHours;
          branchTotals.lastMonth += emp.lastMonthAdj;
          branchTotals.totalHrs += emp.totalHrs;
          branchTotals.holiday += emp.holidayHrs;
          branchTotals.sick += emp.sickHrs;
        });
        
        // Branch subtotal row
        rows.push([
          '', `SUBTOTAL`,
          ...branchTotals.weeks.map(w => w.toFixed(1)),
          branchTotals.total.toFixed(1),
          branchTotals.lastMonth !== 0 ? branchTotals.lastMonth.toFixed(1) : '-',
          branchTotals.totalHrs.toFixed(1),
          branchTotals.holiday > 0 ? `$${branchTotals.holiday.toFixed(1)}` : '-',
          '',
          branchTotals.sick > 0 ? `$${branchTotals.sick.toFixed(1)}` : '-'
        ]);
      });

      // Grand total
      rows.push([
        '', 'GRAND TOTAL',
        ...monthlyGrandTotals.weeklyTotals.map(w => w.toFixed(1)),
        monthlyGrandTotals.totalHours.toFixed(1),
        '-',
        monthlyGrandTotals.totalHrs.toFixed(1),
        monthlyGrandTotals.holidayHrs > 0 ? `$${monthlyGrandTotals.holidayHrs.toFixed(1)}` : '-',
        '',
        monthlyGrandTotals.sickHrs > 0 ? `$${monthlyGrandTotals.sickHrs.toFixed(1)}` : '-'
      ]);

      const csv = rows.map(row => row.join(',')).join('\n');
      downloadCSV(csv, `TimeSheet_${format(currentMonth, 'MMMM_yyyy')}_Consolidated.csv`);
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

  const handlePrint = () => window.print();

  // Format time for display (matching Excel AM/PM format)
  const formatTime = (time: string | null) => {
    if (!time) return '';
    try {
      return format(parseISO(`2000-01-01T${time}`), 'h:mm a');
    } catch {
      return time;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - matching Excel "Staff Attendance Details" title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Staff Attendance Details
          </h2>
          <p className="text-muted-foreground">
            For the month of {format(currentMonth, 'MMMM yy')}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'weekly' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly Entry</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Consolidation</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedWeekIndex(0); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-3 py-2 bg-muted rounded-md text-center text-sm font-medium min-w-[120px]">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button variant="outline" size="icon" onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedWeekIndex(0); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Week selector for weekly view */}
          {viewTab === 'weekly' && (
            <Select value={String(selectedWeekIndex)} onValueChange={(v) => setSelectedWeekIndex(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {monthWeeks.map((week, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    WEEK {idx + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <p className="text-sm text-muted-foreground">Staff Count</p>
              <p className="text-2xl font-bold">{filteredEmployees.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
          <div className="text-center">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">HOURS</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {viewTab === 'weekly' ? weeklyGrandTotals.worked.toFixed(1) : monthlyGrandTotals.totalHours.toFixed(1)}
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-orange-50 dark:bg-orange-950/30">
          <div className="text-center">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">HOLIDAY</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {viewTab === 'weekly' ? weeklyGrandTotals.holiday.toFixed(1) : monthlyGrandTotals.holidayHrs.toFixed(1)}
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-red-50 dark:bg-red-950/30">
          <div className="text-center">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">SICK</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {viewTab === 'weekly' ? weeklyGrandTotals.sick.toFixed(1) : monthlyGrandTotals.sickHrs.toFixed(1)}
            </p>
          </div>
        </Card>
        <Card className="p-4 bg-green-50 dark:bg-green-950/30">
          <div className="text-center">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">TOTAL</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {viewTab === 'weekly' 
                ? (weeklyGrandTotals.worked + weeklyGrandTotals.holiday + weeklyGrandTotals.sick + weeklyGrandTotals.adj).toFixed(1)
                : monthlyGrandTotals.totalHrs.toFixed(1)
              }
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
        /* Weekly View - Excel Format with WEEK # header, Start/End times for each day */
        <Card className="overflow-hidden print:shadow-none">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">
              WEEK {selectedWeekIndex + 1} • {currentWeekStart ? format(currentWeekStart, 'EEEE dd/MM/yyyy') : ''} to {weekEnd ? format(weekEnd, 'EEEE dd/MM/yyyy') : ''}
            </h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1600px]">
              <Table className="text-xs">
                <TableHeader>
                  {/* Header Row 1: Day names */}
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 w-8"></TableHead>
                    <TableHead className="sticky left-8 bg-muted/50 z-10 text-center font-bold">WEEK {selectedWeekIndex + 1}</TableHead>
                    {weekDays.map((day, i) => (
                      <TableHead key={i} colSpan={2} className="text-center font-bold border-x bg-muted/30">
                        {DAYS_OF_WEEK[i].toUpperCase()}
                      </TableHead>
                    ))}
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900/50 font-bold w-16"></TableHead>
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900/50 font-bold">HOURS</TableHead>
                    <TableHead className="text-center bg-orange-100 dark:bg-orange-900/50 font-bold">HOLIDAY</TableHead>
                    <TableHead className="text-center bg-red-100 dark:bg-red-900/50 font-bold">SICK</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900/50 font-bold">ADJ+/-</TableHead>
                    <TableHead className="text-center bg-green-100 dark:bg-green-900/50 font-bold">TOTAL</TableHead>
                    <TableHead className="text-center font-bold print:hidden">Actions</TableHead>
                  </TableRow>
                  {/* Header Row 2: Dates */}
                  <TableRow className="bg-muted/30">
                    <TableHead className="sticky left-0 bg-muted/30 z-10"></TableHead>
                    <TableHead className="sticky left-8 bg-muted/30 z-10"></TableHead>
                    {weekDays.map((day, i) => (
                      <TableHead key={i} colSpan={2} className="text-center text-[10px] font-normal text-muted-foreground border-x">
                        {format(day, 'dd/MM/yyyy')}
                      </TableHead>
                    ))}
                    <TableHead colSpan={7} className="print:hidden"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedTimesheets).map(([branchName, data]) => (
                    <React.Fragment key={branchName}>
                      {/* Branch separator row */}
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={24} className="font-medium text-primary py-1 text-[11px]">
                          {branchName} ({data.timesheets.length} staff)
                        </TableCell>
                      </TableRow>
                      {data.timesheets.map((ts) => {
                        const dayEntries = ts.entries || [];
                        const total = Number(ts.total_worked_hours) + Number(ts.total_holiday_hours) + Number(ts.total_sick_hours) + Number(ts.total_adjustment_hours || 0);
                        return (
                          <TableRow key={ts.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10"></TableCell>
                            <TableCell className="sticky left-8 bg-background z-10 font-bold text-[11px]">
                              {ts.employee?.first_name?.toUpperCase()}
                            </TableCell>
                            {DAYS_OF_WEEK.map((day, dayIdx) => {
                              const entry = dayEntries.find(e => e.day_of_week === day);
                              return (
                                <React.Fragment key={dayIdx}>
                                  <TableCell className="text-center text-[10px] border-l px-1">
                                    {formatTime(entry?.shift_start_time || null)}
                                  </TableCell>
                                  <TableCell className="text-center text-[10px] border-r px-1">
                                    {formatTime(entry?.shift_end_time || null)}
                                  </TableCell>
                                </React.Fragment>
                              );
                            })}
                            <TableCell className="text-center"></TableCell>
                            <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/30">
                              ${ts.total_worked_hours > 0 ? ts.total_worked_hours : 0}
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
                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openTimesheetEditor(ts)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                {ts.status !== 'approved' && (
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-green-600" onClick={() => approveTimesheet(ts.id)}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Week subtotal row (SUMIF for branch) */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="sticky left-0 bg-muted/50 z-10"></TableCell>
                        <TableCell colSpan={15} className="sticky left-8 bg-muted/50 z-10"></TableCell>
                        <TableCell className="text-center bg-blue-100 dark:bg-blue-900/50">
                          ${data.totals.worked.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center bg-orange-100 dark:bg-orange-900/50 text-orange-600">
                          ${data.totals.holiday.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center bg-red-100 dark:bg-red-900/50 text-red-600">
                          ${data.totals.sick.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center bg-purple-100 dark:bg-purple-900/50">
                          {data.totals.adj !== 0 ? `$${data.totals.adj.toFixed(1)}` : ''}
                        </TableCell>
                        <TableCell className="text-center bg-green-100 dark:bg-green-900/50">
                          ${data.totals.total.toFixed(1)}
                        </TableCell>
                        <TableCell className="print:hidden"></TableCell>
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
        /* Monthly Consolidation View - Excel Format: NAME | WEEK 1-6 | TOTAL | (+/-) LAST MONTH | TOTAL HRS | HOLIDAY HRS | SICK */
        <Card className="overflow-hidden print:shadow-none">
          <div className="p-3 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <h3 className="font-bold text-sm">
              MONTHLY CONSOLIDATION - {format(currentMonth, 'MMMM yyyy').toUpperCase()}
            </h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1100px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 w-8"></TableHead>
                    <TableHead className="sticky left-8 bg-muted/50 z-10 min-w-[120px] font-bold">NAME</TableHead>
                    {monthWeeks.map((_, i) => (
                      <TableHead key={i} className="text-center font-bold w-20">WEEK {i + 1}</TableHead>
                    ))}
                    <TableHead className="text-center font-bold bg-blue-100 dark:bg-blue-900/50">TOTAL</TableHead>
                    <TableHead className="text-center font-bold bg-purple-100 dark:bg-purple-900/50">(+/-) LAST MONTH</TableHead>
                    <TableHead className="text-center font-bold bg-green-100 dark:bg-green-900/50">TOTAL HRS</TableHead>
                    <TableHead className="text-center font-bold bg-orange-100 dark:bg-orange-900/50">HOLIDAY HRS</TableHead>
                    <TableHead className="text-center font-bold"></TableHead>
                    <TableHead className="text-center font-bold bg-red-100 dark:bg-red-900/50">SICK</TableHead>
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
                        {/* Branch separator */}
                        <TableRow className="bg-primary/5">
                          <TableCell colSpan={10 + monthWeeks.length} className="font-medium text-primary py-1 text-[11px]">
                            {branchName} ({Object.keys(branchData).length} staff)
                          </TableCell>
                        </TableRow>
                        {Object.values(branchData).map((emp) => (
                          <TableRow key={emp.employee.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background z-10"></TableCell>
                            <TableCell className="sticky left-8 bg-background z-10 font-bold text-[11px]">
                              {emp.employee.first_name?.toUpperCase()}
                            </TableCell>
                            {emp.weeklyHours.map((h, i) => (
                              <TableCell key={i} className="text-center">
                                {h > 0 ? h.toFixed(1) : '-'}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/30">
                              {emp.totalHours.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center bg-purple-50/50 dark:bg-purple-950/30">
                              {emp.lastMonthAdj !== 0 ? emp.lastMonthAdj.toFixed(1) : '-'}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-green-50/50 dark:bg-green-950/30">
                              {emp.totalHrs.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-orange-50/50 dark:bg-orange-950/30 text-orange-600">
                              {emp.holidayHrs > 0 ? `$${emp.holidayHrs.toFixed(1)}` : '-'}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center font-bold bg-red-50/50 dark:bg-red-950/30 text-red-600">
                              {emp.sickHrs > 0 ? `$${emp.sickHrs.toFixed(1)}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Branch subtotal (SUMIF) */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="sticky left-0 bg-muted/50 z-10"></TableCell>
                          <TableCell className="sticky left-8 bg-muted/50 z-10"></TableCell>
                          {branchTotals.weeks.map((w, i) => (
                            <TableCell key={i} className="text-center">
                              {w > 0 ? w.toFixed(1) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-center bg-blue-100 dark:bg-blue-900/50">
                            {branchTotals.total.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center bg-purple-100 dark:bg-purple-900/50">
                            {branchTotals.lastMonth !== 0 ? branchTotals.lastMonth.toFixed(1) : '-'}
                          </TableCell>
                          <TableCell className="text-center bg-green-100 dark:bg-green-900/50">
                            {branchTotals.totalHrs.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center bg-orange-100 dark:bg-orange-900/50 text-orange-600">
                            {branchTotals.holiday > 0 ? `$${branchTotals.holiday.toFixed(1)}` : '-'}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center bg-red-100 dark:bg-red-900/50 text-red-600">
                            {branchTotals.sick > 0 ? `$${branchTotals.sick.toFixed(1)}` : '-'}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand total row */}
                  <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                    <TableCell className="sticky left-0 bg-primary/20 z-10"></TableCell>
                    <TableCell className="sticky left-8 bg-primary/20 z-10 text-sm">GRAND TOTAL</TableCell>
                    {monthlyGrandTotals.weeklyTotals.map((w, i) => (
                      <TableCell key={i} className="text-center text-sm">
                        {w.toFixed(1)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-sm bg-blue-200 dark:bg-blue-800">
                      {monthlyGrandTotals.totalHours.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center bg-purple-200 dark:bg-purple-800">-</TableCell>
                    <TableCell className="text-center text-sm bg-green-200 dark:bg-green-800">
                      {monthlyGrandTotals.totalHrs.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center text-sm bg-orange-200 dark:bg-orange-800 text-orange-700">
                      ${monthlyGrandTotals.holidayHrs.toFixed(1)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center text-sm bg-red-200 dark:bg-red-800 text-red-700">
                      ${monthlyGrandTotals.sickHrs.toFixed(1)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      {/* Edit Dialog - for entering times */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Timesheet - {selectedTimesheet?.employee?.first_name} {selectedTimesheet?.employee?.last_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Break (min)</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Sick</TableHead>
                  <TableHead>ADJ+/-</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{entry.day_of_week}</TableCell>
                    <TableCell className="text-muted-foreground">{format(parseISO(entry.entry_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={entry.shift_start_time || ''}
                        onChange={(e) => updateEntry(idx, 'shift_start_time', e.target.value || null)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={entry.shift_end_time || ''}
                        onChange={(e) => updateEntry(idx, 'shift_end_time', e.target.value || null)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={entry.break_duration_minutes || ''}
                        onChange={(e) => updateEntry(idx, 'break_duration_minutes', Number(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={entry.actual_hours || ''}
                        onChange={(e) => updateEntry(idx, 'actual_hours', Number(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.5"
                        value={entry.holiday_hours || ''}
                        onChange={(e) => updateEntry(idx, 'holiday_hours', Number(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.5"
                        value={entry.sick_hours || ''}
                        onChange={(e) => updateEntry(idx, 'sick_hours', Number(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.5"
                        value={entry.adjustment_hours || ''}
                        onChange={(e) => updateEntry(idx, 'adjustment_hours', Number(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Week totals */}
            <div className="flex gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Hours</p>
                <p className="text-xl font-bold text-blue-600">
                  {entries.reduce((sum, e) => sum + (Number(e.actual_hours) || 0), 0).toFixed(1)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Holiday</p>
                <p className="text-xl font-bold text-orange-600">
                  {entries.reduce((sum, e) => sum + (Number(e.holiday_hours) || 0), 0).toFixed(1)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Sick</p>
                <p className="text-xl font-bold text-red-600">
                  {entries.reduce((sum, e) => sum + (Number(e.sick_hours) || 0), 0).toFixed(1)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Adjustment</p>
                <p className="text-xl font-bold text-purple-600">
                  {entries.reduce((sum, e) => sum + (Number(e.adjustment_hours) || 0), 0).toFixed(1)}
                </p>
              </div>
              <div className="text-center border-l pl-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-green-600">
                  {entries.reduce((sum, e) => 
                    sum + (Number(e.actual_hours) || 0) + (Number(e.holiday_hours) || 0) + 
                    (Number(e.sick_hours) || 0) + (Number(e.adjustment_hours) || 0), 0
                  ).toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={saveTimesheet} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Timesheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
