import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, Upload, CheckCircle2, Clock, Eye, Download, Search, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { buildCompleteContractPdf } from '@/lib/onboardingPdfs';
import PostApprovalOnboarding from '@/components/onboarding/PostApprovalOnboarding';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ContractTemplate from '@/components/onboarding/ContractTemplate';
import EditApprovedContractDialog from '@/components/onboarding/EditApprovedContractDialog';
import { useAuth } from '@/contexts/AuthContext';
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
import nizaLogo from '@/assets/niza-group-logo.png';

interface ApprovedContract {
  id: string;
  employee_id: string;
  approved_at: string | null;
  employer_signed_date: string | null;
  employer_signature: string | null;
  employer_signature_type: string | null;
  signed_contract_path: string | null;
  contract_file_path: string | null;
  contract_content: any | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    address: string | null;
    job_title: string | null;
    join_date: string | null;
    organization_id: string;
    branch_id: string;
    branch: { name: string } | null;
    organization: { name: string } | null;
  } | null;
}

export default function ApprovedContractsTab() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [editingContract, setEditingContract] = useState<ApprovedContract | null>(null);
  const [deletingContract, setDeletingContract] = useState<ApprovedContract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contracts, setContracts] = useState<ApprovedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [viewingContract, setViewingContract] = useState<ApprovedContract | null>(null);
  const [viewEmployeeData, setViewEmployeeData] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchApprovedContracts();
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    const { data } = await supabase.from('organizations').select('id, name');
    setOrganizations(data || []);
  };

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
          employer_signature,
          employer_signature_type,
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
            organization_id,
            branch_id,
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

  const handleViewContract = async (contract: ApprovedContract) => {
    if (contract.contract_content || contract.employee) {
      setViewEmployeeData(contract.employee);
      setViewingContract(contract);
    } else if (contract.signed_contract_path || contract.contract_file_path) {
      handleDownloadFile(contract);
    } else {
      toast.error('No contract available');
    }
  };

  const handleDownloadFile = async (contract: ApprovedContract) => {
    try {
      // Generate complete full 19-clause multi-page contract PDF
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
    } catch (err: any) {
      console.error('Error generating contract PDF:', err);
      toast.error('Failed to download contract PDF');
    }
  };

  if (selectedEmployee) {
    return (
      <PostApprovalOnboarding 
        employeeId={selectedEmployee} 
        onBack={() => {
          setSelectedEmployee(null);
          fetchApprovedContracts();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <NizaLoaderInline />
      </div>
    );
  }

  const filteredContracts = contracts.filter(contract => {
    if (!searchQuery.trim()) return true;
    const employee = contract.employee;
    if (!employee) return false;
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  if (contracts.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium">No approved contracts yet</p>
          <p className="text-sm">Contracts will appear here once approved by Super Admin</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="p-4 border-b space-y-3">
          <div>
            <h3 className="text-lg font-semibold">Approved Contracts</h3>
            <p className="text-sm text-muted-foreground">Download contracts and complete remaining onboarding steps</p>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
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
            {filteredContracts.map((contract) => (
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
                  {contract.signed_contract_path ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                      Signed Contract Attached
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400">
                      <Clock className="h-3 w-3 mr-1 text-amber-600" />
                      Awaiting Signed Upload
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {contract.employee?.status !== 'active' && (
                      <Button 
                        size="sm"
                        className="h-8 text-xs gap-1.5 font-medium"
                        onClick={() => setSelectedEmployee(contract.employee_id)}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Final Upload & Activate
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => handleViewContract(contract)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => handleDownloadFile(contract)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </Button>
                    {isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => setEditingContract(contract)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingContract(contract)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Super Admin: edit approved contract */}
      <EditApprovedContractDialog
        open={!!editingContract}
        onOpenChange={(open) => !open && setEditingContract(null)}
        contract={editingContract}
        onSaved={fetchApprovedContracts}
      />

      {/* Super Admin: delete approved contract */}
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

      {/* Contract View Dialog */}
      <Dialog open={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approved Contract</DialogTitle>
          </DialogHeader>
          {viewingContract && viewEmployeeData && (
            <ContractTemplate
              employeeId={viewingContract.employee_id}
              employeeData={{
                first_name: viewEmployeeData.first_name,
                last_name: viewEmployeeData.last_name,
                address: viewEmployeeData.address || '',
                job_title: viewEmployeeData.job_title || '',
                join_date: viewEmployeeData.join_date || '',
                organization_id: viewEmployeeData.organization_id,
                branch_id: viewEmployeeData.branch_id
              }}
              organizations={organizations}
              readOnly={true}
              isApprovalMode={false}
              contractApproval={{
                employer_signature: viewingContract.employer_signature,
                employer_signature_type: viewingContract.employer_signature_type,
                employer_signed_date: viewingContract.employer_signed_date,
                contract_content: viewingContract.contract_content
              }}
              onSave={() => {}}
              onSubmit={() => setViewingContract(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
