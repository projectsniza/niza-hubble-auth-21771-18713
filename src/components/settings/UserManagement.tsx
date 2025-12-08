import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User, Trash2, Shield, Building2, Loader2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUsers } from '@/hooks/useUsers';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';
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

export default function UserManagement() {
  const { users, isLoading, updateUserRole, updateUserProfile } = useUsers();
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

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
      case 'manager': return 'Manager';
      case 'employee': return 'Employee';
      default: return role;
    }
  };

  const handleEditUser = async (userId: string, updates: any) => {
    if (updates.role) {
      await updateUserRole(userId, updates.role);
    }
    await updateUserProfile(userId, {
      name: updates.name,
      organization_id: updates.organization_id,
      branch_id: updates.branch_id,
      hr_access_level: updates.hr_access_level
    });
    setEditUser(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  {user.role === 'super_admin' || user.role === 'hr' ? (
                    <Shield className="h-6 w-6 text-white" />
                  ) : (
                    <User className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{user.name}</h3>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                    {user.role === 'hr' && user.hr_access_level && (
                      <Badge variant="outline" className="text-xs">
                        {user.hr_access_level === 'full' ? 'Full Access' : 
                         user.hr_access_level === 'organization' ? 'Org Level' : 'Branch Level'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {(user.organization_id || user.branch_id) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{getOrganizationName(user.organization_id)}</span>
                      {user.branch_id && (
                        <span className="text-muted-foreground">
                          / {getBranchName(user.branch_id)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditUser(user)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {users.length === 0 && (
          <Card className="p-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No users yet</h3>
            <p className="text-muted-foreground mb-4">Users will appear here after they sign up</p>
          </Card>
        )}
      </div>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
      />

      {editUser && (
        <EditUserDialog
          open={!!editUser}
          onOpenChange={() => setEditUser(null)}
          user={editUser}
          organizations={organizations}
          branches={branches}
          onSave={handleEditUser}
        />
      )}
    </div>
  );
}
