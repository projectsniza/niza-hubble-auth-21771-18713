import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Users, MoreHorizontal, Eye, Trash2, UserCog, Edit, Ban, CheckCircle, Award, ArrowRightLeft, Search, X } from 'lucide-react';
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
import { getOrCreateEmployeeFolder } from '@/lib/ensureEmployeeDocuments';

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
  searchQuery?: string;
}

export default function EmployeeList({ searchQuery = '' }: EmployeeListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [localSearch, setLocalSearch] = useState(searchQuery);
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

  // Keep local search in sync if parent passes external search query
  useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  
  const activeSearch = localSearch.trim();
  const [debouncedSearch, setDebouncedSearch] = useState(activeSearch);

  // Debounce server-side search to prevent rapid refetches during typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(activeSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [activeSearch]);

  const employeeFilters = useMemo(() => {
    const filters: any = { searchQuery: debouncedSearch };
    const scopedBranchIds = user?.branchIds?.length ? user.branchIds : [];
    
    if (user?.role === 'manager') {
      filters.branchId = user.branchId;
    } else if (user?.role === 'hr') {
      if (scopedBranchIds.length > 0) {
        filters.branchIds = scopedBranchIds;
      } else if (user.hrAccessLevel === 'branch') {
        filters.branchId = user.branchId;
      } else if (user.hrAccessLevel === 'organization') {
        filters.organizationId = user.organizationId;
      }
    }
    
    if (organizationFilter !== 'all' && !filters.organizationId) {
      filters.organizationId = organizationFilter;
    }
    if (branchFilter !== 'all' && !filters.branchId) {
      delete filters.branchIds;
      filters.branchId = branchFilter;
    }
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    
    return filters;
  }, [user, organizationFilter, branchFilter, statusFilter, debouncedSearch]);

  const { employees: rawEmployees, isLoading, deleteEmployee, fetchEmployees } = useEmployees(employeeFilters);

  // Instant 0ms client-side multi-field search & sort: active employees first, deactivated at bottom
  const employees = useMemo(() => {
    let list = [...rawEmployees];

    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      list = list.filter(e => {
        const fullName = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
        const email = (e.email || '').toLowerCase();
        const phone = (e.phone || '').toLowerCase();
        const jobTitle = (e.job_title || '').toLowerCase();
        const department = (e.department || '').toLowerCase();
        const branchName = (e.branch?.name || '').toLowerCase();
        const orgName = (e.organization?.name || '').toLowerCase();
        const ni = (e.national_insurance_number || '').toLowerCase();

        return (
          fullName.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          jobTitle.includes(q) ||
          department.includes(q) ||
          branchName.includes(q) ||
          orgName.includes(q) ||
          ni.includes(q)
        );
      });
    }

    return list.sort((a, b) => {
      const aInactive = a.status === 'inactive' || a.status === 'terminated';
      const bInactive = b.status === 'inactive' || b.status === 'terminated';
      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;
      return 0;
    });
  }, [rawEmployees, activeSearch]);

  // Fetch certifications for all employees
  const employeeIds = useMemo(() => employees.map(e => e.id), [employees]);
  const certMap = useEmployeeCertifications(employeeIds);

  const visibleBranches = user?.branchIds?.length
    ? branches.filter(b => user.branchIds?.includes(b.id))
    : branches;
  const filteredBranches = organizationFilter !== 'all' 
    ? visibleBranches.filter(b => b.organization_id === organizationFilter)
    : visibleBranches;

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

      // Relocate existing employee folder and documents under the new branch folder without creating duplicates
      await getOrCreateEmployeeFolder(transferEmployee.id, {
        ...transferEmployee,
        branch_id: transferBranchId
      }, user?.id);

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

  // Only show full loader on initial page load when no data is cached yet
  if (isLoading && rawEmployees.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        {/* Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search employees by name, email, role, phone..." 
              className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-background" 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={() => navigate('/dashboard/add-employee')} className="gap-2 h-9 text-xs flex-shrink-0">
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(user?.role === 'super_admin' || user?.role === 'hr') && (
            <Select value={organizationFilter} onValueChange={(v) => {
              setOrganizationFilter(v);
              setBranchFilter('all');
            }}>
              <SelectTrigger className="w-40 sm:w-44 h-9 text-xs">
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
              <SelectTrigger className="w-36 sm:w-40 h-9 text-xs">
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
            <SelectTrigger className="w-32 sm:w-36 h-9 text-xs">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: employees.length, icon: Users, tone: 'text-primary bg-primary/10' },
          { label: 'Active', value: employees.filter(e => e.status === 'active').length, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Deactivated', value: employees.filter(e => e.status === 'inactive' || e.status === 'terminated').length, icon: Ban, tone: 'text-destructive bg-destructive/10' },
          { label: 'Branches Covered', value: new Set(employees.map(e => e.branch_id).filter(Boolean)).size, icon: UserCog, tone: 'text-amber-600 bg-amber-500/10' },
        ].map(card => (
          <Card key={card.label} className="p-4 flex items-center gap-3">
            <span className={`h-10 w-10 rounded-xl flex items-center justify-center ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          </Card>
        ))}
      </div>



      {employees.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Search className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {activeSearch ? `No employees matching "${activeSearch}"` : 'No employees found'}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {activeSearch ? 'Check for spelling mistakes or clear the search to view all employees.' : 'Add your first employee to get started'}
              </p>
            </div>
            {activeSearch ? (
              <Button variant="outline" size="sm" onClick={() => setLocalSearch('')} className="gap-2 text-xs">
                <X className="h-3.5 w-3.5" />
                Clear Search
              </Button>
            ) : (
              <Button onClick={() => navigate('/dashboard/add-employee')} className="gap-2 text-xs">
                <UserPlus className="h-4 w-4" />
                Add First Employee
              </Button>
            )}
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
