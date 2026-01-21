import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Shield, Building2, Users, User, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserRole, HRAccessLevel } from '@/types/database';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: { id: string; name: string }[];
  branches: { id: string; name: string; organization_id: string }[];
  onSuccess?: () => void;
}

export default function CreateUserDialog({ 
  open, 
  onOpenChange, 
  organizations, 
  branches,
  onSuccess 
}: CreateUserDialogProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [hrAccessLevel, setHrAccessLevel] = useState<HRAccessLevel>('full');
  const [organizationId, setOrganizationId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBranches = organizationId 
    ? branches.filter(b => b.organization_id === organizationId)
    : branches;

  const resetForm = () => {
    setStep(1);
    setEmail('');
    setName('');
    setPassword('');
    setRole('employee');
    setHrAccessLevel('full');
    setOrganizationId('');
    setBranchId('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!email || !name || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate based on role
    if (role === 'manager' && !branchId) {
      toast.error('Manager must be assigned to a branch');
      return;
    }

    if (role === 'hr') {
      if (hrAccessLevel === 'organization' && !organizationId) {
        toast.error('Organization-restricted HR must have an organization assigned');
        return;
      }
      if (hrAccessLevel === 'branch' && !branchId) {
        toast.error('Branch-restricted HR must have a branch assigned');
        return;
      }
    }

    if (role === 'employee' || role === 'manager') {
      if (!organizationId || !branchId) {
        toast.error(`${role === 'manager' ? 'Store Account' : 'Employee'} must be assigned to an organization and branch`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Store current session to restore after user creation
      const { data: currentSession } = await supabase.auth.getSession();
      const adminSession = currentSession?.session;
      
      // Create user with all data in metadata - the trigger will use these values
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: role,
            organization_id: organizationId || '',
            branch_id: branchId || '',
            hr_access_level: role === 'hr' ? hrAccessLevel : '',
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        const newUserId = authData.user.id;

        // CRITICAL: Restore the original session to prevent switching users
        if (adminSession) {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token
          });
        }

        // If creating an Employee user, ensure there is a linked employees row (required for leave requests, onboarding, etc.)
        if (role === 'employee' && organizationId && branchId) {
          const parts = name.trim().split(/\s+/);
          const firstName = parts[0] || name.trim();
          const lastName = parts.slice(1).join(' ') || '-';

          // Try to link an existing employee record (same email + org + branch)
          const { data: updatedEmployees, error: linkError } = await supabase
            .from('employees')
            .update({
              user_id: newUserId,
              account_activated: true,
              status: 'active',
            })
            .eq('email', email)
            .eq('organization_id', organizationId)
            .eq('branch_id', branchId)
            .is('user_id', null)
            .select('id')
            .limit(1);

          if (linkError) {
            console.warn('Could not link employee record:', linkError);
          }

          // If no existing employee row was linked, create one
          if (!linkError && (!updatedEmployees || updatedEmployees.length === 0)) {
            const { error: createEmpError } = await supabase
              .from('employees')
              .insert({
                first_name: firstName,
                last_name: lastName,
                email,
                organization_id: organizationId,
                branch_id: branchId,
                user_id: newUserId,
                account_activated: true,
                status: 'active',
              });

            if (createEmpError) {
              console.warn('Could not create employee record:', createEmpError);
            }
          }
        }

        toast.success('User created successfully');
        onSuccess?.();
        handleClose();
      }
    } catch (err: unknown) {
      console.error('Error creating user:', err);
      const message = err instanceof Error ? err.message : 'Failed to create user';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleIcon = (r: string) => {
    switch (r) {
      case 'super_admin': return <Shield className="h-5 w-5" />;
      case 'hr': return <Building2 className="h-5 w-5" />;
      case 'manager': return <Users className="h-5 w-5" />;
      default: return <User className="h-5 w-5" />;
    }
  };

  const getRoleDescription = (r: string) => {
    switch (r) {
      case 'super_admin': return 'Full platform control, contract signing, all approvals';
      case 'hr': return 'Employee management, onboarding, document uploads';
      case 'manager': return 'Branch management, team onboarding, limited approvals';
      case 'employee': return 'Self-service portal access only';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Step {step} of 2: {step === 1 ? 'Basic Information' : 'Role & Permissions'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
              <p className="text-xs text-muted-foreground">
                User will use this password to login
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Role *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['super_admin', 'hr', 'manager', 'employee'] as UserRole[]).map((r) => (
                  <Card
                    key={r}
                    className={`p-3 cursor-pointer transition-all ${
                      role === r 
                        ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => {
                      setRole(r);
                      if (r !== 'hr') {
                        setHrAccessLevel('full');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${role === r ? 'bg-primary text-white' : 'bg-muted'}`}>
                        {getRoleIcon(r)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {r === 'super_admin' ? 'Super Admin' : 
                           r === 'hr' ? 'HR Admin' : 
                           r === 'manager' ? 'Store Account' : 'Employee'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getRoleDescription(r)}
                    </p>
                  </Card>
                ))}
              </div>
            </div>

            {role === 'hr' && (
              <div className="space-y-3">
                <Label>HR Access Level *</Label>
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
                      Access all organizations and all branches under them
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
                      Access only one specific branch and employees in it
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

            {/* Organization Selection - Required for HR (non-full), Manager, and Employee */}
            {((role === 'hr' && hrAccessLevel !== 'full') || role === 'manager' || role === 'employee') && (
              <div className="space-y-2">
                <Label htmlFor="organization">
                  Organization *
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
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Branch Selection - Required for HR (branch level), Manager, and Employee */}
            {((role === 'hr' && hrAccessLevel === 'branch') || role === 'manager' || role === 'employee') && organizationId && (
              <div className="space-y-2">
                <Label htmlFor="branch">
                  Branch *
                </Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
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
                        <p className="font-medium">Store Account Restrictions:</p>
                        <ul className="list-disc ml-4 mt-1 space-y-0.5">
                          <li>Can only manage employees in this branch</li>
                          <li>Can onboard new employees</li>
                          <li>Can upload documents after approvals</li>
                          <li>Cannot approve/sign contracts</li>
                          <li>Cannot access other branches</li>
                        </ul>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={() => setStep(2)}
                disabled={!email || !name || !password}
              >
                Next: Role & Permissions
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}