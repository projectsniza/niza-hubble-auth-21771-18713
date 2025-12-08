import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (user: {
    email: string;
    name: string;
    role: 'manager' | 'hr';
    password: string;
    organizationId?: string;
    branchId?: string;
  }) => void;
  organizations: any[];
}

export default function CreateUserDialog({ open, onOpenChange, onSubmit, organizations }: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'manager' | 'hr'>('manager');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');

  const selectedOrg = organizations.find(o => o.id === organizationId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      email,
      name,
      role,
      password,
      organizationId: organizationId || undefined,
      branchId: branchId || undefined,
    });
    // Reset form
    setEmail('');
    setName('');
    setRole('manager');
    setPassword('');
    setOrganizationId('');
    setBranchId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="user-name">Full Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>
          <div>
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <div>
            <Label htmlFor="user-role">Role</Label>
            <Select value={role} onValueChange={(value: 'manager' | 'hr') => setRole(value)}>
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === 'manager' && (
            <>
              <div>
                <Label htmlFor="user-org">Organization</Label>
                <Select value={organizationId} onValueChange={(value) => {
                  setOrganizationId(value);
                  setBranchId(''); // Reset branch when org changes
                }}>
                  <SelectTrigger id="user-org">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {organizationId && selectedOrg?.branches.length > 0 && (
                <div>
                  <Label htmlFor="user-branch">Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger id="user-branch">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedOrg.branches.map((branch: any) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
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
            <Button type="submit">Create User</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
