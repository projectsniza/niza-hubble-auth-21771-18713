import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Clock, Plus, Check, X, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays, isWithinInterval, parseISO } from "date-fns";

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  employee?: { first_name: string; last_name: string };
  leave_type?: { name: string };
}

interface LeaveType {
  id: string;
  name: string;
  days_allowed: number | null;
  is_paid: boolean | null;
  description: string | null;
}

interface MandatoryLeave {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_paid: boolean;
  organization_id: string | null;
  branch_id: string | null;
}

export default function Attendance() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [mandatoryLeave, setMandatoryLeave] = useState<MandatoryLeave[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTimeOff, setShowAddTimeOff] = useState(false);
  const [showAddMandatory, setShowAddMandatory] = useState(false);
  const [showLeaveTypeSettings, setShowLeaveTypeSettings] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  
  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const [newMandatory, setNewMandatory] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isPaid: true
  });

  const [newLeaveType, setNewLeaveType] = useState({
    name: '',
    daysAllowed: '',
    isPaid: true,
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leaveReqRes, leaveTypesRes, mandatoryRes, employeesRes] = await Promise.all([
        supabase.from('leave_requests').select(`
          *,
          employee:employees(first_name, last_name),
          leave_type:leave_types(name)
        `).order('created_at', { ascending: false }),
        supabase.from('leave_types').select('*').order('name'),
        supabase.from('mandatory_leave').select('*').order('start_date'),
        supabase.from('employees').select('id, first_name, last_name, branch_id').eq('status', 'active')
      ]);

      setLeaveRequests(leaveReqRes.data || []);
      setLeaveTypes(leaveTypesRes.data || []);
      setMandatoryLeave(mandatoryRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ 
          status, 
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;
      toast.success(`Leave request ${status}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddTimeOff = async () => {
    if (!newLeave.employeeId || !newLeave.leaveTypeId || !newLeave.startDate || !newLeave.endDate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const { error } = await supabase.from('leave_requests').insert({
        employee_id: newLeave.employeeId,
        leave_type_id: newLeave.leaveTypeId,
        start_date: newLeave.startDate,
        end_date: newLeave.endDate,
        reason: newLeave.reason || null,
        status: user?.role === 'super_admin' ? 'approved' : 'pending',
        approved_by: user?.role === 'super_admin' ? user?.id : null,
        approved_at: user?.role === 'super_admin' ? new Date().toISOString() : null
      });

      if (error) throw error;
      toast.success('Time off added successfully');
      setShowAddTimeOff(false);
      setNewLeave({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddMandatoryLeave = async () => {
    if (!newMandatory.title || !newMandatory.startDate || !newMandatory.endDate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const { error } = await supabase.from('mandatory_leave').insert({
        title: newMandatory.title,
        description: newMandatory.description || null,
        start_date: newMandatory.startDate,
        end_date: newMandatory.endDate,
        is_paid: newMandatory.isPaid,
        created_by: user?.id
      });

      if (error) throw error;
      toast.success('Mandatory leave added');
      setShowAddMandatory(false);
      setNewMandatory({ title: '', description: '', startDate: '', endDate: '', isPaid: true });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteMandatory = async (id: string) => {
    try {
      const { error } = await supabase.from('mandatory_leave').delete().eq('id', id);
      if (error) throw error;
      toast.success('Mandatory leave deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddLeaveType = async () => {
    if (!newLeaveType.name) {
      toast.error('Please enter leave type name');
      return;
    }

    try {
      const { error } = await supabase.from('leave_types').insert({
        name: newLeaveType.name,
        days_allowed: newLeaveType.daysAllowed ? parseInt(newLeaveType.daysAllowed) : null,
        is_paid: newLeaveType.isPaid,
        description: newLeaveType.description || null,
        created_by: user?.id
      });

      if (error) throw error;
      toast.success('Leave type added');
      setNewLeaveType({ name: '', daysAllowed: '', isPaid: true, description: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    try {
      const { error } = await supabase.from('leave_types').delete().eq('id', id);
      if (error) throw error;
      toast.success('Leave type deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const absenceTypes = [
    { name: "Annual leave", color: "bg-blue-500", filter: "annual" },
    { name: "Sickness", color: "bg-yellow-500", filter: "sick" },
    { name: "Lateness", color: "bg-red-500", filter: "lateness" },
    { name: "TOIL", color: "bg-orange-500", filter: "toil" },
    { name: "Other absence", color: "bg-teal-500", filter: "other" },
    { name: "Pending", color: "bg-pink-500", filter: "pending" },
  ];

  const pendingRequests = leaveRequests.filter(r => r.status === 'pending');
  const filteredRequests = filterType === 'all' 
    ? leaveRequests 
    : filterType === 'pending'
      ? pendingRequests
      : leaveRequests.filter(r => r.leave_type?.name?.toLowerCase().includes(filterType));

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setDate(new Date());
  };

  const [showEmployeeLeaveRequest, setShowEmployeeLeaveRequest] = useState(false);
  const [employeeLeaveForm, setEmployeeLeaveForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const handleEmployeeLeaveRequest = async () => {
    if (!employeeLeaveForm.leaveTypeId || !employeeLeaveForm.startDate || !employeeLeaveForm.endDate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      // Get employee record for current user
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (empError || !empData) {
        toast.error('Employee record not found');
        return;
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: empData.id,
        leave_type_id: employeeLeaveForm.leaveTypeId,
        start_date: employeeLeaveForm.startDate,
        end_date: employeeLeaveForm.endDate,
        reason: employeeLeaveForm.reason || null,
        status: 'pending'
      });

      if (error) throw error;
      toast.success('Leave request submitted successfully');
      setShowEmployeeLeaveRequest(false);
      setEmployeeLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit leave request');
    }
  };

  // Employee View
  if (user?.role === 'employee') {
    const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;

    return (
      <div className="p-8 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Calendar & Leave Management</h1>
          <Button onClick={() => setShowEmployeeLeaveRequest(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Request Leave
          </Button>
        </div>
        
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="pending">
              Pending requests
              <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="mandatory">Mandatory leave</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <Select 
                    value={currentMonth.getMonth().toString()}
                    onValueChange={(v) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(v)))}
                  >
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

                  <Select 
                    value={currentMonth.getFullYear().toString()}
                    onValueChange={(v) => setCurrentMonth(new Date(parseInt(v), currentMonth.getMonth()))}
                  >
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

                  <Button variant="outline" size="sm" onClick={goToToday}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Today
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-6">
                {absenceTypes.map((type) => (
                  <div key={type.name} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                    <span className="text-sm text-muted-foreground">{type.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous month
                </Button>
                <h3 className="text-lg font-semibold">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                  Next month
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="w-full"
                />
              </div>

              {/* My Leave Requests List */}
              <div className="mt-6">
                <h3 className="font-semibold mb-4">My Leave Requests ({leaveRequests.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaveRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell>{req.leave_type?.name || 'N/A'}</TableCell>
                          <TableCell>{format(new Date(req.start_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{format(new Date(req.end_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>{differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1}</TableCell>
                          <TableCell>
                            <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {req.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">My Pending Requests</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.filter(r => r.status === 'pending').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending requests
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaveRequests.filter(r => r.status === 'pending').map(req => (
                      <TableRow key={req.id}>
                        <TableCell>{req.leave_type?.name || 'N/A'}</TableCell>
                        <TableCell>{format(new Date(req.start_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{format(new Date(req.end_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.reason || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Pending</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="mandatory">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Public Holidays & Mandatory Leave</h3>
              {mandatoryLeave.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No mandatory leave periods set</p>
              ) : (
                <div className="space-y-3">
                  {mandatoryLeave.map(ml => (
                    <div key={ml.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{ml.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(ml.start_date), 'dd MMM')} - {format(new Date(ml.end_date), 'dd MMM yyyy')}
                        </p>
                        {ml.description && <p className="text-sm text-muted-foreground mt-1">{ml.description}</p>}
                      </div>
                      <Badge variant={ml.is_paid ? 'default' : 'secondary'}>
                        {ml.is_paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Employee Leave Request Dialog */}
        <Dialog open={showEmployeeLeaveRequest} onOpenChange={setShowEmployeeLeaveRequest}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Leave Type *</Label>
                <Select value={employeeLeaveForm.leaveTypeId} onValueChange={(v) => setEmployeeLeaveForm(prev => ({ ...prev, leaveTypeId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} {type.days_allowed && `(${type.days_allowed} days)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={employeeLeaveForm.startDate}
                    onChange={(e) => setEmployeeLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={employeeLeaveForm.endDate}
                    onChange={(e) => setEmployeeLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea
                  value={employeeLeaveForm.reason}
                  onChange={(e) => setEmployeeLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Optional reason for leave"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEmployeeLeaveRequest(false)}>Cancel</Button>
              <Button onClick={handleEmployeeLeaveRequest}>Submit Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Admin/HR/Manager View
  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Calendar & Leave Management</h1>
        {user?.role === 'super_admin' && (
          <Button variant="outline" onClick={() => setShowLeaveTypeSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Leave Type Settings
          </Button>
        )}
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="pending">
            Pending requests
            <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="mandatory">Mandatory leave</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Select 
                  value={currentMonth.getMonth().toString()}
                  onValueChange={(v) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(v)))}
                >
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

                <Select 
                  value={currentMonth.getFullYear().toString()}
                  onValueChange={(v) => setCurrentMonth(new Date(parseInt(v), currentMonth.getMonth()))}
                >
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

                <Button variant="outline" size="sm" onClick={goToToday}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Today
                </Button>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter absences" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All absences</SelectItem>
                    <SelectItem value="pending">Pending only</SelectItem>
                    <SelectItem value="annual">Annual leave</SelectItem>
                    <SelectItem value="sick">Sickness</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => setShowAddTimeOff(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add time off
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              {absenceTypes.map((type) => (
                <div key={type.name} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                  <span className="text-sm text-muted-foreground">{type.name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous month
              </Button>
              <h3 className="text-lg font-semibold">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                Next month
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full"
              />
            </div>

            {/* Leave Requests List */}
            <div className="mt-6">
              <h3 className="font-semibold mb-4">Leave Requests ({filteredRequests.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No leave requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell>{req.employee?.first_name} {req.employee?.last_name}</TableCell>
                        <TableCell>{req.leave_type?.name || 'N/A'}</TableCell>
                        <TableCell>{format(new Date(req.start_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{format(new Date(req.end_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1}</TableCell>
                        <TableCell>
                          <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {req.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleApproveReject(req.id, 'approved')}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleApproveReject(req.id, 'rejected')}>
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
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

        <TabsContent value="pending">
          <Card className="p-6">
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Sort by:</label>
              <Select defaultValue="oldest">
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oldest">Date raised (Oldest first)</SelectItem>
                  <SelectItem value="newest">Date raised (Newest first)</SelectItem>
                  <SelectItem value="employee">Employee name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <h3 className="text-lg font-semibold mb-4">
              Pending requests ({pendingRequests.length})
            </h3>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No pending requests
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(req => (
                  <Card key={req.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{req.employee?.first_name} {req.employee?.last_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {req.leave_type?.name} • {format(new Date(req.start_date), 'dd MMM')} - {format(new Date(req.end_date), 'dd MMM yyyy')}
                        </p>
                        {req.reason && <p className="text-sm mt-1">{req.reason}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveReject(req.id, 'approved')}>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleApproveReject(req.id, 'rejected')}>
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="mandatory">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Mandatory leave</h3>
                <p className="text-sm text-muted-foreground">
                  Dates your employees have to take as leave such as shutdown periods, local bank holidays etc.
                </p>
              </div>
              {(user?.role === 'super_admin' || user?.role === 'hr') && (
                <Button onClick={() => setShowAddMandatory(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add mandatory leave
                </Button>
              )}
            </div>

            {mandatoryLeave.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No mandatory leave periods set
              </div>
            ) : (
              <div className="space-y-3">
                {mandatoryLeave.map(ml => (
                  <Card key={ml.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{ml.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(ml.start_date), 'dd MMM yyyy')} - {format(new Date(ml.end_date), 'dd MMM yyyy')}
                        </p>
                        {ml.description && <p className="text-sm mt-1">{ml.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ml.is_paid ? 'default' : 'secondary'}>
                          {ml.is_paid ? 'Paid' : 'Unpaid'}
                        </Badge>
                        {user?.role === 'super_admin' && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteMandatory(ml.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Time Off Dialog */}
      <Dialog open={showAddTimeOff} onOpenChange={setShowAddTimeOff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={newLeave.employeeId} onValueChange={(v) => setNewLeave({ ...newLeave, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type *</Label>
              <Select value={newLeave.leaveTypeId} onValueChange={(v) => setNewLeave({ ...newLeave, leaveTypeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map(lt => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={newLeave.startDate} onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={newLeave.endDate} onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTimeOff(false)}>Cancel</Button>
            <Button onClick={handleAddTimeOff}>Add Time Off</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mandatory Leave Dialog */}
      <Dialog open={showAddMandatory} onOpenChange={setShowAddMandatory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Mandatory Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={newMandatory.title} onChange={(e) => setNewMandatory({ ...newMandatory, title: e.target.value })} placeholder="e.g., Christmas Shutdown" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newMandatory.description} onChange={(e) => setNewMandatory({ ...newMandatory, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={newMandatory.startDate} onChange={(e) => setNewMandatory({ ...newMandatory, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={newMandatory.endDate} onChange={(e) => setNewMandatory({ ...newMandatory, endDate: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPaid" checked={newMandatory.isPaid} onChange={(e) => setNewMandatory({ ...newMandatory, isPaid: e.target.checked })} />
              <Label htmlFor="isPaid">Paid leave</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMandatory(false)}>Cancel</Button>
            <Button onClick={handleAddMandatoryLeave}>Add Mandatory Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Type Settings Dialog */}
      <Dialog open={showLeaveTypeSettings} onOpenChange={setShowLeaveTypeSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Type Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Add New Leave Type</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={newLeaveType.name} onChange={(e) => setNewLeaveType({ ...newLeaveType, name: e.target.value })} placeholder="e.g., Compassionate Leave" />
                </div>
                <div className="space-y-2">
                  <Label>Days Allowed</Label>
                  <Input type="number" value={newLeaveType.daysAllowed} onChange={(e) => setNewLeaveType({ ...newLeaveType, daysAllowed: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ltPaid" checked={newLeaveType.isPaid} onChange={(e) => setNewLeaveType({ ...newLeaveType, isPaid: e.target.checked })} />
                  <Label htmlFor="ltPaid">Paid leave</Label>
                </div>
                <Button size="sm" onClick={handleAddLeaveType}>Add Leave Type</Button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Existing Leave Types</h4>
              <div className="space-y-2">
                {leaveTypes.map(lt => (
                  <div key={lt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{lt.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {lt.days_allowed ? `${lt.days_allowed} days` : 'Unlimited'} • {lt.is_paid ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteLeaveType(lt.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
