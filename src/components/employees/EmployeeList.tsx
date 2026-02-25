import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Users, MoreHorizontal, Eye, Trash2, UserCog, Edit } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEmployees } from '@/hooks/useEmployees';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeStatusBadge, { EMPLOYEE_STATUSES } from './EmployeeStatusBadge';
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

interface EmployeeListProps {
  searchQuery: string;
}

export default function EmployeeList({ searchQuery }: EmployeeListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [organizationFilter, setOrganizationFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  
  // Build filters based on user role
  const employeeFilters = useMemo(() => {
    const filters: any = { searchQuery };
    
    // Apply role-based restrictions
    if (user?.role === 'manager') {
      filters.branchId = user.branchId;
    } else if (user?.role === 'hr') {
      if (user.hrAccessLevel === 'branch') {
        filters.branchId = user.branchId;
      } else if (user.hrAccessLevel === 'organization') {
        filters.organizationId = user.organizationId;
      }
    }
    
    // Apply manual filters (only if not already restricted by role)
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

  const { employees, isLoading, deleteEmployee, fetchEmployees } = useEmployees(employeeFilters);

  const filteredBranches = organizationFilter !== 'all' 
    ? branches.filter(b => b.organization_id === organizationFilter)
    : branches;

  const handleDeleteEmployee = async () => {
    if (deleteEmployeeId) {
      await deleteEmployee(deleteEmployeeId);
      setDeleteEmployeeId(null);
    }
  };

  // Status badge moved to separate component

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
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(employee.first_name, employee.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
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
                        {employee.status === 'onboarding' && (
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/onboarding/${employee.id}`)}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Continue Onboarding
                          </DropdownMenuItem>
                        )}
                        {/* Only show delete for super_admin and HR, or managers for their own branch employees */}
                        {(user?.role === 'super_admin' || user?.role === 'hr' || (user?.role === 'manager' && employee.branch_id === user?.branchId)) && (
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
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

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

      <EditEmployeeDialog
        open={!!editingEmployee}
        onOpenChange={(open) => !open && setEditingEmployee(null)}
        employee={editingEmployee}
        onSuccess={() => {
          fetchEmployees();
          setEditingEmployee(null);
        }}
      />
    </div>
  );
}
