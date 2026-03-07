import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Plus, Check, X, Settings, Trash2, BarChart3, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import LeaveAttendanceOverview from "@/components/attendance/LeaveAttendanceOverview";
import { getErrorMessage } from "@/lib/errorUtils";

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  supporting_document_path: string | null;
  supporting_document_name: string | null;
  employee?: { first_name: string; last_name: string };
  leave_type?: { name: string; requires_supporting_document?: boolean | null };
}

interface LeaveType {
  id: string;
  name: string;
  days_allowed: number | null;
  is_paid: boolean | null;
  description: string | null;
  requires_supporting_document: boolean | null;
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
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string; organization_id: string; branch_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTimeOff, setShowAddTimeOff] = useState(false);
  const [showAddMandatory, setShowAddMandatory] = useState(false);
  const [showLeaveTypeSettings, setShowLeaveTypeSettings] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  
  // Use centralized org/branch data
  const { organizations, branches } = useOrgBranch();
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || user?.role === 'hr';
  
  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    supportingDocument: null as File | null
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
    description: '',
    requiresDocument: false
  });

  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [editLeaveTypeForm, setEditLeaveTypeForm] = useState({
    name: '',
    daysAllowed: '',
    isPaid: true,
    requiresDocument: false
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
          employee:employees(first_name, last_name, organization_id, branch_id),
          leave_type:leave_types(name, requires_supporting_document)
        `).order('created_at', { ascending: false }),
        supabase.from('leave_types').select('*').order('name'),
        supabase.from('mandatory_leave').select('*').order('start_date'),
        supabase.from('employees').select('id, first_name, last_name, branch_id, organization_id').eq('status', 'active')
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

    // Check if selected leave type requires document
    const selectedLeaveType = leaveTypes.find(lt => lt.id === newLeave.leaveTypeId);
    if (selectedLeaveType?.requires_supporting_document && !newLeave.supportingDocument) {
      toast.error('This leave type requires a supporting document');
      return;
    }

    try {
      let documentPath: string | null = null;
      let documentName: string | null = null;

      // Upload supporting document if provided
      if (newLeave.supportingDocument) {
        const file = newLeave.supportingDocument;
        const fileExt = file.name.split('.').pop();
        const fileName = `${newLeave.employeeId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('leave-documents')
          .upload(fileName, file);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Failed to upload document');
          return;
        }
        
        documentPath = fileName;
        documentName = file.name;
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: newLeave.employeeId,
        leave_type_id: newLeave.leaveTypeId,
        start_date: newLeave.startDate,
        end_date: newLeave.endDate,
        reason: newLeave.reason || null,
        status: (user?.role === 'super_admin' || user?.role === 'hr') ? 'approved' : 'pending',
        approved_by: (user?.role === 'super_admin' || user?.role === 'hr') ? user?.id : null,
        approved_at: (user?.role === 'super_admin' || user?.role === 'hr') ? new Date().toISOString() : null,
        supporting_document_path: documentPath,
        supporting_document_name: documentName
      });

      if (error) throw error;
      toast.success('Time off added successfully');
      setShowAddTimeOff(false);
      setNewLeave({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '', supportingDocument: null });
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
        requires_supporting_document: newLeaveType.requiresDocument,
        created_by: user?.id
      });

      if (error) throw error;
      toast.success('Leave type added');
      setNewLeaveType({ name: '', daysAllowed: '', isPaid: true, description: '', requiresDocument: false });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    try {
      const { error } = await supabase.from('leave_types').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          toast.error('Cannot delete: This leave type is being used by existing leave requests. You can edit it instead.');
        } else {
          throw error;
        }
        return;
      }
      toast.success('Leave type deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditLeaveType = (lt: LeaveType) => {
    setEditingLeaveType(lt);
    setEditLeaveTypeForm({
      name: lt.name,
      daysAllowed: lt.days_allowed?.toString() || '',
      isPaid: lt.is_paid ?? true,
      requiresDocument: lt.requires_supporting_document ?? false
    });
  };

  const handleUpdateLeaveType = async () => {
    if (!editingLeaveType || !editLeaveTypeForm.name) {
      toast.error('Please enter leave type name');
      return;
    }

    try {
      const { error } = await supabase.from('leave_types').update({
        name: editLeaveTypeForm.name,
        days_allowed: editLeaveTypeForm.daysAllowed ? parseInt(editLeaveTypeForm.daysAllowed) : null,
        is_paid: editLeaveTypeForm.isPaid,
        requires_supporting_document: editLeaveTypeForm.requiresDocument
      }).eq('id', editingLeaveType.id);

      if (error) throw error;
      toast.success('Leave type updated');
      setEditingLeaveType(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const seedDefaultLeaveTypes = async () => {
    const defaultLeaveTypes = [
      { name: 'Annual Leave', days_allowed: 28, is_paid: true, requires_supporting_document: false },
      { name: 'Sickness', days_allowed: null, is_paid: true, requires_supporting_document: true },
      { name: 'Medical Appointment', days_allowed: 1, is_paid: true, requires_supporting_document: false },
      { name: 'Dental Appointment', days_allowed: 1, is_paid: false, requires_supporting_document: false },
      { name: 'Maternity Leave', days_allowed: 364, is_paid: true, requires_supporting_document: true },
      { name: 'Paternity Leave', days_allowed: 14, is_paid: true, requires_supporting_document: true },
      { name: 'Adoption Leave', days_allowed: 364, is_paid: true, requires_supporting_document: true },
      { name: 'Shared Parental Leave', days_allowed: 350, is_paid: true, requires_supporting_document: true },
      { name: 'Parental Leave (Unpaid)', days_allowed: 90, is_paid: false, requires_supporting_document: false },
      { name: 'Parental Bereavement Leave', days_allowed: 14, is_paid: true, requires_supporting_document: true },
      { name: 'Neonatal Care Leave', days_allowed: null, is_paid: true, requires_supporting_document: true },
      { name: 'Bereavement Leave', days_allowed: 5, is_paid: true, requires_supporting_document: false },
      { name: 'Compassionate Leave', days_allowed: 5, is_paid: true, requires_supporting_document: false },
      { name: 'Time off for Dependants', days_allowed: null, is_paid: false, requires_supporting_document: false },
      { name: 'Unpaid Carer\'s Leave', days_allowed: 5, is_paid: false, requires_supporting_document: false },
      { name: 'Training / Events', days_allowed: null, is_paid: true, requires_supporting_document: false },
      { name: 'Time Off In Lieu (TOIL)', days_allowed: null, is_paid: true, requires_supporting_document: false },
      { name: 'Unpaid Leave', days_allowed: null, is_paid: false, requires_supporting_document: false },
    ];

    try {
      const existingNames = leaveTypes.map(lt => lt.name.toLowerCase());
      const toInsert = defaultLeaveTypes.filter(lt => !existingNames.includes(lt.name.toLowerCase()));
      
      if (toInsert.length === 0) {
        toast.info('All default leave types already exist');
        return;
      }

      const { error } = await supabase.from('leave_types').insert(
        toInsert.map(lt => ({ ...lt, created_by: user?.id }))
      );

      if (error) throw error;
      toast.success(`Added ${toInsert.length} default leave types`);
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

  // Memoized filter function for performance
  const applyFilters = useCallback((requests: LeaveRequest[]) => {
    if (!canViewFilters || viewMode === 'all') return requests;
    
    return requests.filter(r => {
      const emp = r.employee as any;
      if (viewMode === 'organization' && selectedOrg) {
        return emp?.organization_id === selectedOrg;
      }
      if (viewMode === 'branch' && selectedBranch) {
        return emp?.branch_id === selectedBranch;
      }
      if (viewMode === 'branch' && selectedOrg && !selectedBranch) {
        return emp?.organization_id === selectedOrg;
      }
      return true;
    });
  }, [canViewFilters, viewMode, selectedOrg, selectedBranch]);

  // Memoize filtered requests to prevent recalculation on every render
  const pendingRequests = useMemo(() => 
    applyFilters(leaveRequests.filter(r => r.status === 'pending')),
    [leaveRequests, applyFilters]
  );
  
  const filteredRequests = useMemo(() => {
    // Filter by current month
    const monthFiltered = leaveRequests.filter(r => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      // Include if the leave overlaps with the current month
      return start <= monthEnd && end >= monthStart;
    });
    
    let result = monthFiltered;
    if (filterType === 'pending') {
      result = monthFiltered.filter(r => r.status === 'pending');
    } else if (filterType !== 'all') {
      result = monthFiltered.filter(r => r.leave_type?.name?.toLowerCase().includes(filterType));
    }
    return applyFilters(result);
  }, [leaveRequests, filterType, applyFilters, currentMonth]);
  
  const filteredEmployees = useMemo(() => {
    if (!canViewFilters || viewMode === 'all') return employees;
    return employees.filter(e => {
      if (viewMode === 'organization' && selectedOrg) return e.organization_id === selectedOrg;
      if (viewMode === 'branch' && selectedBranch) return e.branch_id === selectedBranch;
      if (viewMode === 'branch' && selectedOrg && !selectedBranch) return e.organization_id === selectedOrg;
      return true;
    });
  }, [employees, canViewFilters, viewMode, selectedOrg, selectedBranch]);

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
    reason: '',
    supportingDocument: null as File | null
  });

  const handleEmployeeLeaveRequest = async () => {
    if (!employeeLeaveForm.leaveTypeId || !employeeLeaveForm.startDate || !employeeLeaveForm.endDate) {
      toast.error('Please fill all required fields');
      return;
    }

    // Check if selected leave type requires document
    const selectedLeaveType = leaveTypes.find(lt => lt.id === employeeLeaveForm.leaveTypeId);
    if (selectedLeaveType?.requires_supporting_document && !employeeLeaveForm.supportingDocument) {
      toast.error('This leave type requires a supporting document');
      return;
    }

    try {
      if (!user?.id) {
        toast.error('Not logged in');
        return;
      }

      // 1) Normal path: employee row linked by user_id
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let employeeId = empData?.id;

      // 2) Repair path: attempt safe server-side link via SECURITY DEFINER function
      // (required because employees do not have broad UPDATE permissions on employees)
      if (!employeeId) {
        const { data: linkedEmployeeId, error: linkRpcError } = await supabase.rpc('link_my_employee_record');
        if (linkRpcError) {
          // If linking fails, continue to show the original error
          console.warn('link_my_employee_record failed', linkRpcError);
        }

        if (linkedEmployeeId) {
          employeeId = linkedEmployeeId as unknown as string;
        } else {
          // Re-check in case it was already linked by another process
          const { data: empRetry } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          employeeId = empRetry?.id;
        }
      }

      if (empError && empError.code !== 'PGRST116') {
        throw empError;
      }

      if (!employeeId) {
        toast.error('Employee record not found');
        return;
      }

      let documentPath: string | null = null;
      let documentName: string | null = null;

      // Upload supporting document if provided
      if (employeeLeaveForm.supportingDocument) {
        const file = employeeLeaveForm.supportingDocument;
        const fileExt = file.name.split('.').pop();
        const safeExt = fileExt || 'bin';
        const fileName = `${employeeId}/${Date.now()}.${safeExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('leave-documents')
          .upload(fileName, file);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Failed to upload document');
          return;
        }
        
        documentPath = fileName;
        documentName = file.name;
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: employeeId,
        leave_type_id: employeeLeaveForm.leaveTypeId,
        start_date: employeeLeaveForm.startDate,
        end_date: employeeLeaveForm.endDate,
        reason: employeeLeaveForm.reason || null,
        status: 'pending',
        supporting_document_path: documentPath,
        supporting_document_name: documentName
      });

      if (error) throw error;
      toast.success('Leave request submitted successfully');
      setShowEmployeeLeaveRequest(false);
      setEmployeeLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '', supportingDocument: null });
      fetchData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to submit leave request'));
    }
  };

  // Employee View
  if (user?.role === 'employee') {
    const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;

    return (
      <div className="p-4 md:p-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Calendar & Leave</h1>
          <Button size="sm" onClick={() => setShowEmployeeLeaveRequest(true)}>
            <Plus className="h-4 w-4 mr-1 md:mr-2" />
            Request Leave
          </Button>
        </div>
        
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="w-full overflow-x-auto flex no-scrollbar mb-4 md:mb-6">
            <TabsTrigger value="calendar" className="text-xs md:text-sm whitespace-nowrap">Calendar</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs md:text-sm whitespace-nowrap">
              Pending
              <Badge variant="secondary" className="ml-1 md:ml-2 text-xs">{pendingCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="mandatory" className="text-xs md:text-sm whitespace-nowrap">Mandatory</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card className="p-3 md:p-6">
              <div className="flex flex-col gap-3 mb-4 md:mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Select 
                    value={currentMonth.getMonth().toString()}
                    onValueChange={(v) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(v)))}
                  >
                    <SelectTrigger className="w-[120px] md:w-[140px] text-xs md:text-sm">
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
                    <SelectTrigger className="w-[80px] md:w-[100px] text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() + i - 2;
                        return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="sm" onClick={goToToday} className="text-xs md:text-sm">
                    <CalendarIcon className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                    Today
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:gap-4 mb-4 md:mb-6">
                {absenceTypes.map((type) => (
                  <div key={type.name} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${type.color}`}></div>
                    <span className="text-xs md:text-sm text-muted-foreground">{type.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3 md:mb-4">
                <Button variant="ghost" size="sm" onClick={goToPreviousMonth} className="text-xs md:text-sm px-2">
                  <ChevronLeft className="h-4 w-4 mr-0 md:mr-2" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <h3 className="text-sm md:text-lg font-semibold">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <Button variant="ghost" size="sm" onClick={goToNextMonth} className="text-xs md:text-sm px-2">
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 ml-0 md:ml-2" />
                </Button>
              </div>

              <div className="border rounded-lg overflow-x-auto">
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
              <div className="mt-4 md:mt-6">
                <h3 className="font-semibold text-sm md:text-base mb-3 md:mb-4">My Leave Requests ({leaveRequests.length})</h3>
                <div className="overflow-x-auto -mx-3 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">Type</TableHead>
                        <TableHead className="text-xs md:text-sm">From</TableHead>
                        <TableHead className="text-xs md:text-sm">To</TableHead>
                        <TableHead className="text-xs md:text-sm hidden sm:table-cell">Days</TableHead>
                        <TableHead className="text-xs md:text-sm">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 md:py-8 text-muted-foreground text-sm">
                            No leave requests found
                          </TableCell>
                        </TableRow>
                      ) : (
                        leaveRequests.map(req => (
                          <TableRow key={req.id}>
                            <TableCell className="text-xs md:text-sm">{req.leave_type?.name || 'N/A'}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(req.start_date), 'dd MMM')}</TableCell>
                            <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(req.end_date), 'dd MMM')}</TableCell>
                            <TableCell className="text-xs md:text-sm hidden sm:table-cell">{differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1}</TableCell>
                            <TableCell>
                              <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                                {req.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card className="p-3 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">My Pending Requests</h3>
              <div className="overflow-x-auto -mx-3 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Type</TableHead>
                      <TableHead className="text-xs md:text-sm">From</TableHead>
                      <TableHead className="text-xs md:text-sm">To</TableHead>
                      <TableHead className="text-xs md:text-sm hidden sm:table-cell">Days</TableHead>
                      <TableHead className="text-xs md:text-sm hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-xs md:text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.filter(r => r.status === 'pending').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 md:py-8 text-muted-foreground text-sm">
                          No pending requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaveRequests.filter(r => r.status === 'pending').map(req => (
                        <TableRow key={req.id}>
                          <TableCell className="text-xs md:text-sm">{req.leave_type?.name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(req.start_date), 'dd MMM')}</TableCell>
                          <TableCell className="text-xs md:text-sm whitespace-nowrap">{format(new Date(req.end_date), 'dd MMM')}</TableCell>
                          <TableCell className="text-xs md:text-sm hidden sm:table-cell">{differenceInDays(new Date(req.end_date), new Date(req.start_date)) + 1}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs md:text-sm hidden md:table-cell">{req.reason || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="mandatory">
            <Card className="p-3 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Public Holidays & Mandatory Leave</h3>
              {mandatoryLeave.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 md:py-8 text-sm">No mandatory leave periods set</p>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {mandatoryLeave.map(ml => (
                    <div key={ml.id} className="flex items-center justify-between p-3 md:p-4 bg-muted rounded-lg gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm md:text-base">{ml.title}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          {format(new Date(ml.start_date), 'dd MMM')} - {format(new Date(ml.end_date), 'dd MMM yyyy')}
                        </p>
                        {ml.description && <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">{ml.description}</p>}
                      </div>
                      <Badge variant={ml.is_paid ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
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
                <Label>Notes</Label>
                <Textarea
                  value={employeeLeaveForm.reason}
                  onChange={(e) => setEmployeeLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Optional notes"
                  rows={3}
                />
              </div>
              {/* Show file upload if leave type requires document */}
              {(() => {
                const selectedType = leaveTypes.find(lt => lt.id === employeeLeaveForm.leaveTypeId);
                if (selectedType?.requires_supporting_document) {
                  return (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Supporting Document *
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      </Label>
                      <div className="border-2 border-dashed border-muted rounded-lg p-4">
                        {employeeLeaveForm.supportingDocument ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{employeeLeaveForm.supportingDocument.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEmployeeLeaveForm(prev => ({ ...prev, supportingDocument: null }))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center gap-2 cursor-pointer">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Click to upload document</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="*/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setEmployeeLeaveForm(prev => ({ ...prev, supportingDocument: file }));
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload a supporting document (PDF, images, Word documents)
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
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
          {(user?.role === 'super_admin' || user?.role === 'hr') && (
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
          )}
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
                      <div className="flex-1">
                        <p className="font-semibold">{req.employee?.first_name} {req.employee?.last_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {req.leave_type?.name} • {format(new Date(req.start_date), 'dd MMM')} - {format(new Date(req.end_date), 'dd MMM yyyy')}
                        </p>
                        {req.reason && <p className="text-sm mt-1">{req.reason}</p>}
                        {/* Show supporting document if uploaded */}
                        {req.supporting_document_path && (
                          <div className="flex items-center gap-2 mt-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-primary"
                              onClick={async () => {
                                const { data, error } = await supabase.storage
                                  .from('leave-documents')
                                  .createSignedUrl(req.supporting_document_path!, 3600);
                                if (data?.signedUrl) {
                                  window.open(data.signedUrl, '_blank');
                                } else {
                                  console.error('Error getting signed URL:', error);
                                }
                              }}
                            >
                              {req.supporting_document_name || 'View Document'}
                            </Button>
                          </div>
                        )}
                        {/* Indicator if document was required but not provided */}
                        {req.leave_type?.requires_supporting_document && !req.supporting_document_path && (
                          <Badge variant="destructive" className="mt-2 text-xs">
                            Missing required document
                          </Badge>
                        )}
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

        {(user?.role === 'super_admin' || user?.role === 'hr') && (
          <TabsContent value="overview">
            <LeaveAttendanceOverview />
          </TabsContent>
        )}
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
              <Label>Notes</Label>
              <Textarea value={newLeave.reason} onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })} placeholder="Optional notes" />
            </div>
            {/* Show file upload if leave type requires document */}
            {(() => {
              const selectedType = leaveTypes.find(lt => lt.id === newLeave.leaveTypeId);
              if (selectedType?.requires_supporting_document) {
                return (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Supporting Document *
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    </Label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-4">
                      {newLeave.supportingDocument ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{newLeave.supportingDocument.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewLeave({ ...newLeave, supportingDocument: null })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center gap-2 cursor-pointer">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to upload document</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setNewLeave({ ...newLeave, supportingDocument: file });
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload a supporting document (PDF, images, Word documents)
                    </p>
                  </div>
                );
              }
              return null;
            })()}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Type Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Add/Edit Form */}
            {editingLeaveType ? (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold">Edit Leave Type</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input 
                      value={editLeaveTypeForm.name} 
                      onChange={(e) => setEditLeaveTypeForm({ ...editLeaveTypeForm, name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Days Allowed</Label>
                    <Input 
                      type="number" 
                      value={editLeaveTypeForm.daysAllowed} 
                      onChange={(e) => setEditLeaveTypeForm({ ...editLeaveTypeForm, daysAllowed: e.target.value })} 
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="editPaid" 
                      checked={editLeaveTypeForm.isPaid} 
                      onChange={(e) => setEditLeaveTypeForm({ ...editLeaveTypeForm, isPaid: e.target.checked })} 
                    />
                    <Label htmlFor="editPaid">Paid leave</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="editRequiresDoc" 
                      checked={editLeaveTypeForm.requiresDocument} 
                      onChange={(e) => setEditLeaveTypeForm({ ...editLeaveTypeForm, requiresDocument: e.target.checked })} 
                    />
                    <Label htmlFor="editRequiresDoc">Requires supporting document</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdateLeaveType}>Save Changes</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingLeaveType(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Add New Leave Type</h4>
                  <Button size="sm" variant="outline" onClick={seedDefaultLeaveTypes}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add UK Default Types
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={newLeaveType.name} onChange={(e) => setNewLeaveType({ ...newLeaveType, name: e.target.value })} placeholder="e.g., Compassionate Leave" />
                  </div>
                  <div className="space-y-2">
                    <Label>Days Allowed</Label>
                    <Input type="number" value={newLeaveType.daysAllowed} onChange={(e) => setNewLeaveType({ ...newLeaveType, daysAllowed: e.target.value })} placeholder="Leave empty for unlimited" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ltPaid" checked={newLeaveType.isPaid} onChange={(e) => setNewLeaveType({ ...newLeaveType, isPaid: e.target.checked })} />
                    <Label htmlFor="ltPaid">Paid leave</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ltRequiresDoc" checked={newLeaveType.requiresDocument || false} onChange={(e) => setNewLeaveType({ ...newLeaveType, requiresDocument: e.target.checked })} />
                    <Label htmlFor="ltRequiresDoc">Requires supporting document</Label>
                  </div>
                  <Button size="sm" onClick={handleAddLeaveType}>Add Leave Type</Button>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-4">Existing Leave Types ({leaveTypes.length})</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {leaveTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No leave types configured. Click "Add UK Default Types" to get started.
                  </p>
                ) : (
                  leaveTypes.map(lt => (
                    <div key={lt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{lt.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {lt.days_allowed ? `${lt.days_allowed} days` : 'Unlimited'} • {lt.is_paid ? 'Paid' : 'Unpaid'}
                          {lt.requires_supporting_document && ' • Doc Required'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEditLeaveType(lt)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteLeaveType(lt.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
