import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Mail, Phone, Calendar as CalendarIcon, MapPin, FileText, Clock, User, Plus, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { logActivity } from '@/hooks/useActivityLogs';

export default function MyProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [clockIns, setClockIns] = useState<any[]>([]);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: '',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch employee record
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (empData) {
        setEmployee(empData);

        // Fetch leave requests
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('*, leave_types(*)')
          .eq('employee_id', empData.id)
          .order('created_at', { ascending: false });
        setLeaveRequests(leaves || []);

        // Fetch shifts
        const { data: shiftsData } = await supabase
          .from('rota_shifts')
          .select('*, rotas(*)')
          .eq('employee_id', empData.id)
          .gte('shift_date', new Date().toISOString().split('T')[0])
          .order('shift_date', { ascending: true });
        setShifts(shiftsData || []);

        // Fetch documents
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('employee_id', empData.id)
          .order('created_at', { ascending: false });
        setDocuments(docs || []);

        // Fetch payslips
        const { data: payData } = await supabase
          .from('payroll_records')
          .select('*')
          .eq('employee_id', empData.id)
          .order('month', { ascending: false });
        setPayslips(payData || []);
      }

      // Fetch leave types
      const { data: types } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_paid', true);
      setLeaveTypes(types || []);

      // Fetch training assignments
      const { data: trainingData } = await supabase
        .from('training_assignments')
        .select('*, trainings(*)')
        .eq('assigned_to', user?.id)
        .order('created_at', { ascending: false });
      setTrainings(trainingData || []);

      // Fetch clock-ins
      const { data: clockData } = await supabase
        .from('clock_ins')
        .select('*')
        .eq('user_id', user?.id)
        .order('clock_in_time', { ascending: false })
        .limit(30);
      setClockIns(clockData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRequest = async () => {
    if (!employee) return;

    try {
      const { error } = await supabase.from('leave_requests').insert({
        employee_id: employee.id,
        leave_type_id: leaveForm.leave_type_id,
        start_date: leaveForm.start_date.toISOString().split('T')[0],
        end_date: leaveForm.end_date.toISOString().split('T')[0],
        reason: leaveForm.reason,
      });

      if (error) throw error;

      // Log activity for super admin notification
      if (user) {
        await logActivity({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          activityType: 'leave_request',
          activityCategory: 'employees',
          title: 'New Leave Request',
          description: `${user.name} submitted a leave request`,
          organizationId: user.organizationId,
          branchId: user.branchId,
        });
      }

      toast({ title: "Success", description: "Leave request submitted" });
      setShowLeaveDialog(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit leave request",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: 'bg-green-500 text-white',
      pending: 'bg-amber-500 text-white',
      rejected: 'bg-destructive text-destructive-foreground',
      completed: 'bg-green-500 text-white',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Profile</h1>

      {/* Profile Header */}
      <Card className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
          <Avatar className="h-16 w-16 md:h-24 md:w-24">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg md:text-2xl">
              {getInitials(employee?.first_name && employee?.last_name ? `${employee.first_name} ${employee.last_name}` : user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center sm:text-left w-full">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {employee ? `${employee.first_name} ${employee.last_name}` : user.name}
            </h2>
            <p className="text-sm md:text-lg text-muted-foreground mb-3 md:mb-4">{employee?.job_title || user.role}</p>
            
            <div className="flex items-center justify-center sm:justify-start gap-2 md:gap-3 mb-4 md:mb-6 flex-wrap">
              <Badge variant="secondary" className="text-xs md:text-sm">
                {employee?.department || user.role}
              </Badge>
              <Badge className={employee?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                {employee?.status || 'Pending'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
              <div className="flex items-center gap-2 text-sm md:text-base">
                <Mail className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground truncate">{employee?.email || user.email}</span>
              </div>
              {employee?.phone && (
                <div className="flex items-center gap-2 text-sm md:text-base">
                  <Phone className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{employee.phone}</span>
                </div>
              )}
              {employee?.join_date && (
                <div className="flex items-center gap-2 text-sm md:text-base">
                  <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">Joined: {format(new Date(employee.join_date), 'PPP')}</span>
                </div>
              )}
              {employee?.address && (
                <div className="flex items-center gap-2 text-sm md:text-base">
                  <MapPin className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate">{employee.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <Card className="p-3 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-primary/10 rounded-lg">
              <CalendarIcon className="h-4 w-4 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Leave</p>
              <p className="text-lg md:text-2xl font-bold text-foreground">{leaveRequests.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-primary/10 rounded-lg">
              <Clock className="h-4 w-4 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Shifts</p>
              <p className="text-lg md:text-2xl font-bold text-foreground">{shifts.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-primary/10 rounded-lg">
              <FileText className="h-4 w-4 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Docs</p>
              <p className="text-lg md:text-2xl font-bold text-foreground">{documents.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-primary/10 rounded-lg">
              <FileText className="h-4 w-4 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Training</p>
              <p className="text-lg md:text-2xl font-bold text-foreground">{trainings.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="w-full overflow-x-auto flex md:grid md:grid-cols-4 no-scrollbar">
          <TabsTrigger value="leave" className="text-xs md:text-sm whitespace-nowrap">My Leave</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs md:text-sm whitespace-nowrap">Schedule</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs md:text-sm whitespace-nowrap">Docs</TabsTrigger>
          <TabsTrigger value="payslips" className="text-xs md:text-sm whitespace-nowrap">Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="leave">
          <Card className="p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-bold text-foreground">My Leave</h3>
              <Button size="sm" onClick={() => setShowLeaveDialog(true)}>
                <Plus className="h-4 w-4 mr-1 md:mr-2" />
                Request Leave
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No leave requests
                    </TableCell>
                  </TableRow>
                ) : (
                  leaveRequests.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell>{leave.leave_types?.name || '-'}</TableCell>
                      <TableCell>{format(new Date(leave.start_date), 'PPP')}</TableCell>
                      <TableCell>{format(new Date(leave.end_date), 'PPP')}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(leave.status)}>{leave.status}</Badge>
                      </TableCell>
                      <TableCell>{leave.reason || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Schedule</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No upcoming shifts
                    </TableCell>
                  </TableRow>
                ) : (
                  shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{format(new Date(shift.shift_date), 'PPP')}</TableCell>
                      <TableCell>{shift.start_time}</TableCell>
                      <TableCell>{shift.end_time}</TableCell>
                      <TableCell>{shift.break_duration} mins</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(shift.status)}>{shift.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Documents</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No documents
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>{doc.file_type || '-'}</TableCell>
                      <TableCell>{format(new Date(doc.created_at), 'PPP')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Payslips</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No payslips
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell className="font-medium">{format(new Date(payslip.month), 'MMMM yyyy')}</TableCell>
                      <TableCell>£{payslip.net_salary?.toLocaleString() || '0'}</TableCell>
                      <TableCell>{format(new Date(payslip.generated_at), 'PPP')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="training">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Training</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No training courses
                    </TableCell>
                  </TableRow>
                ) : (
                  trainings.map((training) => (
                    <TableRow key={training.id}>
                      <TableCell className="font-medium">{training.trainings?.title || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(training.status)}>{training.status}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(training.created_at), 'PPP')}</TableCell>
                      <TableCell>{training.completed_at ? format(new Date(training.completed_at), 'PPP') : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">Attendance History</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clockIns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No attendance records
                    </TableCell>
                  </TableRow>
                ) : (
                  clockIns.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.clock_in_time), 'PPP')}</TableCell>
                      <TableCell>{format(new Date(record.clock_in_time), 'HH:mm')}</TableCell>
                      <TableCell>{record.clock_out_time ? format(new Date(record.clock_out_time), 'HH:mm') : '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.clock_in_method}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Leave Request Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(leaveForm.start_date, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={leaveForm.start_date}
                      onSelect={(date) => date && setLeaveForm({ ...leaveForm, start_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(leaveForm.end_date, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={leaveForm.end_date}
                      onSelect={(date) => date && setLeaveForm({ ...leaveForm, end_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Enter reason for leave"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Cancel</Button>
            <Button onClick={handleLeaveRequest}>Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
