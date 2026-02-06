import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Search, Timer, CalendarDays, FileText, Trash2, LayoutGrid, Clock, CalendarCheck } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, differenceInMinutes, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, isWithinInterval, isSameDay } from 'date-fns';

interface ClockIn {
  id: string;
  user_id: string;
  branch_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  notes: string | null;
  profile?: { name: string | null; display_name: string | null };
  branch?: { name: string; organization_id?: string };
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  supporting_document_path: string | null;
  supporting_document_name: string | null;
  employee?: { first_name: string; last_name: string; user_id?: string | null; organization_id?: string; branch_id?: string };
  leave_type?: { name: string };
}

interface TimesheetEntry {
  id: string;
  entry_date: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  actual_hours: number | null;
  holiday_hours: number | null;
  sick_hours: number | null;
  timesheet?: { 
    employee_id: string;
    employee?: { first_name: string; last_name: string; user_id?: string | null; organization_id?: string; branch_id?: string };
  };
}

interface ComparisonRow {
  date: string;
  employeeId: string;
  employeeName: string;
  userId: string | null;
  organizationId: string | null;
  branchId: string | null;
  timesheetHours: string | null;
  clockInHours: string | null;
  leaveType: string | null;
  leaveStatus: string | null;
}

export default function LeaveAttendanceOverview() {
  const { user } = useAuth();
  const [clockIns, setClockIns] = useState<ClockIn[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [leaveToDelete, setLeaveToDelete] = useState<LeaveRequest | null>(null);
  
  // Org/Branch filters
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [filterOrg, setFilterOrg] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  const isSuperAdmin = user?.role === 'super_admin';
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');

  useEffect(() => {
    fetchData();
    fetchOrgsAndBranches();
  }, [selectedMonth, selectedYear]);

  const fetchOrgsAndBranches = async () => {
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
      const monthStart = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      const monthEnd = endOfMonth(monthStart);
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

      const [clockInsRes, leaveRes, timesheetRes] = await Promise.all([
        supabase
          .from('clock_ins')
          .select(`
            *,
            branch:branches(name, organization_id)
          `)
          .gte('clock_in_time', monthStart.toISOString())
          .lte('clock_in_time', monthEnd.toISOString())
          .order('clock_in_time', { ascending: false }),
        supabase
          .from('leave_requests')
          .select(`
            *,
            employee:employees(first_name, last_name, user_id, organization_id, branch_id),
            leave_type:leave_types(name)
          `)
          .order('start_date', { ascending: false }),
        supabase
          .from('timesheet_entries')
          .select(`
            *,
            timesheet:timesheets(
              employee_id,
              employee:employees(first_name, last_name, user_id, organization_id, branch_id)
            )
          `)
          .gte('entry_date', monthStartStr)
          .lte('entry_date', monthEndStr)
          .order('entry_date', { ascending: false })
      ]);

      // Fetch profile names for clock-ins
      if (clockInsRes.data) {
        const userIds = [...new Set(clockInsRes.data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name')
          .in('id', userIds);

        const clockInsWithProfiles = clockInsRes.data.map(clockIn => ({
          ...clockIn,
          profile: profiles?.find(p => p.id === clockIn.user_id)
        }));
        setClockIns(clockInsWithProfiles);
      }

      setLeaveRequests(leaveRes.data || []);
      setTimesheetEntries(timesheetRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeave = async (leave: LeaveRequest) => {
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', leave.id);
      if (error) throw error;

      toast.success('Leave request deleted');
      setLeaveToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete leave request');
    }
  };

  const calculateTotalHours = (clockIn: ClockIn) => {
    if (!clockIn.clock_out_time) return 'Active';
    const mins = differenceInMinutes(
      parseISO(clockIn.clock_out_time),
      parseISO(clockIn.clock_in_time)
    );
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours}h ${minutes}m`;
  };

  const getEmployeeTotalHours = () => {
    const employeeHours: { [key: string]: { name: string; totalMins: number; sessions: number; orgId?: string; branchId?: string } } = {};
    
    // First apply org/branch filter to clockIns
    const filteredClockInsForHours = clockIns.filter(clockIn => {
      if (!canViewFilters) return true;
      if (filterOrg && filterOrg !== 'all') {
        if (clockIn.branch?.organization_id !== filterOrg) return false;
      }
      if (filterBranch && filterBranch !== 'all') {
        if (clockIn.branch_id !== filterBranch) return false;
      }
      return true;
    });
    
    filteredClockInsForHours.forEach(clockIn => {
      const userId = clockIn.user_id;
      const name = clockIn.profile?.display_name || clockIn.profile?.name || 'Unknown';
      
      if (!employeeHours[userId]) {
        employeeHours[userId] = { 
          name, 
          totalMins: 0, 
          sessions: 0,
          orgId: clockIn.branch?.organization_id,
          branchId: clockIn.branch_id
        };
      }
      
      if (clockIn.clock_out_time) {
        const mins = differenceInMinutes(
          parseISO(clockIn.clock_out_time),
          parseISO(clockIn.clock_in_time)
        );
        employeeHours[userId].totalMins += mins;
      }
      employeeHours[userId].sessions++;
    });

    return Object.entries(employeeHours).map(([id, data]) => ({
      id,
      name: data.name,
      totalHours: Math.floor(data.totalMins / 60),
      totalMinutes: data.totalMins % 60,
      sessions: data.sessions
    }));
  };

  // Generate comparison data
  const getComparisonData = useCallback((): ComparisonRow[] => {
    const monthStart = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
    const monthEnd = endOfMonth(monthStart);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Build unique employee list from all sources with org/branch info
    const employeeMap = new Map<string, { name: string; userId: string | null; organizationId: string | null; branchId: string | null }>();
    
    timesheetEntries.forEach(te => {
      if (te.timesheet?.employee) {
        employeeMap.set(te.timesheet.employee_id, { 
          name: `${te.timesheet.employee.first_name} ${te.timesheet.employee.last_name}`,
          userId: te.timesheet.employee.user_id || null,
          organizationId: te.timesheet.employee.organization_id || null,
          branchId: te.timesheet.employee.branch_id || null
        });
      }
    });
    
    leaveRequests.forEach(lr => {
      if (lr.employee) {
        employeeMap.set(lr.employee_id, { 
          name: `${lr.employee.first_name} ${lr.employee.last_name}`,
          userId: lr.employee.user_id || null,
          organizationId: lr.employee.organization_id || null,
          branchId: lr.employee.branch_id || null
        });
      }
    });

    const rows: ComparisonRow[] = [];
    
    employeeMap.forEach((empData, empId) => {
      allDays.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        
        // Find timesheet entry
        const tsEntry = timesheetEntries.find(te => te.timesheet?.employee_id === empId && te.entry_date === dayStr);
        let timesheetHours: string | null = null;
        if (tsEntry) {
          const totalHrs = (tsEntry.actual_hours || 0) + (tsEntry.holiday_hours || 0) + (tsEntry.sick_hours || 0);
          if (totalHrs > 0) {
            timesheetHours = `${totalHrs}h`;
          }
          // Use shift_start_time and shift_end_time instead of am/pm
          if (tsEntry.shift_start_time || tsEntry.shift_end_time) {
            const parts = [];
            if (tsEntry.shift_start_time && tsEntry.shift_end_time) {
              parts.push(`${tsEntry.shift_start_time} - ${tsEntry.shift_end_time}`);
            }
            if (parts.length > 0) timesheetHours = parts.join(' | ');
          }
        }
        
        // Find clock-in for this employee on this day
        const empClockIns = clockIns.filter(ci => {
          if (empData.userId && ci.user_id === empData.userId) {
            return isSameDay(parseISO(ci.clock_in_time), day);
          }
          return false;
        });
        let clockInHours: string | null = null;
        if (empClockIns.length > 0) {
          let totalMins = 0;
          empClockIns.forEach(ci => {
            if (ci.clock_out_time) {
              totalMins += differenceInMinutes(parseISO(ci.clock_out_time), parseISO(ci.clock_in_time));
            }
          });
          if (totalMins > 0) {
            clockInHours = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
          } else if (empClockIns.some(ci => !ci.clock_out_time)) {
            clockInHours = 'Active';
          }
        }
        
        // Find leave for this date
        const leave = leaveRequests.find(lr => {
          if (lr.employee_id !== empId) return false;
          const start = parseISO(lr.start_date);
          const end = parseISO(lr.end_date);
          return isWithinInterval(day, { start, end });
        });
        
        // Only include rows that have some data
        if (timesheetHours || clockInHours || leave) {
          rows.push({
            date: dayStr,
            employeeId: empId,
            employeeName: empData.name,
            userId: empData.userId,
            organizationId: empData.organizationId,
            branchId: empData.branchId,
            timesheetHours,
            clockInHours,
            leaveType: leave?.leave_type?.name || null,
            leaveStatus: leave?.status || null
          });
        }
      });
    });
    
    // Sort by date desc, then employee name
    rows.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.employeeName.localeCompare(b.employeeName);
    });
    
    return rows;
  }, [selectedMonth, selectedYear, timesheetEntries, clockIns, leaveRequests]);

  // Apply org/branch filtering to clock-ins
  const filteredClockIns = clockIns.filter(c => {
    const name = c.profile?.display_name || c.profile?.name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    
    if (filterOrg && filterOrg !== 'all') {
      if (c.branch?.organization_id !== filterOrg) return false;
    }
    if (filterBranch && filterBranch !== 'all') {
      if (c.branch_id !== filterBranch) return false;
    }
    return true;
  });

  // Apply org/branch filtering to leave requests
  const filteredLeave = leaveRequests.filter(l => {
    const name = `${l.employee?.first_name} ${l.employee?.last_name}`;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    
    if (filterOrg && filterOrg !== 'all') {
      if (l.employee?.organization_id !== filterOrg) return false;
    }
    if (filterBranch && filterBranch !== 'all') {
      if (l.employee?.branch_id !== filterBranch) return false;
    }
    return true;
  });

  const comparisonData = getComparisonData();
  const filteredComparison = comparisonData.filter(row => {
    const matchesSearch = row.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    
    // Apply org/branch filters
    if (filterOrg && filterOrg !== 'all') {
      if (row.organizationId !== filterOrg) return false;
    }
    if (filterBranch && filterBranch !== 'all') {
      if (row.branchId !== filterBranch) return false;
    }
    return true;
  });

  const pendingLeave = leaveRequests.filter(l => l.status === 'pending').length;
  const approvedLeave = leaveRequests.filter(l => l.status === 'approved').length;
  const employeeHours = getEmployeeTotalHours();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employeeHours.length}</p>
              <p className="text-sm text-muted-foreground">Employees Clocked</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clockIns.length}</p>
              <p className="text-sm text-muted-foreground">Clock-in Sessions</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingLeave}</p>
              <p className="text-sm text-muted-foreground">Pending Leave</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedLeave}</p>
              <p className="text-sm text-muted-foreground">Approved Leave</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {canViewFilters && (
          <>
            <Select value={filterOrg} onValueChange={(v) => { setFilterOrg(v); setFilterBranch(''); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches
                  .filter(b => !filterOrg || filterOrg === 'all' || b.organization_id === filterOrg)
                  .map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </>
        )}
        
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i} value={i.toString()}>
                {new Date(2025, i).toLocaleString('default', { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() + i - 2;
              return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="hours" className="w-full">
        <TabsList>
          <TabsTrigger value="hours">Total Hours</TabsTrigger>
          <TabsTrigger value="clockins">Clock-in History</TabsTrigger>
          <TabsTrigger value="leave">All Leave Requests</TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Attendance Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Employee Hours Summary - {new Date(parseInt(selectedYear), parseInt(selectedMonth)).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Total Sessions</TableHead>
                  <TableHead>Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeHours.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No clock-in data for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeHours.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.sessions}</TableCell>
                      <TableCell>{emp.totalHours}h {emp.totalMinutes}m</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="clockins" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Clock-in/out History</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClockIns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No clock-in records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClockIns.map(clockIn => (
                    <TableRow key={clockIn.id}>
                      <TableCell className="font-medium">
                        {clockIn.profile?.display_name || clockIn.profile?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>{clockIn.branch?.name || '-'}</TableCell>
                      <TableCell>{format(parseISO(clockIn.clock_in_time), 'dd MMM yyyy, HH:mm')}</TableCell>
                      <TableCell>
                        {clockIn.clock_out_time 
                          ? format(parseISO(clockIn.clock_out_time), 'dd MMM yyyy, HH:mm')
                          : <Badge variant="secondary">Active</Badge>
                        }
                      </TableCell>
                      <TableCell>{calculateTotalHours(clockIn)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">All Leave Requests</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Document</TableHead>
                  {isSuperAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeave.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">
                      No leave requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeave.map(leave => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">
                        {leave.employee?.first_name} {leave.employee?.last_name}
                      </TableCell>
                      <TableCell>{leave.leave_type?.name || '-'}</TableCell>
                      <TableCell>{format(parseISO(leave.start_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{format(parseISO(leave.end_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{getStatusBadge(leave.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{leave.reason || '-'}</TableCell>
                      <TableCell>
                        {leave.supporting_document_path ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto flex items-center gap-1 text-primary hover:underline text-sm"
                            onClick={async () => {
                              const { data, error } = await supabase.storage
                                .from('leave-documents')
                                .createSignedUrl(leave.supporting_document_path!, 3600);
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, '_blank');
                              } else {
                                console.error('Error getting signed URL:', error);
                              }
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setLeaveToDelete(leave)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold">Attendance Comparison</h3>
              <span className="text-sm text-muted-foreground">
                - {new Date(parseInt(selectedYear), parseInt(selectedMonth)).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Compare timesheet entries, clock-ins, and leave requests side by side.
            </p>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <span>Timesheet</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span>Clock-in</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-orange-600" />
                <span>Leave</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-green-600" />
                        Timesheet
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-purple-600" />
                        Clock-in
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <CalendarCheck className="h-4 w-4 text-orange-600" />
                        Leave
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComparison.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No attendance data found for this month
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComparison.map((row, idx) => (
                      <TableRow key={`${row.date}-${row.employeeId}-${idx}`}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(parseISO(row.date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>{row.employeeName}</TableCell>
                        <TableCell>
                          {row.timesheetHours ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                              {row.timesheetHours}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.clockInHours ? (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20">
                              {row.clockInHours}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.leaveType ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
                                {row.leaveType}
                              </Badge>
                              {row.leaveStatus && getStatusBadge(row.leaveStatus)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Leave Confirmation Dialog */}
      <AlertDialog open={!!leaveToDelete} onOpenChange={(open) => !open && setLeaveToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the leave request for {leaveToDelete?.employee?.first_name} {leaveToDelete?.employee?.last_name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => leaveToDelete && handleDeleteLeave(leaveToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
