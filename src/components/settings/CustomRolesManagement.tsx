import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Edit, Trash2, Shield, Building2, MapPin, Loader2, Users, ShieldCheck, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { toast } from 'sonner';

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  base_role: 'manager' | 'hr' | 'employee';
  organization_id: string | null;
  branch_id: string | null;
  permissions: Record<string, boolean>;
  app_access: {
    niza_safe: boolean;
    niza_finance: boolean;
    niza_templates: boolean;
  };
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
  
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_role: 'manager' as 'manager' | 'hr' | 'employee',
    organization_id: '',
    branch_id: '',
    permissions: {} as Record<string, boolean>,
    app_access: {
      niza_safe: false,
      niza_finance: false,
      niza_templates: false,
    },
  });

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
      
      const typedRoles = (data || []).map(role => ({
        ...role,
        permissions: typeof role.permissions === 'object' && role.permissions !== null 
          ? role.permissions as Record<string, boolean> 
          : {},
        app_access: typeof role.app_access === 'object' && role.app_access !== null
          ? role.app_access as { niza_safe: boolean; niza_finance: boolean; niza_templates: boolean }
          : { niza_safe: false, niza_finance: false, niza_templates: false },
      })) as CustomRole[];
      
      setRoles(typedRoles);
    } catch (error: any) {
      toast.error('Failed to load custom roles: ' + error.message);
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
      app_access: {
        niza_safe: false,
        niza_finance: false,
        niza_templates: false,
      },
    });
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
      app_access: role.app_access || { niza_safe: false, niza_finance: false, niza_templates: false },
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

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('custom_roles').insert({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        base_role: formData.base_role,
        organization_id: formData.organization_id || null,
        branch_id: formData.branch_id || null,
        permissions: formData.permissions,
        app_access: formData.app_access,
      });

      if (error) throw error;

      toast.success('Custom role created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchRoles();
    } catch (error: any) {
      toast.error('Failed to create role: ' + error.message);
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
          permissions: formData.permissions,
          app_access: formData.app_access,
        })
        .eq('id', selectedRole.id);

      if (error) throw error;

      toast.success('Custom role updated successfully');
      setShowEditDialog(false);
      setSelectedRole(null);
      resetForm();
      fetchRoles();
    } catch (error: any) {
      toast.error('Failed to update role: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', selectedRole.id);

      if (error) throw error;

      toast.success('Custom role deleted successfully');
      setShowDeleteDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error: any) {
      toast.error('Failed to delete role: ' + error.message);
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
    } catch (error: any) {
      toast.error('Failed to update role status: ' + error.message);
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

  const RoleFormContent = () => (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Role Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Store Supervisor"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the role's responsibilities..."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Base Role Type *</Label>
          <Select 
            value={formData.base_role} 
            onValueChange={(v) => setFormData(prev => ({ 
              ...prev, 
              base_role: v as 'manager' | 'hr' | 'employee',
              permissions: {} // Reset permissions when base role changes
            }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Store Account</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the base role type to inherit its feature set
          </p>
        </div>
      </div>

      {/* Scope Configuration - Only for Manager/HR */}
      {formData.base_role !== 'employee' && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Scope Configuration
          </h4>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select 
                value={formData.organization_id || 'all'} 
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  organization_id: v === 'all' ? '' : v,
                  branch_id: '' // Reset branch when org changes
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Branch</Label>
              <Select 
                value={formData.branch_id || 'all'} 
                onValueChange={(v) => setFormData(prev => ({ 
                  ...prev, 
                  branch_id: v === 'all' ? '' : v 
                }))}
                disabled={!formData.organization_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {filteredBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Feature Permissions */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Feature Permissions
        </h4>
        
        <Accordion type="multiple" className="w-full">
          {Object.entries(getFeatures()).map(([groupName, features]) => (
            <AccordionItem key={groupName} value={groupName}>
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  {groupName}
                  <Badge variant="outline" className="text-xs">
                    {features.filter(f => formData.permissions[f.key]).length}/{features.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pl-2">
                  <div className="flex gap-2 mb-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => toggleAllInGroup(features, true)}
                    >
                      Select All
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => toggleAllInGroup(features, false)}
                    >
                      Deselect All
                    </Button>
                  </div>
                  {features.map(feature => (
                    <div key={feature.key} className="flex items-center gap-2">
                      <Checkbox
                        id={feature.key}
                        checked={formData.permissions[feature.key] || false}
                        onCheckedChange={() => togglePermission(feature.key)}
                      />
                      <label htmlFor={feature.key} className="text-sm cursor-pointer">
                        {feature.label}
                      </label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Extra App Access */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Extra App Access
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza Safe</p>
              <p className="text-xs text-muted-foreground">Health & Safety management</p>
            </div>
            <Switch
              checked={formData.app_access.niza_safe}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                app_access: { ...prev.app_access, niza_safe: checked }
              }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza Finance</p>
              <p className="text-xs text-muted-foreground">Financial reports & P&L</p>
            </div>
            <Switch
              checked={formData.app_access.niza_finance}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                app_access: { ...prev.app_access, niza_finance: checked }
              }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza Templates</p>
              <p className="text-xs text-muted-foreground">Business cards, ID cards, etc.</p>
            </div>
            <Switch
              checked={formData.app_access.niza_templates}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                app_access: { ...prev.app_access, niza_templates: checked }
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>
              Define a new custom role with specific permissions
            </DialogDescription>
          </DialogHeader>
          <RoleFormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Custom Role</DialogTitle>
            <DialogDescription>
              Modify the role's permissions and settings
            </DialogDescription>
          </DialogHeader>
          <RoleFormContent />
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
