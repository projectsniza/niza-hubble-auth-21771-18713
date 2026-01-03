import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, Shield, Building2, Users, User } from 'lucide-react';
import { UserRole, HRAccessLevel } from '@/types/database';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  organizations: any[];
  branches: any[];
  onSave: (userId: string, updates: any) => void;
}

export default function EditUserDialog({
  open,
  onOpenChange,
  user,
  organizations,
  branches,
  onSave,
}: EditUserDialogProps) {
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'employee');
  const [organizationId, setOrganizationId] = useState(user?.organization_id || '');
  const [branchId, setBranchId] = useState(user?.branch_id || '');
  const [hrAccessLevel, setHrAccessLevel] = useState<HRAccessLevel>(user?.hr_access_level || 'full');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setRole(user.role || 'employee');
      setOrganizationId(user.organization_id || '');
      setBranchId(user.branch_id || '');
      setHrAccessLevel(user.hr_access_level || 'full');
    }
  }, [user]);

  const filteredBranches = organizationId 
    ? branches.filter(b => b.organization_id === organizationId)
    : branches;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on role
    if (role === 'manager' && !branchId) {
      return;
    }

    if (role === 'hr') {
      if (hrAccessLevel === 'organization' && !organizationId) {
        return;
      }
      if (hrAccessLevel === 'branch' && !branchId) {
        return;
      }
    }

    setIsSubmitting(true);
    
    await onSave(user.id, {
      name,
      role,
      organization_id: organizationId || null,
      branch_id: branchId || null,
      hr_access_level: role === 'hr' ? hrAccessLevel : null
    });
    
    setIsSubmitting(false);
  };

  const getRoleIcon = (r: string) => {
    switch (r) {
      case 'super_admin': return <Shield className="h-4 w-4" />;
      case 'hr': return <Building2 className="h-4 w-4" />;
      case 'manager': return <Users className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User: {user?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v: UserRole) => {
              setRole(v);
              if (v !== 'hr') {
                setHrAccessLevel('full');
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Super Admin
                  </div>
                </SelectItem>
                <SelectItem value="hr">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    HR Admin
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Store Login
                  </div>
                </SelectItem>
                <SelectItem value="employee">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Employee
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === 'hr' && (
            <div className="space-y-3">
              <Label>HR Access Level</Label>
              <div className="space-y-2">
                <Card
                  className={`p-3 cursor-pointer transition-all ${
                    hrAccessLevel === 'full' 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500' 
                      : 'hover:border-blue-300'
                  }`}
                  onClick={() => {
                    setHrAccessLevel('full');
                    setOrganizationId('');
                    setBranchId('');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500">Full HR</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Access all organizations and all branches
                  </p>
                </Card>

                <Card
                  className={`p-3 cursor-pointer transition-all ${
                    hrAccessLevel === 'organization' 
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-500' 
                      : 'hover:border-green-300'
                  }`}
                  onClick={() => {
                    setHrAccessLevel('organization');
                    setBranchId('');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">Organization Restricted</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Access only one organization and all branches under it
                  </p>
                </Card>

                <Card
                  className={`p-3 cursor-pointer transition-all ${
                    hrAccessLevel === 'branch' 
                      ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500' 
                      : 'hover:border-orange-300'
                  }`}
                  onClick={() => setHrAccessLevel('branch')}
                >
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500">Branch Restricted</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Access only one specific branch
                  </p>
                </Card>
              </div>

              {hrAccessLevel !== 'full' && (
                <Card className="p-3 border-amber-200 bg-amber-50">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-medium">Restricted HR Permissions:</p>
                      <ul className="list-disc ml-4 mt-1 space-y-0.5">
                        <li>Can onboard employees</li>
                        <li>Can upload documents</li>
                        <li>Cannot approve/sign contracts</li>
                        <li>Cannot access outside permitted area</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Organization Selection */}
          {((role === 'hr' && hrAccessLevel !== 'full') || role === 'manager' || role === 'employee') && (
            <div className="space-y-2">
              <Label htmlFor="organization">
                Organization {role === 'hr' && hrAccessLevel === 'organization' ? '*' : ''}
                {role === 'manager' ? '*' : ''}
              </Label>
              <Select 
                value={organizationId} 
                onValueChange={(v) => {
                  setOrganizationId(v);
                  setBranchId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Branch Selection */}
          {((role === 'hr' && hrAccessLevel === 'branch') || role === 'manager' || (role === 'employee' && organizationId)) && organizationId && (
            <div className="space-y-2">
              <Label htmlFor="branch">
                Branch {role === 'manager' || (role === 'hr' && hrAccessLevel === 'branch') ? '*' : ''}
              </Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {filteredBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {role === 'manager' && (
                <Card className="p-3 border-orange-200 bg-orange-50 mt-2">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-orange-800">
                      <p className="font-medium">Manager Restrictions:</p>
                      <ul className="list-disc ml-4 mt-1 space-y-0.5">
                        <li>Can only manage employees in this branch</li>
                        <li>Can onboard new employees</li>
                        <li>Cannot approve/sign contracts</li>
                        <li>Cannot access other branches</li>
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
