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
  const [role, setRole] = useState(user?.role || 'employee');
  const [organizationId, setOrganizationId] = useState(user?.organization_id || '');
  const [branchId, setBranchId] = useState(user?.branch_id || '');
  const [hrAccessLevel, setHrAccessLevel] = useState(user?.hr_access_level || 'full');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
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
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="hr">HR Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === 'hr' && (
            <div className="space-y-2">
              <Label htmlFor="hr-access">HR Access Level</Label>
              <Select value={hrAccessLevel} onValueChange={setHrAccessLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full (Entire Company)</SelectItem>
                  <SelectItem value="organization">Organization Level</SelectItem>
                  <SelectItem value="branch">Branch Level</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(role === 'hr' || role === 'manager' || role === 'employee') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Select value={organizationId} onValueChange={(v) => {
                  setOrganizationId(v);
                  setBranchId('');
                }}>
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

              {organizationId && (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
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
                </div>
              )}
            </>
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
