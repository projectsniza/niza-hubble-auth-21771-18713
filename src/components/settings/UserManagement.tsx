import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User, Shield, Building2, Loader2, Edit, Users, Clock, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUsers } from '@/hooks/useUsers';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';
import PendingAccountsDialog from './PendingAccountsDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function UserManagement() {
  const { users, isLoading, updateUserRole, updateUserProfile, fetchUsers, getPendingCountForManager } = useUsers();
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [pendingDialogManager, setPendingDialogManager] = useState<any>(null);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());

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

  const getHRAccessDescription = (level: string | null) => {
    switch (level) {
      case 'full': return 'Full Access - All organizations and branches';
      case 'organization': return 'Organization Restricted - All branches under assigned organization';
      case 'branch': return 'Branch Restricted - Only assigned branch';
      default: return '';
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

  const toggleManagerExpanded = (managerId: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedManagers(newExpanded);
  };

  // Filter users by role
  const superAdmins = users.filter(u => u.role === 'super_admin');
  const hrUsers = users.filter(u => u.role === 'hr');
  const managers = users.filter(u => u.role === 'manager');
  const employees = users.filter(u => u.role === 'employee');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const UserCard = ({ user }: { user: any }) => (
    <Card key={user.id} className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            {user.role === 'super_admin' || user.role === 'hr' ? (
              <Shield className="h-5 w-5 text-white" />
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{user.name}</h3>
              <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                {getRoleLabel(user.role)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            
            {user.role === 'hr' && user.hr_access_level && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {user.hr_access_level === 'full' ? 'Full HR' : 
                   user.hr_access_level === 'organization' ? 'Org Restricted' : 'Branch Restricted'}
                </Badge>
              </div>
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

            {user.role === 'hr' && user.hr_access_level && (
              <p className="text-xs text-muted-foreground mt-1">
                {getHRAccessDescription(user.hr_access_level)}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditUser(user)}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );

  const ManagerCard = ({ user, pendingCount }: { user: any; pendingCount: number }) => {
    const isExpanded = expandedManagers.has(user.id);
    
    return (
      <Card key={user.id} className="overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{user.name}</h3>
                  <Badge variant="outline" className="text-xs">Manager</Badge>
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {pendingCount} Pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
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
            <div className="flex gap-2">
              {pendingCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => setPendingDialogManager(user)}
                >
                  <Eye className="h-4 w-4" />
                  View Pending
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditUser(user)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage system users, roles, and permissions</p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <Tabs defaultValue="super_admin" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="super_admin" className="gap-2">
            <Shield className="h-4 w-4" />
            Super Admins ({superAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="hr" className="gap-2">
            HR Admins ({hrUsers.length})
          </TabsTrigger>
          <TabsTrigger value="manager" className="gap-2">
            <Users className="h-4 w-4" />
            Managers ({managers.length})
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-2">
            Employees ({employees.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="super_admin" className="space-y-4 mt-4">
          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Super Admins</strong> have full platform control including contract signing, approval authority, and access to all organizations and branches.
            </p>
          </Card>
          <div className="grid gap-3">
            {superAdmins.map(user => (
              <UserCard key={user.id} user={user} />
            ))}
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
                <li><strong>Full HR:</strong> Access all organizations and branches</li>
                <li><strong>Organization Restricted:</strong> Access one organization and all its branches</li>
                <li><strong>Branch Restricted:</strong> Access only one specific branch</li>
              </ul>
              <p className="mt-2 text-xs text-blue-600">
                HR can onboard employees and upload documents but cannot approve or sign contracts.
              </p>
            </div>
          </Card>
          <div className="grid gap-3">
            {hrUsers.map(user => (
              <UserCard key={user.id} user={user} />
            ))}
            {hrUsers.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No HR admins found</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="manager" className="space-y-4 mt-4">
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="text-sm text-orange-800 space-y-2">
              <p><strong>Manager Permissions:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Assigned to a single branch</li>
                <li>Can onboard employees in their branch</li>
                <li>Can upload documents after approvals</li>
                <li>Cannot approve/sign contracts</li>
                <li>Cannot access other branches</li>
              </ul>
            </div>
          </Card>
          
          <div className="grid gap-3">
            {managers.map(user => (
              <ManagerCard key={user.id} user={user} pendingCount={getPendingCountForManager(user.id)} />
            ))}
            {managers.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No managers found</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="employee" className="space-y-4 mt-4">
          <Card className="p-4 bg-gray-50 border-gray-200">
            <p className="text-sm text-gray-700">
              <strong>Employees</strong> have self-service portal access only. They can view their own documents, schedules, and submit leave requests.
            </p>
          </Card>
          <div className="grid gap-3">
            {employees.map(user => (
              <UserCard key={user.id} user={user} />
            ))}
            {employees.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No employee users found</p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        organizations={organizations}
        branches={branches}
        onSuccess={fetchUsers}
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

      {pendingDialogManager && (
        <PendingAccountsDialog
          open={!!pendingDialogManager}
          onOpenChange={() => setPendingDialogManager(null)}
          manager={pendingDialogManager}
          onActivate={fetchUsers}
        />
      )}
    </div>
  );
}
