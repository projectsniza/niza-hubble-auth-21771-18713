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
    
    // Generate full contract PDF using contract_content
    if (contract.contract_content && contract.employee) {
      generateFullContractPDF(contract);
    } else if (contract.employee) {
      // Fallback to basic PDF if no contract_content
      generateBasicContractPDF(contract);
    } else {
      toast.error('No contract data available');
    }
  };

  const generateFullContractPDF = async (contract: ApprovedContract) => {
    const contractData = contract.contract_content;
    const orgName = contract.employee?.organization?.name || 'NIZA GROUP';
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    const headerHeight = 25;
    let y = headerHeight + 10;
    const lineHeight = 5;
    const sectionGap = 8;

    // Load logo image
    const loadLogoImage = (): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = nizaLogo;
      });
    };

    const logoDataUrl = await loadLogoImage();

    const addHeader = () => {
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 40, 10, 40, 12);
      }
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
    };

    addHeader();

    const addPage = () => {
      doc.addPage();
      addHeader();
      y = headerHeight + 10;
    };

    const checkPageBreak = (height: number) => {
      if (y + height > pageHeight - 20) {
        addPage();
      }
    };

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, indent: number = 0) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      checkPageBreak(lines.length * lineHeight);
      doc.text(lines, margin + indent, y);
      y += lines.length * lineHeight + 2;
    };

    const addSectionTitle = (title: string) => {
      checkPageBreak(12);
      y += 3;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 7;
    };

    const addSubTitle = (title: string) => {
      checkPageBreak(10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += 6;
    };

    // Page 1 - Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('THIS CONTRACT OF EMPLOYMENT', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`is made on ${contractData.contract_date || '…………………………………………………'}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // PARTIES
    addSectionTitle('PARTIES');
    addText(`1. ${orgName} a company incorporated in England and Wales (registered number ${contractData.registered_number || '________'}) whose registered office is at ${contractData.registered_office || '________________'} (the Employer); and`);
    y += 2;
    addText(`2. ${contractData.employee_name || contract.employee?.first_name + ' ' + contract.employee?.last_name} of ${contractData.employee_address || contract.employee?.address || '[                  ]'} (you).`);
    y += sectionGap;

    // THE PARTIES AGREE
    addSectionTitle('THE PARTIES AGREE:');

    // 1. Appointment
    addSectionTitle('1. Appointment');
    addText('1.1. The Employer will employ you on the terms and conditions set out in this contract.');
    addText(`1.2. Your employment with the Employer under this contract will commence on the date hereof ${contractData.commencement_date || '……………………….'} (The Commencement Date).`);
    addText('1.3. Your period of continuous employment with the Employer commenced on the Commencement Date, and no period of employment with any previous employer counts as part of your period of continuous employment with the Employer.');
    addText('1.4. You warrant to the Employer that you have the unconditional right to work in the U.K. Should this right be withdrawn, or should your status materially change, you agree to notify the Employer immediately. The Employer reserves the right to terminate your employment, with or without notice (as appropriate), should your right to work in the U.K. be withdrawn.');
    addText('1.5. Any misrepresentation of your employment status is a serious disciplinary offence which may result in your dismissal.');
    addText('1.6. The first 6 months of your employment will be a probationary period (the Probationary Period), during which the Employer will monitor your performance and conduct. The Employer will confirm your continued employment to you when you have completed your Probationary Period to the Employer\'s satisfaction. During the Probationary Period, either the Employer or you may terminate your employment by giving one week\'s notice.');

    // 2. Duties
    addSectionTitle('2. Duties');
    addText(`2.1. You will be employed as a ${contractData.job_title || '………………………….'} or in such other capacity as the Employer may from time to time reasonably direct.`);
    addText('2.2. In addition to your normal duties, you may be required to undertake alternative, additional, or ancillary duties from time to time or to transfer to another part of the business as the Employer may reasonably direct.');
    addText('2.3. Unless otherwise notified, you will report to the site manager (your Manager). The Employer may from time to time change your Manager.');

    // 3. Hours of work
    addSectionTitle('3. Hours of work');
    addText(`3.1. Your normal hours of work are ${contractData.hours_per_week || '……………….'} hours per week.`);
    addText('3.2. The Employer may vary your hours of work or the pattern of your normal hours, as it considers necessary to meet the needs of the business.');
    addText('3.3. You are required to work such additional hours as are deemed necessary by the Employer for the proper performance of your duties. You will not be entitled to any further remuneration for any such additional hours worked.');
    addText('3.4. If you are late for work this will result in you losing pay. The equivalent of one quarter of an hour\'s gross pay will be deducted in respect of each 15 minute period, or part thereof, for which you fail to attend. Persistent poor time-keeping may result in disciplinary action being taken against you.');
    addText('3.5. Subject to clauses 3.5.i. to iv. (inclusive) below, you will be entitled to a break during your hours of work on the basis set out below:');
    
    y += 3;
    doc.setFontSize(9);
    const breakData = [
      ['Less than 4 hours:', 'None'],
      ['4 < 6 hours:', '1x15mins unpaid'],
      ['6 < 7.5 hours:', '1x20mins unpaid'],
      ['7.5 or above:', '2x15mins unpaid, 1x30mins unpaid']
    ];
    breakData.forEach(([hours, breaks]) => {
      checkPageBreak(6);
      doc.text(`• ${hours} ${breaks}`, margin + 5, y);
      y += 5;
    });
    y += 3;

    // 4. Salary
    addSectionTitle('4. Salary');
    addText(`4.1. The Employer will pay you a salary at the rate of £${contractData.salary_rate || '……………………'} per hour (Salary).`);
    addText('4.2. All payments of Salary are subject to deductions for income tax and national insurance contributions and other authorised deductions or deductions required by law.');
    addText('4.3. You authorise the Employer at any time during your employment and/or on its termination to deduct any sums owed by you to the Employer at any time from your Salary and/or from any other sums due to you under this contract.');

    // 5. Place of work
    addSectionTitle('5. Place of work and mobility');
    addText(`Your normal place of work will be at ${contractData.place_of_work || '…………………………………………………….....................'}`);

    // 6. Holiday
    addSectionTitle('6. Holiday');
    addText(`6.1. You will be entitled to ${contractData.holiday_days || '…….'} days' paid holiday in each holiday year, which runs from 1st of April to 31st of March, excluding bank and public holidays which you normally work. Your holiday entitlement includes your statutory basic entitlement.`);
    addText('6.2. You acknowledge that the Employer trades on the usual bank holidays in England and Wales and that you may be scheduled to work in accordance with availability unless on Annual Leave.');
    addText('6.3. You must take all of your entitlement in the holiday year in which it accrues and carrying forward holiday is not permitted.');
    addText('6.4. You must give your Manager not less than 6 weeks\' written notice of your proposed holiday dates. Holidays are to be taken at such time or times as your Manager agrees.');
    addText('6.5. The Employer reserves the right to require you to take holidays on particular dates including during any notice period or garden leave.');
    addText('6.6. On termination of your employment, you will be paid in lieu of accrued but untaken holiday entitlement.');

    // 7. Sickness
    addSectionTitle('7. Sickness');
    addText('7.1. If you are absent from work for any reason, you must inform your Manager by no later than 9.30 am on the first day of absence. The reason for absence and the expected duration of the absence should be given.');
    addText('7.2. There is no pay for any absence due to illness or injury, other than statutory sick pay if you are eligible.');
    addText('7.3. At any time during your employment, you will, at the Employer\'s request, submit yourself to a medical examination by a medical practitioner nominated by the Employer.');

    // 8. Disciplinary and grievance matters
    addSectionTitle('8. Disciplinary and grievance matters');
    addText('8.1. You are subject to the Employer\'s disciplinary and grievance rules and procedures. Such rules and procedures do not form part of this contract.');
    addText('8.2. The Employer may, in its absolute discretion, suspend you in order to investigate any claim or allegation which it considers could constitute serious misconduct.');
    addText('8.3. If you wish to appeal against any disciplinary decision, your appeal must be made in writing.');
    addText('8.4. If you wish to raise a grievance, you may do so by writing.');
    addText('8.5. The following acts or omissions may result in disciplinary action being taken against you:');
    
    const disciplinaryItems = [
      '8.5.1. Failure or refusal to comply with a reasonable and lawful instruction given to you by a manager or supervisor.',
      '8.5.2. Unauthorised absence for a reason other than illness or injury.',
      '8.5.3. Poor time keeping',
      '8.5.4. Any act of theft or dishonesty',
      '8.5.5. Fighting',
      '8.5.6. Drinking or being under the influence of drink or drugs',
      '8.5.7. Smoking in or near the shop floor, forecourt, or stockroom',
      '8.5.8. Being impolite or discourteous to members of the public',
      '8.5.9. Being inappropriately dressed whilst on duty.',
      '8.5.10. Failure to follow the appropriate procedure in relation staff purchases from the store.'
    ];
    disciplinaryItems.forEach(item => {
      addText(item, 10, false, 5);
    });
    addText('This list is not exhaustive.', 10, false, 5);

    // 9. Grievance Procedure
    addSectionTitle('9. Grievance Procedure');
    addText('9.1. The object of the grievance procedure is to enable employees who consider they have a grievance or complaint arising from their employment with the Employer to have it dealt with at the nearest appropriate level within as short a time as possible.');
    addText('9.2. At all stages of the grievance procedure, you may be accompanied by a fellow worker or a trade union official of your choice.');
    
    addSubTitle('Informal Resolution');
    addText('In many cases grievances can be resolved informally without activating the formal procedure. Employees should aim to resolve grievances informally by either writing to or speaking with their line manager.');
    
    addSubTitle('Formal Procedure');
    addText('STEP 1: In the first instance all grievances must be submitted in writing to your Manager who will attempt to deal with the matter.');
    addText('STEP 2: Every opportunity will be given for your grievance to be stated and thoroughly discussed. You will be invited to attend a meeting.');
    addText('STEP 3: If you wish to appeal, you will be invited to a further meeting. This will be heard by a more senior manager. The decision is final.');

    // 10. Disciplinary Action
    addSectionTitle('10. Disciplinary Action');
    addText('10.1. If your grievance concerns the imposition of an oral or written disciplinary warning, you may use the grievance procedure to seek redress.');
    addText('10.5. The Employer requires good standards of discipline from its employees, together with satisfactory standards of work.');
    addText('10.6. The purpose of this procedure is to be corrective rather than punitive.');
    addText('10.7. If your standard of work or conduct falls, and, after warnings, remains below the level which is acceptable, you may be dismissed.');
    addText('10.8. Summary dismissal without notice will take place if an act of gross misconduct is committed.');

    // 11. Disciplinary Procedure
    addSectionTitle('11. Disciplinary Procedure');
    addText('11.1. The following stages in the disciplinary procedure are outlined below. The Employer reserves the right to activate any stage of the procedure where appropriate.');
    
    addSubTitle('STAGE 1 – Improvement Notice: Unsatisfactory Performance');
    addText('If your performance does not meet the acceptable standards expected by the Employer, you may normally be given an improvement notice.');
    
    addSubTitle('STAGE 2 – First Written Warning');
    addText('If your conduct does not meet acceptable standards you will normally be given a written warning.');
    
    addSubTitle('STAGE 3 – Second Written Warning');
    addText('If your conduct continues to fall below acceptable standards you may be given a second written warning.');
    
    addSubTitle('STAGE 4 – Final Written Warning');
    addText('If the offence is sufficiently serious, or there is a failure to improve during the currency of a prior warning, a final written warning may be given.');
    
    addSubTitle('STAGE 5 – Dismissal or Other Sanction');
    addText('If there is still a failure to improve, or where the conduct or performance is sufficiently serious, the final step in the procedure may be dismissal.');

    // 12. Appeals Procedure
    addSectionTitle('12. Appeals Procedure');
    addText('12.1. If you are dissatisfied with any disciplinary decision affecting you, you may appeal to your Manager within five working days of the disciplinary decision.');
    addText('12.2. Any appeal must be put in writing, stating the grounds for the appeal.');
    addText('12.3. You will be invited to attend an appeal meeting. A more senior manager will hear this where this is reasonably practicable.');
    addText('12.4. Within a reasonable period of time after the appeal meeting, you will be informed of the decision. The decision is final.');

    // 13. Pension
    addSectionTitle('13. Pension');
    addText('The Employer will comply with the employer pension duties concerning pension auto-enrolment in accordance with Part 1 of the Pensions Act 2008. Subject to your age and earnings level, you will be automatically enrolled into either a qualifying pension scheme or NEST.');

    // 14. Termination
    addSectionTitle('14. Termination of employment');
    addText('14.1. You may terminate your employment at any time on giving to the Employer not less than three weeks prior written notice.');
    addText('14.2. Nothing in this contract will prevent the Employer from terminating your employment, without notice, in a case of gross misconduct.');
    addText('14.3. The Employer may in its sole and absolute discretion terminate your employment at any time with immediate effect by making a payment to you in lieu of notice.');

    // 15. Data protection
    addSectionTitle('15. Data protection and monitoring');
    addText('15.1. You consent to the Employer processing personal data and sensitive personal data concerning you in its manual and computerised/automated filing systems internally and, so far as is reasonably necessary, externally.');
    addText('15.2. You consent to your personal data and sensitive personal data being transferred to and processed by: any Group Employer; professional advisors; any third-party providing services; HM Revenue and Customs or other authorities; and prospective purchasers.');
    addText('15.3. You consent to the Employer monitoring, intercepting, reading, and recording your telephone, email, and other electronic communications for monitoring purposes.');

    // 16. Variation
    addSectionTitle('16. Variation');
    addText('The Employer reserves the right to make reasonable changes to any of your terms and conditions of employment. Changes will be notified to you in writing before they come into force.');

    // 17. Policies
    addSectionTitle('17. Policies and Procedures');
    addText('You agree to comply with the rules, policies, and procedures of the Employer from time to time in force, although these do not form part of your contract of employment.');

    // 18. Collective Agreement
    addSectionTitle('18. Collective Agreement');
    addText('There is no collective agreement which directly affects your employment.');

    // 19. Entire agreement
    addSectionTitle('19. Entire agreement');
    addText('19.1. This contract is the entire agreement between you and the Employer in relation to its subject matter and replaces all previous agreements and arrangements.');
    addText('19.2. The information contained in this contract contains the particulars required for a written statement under Section 1 of the Employment Rights Act 1996.');

    // Signatures
    checkPageBreak(60);
    y += 10;
    addSectionTitle('AGREED by the parties');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('I agree to the above terms', margin, y);
    y += 10;
    doc.text('Signed: ...............................................', margin, y);
    y += 8;
    doc.text('Date: ...............................................', margin, y);
    y += 15;
    
    doc.text('Signed on behalf of the Employer', margin, y);
    y += 10;
    
    // Add employer signature if available
    if (contract.employer_signature) {
      if (contract.employer_signature_type === 'drawn' || contract.employer_signature_type === 'uploaded') {
        try {
          doc.addImage(contract.employer_signature, 'PNG', margin, y, 60, 20);
          y += 25;
        } catch {
          doc.setFont('times', 'italic');
          doc.setFontSize(14);
          doc.text(contract.employer_signature, margin, y);
          y += 8;
        }
      } else {
        doc.setFont('times', 'italic');
        doc.setFontSize(14);
        doc.text(contract.employer_signature, margin, y);
        y += 8;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Date: ${contract.employer_signed_date ? format(new Date(contract.employer_signed_date), 'dd MMM yyyy') : '...............................................'}`, margin, y);
    } else {
      doc.text('Signed: ...............................................', margin, y);
      y += 8;
      doc.text('Date: ...............................................', margin, y);
    }

    const employeeName = contractData.employee_name || `${contract.employee?.first_name}_${contract.employee?.last_name}`;
    doc.save(`Contract_${employeeName.replace(/\s/g, '_')}.pdf`);
    toast.success('Contract downloaded');
  };

  const generateBasicContractPDF = (contract: ApprovedContract) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 30;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Employment Contract', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Employee: ${contract.employee?.first_name} ${contract.employee?.last_name}`, margin, y);
    y += 8;
    doc.text(`Organization: ${contract.employee?.organization?.name || '-'}`, margin, y);
    y += 8;
    doc.text(`Branch: ${contract.employee?.branch?.name || '-'}`, margin, y);
    y += 8;
    doc.text(`Job Title: ${contract.employee?.job_title || '-'}`, margin, y);
    y += 8;
    doc.text(`Join Date: ${contract.employee?.join_date || '-'}`, margin, y);
    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.text('Contract Approval', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Approved Date: ${contract.approved_at ? format(new Date(contract.approved_at), 'dd MMM yyyy') : '-'}`, margin, y);

    doc.save(`contract-${contract.employee?.first_name}-${contract.employee?.last_name}.pdf`);
    toast.success('Contract downloaded');
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
