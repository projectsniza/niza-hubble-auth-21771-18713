import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Shield, Building2, MapPin, Loader2 } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CustomRoleForm, type AppAccess, type BaseRole, type FeatureGroups, type CustomRoleFormData } from './CustomRoleForm';


interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  base_role: BaseRole;
  organization_id: string | null;
  branch_id: string | null;
  permissions: Record<string, boolean>;
  app_access: AppAccess;
  is_active: boolean;
  created_at: string;
}

// Define feature groups based on role type
const MANAGER_FEATURES = {
  'Employee Management': [
    { key: 'view_employees', label: 'View Employees' },
    { key: 'add_employees', label: 'Add Employees' },
    { key: 'edit_employees', label: 'Edit Employees' },
    { key: 'delete_employees', label: 'Delete Employees' },
  ],
  'Scheduling': [
    { key: 'view_schedules', label: 'View Schedules' },
    { key: 'create_rotas', label: 'Create Rotas' },
    { key: 'manage_shifts', label: 'Manage Shifts' },
  ],
  'Attendance': [
    { key: 'view_attendance', label: 'View Attendance' },
    { key: 'manage_leave', label: 'Manage Leave Requests' },
    { key: 'view_clockins', label: 'View Clock-ins' },
  ],
  'Documents': [
    { key: 'view_documents', label: 'View Documents' },
    { key: 'upload_documents', label: 'Upload Documents' },
    { key: 'delete_documents', label: 'Delete Documents' },
  ],
  'Reports': [
    { key: 'view_reports', label: 'View Reports' },
    { key: 'create_reports', label: 'Create Reports' },
    { key: 'submit_daily_reports', label: 'Submit Daily Reports' },
  ],
  'Training': [
    { key: 'view_training', label: 'View Training' },
    { key: 'assign_training', label: 'Assign Training' },
    { key: 'create_training', label: 'Create Training' },
  ],
  'Maintenance': [
    { key: 'view_maintenance', label: 'View Maintenance Tickets' },
    { key: 'create_maintenance', label: 'Create Maintenance Tickets' },
    { key: 'manage_maintenance', label: 'Manage Maintenance Tickets' },
  ],
};

const HR_FEATURES = {
  ...MANAGER_FEATURES,
  'Onboarding': [
    { key: 'view_onboarding', label: 'View Onboarding' },
    { key: 'manage_onboarding', label: 'Manage Onboarding' },
    { key: 'approve_contracts', label: 'Approve Contracts' },
  ],
  'Payroll': [
    { key: 'view_payroll', label: 'View Payroll' },
    { key: 'manage_payroll', label: 'Manage Payroll' },
  ],
  'UK Compliance': [
    { key: 'view_compliance', label: 'View Compliance' },
    { key: 'manage_compliance', label: 'Manage Compliance Settings' },
  ],
  'Performance': [
    { key: 'view_performance', label: 'View Performance' },
    { key: 'manage_performance', label: 'Manage Performance Reviews' },
  ],
};

const EMPLOYEE_FEATURES = {
  'Self Service': [
    { key: 'view_own_profile', label: 'View Own Profile' },
    { key: 'edit_own_profile', label: 'Edit Own Profile' },
    { key: 'submit_leave', label: 'Submit Leave Requests' },
    { key: 'view_schedule', label: 'View Own Schedule' },
    { key: 'clock_in_out', label: 'Clock In/Out' },
    { key: 'view_payslips', label: 'View Payslips' },
    { key: 'view_own_documents', label: 'View Own Documents' },
    { key: 'complete_training', label: 'Complete Training' },
  ],
  'Communication': [
    { key: 'view_events', label: 'View Events' },
    { key: 'use_messaging', label: 'Use Messaging' },
  ],
};

export default function CustomRolesManagement() {
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  const { user } = useAuth();
  
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Default app access structure
  const defaultAppAccess: AppAccess = {
    niza_safe: false,
    niza_finance: false,
    niza_templates: false,
  };
  
  // Form state
  const [formData, setFormData] = useState<CustomRoleFormData>({
    name: '',
    description: '',
    base_role: 'manager',
    organization_id: '',
    branch_id: '',
    permissions: {},
    app_access: { ...defaultAppAccess },
  });
  
  // User creation state
  const [createUser] = useState(true); // Always enabled
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPassword, setUserPassword] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse database rows with proper type safety
      const typedRoles: CustomRole[] = (data || []).map(role => {
        // Safely parse permissions
        let permissions: Record<string, boolean> = {};
        if (role.permissions && typeof role.permissions === 'object' && !Array.isArray(role.permissions)) {
          permissions = role.permissions as Record<string, boolean>;
        }
        
        // Safely parse app_access
        let app_access: AppAccess = { ...defaultAppAccess };
        if (role.app_access && typeof role.app_access === 'object' && !Array.isArray(role.app_access)) {
          const access = role.app_access as Record<string, unknown>;
          app_access = {
            niza_safe: Boolean(access.niza_safe),
            niza_finance: Boolean(access.niza_finance),
            niza_templates: Boolean(access.niza_templates),
          };
        }
        
        // Validate base_role
        const validBaseRoles: BaseRole[] = ['manager', 'hr', 'employee'];
        const base_role: BaseRole = validBaseRoles.includes(role.base_role as BaseRole) 
          ? (role.base_role as BaseRole) 
          : 'manager';
        
        return {
          id: role.id,
          name: role.name,
          description: role.description,
          base_role,
          organization_id: role.organization_id,
          branch_id: role.branch_id,
          permissions,
          app_access,
          is_active: role.is_active ?? true,
          created_at: role.created_at ?? new Date().toISOString(),
        };
      });
      
      setRoles(typedRoles);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load custom roles: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      base_role: 'manager',
      organization_id: '',
      branch_id: '',
      permissions: {},
      app_access: { ...defaultAppAccess },
    });
    // createUser is always true, no need to reset
    setUserEmail('');
    setUserName('');
    setUserPassword('');
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (role: CustomRole) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      base_role: role.base_role,
      organization_id: role.organization_id || '',
      branch_id: role.branch_id || '',
      permissions: role.permissions || {},
      app_access: role.app_access || { ...defaultAppAccess },
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (role: CustomRole) => {
    setSelectedRole(role);
    setShowDeleteDialog(true);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    // Validate user creation fields (always required now)
    if (!userEmail.trim() || !userName.trim() || !userPassword.trim()) {
      toast.error('Please fill in all user credential fields');
      return;
    }
    if (userPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    // Validate required org/branch based on role
    if (formData.base_role === 'manager' && !formData.branch_id) {
      toast.error('Store Account users must be assigned to a branch');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the custom role first
      const { data: roleData, error: roleError } = await supabase
        .from('custom_roles')
        .insert([
          {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            base_role: formData.base_role,
            organization_id: formData.organization_id || null,
            branch_id: formData.branch_id || null,
            permissions: formData.permissions as any,
            app_access: formData.app_access as any,
            created_by: user?.id || null,
          },
        ])
        .select()
        .single();

      if (roleError) throw roleError;

      // Create the user with this role using admin edge function
      if (roleData) {
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: userEmail.trim(),
            password: userPassword,
            name: userName.trim(),
            role: formData.base_role,
            organization_id: formData.organization_id || '',
            branch_id: formData.branch_id || '',
            custom_role_id: roleData.id,
          },
        });

        if (response.error) {
          toast.error('Role created but user creation failed: ' + (response.error.message || 'Unknown error'));
        } else if (response.data?.success) {
          toast.success('Custom role and user created successfully');
        } else {
          toast.error('Role created but user creation failed: ' + (response.data?.error || 'Unknown error'));
        }
      }

      setShowCreateDialog(false);
      resetForm();
      fetchRoles();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to create role: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRole || !formData.name.trim()) {
      toast.error('Please enter a role name');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('custom_roles')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          base_role: formData.base_role,
          organization_id: formData.organization_id || null,
          branch_id: formData.branch_id || null,
          permissions: formData.permissions as any,
          app_access: formData.app_access as any,
        })
        .eq('id', selectedRole.id);

      if (error) throw error;

      toast.success('Custom role updated successfully');
      setShowEditDialog(false);
      setSelectedRole(null);
      resetForm();
      fetchRoles();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update role: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    setIsSubmitting(true);
    try {
      // First, find all users created from this custom role and deactivate them
      const { data: linkedUsers, error: findError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('custom_role_id', selectedRole.id);
      
      if (findError) {
        console.error('Error finding linked users:', findError);
      }
      
      // Deactivate all linked users
      if (linkedUsers && linkedUsers.length > 0) {
        const userIds = linkedUsers.map(u => u.id);
        const { error: deactivateError } = await supabase
          .from('profiles')
          .update({ is_active: false })
          .in('id', userIds);
        
        if (deactivateError) {
          console.error('Error deactivating linked users:', deactivateError);
          toast.error('Warning: Could not deactivate some linked user accounts');
        } else {
          toast.info(`Deactivated ${linkedUsers.length} user account(s) linked to this role`);
        }
      }
      
      // Now delete the custom role
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', selectedRole.id);

      if (error) throw error;

      toast.success('Custom role deleted successfully');
      setShowDeleteDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete role: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRoleActive = async (role: CustomRole) => {
    try {
      const { error } = await supabase
        .from('custom_roles')
        .update({ is_active: !role.is_active })
        .eq('id', role.id);

      if (error) throw error;

      toast.success(role.is_active ? 'Role deactivated' : 'Role activated');
      fetchRoles();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update role status: ' + message);
    }
  };

  const getFeatures = () => {
    switch (formData.base_role) {
      case 'hr':
        return HR_FEATURES;
      case 'employee':
        return EMPLOYEE_FEATURES;
      default:
        return MANAGER_FEATURES;
    }
  };

  const togglePermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const toggleAllInGroup = (features: { key: string }[], enable: boolean) => {
    setFormData(prev => {
      const newPermissions = { ...prev.permissions };
      features.forEach(f => {
        newPermissions[f.key] = enable;
      });
      return { ...prev, permissions: newPermissions };
    });
  };

  const filteredBranches = formData.organization_id 
    ? branches.filter(b => b.organization_id === formData.organization_id)
    : branches;

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return 'All Organizations';
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return 'All Branches';
    return branches.find(b => b.id === branchId)?.name || 'Unknown';
  };

  const getBaseRoleBadge = (baseRole: string) => {
    switch (baseRole) {
      case 'hr':
        return <Badge variant="secondary">HR Based</Badge>;
      case 'manager':
        return <Badge variant="outline">Store Account Based</Badge>;
      default:
        return <Badge>Employee Based</Badge>;
    }
  };

  const features: FeatureGroups = getFeatures();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Roles</h3>
          <p className="text-sm text-muted-foreground">
            Create custom roles with specific permissions for your organization
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Custom Roles</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create custom roles to assign specific permissions to users
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map(role => (
            <Card key={role.id} className={!role.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      {role.name}
                    </CardTitle>
                    {role.description && (
                      <CardDescription className="text-xs">
                        {role.description}
                      </CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={role.is_active}
                    onCheckedChange={() => toggleRoleActive(role)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {getBaseRoleBadge(role.base_role)}
                  {!role.is_active && <Badge variant="destructive">Inactive</Badge>}
                </div>

                {role.base_role !== 'employee' && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {getOrgName(role.organization_id)}
                    </div>
                    {role.organization_id && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {getBranchName(role.branch_id)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {role.app_access?.niza_safe && (
                    <Badge variant="outline" className="text-xs">Safe</Badge>
                  )}
                  {role.app_access?.niza_finance && (
                    <Badge variant="outline" className="text-xs">Finance</Badge>
                  )}
                  {role.app_access?.niza_templates && (
                    <Badge variant="outline" className="text-xs">Templates</Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openEditDialog(role)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => openDeleteDialog(role)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog} modal={true}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>
              Define a new custom role with specific permissions
            </DialogDescription>
          </DialogHeader>
          <CustomRoleForm
            isEditMode={false}
            formData={formData}
            setFormData={setFormData}
            organizations={organizations}
            filteredBranches={filteredBranches}
            userEmail={userEmail}
            setUserEmail={setUserEmail}
            userPassword={userPassword}
            setUserPassword={setUserPassword}
            userName={userName}
            setUserName={setUserName}
            features={features}
            toggleAllInGroup={toggleAllInGroup}
            togglePermission={togglePermission}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Role & User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog} modal={true}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Custom Role</DialogTitle>
            <DialogDescription>
              Modify the role's permissions and settings
            </DialogDescription>
          </DialogHeader>
          <CustomRoleForm
            isEditMode={true}
            formData={formData}
            setFormData={setFormData}
            organizations={organizations}
            filteredBranches={filteredBranches}
            userEmail={userEmail}
            setUserEmail={setUserEmail}
            userPassword={userPassword}
            setUserPassword={setUserPassword}
            userName={userName}
            setUserName={setUserName}
            features={features}
            toggleAllInGroup={toggleAllInGroup}
            togglePermission={togglePermission}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRole?.name}"? This action cannot be undone
              and will remove this role from all assigned users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
