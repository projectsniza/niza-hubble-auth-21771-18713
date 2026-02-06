import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileCheck, Upload, Users, CheckCircle2, Clock, FileText } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import OnboardingApprovals from '@/components/onboarding/OnboardingApprovals';
import OnboardingManagement from '@/components/onboarding/OnboardingManagement';
import PostApprovalOnboarding from '@/components/onboarding/PostApprovalOnboarding';

interface ApprovedContract {
  id: string;
  employee_id: string;
  approved_at: string | null;
  employer_signed_date: string | null;
  signed_contract_path: string | null;
  contract_file_path: string | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    branch: { name: string } | null;
    organization: { name: string } | null;
  } | null;
}

function ApprovedContractsList({ onSelectEmployee }: { onSelectEmployee: (id: string) => void }) {
  const [contracts, setContracts] = useState<ApprovedContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedContracts();
  }, []);

  const fetchApprovedContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_approvals')
        .select(`
          id,
          employee_id,
          approved_at,
          employer_signed_date,
          signed_contract_path,
          contract_file_path,
          employee:employees!contract_approvals_employee_id_fkey(
            id,
            first_name,
            last_name,
            status,
            branch:branches(name),
            organization:organizations(name)
          )
        `)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (contract: ApprovedContract) => {
    const filePath = contract.signed_contract_path || contract.contract_file_path;
    if (!filePath) {
      toast.error('No contract file available');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      toast.error('Failed to download contract');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <NizaLoaderInline />
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p>No approved contracts yet</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Approved</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((contract) => (
          <TableRow key={contract.id}>
            <TableCell className="font-medium">
              {contract.employee?.first_name} {contract.employee?.last_name}
            </TableCell>
            <TableCell>{contract.employee?.organization?.name || '-'}</TableCell>
            <TableCell>{contract.employee?.branch?.name || '-'}</TableCell>
            <TableCell>
              {contract.approved_at 
                ? format(new Date(contract.approved_at), 'dd MMM yyyy')
                : '-'
              }
            </TableCell>
            <TableCell>
              {contract.employee?.status === 'active' ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Docs
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownload(contract)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                {contract.employee?.status !== 'active' && (
                  <Button 
                    size="sm"
                    onClick={() => onSelectEmployee(contract.employee_id)}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Continue
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OnboardingProgressTab() {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'progress' | 'approved'>('progress');

  if (selectedEmployee) {
    return (
      <PostApprovalOnboarding 
        employeeId={selectedEmployee} 
        onBack={() => setSelectedEmployee(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeSection === 'progress' ? 'default' : 'outline'}
          onClick={() => setActiveSection('progress')}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          In Progress
        </Button>
        <Button
          variant={activeSection === 'approved' ? 'default' : 'outline'}
          onClick={() => setActiveSection('approved')}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Approved Contracts
        </Button>
      </div>

      {activeSection === 'progress' ? (
        <OnboardingManagement />
      ) : (
        <Card>
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">Approved Contracts</h3>
            <p className="text-sm text-muted-foreground">Download contracts and complete remaining onboarding steps</p>
          </div>
          <ApprovedContractsList onSelectEmployee={setSelectedEmployee} />
        </Card>
      )}
    </div>
  );
}

export default function Onboarding() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('onboarding');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // Super Admin sees approval workflow + approved contracts
  if (user?.role === 'super_admin') {
    if (selectedEmployee) {
      return (
        <div className="p-8">
          <PostApprovalOnboarding 
            employeeId={selectedEmployee} 
            onBack={() => setSelectedEmployee(null)}
          />
        </div>
      );
    }

    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Onboarding</h1>
          <p className="text-muted-foreground">Manage employee onboarding and contracts</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="onboarding">Contract Approvals</TabsTrigger>
            <TabsTrigger value="contracts">Approved Contracts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="onboarding" className="mt-6">
            <OnboardingApprovals />
          </TabsContent>
          
          <TabsContent value="contracts" className="mt-6">
            <Card>
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Approved Contracts</h3>
                <p className="text-sm text-muted-foreground">Download contracts and complete remaining onboarding steps</p>
              </div>
              <ApprovedContractsList onSelectEmployee={setSelectedEmployee} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // HR and Store Accounts see management interface with embedded approved contracts
  if (user?.role === 'hr' || user?.role === 'manager') {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Onboarding</h1>
          <p className="text-muted-foreground">Manage employee onboarding and contracts</p>
        </div>
        
        <OnboardingProgressTab />
      </div>
    );
  }

  // Employees see their own onboarding status (future enhancement)
  return (
    <div className="p-8">
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Employee Onboarding</h2>
        <p className="text-muted-foreground">Access restricted to HR and Management roles</p>
      </div>
    </div>
  );
}