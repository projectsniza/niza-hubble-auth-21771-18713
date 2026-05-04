import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Users, MoreHorizontal, Eye, Trash2, UserCog, Edit, Ban, CheckCircle, Award, ArrowRightLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useEmployees } from '@/hooks/useEmployees';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeStatusBadge, { EMPLOYEE_STATUSES } from './EmployeeStatusBadge';
import { EmployeeCertifications, GoldCoinBadge, useEmployeeCertifications } from './EmployeeCertifications';
import EditEmployeeDialog from './EditEmployeeDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEACTIVATION_REASONS = [
  { value: 'resigned', label: 'Resigned', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'temporarily_suspended', label: 'Temporarily Suspended', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'end_of_contract', label: 'End of Contract', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'redundancy', label: 'Redundancy', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'gross_misconduct', label: 'Gross Misconduct', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'mutual_agreement', label: 'Mutual Agreement', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
];

export const getDeactivationReasonConfig = (reason: string | null) => {
  if (!reason) return null;
  return DEACTIVATION_REASONS.find(r => r.value === reason) || { value: reason, label: reason, color: 'bg-gray-100 text-gray-700 border-gray-200' };
};

interface EmployeeListProps {
  searchQuery: string;
}

export default function EmployeeList({ searchQuery }: EmployeeListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [organizationFilter, setOrganizationFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [deactivateEmployee, setDeactivateEmployee] = useState<any>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [deactivationNotes, setDeactivationNotes] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [certEmployeeId, setCertEmployeeId] = useState<string | null>(null);
  const [transferEmployee, setTransferEmployee] = useState<any>(null);
  const [transferBranchId, setTransferBranchId] = useState<string>('');
  const [transferResetData, setTransferResetData] = useState<boolean>(true);
  const [isTransferring, setIsTransferring] = useState(false);

  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  
  const employeeFilters = useMemo(() => {
    const filters: any = { searchQuery };
    
    if (user?.role === 'manager') {
      filters.branchId = user.branchId;
    } else if (user?.role === 'hr') {
      if (user.hrAccessLevel === 'branch') {
        filters.branchId = user.branchId;
      } else if (user.hrAccessLevel === 'organization') {
        filters.organizationId = user.organizationId;
      }
    }
    
    if (organizationFilter !== 'all' && !filters.organizationId) {
      filters.organizationId = organizationFilter;
    }
    if (branchFilter !== 'all' && !filters.branchId) {
      filters.branchId = branchFilter;
    }
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    
    return filters;
  }, [user, organizationFilter, branchFilter, statusFilter, searchQuery]);

  const { employees: rawEmployees, isLoading, deleteEmployee, fetchEmployees } = useEmployees(employeeFilters);

  // Sort: active employees first, deactivated at bottom
  const employees = useMemo(() => {
    return [...rawEmployees].sort((a, b) => {
      const aInactive = a.status === 'inactive' || a.status === 'terminated';
      const bInactive = b.status === 'inactive' || b.status === 'terminated';
      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;
      return 0;
    });
  }, [rawEmployees]);

  // Fetch certifications for all employees
  const employeeIds = useMemo(() => employees.map(e => e.id), [employees]);
  const certMap = useEmployeeCertifications(employeeIds);

  const filteredBranches = organizationFilter !== 'all' 
    ? branches.filter(b => b.organization_id === organizationFilter)
    : branches;

  const handleDeleteEmployee = async () => {
    if (deleteEmployeeId) {
      await deleteEmployee(deleteEmployeeId);
      setDeleteEmployeeId(null);
    }
  };

  const handleDeactivateEmployee = async () => {
    if (!deactivateEmployee || !deactivationReason) {
      toast.error('Please select a reason');
      return;
    }
    setIsDeactivating(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ 
          status: 'inactive', 
          deactivation_reason: deactivationReason
        })
        .eq('id', deactivateEmployee.id);
      if (error) throw error;

      // Deactivate linked profile (by user_id or email fallback)
      if (deactivateEmployee.user_id) {
        await supabase
          .from('profiles')
          .update({ is_active: false })
          .eq('id', deactivateEmployee.user_id);
      } else if (deactivateEmployee.email) {
        await supabase
          .from('profiles')
          .update({ is_active: false })
          .eq('email', deactivateEmployee.email);
      }

      toast.success(`${deactivateEmployee.first_name} ${deactivateEmployee.last_name} has been deactivated`);
      setDeactivateEmployee(null);
      setDeactivationReason('');
      setDeactivationNotes('');
      fetchEmployees(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateEmployee = async (employee: any) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'active', deactivation_reason: null })
        .eq('id', employee.id);
      if (error) throw error;

      if (employee.user_id) {
        await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('id', employee.user_id);
      } else if (employee.email) {
        await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('email', employee.email);
      }

      toast.success(`${employee.first_name} ${employee.last_name} has been reactivated`);
      fetchEmployees(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTransferEmployee = async () => {
    if (!transferEmployee || !transferBranchId) {
      toast.error('Please select a destination branch');
      return;
    }
    if (transferBranchId === transferEmployee.branch_id) {
      toast.error('Employee is already in this branch');
      return;
    }
    setIsTransferring(true);
    try {
      const { error } = await supabase.rpc('transfer_employee', {
        p_employee_id: transferEmployee.id,
        p_new_branch_id: transferBranchId,
        p_reset_data: transferResetData,
      });
      if (error) throw error;
      toast.success(`${transferEmployee.first_name} ${transferEmployee.last_name} has been transferred`);
      setTransferEmployee(null);
      setTransferBranchId('');
      setTransferResetData(true);
      fetchEmployees(true);
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={() => navigate('/dashboard/add-employee')} className="gap-2">
          <UserPlus className="h-5 w-5" />
          Add Employee
        </Button>
        
        <div className="flex gap-3">
          {(user?.role === 'super_admin' || user?.role === 'hr') && (
            <Select value={organizationFilter} onValueChange={(v) => {
              setOrganizationFilter(v);
              setBranchFilter('all');
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {(user?.role === 'super_admin' || user?.role === 'hr') && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {filteredBranches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_STATUSES.map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {employees.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No employees found</h3>
              <p className="text-muted-foreground mb-4">Add your first employee to get started</p>
            </div>
            <Button onClick={() => navigate('/dashboard/add-employee')} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add First Employee
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const isDeactivated = employee.status === 'inactive' || employee.status === 'terminated';
                const reasonConfig = getDeactivationReasonConfig(employee.deactivation_reason);
                return (
                  <TableRow key={employee.id} className={isDeactivated ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className={isDeactivated ? "bg-destructive/20 text-destructive" : "bg-primary/10 text-primary"}>
                            {getInitials(employee.first_name, employee.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${isDeactivated ? 'text-destructive' : ''}`}>{employee.first_name} {employee.last_name}</p>
                            {certMap[employee.id] && certMap[employee.id].total > 0 && (
                              <GoldCoinBadge 
                                totalCoins={certMap[employee.id].total} 
                                certifications={certMap[employee.id].certs}
                                canManage={user?.role === 'super_admin' || user?.role === 'hr'}
                              />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                          {reasonConfig && (
                            <Badge className={`text-xs mt-1 ${reasonConfig.color}`}>
                              {reasonConfig.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.job_title || '-'}</TableCell>
                    <TableCell>{employee.department || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{employee.branch?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{employee.organization?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.join_date 
                        ? (() => {
                            const dt = new Date(employee.join_date);
                            return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                          })()
                        : '-'
                      }
                    </TableCell>
                    <TableCell><EmployeeStatusBadge status={employee.status} /></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/employees/${employee.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingEmployee(employee)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCertEmployeeId(employee.id)}>
                            <Award className="h-4 w-4 mr-2" />
                            Add Certification
                          </DropdownMenuItem>
                          {user?.role === 'super_admin' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setTransferEmployee(employee);
                                setTransferBranchId('');
                                setTransferResetData(true);
                              }}
                              className="text-blue-600 focus:text-blue-600"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                              Transfer
                            </DropdownMenuItem>
                          )}
                          {(employee.status === 'inactive' || employee.status === 'terminated') && user?.role === 'super_admin' && (
                            <DropdownMenuItem 
                              onClick={() => handleReactivateEmployee(employee)}
                              className="text-green-600 focus:text-green-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          {employee.status !== 'inactive' && employee.status !== 'terminated' && user?.role === 'super_admin' && (
                            <DropdownMenuItem 
                              onClick={() => setDeactivateEmployee(employee)}
                              className="text-orange-600 focus:text-orange-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                          {(user?.role === 'super_admin' || user?.role === 'hr') && (
                            <DropdownMenuItem 
                              onClick={() => setDeleteEmployeeId(employee.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEmployeeId} onOpenChange={() => setDeleteEmployeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this employee and all their documents.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivation Dialog */}
      <Dialog open={!!deactivateEmployee} onOpenChange={(open) => !open && setDeactivateEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-orange-500" />
              Deactivate Employee
            </DialogTitle>
            <DialogDescription>
              Deactivate {deactivateEmployee?.first_name} {deactivateEmployee?.last_name}. This will prevent them from accessing the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for deactivation</Label>
              <Select value={deactivationReason} onValueChange={setDeactivationReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {DEACTIVATION_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional notes (optional)</Label>
              <Textarea
                value={deactivationNotes}
                onChange={(e) => setDeactivationNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateEmployee(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeactivateEmployee} 
              disabled={!deactivationReason || isDeactivating}
            >
              {isDeactivating ? 'Deactivating...' : 'Deactivate Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditEmployeeDialog
        open={!!editingEmployee}
        onOpenChange={(open) => !open && setEditingEmployee(null)}
        employee={editingEmployee}
        onSuccess={() => {
          fetchEmployees();
          setEditingEmployee(null);
        }}
      />

      {certEmployeeId && (
        <EmployeeCertifications 
          employeeId={certEmployeeId} 
          canManage={true} 
          autoOpen={true}
          onClose={() => setCertEmployeeId(null)}
        />
      )}

      {/* Transfer Employee Dialog */}
      <Dialog open={!!transferEmployee} onOpenChange={(open) => !open && setTransferEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Transfer Employee
            </DialogTitle>
            <DialogDescription>
              Move {transferEmployee?.first_name} {transferEmployee?.last_name} to a different branch / store.
              Their personal folder will be moved to the new branch automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Destination Branch</Label>
              <Select value={transferBranchId} onValueChange={setTransferBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch..." />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter((b) => b.id !== transferEmployee?.branch_id)
                    .map((b) => {
                      const org = organizations.find((o) => o.id === b.organization_id);
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}{org ? ` — ${org.name}` : ''}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox
                id="reset-data"
                checked={transferResetData}
                onCheckedChange={(c) => setTransferResetData(c === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="reset-data" className="cursor-pointer">
                  Reset Timesheets, Holiday & Leave history
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recommended. Clears existing timesheets, holiday balances and leave requests so the employee starts fresh in the new branch.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferEmployee(null)}>Cancel</Button>
            <Button
              onClick={handleTransferEmployee}
              disabled={!transferBranchId || isTransferring}
            >
              {isTransferring ? 'Transferring...' : 'Transfer Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
