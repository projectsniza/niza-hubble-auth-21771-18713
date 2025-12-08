import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User, Edit, Trash2, Shield, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CreateUserDialog from './CreateUserDialog';
import { toast } from 'sonner';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'hr';
  organizationId?: string;
  branchId?: string;
  password: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);

  useEffect(() => {
    const storedUsers = localStorage.getItem('niza_managed_users');
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    }

    const storedOrgs = localStorage.getItem('niza_organizations');
    if (storedOrgs) {
      setOrganizations(JSON.parse(storedOrgs));
    }
  }, []);

  const saveUsers = (updatedUsers: ManagedUser[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('niza_managed_users', JSON.stringify(updatedUsers));
  };

  const handleCreateUser = (user: Omit<ManagedUser, 'id'>) => {
    const newUser: ManagedUser = {
      ...user,
      id: Date.now().toString(),
    };
    saveUsers([...users, newUser]);
    toast.success('User created successfully');
  };

  const handleDeleteUser = (userId: string) => {
    saveUsers(users.filter(u => u.id !== userId));
    toast.success('User deleted');
  };

  const getOrganizationName = (orgId?: string) => {
    if (!orgId) return null;
    const org = organizations.find(o => o.id === orgId);
    return org?.name;
  };

  const getBranchName = (orgId?: string, branchId?: string) => {
    if (!orgId || !branchId) return null;
    const org = organizations.find(o => o.id === orgId);
    const branch = org?.branches.find((b: any) => b.id === branchId);
    return branch?.name;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage managers and HR users</p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  {user.role === 'hr' ? (
                    <Shield className="h-6 w-6 text-white" />
                  ) : (
                    <User className="h-6 w-6 text-white" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{user.name}</h3>
                    <Badge variant={user.role === 'hr' ? 'default' : 'secondary'}>
                      {user.role === 'hr' ? 'HR' : 'Manager'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.organizationId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{getOrganizationName(user.organizationId)}</span>
                      {user.branchId && (
                        <span className="text-muted-foreground">
                          / {getBranchName(user.organizationId, user.branchId)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded inline-block">
                    Password: {user.password}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteUser(user.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}

        {users.length === 0 && (
          <Card className="p-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No users yet</h3>
            <p className="text-muted-foreground mb-4">Create managers and HR users to manage your organization</p>
            <Button onClick={() => setCreateUserOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </Card>
        )}
      </div>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSubmit={handleCreateUser}
        organizations={organizations}
      />
    </div>
  );
}
