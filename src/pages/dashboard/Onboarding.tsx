import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileCheck, Upload, Users, CheckCircle2, Clock, FileText, Pencil, Trash2 } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import OnboardingApprovals from '@/components/onboarding/OnboardingApprovals';
import OnboardingManagement from '@/components/onboarding/OnboardingManagement';
import PostApprovalOnboarding from '@/components/onboarding/PostApprovalOnboarding';
import EditApprovedContractDialog from '@/components/onboarding/EditApprovedContractDialog';
import { buildCompleteContractPdf } from '@/lib/onboardingPdfs';
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

interface ApprovedContract {
  id: string;
  employee_id: string;
  approved_at: string | null;
  employer_signed_date: string | null;
  signed_contract_path: string | null;
  contract_file_path: string | null;
  contract_content?: any;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    address?: string | null;
    job_title?: string | null;
    join_date?: string | null;
    branch: { name: string } | null;
    organization: { name: string } | null;
  } | null;
}

function ApprovedContractsList({ onSelectEmployee }: { onSelectEmployee: (id: string) => void }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [editingContract, setEditingContract] = useState<ApprovedContract | null>(null);
  const [deletingContract, setDeletingContract] = useState<ApprovedContract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
          contract_content,
          employee:employees!contract_approvals_employee_id_fkey(
            id,
            first_name,
            last_name,
            status,
            address,
            job_title,
            join_date,
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

  const handleDeleteContract = async () => {
    if (!deletingContract) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('contract_approvals')
        .delete()
        .eq('id', deletingContract.id);
      if (error) throw error;
      toast.success('Approved contract deleted');
      setDeletingContract(null);
      fetchApprovedContracts();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete contract');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (contract: ApprovedContract) => {
    try {
      const doc = await buildCompleteContractPdf({
        contractData: contract.contract_content || {},
        employeeData: contract.employee || {},
        organizationData: contract.employee?.organization || {},
        branchData: contract.employee?.branch || {},
        approvalData: contract || {},
      });
      const empName = `${contract.employee?.first_name || ''}_${contract.employee?.last_name || ''}`.trim().replace(/\s+/g, '_') || 'Employee';
      doc.save(`Approved_Employment_Contract_${empName}.pdf`);
      toast.success('Complete approved contract downloaded');
    } catch (error: any) {
      console.error('Error generating contract PDF:', error);
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
    <>
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
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingContract(contract)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
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
                {isSuperAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeletingContract(contract)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    <EditApprovedContractDialog
      open={!!editingContract}
      onOpenChange={(open) => !open && setEditingContract(null)}
      contract={editingContract}
      onSaved={fetchApprovedContracts}
    />

    <AlertDialog open={!!deletingContract} onOpenChange={(open) => !open && setDeletingContract(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this approved contract?</AlertDialogTitle>
          <AlertDialogDescription>
            The signed contract record for {deletingContract?.employee?.first_name} {deletingContract?.employee?.last_name} will be removed and can no longer be viewed or downloaded. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteContract} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function OnboardingProgressTab() {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employeeId');
  const tabParam = searchParams.get('tab');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(empParam || null);

  useEffect(() => {
    if (empParam) {
      setSelectedEmployee(empParam);
    }
  }, [empParam]);
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
  const [activeTab, setActiveTab] = useState(tabParam === 'contracts' ? 'contracts' : 'onboarding');
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employeeId');
  const tabParam = searchParams.get('tab');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(empParam || null);

  useEffect(() => {
    if (empParam) {
      setSelectedEmployee(empParam);
    }
  }, [empParam]);

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