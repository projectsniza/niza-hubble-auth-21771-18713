import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Building2, Loader2, Edit, Trash2, Power, KeyRound, UserPlus, Search, CheckCircle, Users, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUsers } from '@/hooks/useUsers';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PendingEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  organization_id: string;
  branch_id: string;
  organization?: { name: string };
  branch?: { name: string };
  account_activated: boolean;
  user_id: string | null;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { users, isLoading: usersLoading, updateUserRole, updateUserProfile, fetchUsers } = useUsers();
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  
  // States
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  
  // Dialog states
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<PendingEmployee | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Form states for activation
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'super_admin' | 'hr' | 'manager' | 'employee'>('employee');
  const [hrAccessLevel, setHrAccessLevel] = useState<'full' | 'organization' | 'branch'>('full');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states for editing
  const [editRole, setEditRole] = useState<'super_admin' | 'hr' | 'manager' | 'employee'>('employee');
  const [editHrAccessLevel, setEditHrAccessLevel] = useState<'full' | 'organization' | 'branch'>('full');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editOrgId, setEditOrgId] = useState('');
  const [editBranchId, setEditBranchId] = useState('');

  // Fetch pending employees
  useEffect(() => {
    fetchPendingEmployees();
  }, []);

  const fetchPendingEmployees = async () => {
    setIsLoadingPending(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          email,
          job_title,
          organization_id,
          branch_id,
          account_activated,
          user_id,
          organization:organizations(name),
          branch:branches(name)
        `)
        .eq('account_activated', false)
        .not('status', 'eq', 'terminated')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingEmployees(data || []);
    } catch (error: any) {
      toast.error('Failed to load pending employees: ' + error.message);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleActivateAccount = async () => {
    if (!selectedEmployee) return;
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save current admin session before creating new user
      const { data: currentSession } = await supabase.auth.getSession();
      const adminSession = currentSession?.session;

      // Create auth user with role in metadata for the trigger
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: selectedEmployee.email,
        password: password,
        options: {
          data: {
            name: displayName || `${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
            role: selectedRole,
            organization_id: selectedEmployee.organization_id || '',
            branch_id: selectedEmployee.branch_id || '',
            hr_access_level: selectedRole === 'hr' ? hrAccessLevel : ''
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the profile with additional details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          organization_id: selectedEmployee.organization_id,
          branch_id: selectedEmployee.branch_id,
          display_name: displayName || null,
          force_password_change: true,
          hr_access_level: selectedRole === 'hr' ? hrAccessLevel : null
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      // Update the user role to ensure it's correct
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('user_id', authData.user.id);
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: authData.user.id, role: selectedRole });
      }

      // Link employee to user and activate
      const { error: employeeError } = await supabase
        .from('employees')
        .update({ 
          user_id: authData.user.id,
          account_activated: true 
        })
        .eq('id', selectedEmployee.id);

      if (employeeError) throw employeeError;

      // Restore admin session after creating the new user
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        });
      }

      toast.success(`Account created for ${selectedEmployee.first_name} ${selectedEmployee.last_name}`);
      setActivateDialogOpen(false);
      resetActivateForm();
      fetchPendingEmployees();
      fetchUsers();
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        toast.error('This email is already registered. Please use a different email.');
      } else {
        toast.error(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetActivateForm = () => {
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setSelectedRole('employee');
    setHrAccessLevel('full');
    setSelectedEmployee(null);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    
    setIsSubmitting(true);
    try {
      // Update role
      await updateUserRole(selectedUser.id, editRole);
      
      // Update profile
      await updateUserProfile(selectedUser.id, {
        name: selectedUser.name,
        organization_id: editOrgId || null,
        branch_id: editBranchId || null,
        hr_access_level: editRole === 'hr' ? editHrAccessLevel : null
      });

      // Update display name
      await supabase
        .from('profiles')
        .update({ display_name: editDisplayName || null })
        .eq('id', selectedUser.id);

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);
      
      toast.success('User deactivated');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', userId);
      
      toast.success('User activated');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLinkEmployeeRecord = async (targetUser: any) => {
    try {
      if (!targetUser?.email) {
        toast.error('User email missing');
        return;
      }

      const query = supabase
        .from('employees')
        .select('id, user_id, account_activated, status, organization_id, branch_id')
        .eq('email', targetUser.email)
        .limit(1);

      // Narrow match when we have scope data
      const scopedQuery = targetUser.organization_id ? query.eq('organization_id', targetUser.organization_id) : query;
      const scopedQuery2 = targetUser.branch_id ? scopedQuery.eq('branch_id', targetUser.branch_id) : scopedQuery;

      const { data: employeeRows, error: empError } = await scopedQuery2;
      if (empError) throw empError;

      const employee = employeeRows?.[0];
      if (!employee) {
        toast.error('No matching employee record found for this user email');
        return;
      }

      const { error: linkError } = await supabase
        .from('employees')
        .update({
          user_id: targetUser.id,
          account_activated: true,
          status: 'active',
        })
        .eq('id', employee.id);

      if (linkError) throw linkError;

      toast.success('Employee record linked successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to link employee record');
    }
  };

  const openResetPasswordDialog = (user: any) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setConfirmNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      // Call edge function to reset password
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          userId: resetPasswordUser.id,
          newPassword: newPassword
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Password reset successfully for ${resetPasswordUser.name}`);
      setResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Password reset failed. Please contact system administrator.');
      console.error('Password reset error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    // Don't allow deleting yourself
    if (deleteUserId === currentUser?.id) {
      toast.error("You cannot delete your own account");
      setDeleteUserId(null);
      return;
    }
    
    try {
      // Call edge function to delete user (uses admin API)
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteUserId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('User deleted successfully');
      setDeleteUserId(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Delete user error:', error);

      // supabase-js returns rich error objects for functions.invoke.
      // Prefer a clear message over the generic "non-2xx" text.
      const message =
        error?.context?.body?.error ||
        error?.context?.body?.message ||
        error?.message ||
        'Failed to delete user';

      toast.error(message);
    }
  };

  const openActivateDialog = (employee: PendingEmployee) => {
    setSelectedEmployee(employee);
    setDisplayName(`${employee.first_name} ${employee.last_name}`);
    setActivateDialogOpen(true);
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditHrAccessLevel(user.hr_access_level || 'full');
    setEditDisplayName(user.display_name || '');
    setEditOrgId(user.organization_id || '');
    setEditBranchId(user.branch_id || '');
    setEditDialogOpen(true);
  };

  const getOrganizationName = (orgId?: string | null) => {
    if (!orgId) return null;
    const org = organizations.find(o => o.id === orgId);
    return org?.name;
  };

  const getBranchName = (branchId?: string | null) => {
    if (!branchId) return null;
    const branch = branches.find(b => b.id === branchId);
    return branch?.name;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'default';
      case 'hr': return 'secondary';
      case 'manager': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'hr': return 'HR Admin';
      case 'manager': return 'Store Account';
      case 'employee': return 'Employee';
      default: return role;
    }
  };

  const filteredBranches = editOrgId 
    ? branches.filter(b => b.organization_id === editOrgId)
    : branches;

  // Filter users by role
  const superAdmins = users.filter(u => u.role === 'super_admin');
  const hrUsers = users.filter(u => u.role === 'hr');
  const managers = users.filter(u => u.role === 'manager');
  const employees = users.filter(u => u.role === 'employee');

  // Filter pending employees
  const filteredPending = pendingEmployees.filter(e => 
    `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = usersLoading || isLoadingPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const UserCard = ({ user }: { user: any }) => (
    <Card key={user.id} className={`p-4 ${user.is_active === false ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={user.is_active === false ? "bg-destructive/20 text-destructive" : "bg-gradient-to-br from-primary to-accent text-white"}>
              {user.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold ${user.is_active === false ? 'text-destructive' : ''}`}>{user.name}</h3>
              <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                {getRoleLabel(user.role)}
              </Badge>
              {user.is_active === false && (
                <Badge variant="destructive" className="text-xs">Deactivated</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            
            {user.role === 'hr' && user.hr_access_level && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {user.hr_access_level === 'full' ? 'Full Access' : 
                 user.hr_access_level === 'organization' ? 'Organization' : 'Branch Only'}
              </Badge>
            )}
            
            {(user.organization_id || user.branch_id) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{getOrganizationName(user.organization_id)}</span>
                {user.branch_id && (
                  <span>/ {getBranchName(user.branch_id)}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {user.role === 'employee' && (currentUser?.role === 'super_admin' || currentUser?.role === 'hr' || currentUser?.role === 'manager') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLinkEmployeeRecord(user)}
              title="Link employee record"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} title="Edit user">
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-amber-600 hover:bg-amber-50"
            onClick={() => openResetPasswordDialog(user)}
            title="Reset password"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          {user.is_active !== false ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-destructive hover:bg-destructive/10"
              onClick={() => handleDeactivateUser(user.id)}
              title="Deactivate user"
            >
              <Power className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-green-600 hover:bg-green-50"
              onClick={() => handleActivateUser(user.id)}
              title="Reactivate user"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteUserId(user.id)}
            title="Delete user"
            disabled={user.id === currentUser?.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Create accounts from employees & manage system users</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Pending ({pendingEmployees.length})
          </TabsTrigger>
          <TabsTrigger value="super_admin" className="gap-2">
            <Shield className="h-4 w-4" />
            Super Admins ({superAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="hr" className="gap-2">
            HR ({hrUsers.length})
          </TabsTrigger>
          <TabsTrigger value="manager" className="gap-2">
            <Users className="h-4 w-4" />
            Store Accounts ({managers.length})
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-2">
            Employees ({employees.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Accounts Tab */}
        <TabsContent value="pending" className="space-y-4 mt-4">
          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Pending Accounts:</strong> These employees have completed onboarding or bulk upload but need login credentials to access the system.
              Create their account with a temporary password - they will be prompted to change it on first login.
            </p>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {filteredPending.map(employee => (
              <Card key={employee.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-amber-100 text-amber-700">
                        {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{employee.first_name} {employee.last_name}</h3>
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Pending Activation
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{employee.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Building2 className="h-3 w-3" />
                        <span>{employee.organization?.name || 'No org'}</span>
                        <span>/</span>
                        <span>{employee.branch?.name || 'No branch'}</span>
                        {employee.job_title && (
                          <>
                            <span>•</span>
                            <span>{employee.job_title}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => openActivateDialog(employee)} className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    Create Account
                  </Button>
                </div>
              </Card>
            ))}

            {filteredPending.length === 0 && (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-muted-foreground">No pending accounts</p>
                <p className="text-sm text-muted-foreground mt-1">All employees have been activated</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="super_admin" className="space-y-4 mt-4">
          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Super Admins</strong> have full platform control including contract signing, approval authority, and access to all organizations.
            </p>
          </Card>
          <div className="grid gap-3">
            {superAdmins.map(user => <UserCard key={user.id} user={user} />)}
            {superAdmins.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No super admins found</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="hr" className="space-y-4 mt-4">
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>HR Admin Access Levels:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Full:</strong> Access all organizations and branches</li>
                <li><strong>Organization:</strong> Access one organization and all its branches</li>
                <li><strong>Branch:</strong> Access only one specific branch</li>
              </ul>
            </div>
          </Card>
          <div className="grid gap-3">
            {hrUsers.map(user => <UserCard key={user.id} user={user} />)}
            {hrUsers.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No HR admins found</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="manager" className="space-y-4 mt-4">
          <Card className="p-4 bg-orange-50 border-orange-200">
            <p className="text-sm text-orange-800">
              <strong>Store Accounts</strong> are assigned to a single branch and can onboard employees within their branch.
            </p>
          </Card>
          <div className="grid gap-3">
            {managers.map(user => <UserCard key={user.id} user={user} />)}
            {managers.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No store accounts found</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="employee" className="space-y-4 mt-4">
          <Card className="p-4 bg-gray-50 border-gray-200">
            <p className="text-sm text-gray-700">
              <strong>Employees</strong> have self-service portal access only.
            </p>
          </Card>
          <div className="grid gap-3">
            {employees.map(user => <UserCard key={user.id} user={user} />)}
            {employees.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No employee users found</p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Activate Account Dialog */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Create Account
            </DialogTitle>
            <DialogDescription>
              Create login credentials for {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email (from employee record)</Label>
              <Input value={selectedEmployee?.email || ''} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label>Display Name (for welcome message)</Label>
              <Input
                placeholder="e.g., Ajay"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Shown as "Welcome back, {displayName || 'Name'}"</p>
            </div>

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Assign Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'super_admin' | 'hr' | 'manager' | 'employee')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Store Account</SelectItem>
                  <SelectItem value="hr">HR Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === 'hr' && (
              <>
                <div className="space-y-2">
                  <Label>HR Access Level</Label>
                  <Select value={hrAccessLevel} onValueChange={(v) => setHrAccessLevel(v as 'full' | 'organization' | 'branch')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Access (All Organizations)</SelectItem>
                      <SelectItem value="organization">Organization Only</SelectItem>
                      <SelectItem value="branch">Branch Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hrAccessLevel !== 'full' && (
                  <>
                    <div className="space-y-2">
                      <Label>Organization</Label>
                      <Select 
                        value={selectedEmployee?.organization_id || ''} 
                        disabled
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="From employee record" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map(org => (
                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Organization is inherited from employee record</p>
                    </div>

                    {hrAccessLevel === 'branch' && (
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Select 
                          value={selectedEmployee?.branch_id || ''} 
                          disabled
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="From employee record" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.filter(b => b.organization_id === selectedEmployee?.organization_id).map(branch => (
                              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Branch is inherited from employee record</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {selectedRole === 'manager' && (
              <>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select 
                    value={selectedEmployee?.organization_id || ''} 
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="From employee record" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Organization is inherited from employee record</p>
                </div>

                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select 
                    value={selectedEmployee?.branch_id || ''} 
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="From employee record" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.filter(b => b.organization_id === selectedEmployee?.organization_id).map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Branch is inherited from employee record</p>
                </div>
              </>
            )}

            <Card className="p-3 bg-blue-50 border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>Password Change Required:</strong> The user will be required to change their password on first login for security.
              </p>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActivateDialogOpen(false); resetActivateForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleActivateAccount} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role and permissions for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="Display name for welcome message"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as 'super_admin' | 'hr' | 'manager' | 'employee')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Store Account</SelectItem>
                  <SelectItem value="hr">HR Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === 'hr' && (
              <div className="space-y-2">
                <Label>HR Access Level</Label>
                <Select value={editHrAccessLevel} onValueChange={(v) => setEditHrAccessLevel(v as 'full' | 'organization' | 'branch')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Access</SelectItem>
                    <SelectItem value="organization">Organization Only</SelectItem>
                    <SelectItem value="branch">Branch Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(editRole === 'hr' || editRole === 'manager') && (
              <>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={editOrgId} onValueChange={(v) => { setEditOrgId(v); setEditBranchId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={editBranchId} onValueChange={setEditBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBranches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This will remove their profile and role from the system. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordUser?.name}. They will need to use this password to login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}