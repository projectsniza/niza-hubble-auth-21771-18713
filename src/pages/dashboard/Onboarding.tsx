import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileCheck, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import OnboardingApprovals from '@/components/onboarding/OnboardingApprovals';
import OnboardingManagement from '@/components/onboarding/OnboardingManagement';

interface ApprovedContract {
  id: string;
  employee_id: string;
  approved_at: string | null;
  employer_signed_date: string | null;
  signed_contract_path: string | null;
  contract_file_path: string | null;
  employee: {
    first_name: string;
    last_name: string;
    branch: { name: string } | null;
    organization: { name: string } | null;
  } | null;
}

function ApprovedContractsTab() {
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
            first_name,
            last_name,
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Approved Contracts</h2>
        <p className="text-muted-foreground">Download signed contracts for employees</p>
      </div>

      {contracts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileCheck className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">No approved contracts</h3>
              <p className="text-muted-foreground">Approved contracts will appear here</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Signed Date</TableHead>
                <TableHead>Approved At</TableHead>
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
                    {contract.employer_signed_date 
                      ? format(new Date(contract.employer_signed_date), 'dd MMM yyyy')
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {contract.approved_at 
                      ? format(new Date(contract.approved_at), 'dd MMM yyyy')
                      : '-'
                    }
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export default function Onboarding() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('onboarding');

  // Super Admin sees approval workflow + approved contracts
  if (user?.role === 'super_admin') {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Onboarding</h1>
          <p className="text-muted-foreground">Manage employee onboarding and contracts</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="onboarding">Pending Approvals</TabsTrigger>
            <TabsTrigger value="contracts">Approved Contracts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="onboarding" className="mt-6">
            <OnboardingApprovals />
          </TabsContent>
          
          <TabsContent value="contracts" className="mt-6">
            <ApprovedContractsTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // HR and Managers see management interface + approved contracts
  if (user?.role === 'hr' || user?.role === 'manager') {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Onboarding</h1>
          <p className="text-muted-foreground">Manage employee onboarding and contracts</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="onboarding">Onboarding Progress</TabsTrigger>
            <TabsTrigger value="contracts">Approved Contracts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="onboarding" className="mt-6">
            <OnboardingManagement />
          </TabsContent>
          
          <TabsContent value="contracts" className="mt-6">
            <ApprovedContractsTab />
          </TabsContent>
        </Tabs>
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