import React, { useState, useEffect } from 'react';
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
  Download, Loader2, Users, Plus, Search
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, addMonths, subMonths } from 'date-fns';
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

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');

  // Get fiscal year dates (April - March)
  const getFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth();
    if (month < 3) { // Jan-Mar
      return { start: currentYear - 1, end: currentYear };
    }
    return { start: currentYear, end: currentYear + 1 };
  };
  
  const fiscalYear = getFiscalYear();

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
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
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

      setTimesheets(timesheetsData || []);
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
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      toast.error('Failed to fetch monthly data');
    } finally {
      setLoading(false);
    }
  };

  const createTimesheetForEmployee = async (employee: Employee) => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
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

      const days = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
      const entryInserts = days.map((day, idx) => ({
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
    
    // Type-safe assignment based on field
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

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  });

  const employeesWithoutTimesheet = filteredEmployees.filter(
    emp => !timesheets.some(t => t.employee_id === emp.id)
  );

  const filteredTimesheets = timesheets.filter(t => {
    const emp = t.employee;
    if (!emp) return true;
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    if (filterMode === 'organization' && selectedOrg) return emp.organization_id === selectedOrg;
    if (filterMode === 'branch' && selectedBranch) return emp.branch_id === selectedBranch;
    return true;
  });

  // Group by branch with SUMIF totals
  const groupedTimesheets = filteredTimesheets.reduce((acc, ts) => {
    const branchName = ts.employee?.branch?.name || 'Unassigned';
    if (!acc[branchName]) acc[branchName] = { timesheets: [], totals: { worked: 0, holiday: 0, sick: 0, adj: 0 } };
    acc[branchName].timesheets.push(ts);
    acc[branchName].totals.worked += Number(ts.total_worked_hours) || 0;
    acc[branchName].totals.holiday += Number(ts.total_holiday_hours) || 0;
    acc[branchName].totals.sick += Number(ts.total_sick_hours) || 0;
    acc[branchName].totals.adj += Number(ts.total_adjustment_hours) || 0;
    return acc;
  }, {} as Record<string, { timesheets: Timesheet[]; totals: { worked: number; holiday: number; sick: number; adj: number } }>);

  // Grand totals
  const grandTotals = {
    worked: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_worked_hours) || 0), 0),
    holiday: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_holiday_hours) || 0), 0),
    sick: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_sick_hours) || 0), 0),
    adj: filteredTimesheets.reduce((sum, t) => sum + (Number(t.total_adjustment_hours) || 0), 0)
  };

  const getMonthlyEmployeeData = () => {
    const aggregated: Record<string, { 
      employee: Employee; 
      weeks: Record<number, Timesheet>;
      totalHours: number;
      totalHoliday: number;
      totalSick: number;
      totalAdj: number;
    }> = {};

    const monthStart = startOfMonth(currentMonth);
    const weeksInMonth = eachWeekOfInterval(
      { start: monthStart, end: endOfMonth(currentMonth) },
      { weekStartsOn: 1 }
    );

    monthlyTimesheets.forEach(ts => {
      if (!ts.employee) return;
      const empId = ts.employee_id;
      
      if (!aggregated[empId]) {
        aggregated[empId] = {
          employee: ts.employee,
          weeks: {},
          totalHours: 0,
          totalHoliday: 0,
          totalSick: 0,
          totalAdj: 0
        };
      }

      const weekIdx = weeksInMonth.findIndex(w => format(w, 'yyyy-MM-dd') === ts.week_start_date);
      if (weekIdx >= 0) aggregated[empId].weeks[weekIdx + 1] = ts;
      
      aggregated[empId].totalHours += Number(ts.total_worked_hours) || 0;
      aggregated[empId].totalHoliday += Number(ts.total_holiday_hours) || 0;
      aggregated[empId].totalSick += Number(ts.total_sick_hours) || 0;
      aggregated[empId].totalAdj += Number(ts.total_adjustment_hours) || 0;
    });

    // Group by branch
    const grouped: Record<string, typeof aggregated> = {};
    Object.entries(aggregated).forEach(([empId, data]) => {
      const branchName = data.employee.branch?.name || 'Unassigned';
      if (!grouped[branchName]) grouped[branchName] = {};
      grouped[branchName][empId] = data;
    });

    return { aggregated, grouped, weeksInMonth };
  };

  const weekTotals = {
    worked: entries.reduce((sum, e) => sum + (Number(e.actual_hours) || 0), 0),
    holiday: entries.reduce((sum, e) => sum + (Number(e.holiday_hours) || 0), 0),
    sick: entries.reduce((sum, e) => sum + (Number(e.sick_hours) || 0), 0),
    adj: entries.reduce((sum, e) => sum + (Number(e.adjustment_hours) || 0), 0)
  };

  const exportToCSV = () => {
    const headers = ['No', 'Staff Name', 'Location', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Worked', 'Holiday', 'Sick', 'ADJ+/-', 'Total', 'Status'];
    const rows: (string | number)[][] = [];
    let rowNum = 1;
    
    Object.entries(groupedTimesheets).forEach(([branchName, data]) => {
      rows.push([`📍 ${branchName}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      data.timesheets.forEach(t => {
        const total = Number(t.total_worked_hours) + Number(t.total_holiday_hours) + Number(t.total_sick_hours) + Number(t.total_adjustment_hours || 0);
        rows.push([
          rowNum++, `${t.employee?.first_name} ${t.employee?.last_name}`, branchName,
          '-', '-', '-', '-', '-', '-', '-',
          t.total_worked_hours, t.total_holiday_hours, t.total_sick_hours, t.total_adjustment_hours || 0, total.toFixed(1), t.status
        ]);
      });
      // Branch subtotal
      rows.push([
        '', `SUBTOTAL - ${branchName}`, '', '', '', '', '', '', '', '',
        data.totals.worked.toFixed(1), data.totals.holiday.toFixed(1), data.totals.sick.toFixed(1), data.totals.adj.toFixed(1),
        (data.totals.worked + data.totals.holiday + data.totals.sick + data.totals.adj).toFixed(1), ''
      ]);
    });
    // Grand total
    rows.push([
      '', 'GRAND TOTAL', '', '', '', '', '', '', '', '',
      grandTotals.worked.toFixed(1), grandTotals.holiday.toFixed(1), grandTotals.sick.toFixed(1), grandTotals.adj.toFixed(1),
      (grandTotals.worked + grandTotals.holiday + grandTotals.sick + grandTotals.adj).toFixed(1), ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TimeSheet_${fiscalYear.start}-${fiscalYear.end}_${format(currentWeekStart, 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Time Sheet {fiscalYear.start}-{fiscalYear.end}</h2>
          <p className="text-muted-foreground">Weekly timesheet tracking (UK fiscal year: April - March)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'weekly' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewTab === 'weekly' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="px-3 py-2 bg-muted rounded-md text-center text-sm font-medium">
                {format(currentWeekStart, 'dd MMM')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd MMM yyyy')}
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="px-3 py-2 bg-muted rounded-md text-center text-sm font-medium">{format(currentMonth, 'MMMM yyyy')}</div>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
          
          <Button variant="outline" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button variant="outline" onClick={() => window.print()}><Download className="h-4 w-4 mr-2" />Print</Button>
        </div>
      </div>

      {canViewFilters && (
        <OrgBranchFilter organizations={organizations} branches={branches} viewMode={filterMode}
          selectedOrg={selectedOrg} selectedBranch={selectedBranch} onViewModeChange={setFilterMode}
          onOrgChange={setSelectedOrg} onBranchChange={setSelectedBranch} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Employees</p><p className="text-2xl font-bold">{filteredEmployees.length}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Save className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Total Worked</p><p className="text-2xl font-bold">{grandTotals.worked.toFixed(0)}h</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><Check className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Approved</p><p className="text-2xl font-bold">{filteredTimesheets.filter(t => t.status === 'approved').length}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Save className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold">{filteredTimesheets.filter(t => t.status === 'draft' || t.status === 'submitted').length}</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Plus className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-sm text-muted-foreground">Not Created</p><p className="text-2xl font-bold">{employeesWithoutTimesheet.length}</p></div></div></Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        {viewTab === 'weekly' && employeesWithoutTimesheet.length > 0 && (
          <Button onClick={createAllTimesheets}><Plus className="h-4 w-4 mr-2" />Create All ({employeesWithoutTimesheet.length})</Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : viewTab === 'weekly' ? (
        <Card>
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-bold text-sm">TIMESHEET - Week {format(currentWeekStart, 'dd/MM/yyyy')} to {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd/MM/yyyy')}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1200px]">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 w-8 font-bold">No</TableHead>
                    <TableHead className="sticky left-8 bg-muted/50 z-10 min-w-[140px] font-bold">Staff Name</TableHead>
                    <TableHead className="font-bold">Location</TableHead>
                    {DAYS_SHORT.map(d => <TableHead key={d} className="text-center w-10 font-bold">{d}</TableHead>)}
                    <TableHead className="text-center bg-blue-100 dark:bg-blue-900 font-bold">Worked</TableHead>
                    <TableHead className="text-center bg-orange-100 dark:bg-orange-900 font-bold">Holiday</TableHead>
                    <TableHead className="text-center bg-red-100 dark:bg-red-900 font-bold">Sick</TableHead>
                    <TableHead className="text-center bg-purple-100 dark:bg-purple-900 font-bold">ADJ+/-</TableHead>
                    <TableHead className="text-center bg-green-100 dark:bg-green-900 font-bold">Total</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                    <TableHead className="text-center font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedTimesheets).map(([branchName, data]) => (
                    <React.Fragment key={branchName}>
                      <TableRow className="bg-primary/10 border-t-2 border-primary/20">
                        <TableCell colSpan={17} className="font-bold text-primary py-2">📍 {branchName} ({data.timesheets.length} staff)</TableCell>
                      </TableRow>
                      {data.timesheets.map((ts, idx) => {
                        const total = Number(ts.total_worked_hours) + Number(ts.total_holiday_hours) + Number(ts.total_sick_hours) + Number(ts.total_adjustment_hours || 0);
                        return (
                          <TableRow key={ts.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 bg-background text-center">{idx + 1}</TableCell>
                            <TableCell className="sticky left-8 bg-background font-medium">{ts.employee?.first_name} {ts.employee?.last_name}</TableCell>
                            <TableCell className="text-muted-foreground">{ts.employee?.branch?.name || '-'}</TableCell>
                            {DAYS_SHORT.map((_, i) => <TableCell key={i} className="text-center text-muted-foreground">-</TableCell>)}
                            <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/50">{ts.total_worked_hours}</TableCell>
                            <TableCell className="text-center font-bold text-orange-600 bg-orange-50/50 dark:bg-orange-950/50">{ts.total_holiday_hours}</TableCell>
                            <TableCell className="text-center font-bold text-red-600 bg-red-50/50 dark:bg-red-950/50">{ts.total_sick_hours}</TableCell>
                            <TableCell className={`text-center font-bold bg-purple-50/50 dark:bg-purple-950/50 ${(ts.total_adjustment_hours || 0) < 0 ? 'text-red-600' : (ts.total_adjustment_hours || 0) > 0 ? 'text-green-600' : ''}`}>
                              {(ts.total_adjustment_hours || 0) > 0 ? '+' : ''}{ts.total_adjustment_hours || 0}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-green-50/50 dark:bg-green-950/50">{total.toFixed(1)}</TableCell>
                            <TableCell className="text-center">{getStatusBadge(ts.status)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="outline" onClick={() => openTimesheetEditor(ts)}>Edit</Button>
                                {ts.status !== 'approved' && <Button size="sm" onClick={() => approveTimesheet(ts.id)}><Check className="h-3 w-3" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Branch Subtotal Row */}
                      <TableRow className="bg-muted/50 border-b-2 border-primary/20 font-bold">
                        <TableCell></TableCell>
                        <TableCell className="sticky left-8 bg-muted/50 text-primary">SUBTOTAL - {branchName}</TableCell>
                        <TableCell></TableCell>
                        {DAYS_SHORT.map((_, i) => <TableCell key={i}></TableCell>)}
                        <TableCell className="text-center bg-blue-100 dark:bg-blue-900">{data.totals.worked.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-orange-100 dark:bg-orange-900 text-orange-700">{data.totals.holiday.toFixed(1)}</TableCell>
                        <TableCell className="text-center bg-red-100 dark:bg-red-900 text-red-700">{data.totals.sick.toFixed(1)}</TableCell>
                        <TableCell className={`text-center bg-purple-100 dark:bg-purple-900 ${data.totals.adj < 0 ? 'text-red-700' : data.totals.adj > 0 ? 'text-green-700' : ''}`}>
                          {data.totals.adj > 0 ? '+' : ''}{data.totals.adj.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center bg-green-100 dark:bg-green-900">{(data.totals.worked + data.totals.holiday + data.totals.sick + data.totals.adj).toFixed(1)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                  {/* Employees without timesheets */}
                  {employeesWithoutTimesheet.map((emp) => (
                    <TableRow key={emp.id} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell className="font-medium text-muted-foreground">{emp.first_name} {emp.last_name}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.branch?.name || '-'}</TableCell>
                      <TableCell colSpan={12} className="text-center text-muted-foreground italic">No timesheet created</TableCell>
                      <TableCell className="text-center"><Button size="sm" variant="outline" onClick={() => createTimesheetForEmployee(emp)}><Plus className="h-3 w-3 mr-1" />Create</Button></TableCell>
                    </TableRow>
                  ))}
                  {/* Grand Total Row */}
                  {filteredTimesheets.length > 0 && (
                    <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                      <TableCell></TableCell>
                      <TableCell className="sticky left-8 bg-primary/20 text-lg">GRAND TOTAL</TableCell>
                      <TableCell></TableCell>
                      {DAYS_SHORT.map((_, i) => <TableCell key={i}></TableCell>)}
                      <TableCell className="text-center text-lg bg-blue-200 dark:bg-blue-800">{grandTotals.worked.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-orange-200 dark:bg-orange-800">{grandTotals.holiday.toFixed(1)}</TableCell>
                      <TableCell className="text-center text-lg bg-red-200 dark:bg-red-800">{grandTotals.sick.toFixed(1)}</TableCell>
                      <TableCell className={`text-center text-lg bg-purple-200 dark:bg-purple-800 ${grandTotals.adj < 0 ? 'text-red-700' : grandTotals.adj > 0 ? 'text-green-700' : ''}`}>
                        {grandTotals.adj > 0 ? '+' : ''}{grandTotals.adj.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center text-lg bg-green-200 dark:bg-green-800">{(grandTotals.worked + grandTotals.holiday + grandTotals.sick + grandTotals.adj).toFixed(1)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  )}
                  {filteredTimesheets.length === 0 && employeesWithoutTimesheet.length === 0 && (
                    <TableRow><TableCell colSpan={17} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      ) : (
        <Card>
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-bold text-sm">MONTHLY VIEW - {format(currentMonth, 'MMMM yyyy')}</h3>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[1000px]">
              {(() => {
                const { grouped, weeksInMonth } = getMonthlyEmployeeData();
                const monthlyGrandTotals = { hours: 0, holiday: 0, sick: 0, adj: 0 };
                
                return (
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50 z-10 w-8 font-bold">No</TableHead>
                        <TableHead className="sticky left-8 bg-muted/50 z-10 min-w-[140px] font-bold">Staff Name</TableHead>
                        <TableHead className="font-bold">Location</TableHead>
                        {weeksInMonth.map((w, idx) => (
                          <TableHead key={idx} className="text-center font-bold">
                            <div>Wk {idx + 1}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{format(w, 'dd/MM')}</div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center bg-blue-100 dark:bg-blue-900 font-bold">Hours</TableHead>
                        <TableHead className="text-center bg-orange-100 dark:bg-orange-900 font-bold">Holiday</TableHead>
                        <TableHead className="text-center bg-red-100 dark:bg-red-900 font-bold">Sick</TableHead>
                        <TableHead className="text-center bg-purple-100 dark:bg-purple-900 font-bold">ADJ</TableHead>
                        <TableHead className="text-center bg-green-100 dark:bg-green-900 font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(grouped).map(([branchName, branchData]) => {
                        const branchTotals = { hours: 0, holiday: 0, sick: 0, adj: 0 };
                        const dataArray = Object.values(branchData);
                        dataArray.forEach(d => {
                          branchTotals.hours += d.totalHours;
                          branchTotals.holiday += d.totalHoliday;
                          branchTotals.sick += d.totalSick;
                          branchTotals.adj += d.totalAdj;
                        });
                        monthlyGrandTotals.hours += branchTotals.hours;
                        monthlyGrandTotals.holiday += branchTotals.holiday;
                        monthlyGrandTotals.sick += branchTotals.sick;
                        monthlyGrandTotals.adj += branchTotals.adj;

                        return (
                          <React.Fragment key={branchName}>
                            <TableRow className="bg-primary/10 border-t-2 border-primary/20">
                              <TableCell colSpan={weeksInMonth.length + 8} className="font-bold text-primary py-2">📍 {branchName} ({dataArray.length} staff)</TableCell>
                            </TableRow>
                            {dataArray.map((data, idx) => (
                              <TableRow key={data.employee.id} className="hover:bg-muted/30">
                                <TableCell className="sticky left-0 bg-background text-center">{idx + 1}</TableCell>
                                <TableCell className="sticky left-8 bg-background font-medium">{data.employee.first_name} {data.employee.last_name}</TableCell>
                                <TableCell className="text-muted-foreground">{data.employee.branch?.name || '-'}</TableCell>
                                {weeksInMonth.map((_, wkIdx) => {
                                  const ts = data.weeks[wkIdx + 1];
                                  return <TableCell key={wkIdx} className="text-center">{ts ? Number(ts.total_worked_hours).toFixed(1) : '-'}</TableCell>;
                                })}
                                <TableCell className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/50">{data.totalHours.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-bold text-orange-600 bg-orange-50/50 dark:bg-orange-950/50">{data.totalHoliday.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-bold text-red-600 bg-red-50/50 dark:bg-red-950/50">{data.totalSick.toFixed(1)}</TableCell>
                                <TableCell className={`text-center font-bold bg-purple-50/50 dark:bg-purple-950/50 ${data.totalAdj < 0 ? 'text-red-600' : data.totalAdj > 0 ? 'text-green-600' : ''}`}>
                                  {data.totalAdj > 0 ? '+' : ''}{data.totalAdj.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-center font-bold bg-green-50/50 dark:bg-green-950/50">
                                  {(data.totalHours + data.totalHoliday + data.totalSick + data.totalAdj).toFixed(1)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Branch Subtotal */}
                            <TableRow className="bg-muted/50 border-b-2 border-primary/20 font-bold">
                              <TableCell></TableCell>
                              <TableCell className="sticky left-8 bg-muted/50 text-primary">SUBTOTAL - {branchName}</TableCell>
                              <TableCell></TableCell>
                              {weeksInMonth.map((_, i) => <TableCell key={i}></TableCell>)}
                              <TableCell className="text-center bg-blue-100 dark:bg-blue-900">{branchTotals.hours.toFixed(1)}</TableCell>
                              <TableCell className="text-center bg-orange-100 dark:bg-orange-900 text-orange-700">{branchTotals.holiday.toFixed(1)}</TableCell>
                              <TableCell className="text-center bg-red-100 dark:bg-red-900 text-red-700">{branchTotals.sick.toFixed(1)}</TableCell>
                              <TableCell className={`text-center bg-purple-100 dark:bg-purple-900 ${branchTotals.adj < 0 ? 'text-red-700' : branchTotals.adj > 0 ? 'text-green-700' : ''}`}>
                                {branchTotals.adj > 0 ? '+' : ''}{branchTotals.adj.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-center bg-green-100 dark:bg-green-900">
                                {(branchTotals.hours + branchTotals.holiday + branchTotals.sick + branchTotals.adj).toFixed(1)}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                      {/* Grand Total */}
                      {Object.keys(grouped).length > 0 && (
                        <TableRow className="bg-primary/20 border-t-4 border-primary font-bold text-primary">
                          <TableCell></TableCell>
                          <TableCell className="sticky left-8 bg-primary/20 text-lg">GRAND TOTAL</TableCell>
                          <TableCell></TableCell>
                          {weeksInMonth.map((_, i) => <TableCell key={i}></TableCell>)}
                          <TableCell className="text-center text-lg bg-blue-200 dark:bg-blue-800">{monthlyGrandTotals.hours.toFixed(1)}</TableCell>
                          <TableCell className="text-center text-lg bg-orange-200 dark:bg-orange-800">{monthlyGrandTotals.holiday.toFixed(1)}</TableCell>
                          <TableCell className="text-center text-lg bg-red-200 dark:bg-red-800">{monthlyGrandTotals.sick.toFixed(1)}</TableCell>
                          <TableCell className={`text-center text-lg bg-purple-200 dark:bg-purple-800 ${monthlyGrandTotals.adj < 0 ? 'text-red-700' : monthlyGrandTotals.adj > 0 ? 'text-green-700' : ''}`}>
                            {monthlyGrandTotals.adj > 0 ? '+' : ''}{monthlyGrandTotals.adj.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center text-lg bg-green-200 dark:bg-green-800">
                            {(monthlyGrandTotals.hours + monthlyGrandTotals.holiday + monthlyGrandTotals.sick + monthlyGrandTotals.adj).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      )}
                      {Object.keys(grouped).length === 0 && (
                        <TableRow><TableCell colSpan={weeksInMonth.length + 8} className="text-center py-8 text-muted-foreground">No timesheets found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                );
              })()}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Timesheet - {selectedTimesheet?.employee?.first_name} {selectedTimesheet?.employee?.last_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Week: {selectedTimesheet?.week_start_date} to {selectedTimesheet?.week_end_date}</div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Day</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Start</TableHead>
                  <TableHead className="font-bold">End</TableHead>
                  <TableHead className="font-bold">Break</TableHead>
                  <TableHead className="bg-blue-100 dark:bg-blue-900 font-bold">Worked</TableHead>
                  <TableHead className="bg-orange-100 dark:bg-orange-900 font-bold">Holiday</TableHead>
                  <TableHead className="bg-red-100 dark:bg-red-900 font-bold">Sick</TableHead>
                  <TableHead className="bg-purple-100 dark:bg-purple-900 font-bold">ADJ+/-</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={entry.id || idx}>
                    <TableCell className="font-medium">{DAYS_SHORT[idx] || entry.day_of_week}</TableCell>
                    <TableCell>{format(parseISO(entry.entry_date), 'dd/MM')}</TableCell>
                    <TableCell><Input type="time" value={entry.shift_start_time || ''} onChange={(e) => updateEntry(idx, 'shift_start_time', e.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input type="time" value={entry.shift_end_time || ''} onChange={(e) => updateEntry(idx, 'shift_end_time', e.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input type="number" value={entry.break_duration_minutes} onChange={(e) => updateEntry(idx, 'break_duration_minutes', parseInt(e.target.value) || 0)} className="w-16" /></TableCell>
                    <TableCell className="bg-blue-50/50 dark:bg-blue-950/50"><Input type="number" step="0.25" value={entry.actual_hours} onChange={(e) => updateEntry(idx, 'actual_hours', parseFloat(e.target.value) || 0)} className="w-20" /></TableCell>
                    <TableCell className="bg-orange-50/50 dark:bg-orange-950/50"><Input type="number" step="0.25" value={entry.holiday_hours} onChange={(e) => updateEntry(idx, 'holiday_hours', parseFloat(e.target.value) || 0)} className="w-20" /></TableCell>
                    <TableCell className="bg-red-50/50 dark:bg-red-950/50"><Input type="number" step="0.25" value={entry.sick_hours} onChange={(e) => updateEntry(idx, 'sick_hours', parseFloat(e.target.value) || 0)} className="w-20" /></TableCell>
                    <TableCell className="bg-purple-50/50 dark:bg-purple-950/50"><Input type="number" step="0.25" value={entry.adjustment_hours} onChange={(e) => updateEntry(idx, 'adjustment_hours', parseFloat(e.target.value) || 0)} className="w-20" /></TableCell>
                    <TableCell>
                      <Select value={entry.entry_type} onValueChange={(v) => updateEntry(idx, 'entry_type', v)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="holiday">Holiday</SelectItem>
                          <SelectItem value="sick">Sick</SelectItem>
                          <SelectItem value="absence">Absence</SelectItem>
                          <SelectItem value="bank_holiday">Bank Hol</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-6 p-4 bg-muted rounded-lg text-sm">
              <div><span className="text-muted-foreground">Worked:</span> <span className="font-bold text-blue-600">{weekTotals.worked.toFixed(1)}h</span></div>
              <div><span className="text-muted-foreground">Holiday:</span> <span className="font-bold text-orange-600">{weekTotals.holiday.toFixed(1)}h</span></div>
              <div><span className="text-muted-foreground">Sick:</span> <span className="font-bold text-red-600">{weekTotals.sick.toFixed(1)}h</span></div>
              <div><span className="text-muted-foreground">ADJ+/-:</span> <span className={`font-bold ${weekTotals.adj < 0 ? 'text-red-600' : weekTotals.adj > 0 ? 'text-green-600' : ''}`}>{weekTotals.adj > 0 ? '+' : ''}{weekTotals.adj.toFixed(1)}h</span></div>
              <div className="ml-auto"><span className="text-muted-foreground">Total:</span> <span className="font-bold text-lg">{(weekTotals.worked + weekTotals.holiday + weekTotals.sick + weekTotals.adj).toFixed(1)}h</span></div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={saveTimesheet} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
