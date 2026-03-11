import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  UserPlus, Search, Upload, FileSignature, Users, 
  UserCog, Settings, FileCheck, FileUp, Trash2, PlayCircle, Loader2, Settings2
} from 'lucide-react';
import EmployeeList from '@/components/employees/EmployeeList';
import TeamManagement from '@/components/employees/TeamManagement';
import ContractApprovalsTab from '@/components/employees/ContractApprovalsTab';
import ApprovedContractsTab from '@/components/employees/ApprovedContractsTab';
import BulkUploadDialog from '@/components/employees/BulkUploadDialog';
import BulkUploadedEmployees from '@/components/employees/BulkUploadedEmployees';
import BulkUploadSettings from '@/components/employees/BulkUploadSettings';
import OnboardingSettings from '@/components/employees/OnboardingSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { toast } from 'sonner';

// Pending Accounts - shows only pending employee accounts
function PendingAccountsOnly() {
  const [pendingEmployees, setPendingEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activationData, setActivationData] = useState<{ employeeId: string; password: string } | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`id, first_name, last_name, email, job_title, organization_id, branch_id, account_activated, user_id, status, organization:organizations(name), branch:branches(name)`)
        .eq('account_activated', false)
        .is('user_id', null)
        .not('status', 'eq', 'terminated')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPendingEmployees(data || []);
    } catch (error: any) {
      toast.error('Failed to load pending accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateAccount = async (employee: any) => {
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: employee.email,
        password: activationData.password,
        options: {
          data: {
            name: `${employee.first_name} ${employee.last_name}`,
            role: 'employee',
            organization_id: employee.organization_id,
            branch_id: employee.branch_id,
          }
        }
      });
      if (authError) throw authError;

      if (authData.user) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ user_id: authData.user.id, account_activated: true, status: 'active' })
          .eq('id', employee.id);
        if (updateError) throw updateError;

        toast.success(`Account created for ${employee.first_name} ${employee.last_name}`);
        setActivationData(null);
        fetchPending();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account');
    } finally {
      setActivatingId(null);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><NizaLoaderInline /></div>;

  if (pendingEmployees.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Pending Accounts</h3>
        <p className="text-muted-foreground">All employee accounts have been activated</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Job Title</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingEmployees.map(emp => (
            <TableRow key={emp.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary/10 text-primary">{emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{emp.job_title || '-'}</TableCell>
              <TableCell>{emp.branch?.name || '-'}</TableCell>
              <TableCell><Badge variant="secondary">Account Pending</Badge></TableCell>
              <TableCell className="text-right">
                {activationData?.employeeId === emp.id ? (
                  <div className="flex items-center gap-2 justify-end">
                    <div className="space-y-1">
                      <Label htmlFor={`pw-${emp.id}`} className="text-xs">Set Password</Label>
                      <Input
                        id={`pw-${emp.id}`}
                        type="password"
                        placeholder="Min 6 characters"
                        value={activationData.password}
                        onChange={e => setActivationData({ ...activationData, password: e.target.value })}
                        className="h-8 text-sm w-40"
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setActivationData(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => handleActivateAccount(emp)} disabled={activatingId === emp.id}>
                      {activatingId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => handleActivateAccount(emp)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" />Create Account
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// Pending Onboardings - shows employees in onboarding
function PendingOnboardings() {
  const navigate = useNavigate();
  const [onboardingEmployees, setOnboardingEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchOnboarding();
  }, []);

  const fetchOnboarding = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`id, first_name, last_name, email, status, organization_id, branch_id, organization:organizations(name), branch:branches(name), onboarding:employee_onboarding(id, current_step, completed_at, contract_approved, contract_submitted_for_approval), contract_approval:contract_approvals(id, status)`)
        .in('status', ['onboarding', 'awaiting_signature', 'awaiting_approval'])
        .order('created_at', { ascending: false });
      if (error) {
        // Retry on transient errors
        if (retryCount < 2 && (error.message?.includes('fetch') || error.message?.includes('503'))) {
          await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
          return fetchOnboarding(retryCount + 1);
        }
        throw error;
      }
      // Filter out employees whose contract is submitted or approved
      const filtered = (data || []).filter(emp => {
        const onb = emp.onboarding?.[0];
        const ca = emp.contract_approval?.[0];
        if (onb?.contract_approved) return false;
        if (onb?.contract_submitted_for_approval) return false;
        if (ca?.status === 'pending' || ca?.status === 'approved') return false;
        return true;
      });
      setOnboardingEmployees(filtered);
    } catch (error: any) {
      console.error('Failed to load pending onboardings:', error);
      // Only show toast on final failure, not on every retry
      if (onboardingEmployees.length === 0) {
        toast.error('Failed to load pending onboardings. Please refresh the page.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Employee deleted');
      setDeleteId(null);
      fetchOnboarding();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStepLabel = (emp: any) => {
    const onb = emp.onboarding?.[0];
    if (!onb) return 'Not started';
    if (emp.status === 'awaiting_approval') return 'Awaiting Contract Approval';
    if (emp.status === 'awaiting_signature') return 'Awaiting Signature';
    return `Step ${onb.current_step || 1} of 3`;
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><NizaLoaderInline /></div>;

  if (onboardingEmployees.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Pending Onboardings</h3>
        <p className="text-muted-foreground">All employees have completed onboarding</p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {onboardingEmployees.map(emp => (
              <TableRow key={emp.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarFallback className="bg-amber-500/10 text-amber-600">{emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                      <p className="text-sm text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{emp.branch?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">{getStepLabel(emp)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" onClick={() => navigate(`/dashboard/onboarding/${emp.id}`)}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />Continue
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(emp.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this employee and all their onboarding data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Employees() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [activeTab, setActiveTab] = useState('employees');
  const { counts } = useNotificationCounts();

  useEffect(() => {
    if (user?.role === 'employee') {
      navigate('/dashboard/my-profile');
    }
  }, [user, navigate]);

  if (user?.role !== 'super_admin' && user?.role !== 'hr' && user?.role !== 'manager') {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">You don't have permission to access employee management</p>
        </div>
      </div>
    );
  }

  const handleBulkUploadSuccess = () => {
    setShowBulkUpload(false);
    setActiveTab('bulk-uploads');
  };

  const showContractApprovals = user?.role === 'super_admin';
  const showApprovedContracts = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';
  const showBulkUploads = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';
  const showBulkUploadSettings = user?.role === 'super_admin' || user?.role === 'hr';
  const showPendingAccounts = user?.role === 'super_admin' || user?.role === 'hr';
  const showOnboardingSettings = user?.role === 'super_admin' || user?.role === 'hr';

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Employee Hub</h2>
          <p className="text-muted-foreground mt-1">
            Manage employees, onboarding, teams, and settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search employees..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {(user?.role === 'super_admin' || user?.role === 'hr') && (
            <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
          )}
          <Button onClick={() => navigate('/dashboard/add-employee')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            All Employees
          </TabsTrigger>
          <TabsTrigger value="pending-onboarding" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Pending Onboardings
            {counts.pending_onboardings > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] ml-1">{counts.pending_onboardings}</Badge>
            )}
          </TabsTrigger>
          {showContractApprovals && (
            <TabsTrigger value="approvals" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Contract Approvals
              {counts.contract_approvals > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] ml-1">{counts.contract_approvals}</Badge>
              )}
            </TabsTrigger>
          )}
          {showApprovedContracts && (
            <TabsTrigger value="approved-contracts" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Approved Contracts
            </TabsTrigger>
          )}
          {showBulkUploads && (
            <TabsTrigger value="bulk-uploads" className="gap-2">
              <FileUp className="h-4 w-4" />
              Bulk Uploads
            </TabsTrigger>
          )}
          {showBulkUploadSettings && (
            <TabsTrigger value="bulk-upload-settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Bulk Upload Settings
            </TabsTrigger>
          )}
          <TabsTrigger value="teams" className="gap-2">
            <Users className="h-4 w-4" />
            Teams
          </TabsTrigger>
          {showPendingAccounts && (
            <TabsTrigger value="pending-accounts" className="gap-2">
              <UserCog className="h-4 w-4" />
              Pending Accounts
              {counts.pending_accounts > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px] ml-1">{counts.pending_accounts}</Badge>
              )}
            </TabsTrigger>
          )}
          {showOnboardingSettings && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Onboarding Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="space-y-4 mt-6">
          <EmployeeList searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="pending-onboarding" className="mt-6">
          <PendingOnboardings />
        </TabsContent>

        {showContractApprovals && (
          <TabsContent value="approvals" className="mt-6">
            <ContractApprovalsTab />
          </TabsContent>
        )}

        {showApprovedContracts && (
          <TabsContent value="approved-contracts" className="mt-6">
            <ApprovedContractsTab />
          </TabsContent>
        )}

        {showBulkUploads && (
          <TabsContent value="bulk-uploads" className="mt-6">
            <BulkUploadedEmployees />
          </TabsContent>
        )}

        {showBulkUploadSettings && (
          <TabsContent value="bulk-upload-settings" className="mt-6">
            <BulkUploadSettings />
          </TabsContent>
        )}

        <TabsContent value="teams" className="mt-6">
          <TeamManagement />
        </TabsContent>

        {showPendingAccounts && (
          <TabsContent value="pending-accounts" className="mt-6">
            <PendingAccountsOnly />
          </TabsContent>
        )}

        {showOnboardingSettings && (
          <TabsContent value="settings" className="mt-6">
            <OnboardingSettings />
          </TabsContent>
        )}
      </Tabs>

      <BulkUploadDialog 
        open={showBulkUpload} 
        onOpenChange={setShowBulkUpload}
        onSuccess={handleBulkUploadSuccess}
      />
    </div>
  );
}
