import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, Loader2, Upload, CheckCircle2, Clock, Eye, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import PostApprovalOnboarding from '@/components/onboarding/PostApprovalOnboarding';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ContractTemplate from '@/components/onboarding/ContractTemplate';

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
  const [contracts, setContracts] = useState<ApprovedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [viewingContract, setViewingContract] = useState<ApprovedContract | null>(null);
  const [viewEmployeeData, setViewEmployeeData] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);

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
    const filePath = contract.signed_contract_path || contract.contract_file_path;
    
    // Try to download from storage first
    if (filePath) {
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 60);

        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      } catch (error) {
        console.log('Storage file not found, generating PDF...');
      }
    }
    
    // Generate PDF if no file in storage
    if (contract.employee) {
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let y = 30;

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Employment Contract', pageWidth / 2, y, { align: 'center' });
        y += 15;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        // Employee details
        doc.text(`Employee: ${contract.employee.first_name} ${contract.employee.last_name}`, margin, y);
        y += 8;
        doc.text(`Organization: ${contract.employee.organization?.name || '-'}`, margin, y);
        y += 8;
        doc.text(`Branch: ${contract.employee.branch?.name || '-'}`, margin, y);
        y += 8;
        doc.text(`Job Title: ${contract.employee.job_title || '-'}`, margin, y);
        y += 8;
        doc.text(`Join Date: ${contract.employee.join_date || '-'}`, margin, y);
        y += 8;
        doc.text(`Address: ${contract.employee.address || '-'}`, margin, y);
        y += 15;

        // Approval info
        doc.setFont('helvetica', 'bold');
        doc.text('Contract Approval', margin, y);
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Approved Date: ${contract.approved_at ? format(new Date(contract.approved_at), 'dd MMM yyyy') : '-'}`, margin, y);
        y += 8;
        
        if (contract.employer_signature) {
          doc.text(`Employer Signed: ${contract.employer_signed_date ? format(new Date(contract.employer_signed_date), 'dd MMM yyyy') : 'Yes'}`, margin, y);
          y += 15;
          
          // Add signature
          if (contract.employer_signature_type === 'drawn' || contract.employer_signature_type === 'uploaded') {
            try {
              doc.addImage(contract.employer_signature, 'PNG', margin, y, 60, 20);
              y += 25;
            } catch {
              doc.setFont('helvetica', 'italic');
              doc.text(contract.employer_signature, margin, y);
              y += 8;
            }
          } else {
            doc.setFont('times', 'italic');
            doc.setFontSize(16);
            doc.text(contract.employer_signature, margin, y);
          }
        }

        // Save the PDF
        doc.save(`contract-${contract.employee.first_name}-${contract.employee.last_name}.pdf`);
        toast.success('Contract downloaded');
      } catch (error: any) {
        toast.error('Failed to generate contract PDF');
      }
    } else {
      toast.error('No contract data available');
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Approved Contracts</h3>
          <p className="text-sm text-muted-foreground">Download contracts and complete remaining onboarding steps</p>
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
                      onClick={() => handleViewContract(contract)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadFile(contract)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    {contract.employee?.status !== 'active' && (
                      <Button 
                        size="sm"
                        onClick={() => setSelectedEmployee(contract.employee_id)}
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
      </Card>

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
                employer_signed_date: viewingContract.employer_signed_date
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
