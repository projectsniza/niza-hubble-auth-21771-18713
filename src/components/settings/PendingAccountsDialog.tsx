import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Building2, 
  Loader2, 
  UserPlus, 
  Mail,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';

interface PendingAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manager: any;
  onActivate?: () => void;
}

interface PendingEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  organization_id: string;
  branch_id: string;
  created_by: string | null;
  account_activated: boolean;
}

export default function PendingAccountsDialog({
  open,
  onOpenChange,
  manager,
  onActivate
}: PendingAccountsDialogProps) {
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activationData, setActivationData] = useState<{
    employeeId: string;
    password: string;
  } | null>(null);
  
  const { organizations } = useOrganizations();
  const { branches } = useBranches();

  useEffect(() => {
    if (open && manager) {
      fetchPendingEmployees();
    }
  }, [open, manager]);

  const fetchPendingEmployees = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, organization_id, branch_id, created_by, account_activated')
        .eq('branch_id', manager.branch_id)
        .eq('account_activated', false)
        .not('status', 'eq', 'terminated');

      if (error) throw error;
      setPendingEmployees(data || []);
    } catch (err) {
      console.error('Error fetching pending employees:', err);
      toast.error('Failed to load pending employees');
    } finally {
      setIsLoading(false);
    }
  };

  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Unknown';
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unknown';
  };

  const getAddedByName = (createdBy: string | null) => {
    if (!createdBy) return 'System';
    return 'HR/Manager';
  };

  const handleActivateAccount = async (employee: PendingEmployee) => {
    if (!activationData || activationData.employeeId !== employee.id) {
      setActivationData({ employeeId: employee.id, password: '' });
      return;
    }

    if (!activationData.password || activationData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setActivatingId(employee.id);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: employee.email,
        password: activationData.password,
        options: {
          data: {
            name: `${employee.first_name} ${employee.last_name}`,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update employee record with user_id and activated status
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            user_id: authData.user.id,
            account_activated: true,
            status: 'active'
          })
          .eq('id', employee.id);

        if (updateError) throw updateError;

        // Update user role to employee
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'employee' })
          .eq('user_id', authData.user.id);

        if (roleError) throw roleError;

        // Update profile with organization and branch
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            organization_id: employee.organization_id,
            branch_id: employee.branch_id
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        toast.success(`Account activated for ${employee.first_name} ${employee.last_name}`);
        setActivationData(null);
        fetchPendingEmployees();
        onActivate?.();
      }
    } catch (err: unknown) {
      console.error('Error activating account:', err);
      const message = err instanceof Error ? err.message : 'Failed to activate account';
      toast.error(message);
    } finally {
      setActivatingId(null);
    }
  };

  const cancelActivation = () => {
    setActivationData(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Pending Accounts - {manager?.name}
          </DialogTitle>
          <DialogDescription>
            Employees who have completed onboarding but don't have login credentials yet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pendingEmployees.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Accounts</h3>
              <p className="text-muted-foreground">
                All employees in this branch have activated accounts
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingEmployees.map((employee) => (
                <Card key={employee.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">
                            {employee.first_name} {employee.last_name}
                          </h3>
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending Activation
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {getOrganizationName(employee.organization_id)} / {getBranchName(employee.branch_id)}
                          </div>
                          <div>
                            Added by: {getAddedByName(employee.created_by)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {activationData?.employeeId === employee.id ? (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <div className="space-y-1">
                          <Label htmlFor={`password-${employee.id}`} className="text-xs">
                            Set Password
                          </Label>
                          <Input
                            id={`password-${employee.id}`}
                            type="password"
                            placeholder="Min 6 characters"
                            value={activationData.password}
                            onChange={(e) => setActivationData({
                              ...activationData,
                              password: e.target.value
                            })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelActivation}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleActivateAccount(employee)}
                            disabled={activatingId === employee.id}
                            className="flex-1"
                          >
                            {activatingId === employee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Confirm'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleActivateAccount(employee)}
                        className="gap-1"
                      >
                        <UserPlus className="h-4 w-4" />
                        Activate Account
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
