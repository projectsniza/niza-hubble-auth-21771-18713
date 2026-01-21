import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, Timer, CalendarDays, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInMinutes, startOfMonth, endOfMonth, parseISO } from 'date-fns';

interface ClockIn {
  id: string;
  user_id: string;
  branch_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  notes: string | null;
  profile?: { name: string | null; display_name: string | null };
  branch?: { name: string };
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
  employee?: { first_name: string; last_name: string };
  leave_type?: { name: string };
}

export default function LeaveAttendanceOverview() {
  const [clockIns, setClockIns] = useState<ClockIn[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      const monthEnd = endOfMonth(monthStart);

      const [clockInsRes, leaveRes] = await Promise.all([
        supabase
          .from('clock_ins')
          .select(`
            *,
            branch:branches(name)
          `)
          .gte('clock_in_time', monthStart.toISOString())
          .lte('clock_in_time', monthEnd.toISOString())
          .order('clock_in_time', { ascending: false }),
        supabase
          .from('leave_requests')
          .select(`
            *,
            employee:employees(first_name, last_name),
            leave_type:leave_types(name)
          `)
          .order('start_date', { ascending: false })
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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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
    const employeeHours: { [key: string]: { name: string; totalMins: number; sessions: number } } = {};
    
    clockIns.forEach(clockIn => {
      const userId = clockIn.user_id;
      const name = clockIn.profile?.display_name || clockIn.profile?.name || 'Unknown';
      
      if (!employeeHours[userId]) {
        employeeHours[userId] = { name, totalMins: 0, sessions: 0 };
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

  const filteredClockIns = clockIns.filter(c => {
    const name = c.profile?.display_name || c.profile?.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredLeave = leaveRequests.filter(l => {
    const name = `${l.employee?.first_name} ${l.employee?.last_name}`;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeave.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                          <a
                            href={supabase.storage.from('leave-documents').getPublicUrl(leave.supporting_document_path).data.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline text-sm"
                          >
                            <FileText className="h-4 w-4" />
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
