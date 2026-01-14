import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, Save, Check, 
  X, FileText, Download, Loader2, Users, Building2, Plus, Search
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

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

export function TimesheetView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewTab, setViewTab] = useState<'weekly' | 'monthly'>('weekly');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [monthlyTimesheets, setMonthlyTimesheets] = useState<Timesheet[]>([]);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');

  useEffect(() => {
    if (viewTab === 'weekly') {
      fetchWeeklyData();
    } else {
      fetchMonthlyData();
    }
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }
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

      // Fetch employees with branch info
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
        .in('status', ['active', 'onboarding'])
        .order('first_name');

      setEmployees(employeesData || []);

      // Fetch timesheets for the week
      const { data: timesheetsData } = await supabase
        .from('timesheets')
        .select(`
          *,
          employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))
        `)
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

      // Fetch employees with branch info
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, organization_id, branch_id, branch:branches(name)')
        .in('status', ['active', 'onboarding'])
        .order('first_name');

      setEmployees(employeesData || []);

      // Fetch all timesheets for the month
      const { data: timesheetsData } = await supabase
        .from('timesheets')
        .select(`
          *,
          employee:employees(id, first_name, last_name, organization_id, branch_id, branch:branches(name))
        `)
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

      // Create empty entries for each day
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
    } catch (error: any) {
      toast.error(error.message || 'Failed to create timesheet');
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

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: any) => {
    const updated = [...entries];
    (updated[index] as any)[field] = value;
    
    // Auto-calculate actual hours if start/end times are set
    if ((field === 'shift_start_time' || field === 'shift_end_time' || field === 'break_duration_minutes') 
        && updated[index].shift_start_time && updated[index].shift_end_time) {
      const start = updated[index].shift_start_time!;
      const end = updated[index].shift_end_time!;
      const breakMins = updated[index].break_duration_minutes || 0;
      
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      
      let totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
      if (totalMins < 0) totalMins += 24 * 60; // Handle overnight
      
      updated[index].actual_hours = Math.round(totalMins / 60 * 100) / 100;
    }
    
    setEntries(updated);
  };

  const saveTimesheet = async () => {
    if (!selectedTimesheet) return;
    
    setSaving(true);
    try {
      for (const entry of entries) {
        if (entry.id) {
          await supabase
            .from('timesheet_entries')
            .update({
              shift_start_time: entry.shift_start_time,
              shift_end_time: entry.shift_end_time,
              break_duration_minutes: entry.break_duration_minutes,
              actual_hours: entry.actual_hours,
              holiday_hours: entry.holiday_hours,
              sick_hours: entry.sick_hours,
              adjustment_hours: entry.adjustment_hours,
              entry_type: entry.entry_type,
              notes: entry.notes
            })
            .eq('id', entry.id);
        }
      }

      toast.success('Timesheet saved');
      setShowEditDialog(false);
      fetchWeeklyData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save timesheet');
    } finally {
      setSaving(false);
    }
  };

  const approveTimesheet = async (timesheetId: string) => {
    try {
      await supabase
        .from('timesheets')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id
        })
        .eq('id', timesheetId);

      const timesheet = timesheets.find(t => t.id === timesheetId);
      if (timesheet) {
        await supabase.rpc('calculate_holiday_balance', {
          p_employee_id: timesheet.employee_id
        });
      }

      toast.success('Timesheet approved');
      fetchWeeklyData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve timesheet');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'submitted':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Submitted</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter employees based on selection and search
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (!canViewFilters) return true;
    if (viewMode === 'organization' && selectedOrg) {
      return emp.organization_id === selectedOrg;
    }
    if (viewMode === 'branch' && selectedBranch) {
      return emp.branch_id === selectedBranch;
    }
    return true;
  });

  // Get employees without timesheets for this week
  const employeesWithoutTimesheet = filteredEmployees.filter(
    emp => !timesheets.some(t => t.employee_id === emp.id)
  );

  const filteredTimesheets = timesheets.filter(t => {
    const emp = t.employee;
    if (!emp) return true;
    
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (!canViewFilters) return true;
    if (viewMode === 'organization' && selectedOrg) {
      return emp.organization_id === selectedOrg;
    }
    if (viewMode === 'branch' && selectedBranch) {
      return emp.branch_id === selectedBranch;
    }
    return true;
  });

  // Monthly view - aggregate by employee
  const getMonthlyEmployeeData = () => {
    const aggregated: Record<string, { 
      employee: Employee; 
      weeks: Record<number, Timesheet>;
      totalHours: number;
      totalHoliday: number;
      totalSick: number;
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
          totalSick: 0
        };
      }

      const weekIdx = weeksInMonth.findIndex(w => 
        format(w, 'yyyy-MM-dd') === ts.week_start_date
      );
      
      if (weekIdx >= 0) {
        aggregated[empId].weeks[weekIdx + 1] = ts;
      }
      
      aggregated[empId].totalHours += Number(ts.total_worked_hours) || 0;
      aggregated[empId].totalHoliday += Number(ts.total_holiday_hours) || 0;
      aggregated[empId].totalSick += Number(ts.total_sick_hours) || 0;
    });

    return { aggregated, weeksInMonth };
  };

  const weekTotal = (field: 'actual_hours' | 'holiday_hours' | 'sick_hours') => 
    entries.reduce((sum, e) => sum + (Number(e[field]) || 0), 0);

  const exportToCSV = () => {
    const headers = ['Employee', 'Location', 'Week', 'Worked Hours', 'Holiday Hours', 'Sick Hours', 'Total', 'Status'];
    const rows = filteredTimesheets.map(t => [
      `${t.employee?.first_name} ${t.employee?.last_name}`,
      t.employee?.branch?.name || '',
      `${t.week_start_date} - ${t.week_end_date}`,
      t.total_worked_hours,
      t.total_holiday_hours,
      t.total_sick_hours,
      Number(t.total_worked_hours) + Number(t.total_holiday_hours) + Number(t.total_sick_hours),
      t.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${format(currentWeekStart, 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Staff Attendance Details</h2>
          <p className="text-muted-foreground">Track actual worked hours, holiday & sick time</p>
        </div>
        
        {/* View Toggle & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'weekly' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewTab === 'weekly' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-4 py-2 bg-muted rounded-md min-w-[200px] text-center">
                <span className="font-medium">
                  {format(currentWeekStart, 'dd MMM')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd MMM yyyy')}
                </span>
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Today
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-4 py-2 bg-muted rounded-md min-w-[150px] text-center">
                <span className="font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
              </div>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      {canViewFilters && (
        <OrgBranchFilter
          organizations={organizations}
          branches={branches}
          viewMode={viewMode}
          selectedOrg={selectedOrg}
          selectedBranch={selectedBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setSelectedOrg}
          onBranchChange={setSelectedBranch}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-bold">{filteredEmployees.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold">{filteredTimesheets.filter(t => t.status === 'approved').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{filteredTimesheets.filter(t => t.status === 'draft' || t.status === 'submitted').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Not Created</p>
              <p className="text-2xl font-bold">{employeesWithoutTimesheet.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {viewTab === 'weekly' && employeesWithoutTimesheet.length > 0 && (
          <Button onClick={createAllTimesheets}>
            <Plus className="h-4 w-4 mr-2" />
            Create All Timesheets ({employeesWithoutTimesheet.length})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewTab === 'weekly' ? (
        /* Weekly View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Mon</TableHead>
                <TableHead className="text-center">Tue</TableHead>
                <TableHead className="text-center">Wed</TableHead>
                <TableHead className="text-center">Thu</TableHead>
                <TableHead className="text-center">Fri</TableHead>
                <TableHead className="text-center">Sat</TableHead>
                <TableHead className="text-center">Sun</TableHead>
                <TableHead className="text-center">Hours</TableHead>
                <TableHead className="text-center">Holiday</TableHead>
                <TableHead className="text-center">Sick</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Existing Timesheets */}
              {filteredTimesheets.map((timesheet) => (
                <TableRow key={timesheet.id}>
                  <TableCell className="font-medium">
                    {timesheet.employee?.first_name} {timesheet.employee?.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {timesheet.employee?.branch?.name || '-'}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center text-muted-foreground">-</TableCell>
                  <TableCell className="text-center font-medium">{timesheet.total_worked_hours}</TableCell>
                  <TableCell className="text-center text-blue-600">{timesheet.total_holiday_hours}</TableCell>
                  <TableCell className="text-center text-red-600">{timesheet.total_sick_hours}</TableCell>
                  <TableCell className="text-center font-bold">
                    {Number(timesheet.total_worked_hours) + Number(timesheet.total_holiday_hours) + Number(timesheet.total_sick_hours)}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(timesheet.status)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openTimesheetEditor(timesheet)}>
                        Edit
                      </Button>
                      {timesheet.status !== 'approved' && (
                        <Button size="sm" variant="default" onClick={() => approveTimesheet(timesheet.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Employees without timesheets */}
              {employeesWithoutTimesheet.map((emp) => (
                <TableRow key={emp.id} className="bg-muted/30">
                  <TableCell className="font-medium text-muted-foreground">
                    {emp.first_name} {emp.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {emp.branch?.name || '-'}
                  </TableCell>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    No timesheet for this week
                  </TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="outline" onClick={() => createTimesheetForEmployee(emp)}>
                      <Plus className="h-3 w-3 mr-1" /> Create
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Monthly View - like Excel format */
        <Card>
          <ScrollArea className="w-full">
            <div className="min-w-[1200px]">
              {(() => {
                const { aggregated, weeksInMonth } = getMonthlyEmployeeData();
                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50">Employee</TableHead>
                        <TableHead>Location</TableHead>
                        {weeksInMonth.map((w, idx) => (
                          <TableHead key={idx} className="text-center text-xs">
                            Week {idx + 1}<br/>
                            <span className="text-muted-foreground">{format(w, 'dd/MM')}</span>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold bg-blue-50 dark:bg-blue-950">Hours</TableHead>
                        <TableHead className="text-center font-bold bg-orange-50 dark:bg-orange-950">Holiday</TableHead>
                        <TableHead className="text-center font-bold bg-red-50 dark:bg-red-950">Sick</TableHead>
                        <TableHead className="text-center font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(aggregated).map((data) => (
                        <TableRow key={data.employee.id}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {data.employee.first_name} {data.employee.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {data.employee.branch?.name || '-'}
                          </TableCell>
                          {weeksInMonth.map((_, idx) => {
                            const ts = data.weeks[idx + 1];
                            return (
                              <TableCell key={idx} className="text-center text-sm">
                                {ts ? Number(ts.total_worked_hours).toFixed(1) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-blue-50 dark:bg-blue-950">
                            {data.totalHours.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center font-bold text-orange-600 bg-orange-50 dark:bg-orange-950">
                            {data.totalHoliday.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center font-bold text-red-600 bg-red-50 dark:bg-red-950">
                            {data.totalSick.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {(data.totalHours + data.totalHoliday + data.totalSick).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {Object.keys(aggregated).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={weeksInMonth.length + 6} className="text-center py-8 text-muted-foreground">
                            No timesheets found for this month
                          </TableCell>
                        </TableRow>
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

      {/* Edit Timesheet Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Timesheet - {selectedTimesheet?.employee?.first_name} {selectedTimesheet?.employee?.last_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Week: {selectedTimesheet?.week_start_date} to {selectedTimesheet?.week_end_date}
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Break (min)</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Sick</TableHead>
                  <TableHead>Adj+/-</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={entry.id || idx}>
                    <TableCell className="font-medium">{entry.day_of_week}</TableCell>
                    <TableCell>{format(parseISO(entry.entry_date), 'dd/MM')}</TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={entry.shift_start_time || ''}
                        onChange={(e) => updateEntry(idx, 'shift_start_time', e.target.value)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={entry.shift_end_time || ''}
                        onChange={(e) => updateEntry(idx, 'shift_end_time', e.target.value)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.break_duration_minutes}
                        onChange={(e) => updateEntry(idx, 'break_duration_minutes', parseInt(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={entry.actual_hours}
                        onChange={(e) => updateEntry(idx, 'actual_hours', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={entry.holiday_hours}
                        onChange={(e) => updateEntry(idx, 'holiday_hours', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={entry.sick_hours}
                        onChange={(e) => updateEntry(idx, 'sick_hours', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        value={entry.adjustment_hours}
                        onChange={(e) => updateEntry(idx, 'adjustment_hours', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={entry.entry_type} onValueChange={(v) => updateEntry(idx, 'entry_type', v)}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="holiday">Holiday</SelectItem>
                          <SelectItem value="sick">Sick</SelectItem>
                          <SelectItem value="absence">Absence</SelectItem>
                          <SelectItem value="bank_holiday">Bank Holiday</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Week Totals */}
            <div className="flex gap-6 p-4 bg-muted rounded-lg">
              <div>
                <span className="text-sm text-muted-foreground">Total Worked:</span>
                <span className="ml-2 font-bold">{weekTotal('actual_hours').toFixed(2)} hrs</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Holiday:</span>
                <span className="ml-2 font-bold text-blue-600">{weekTotal('holiday_hours').toFixed(2)} hrs</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Sick:</span>
                <span className="ml-2 font-bold text-red-600">{weekTotal('sick_hours').toFixed(2)} hrs</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Grand Total:</span>
                <span className="ml-2 font-bold">
                  {(weekTotal('actual_hours') + weekTotal('holiday_hours') + weekTotal('sick_hours')).toFixed(2)} hrs
                </span>
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
