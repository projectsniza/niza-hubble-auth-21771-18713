import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, Send, PenTool, Upload, Type } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/contexts/AuthContext';
import nizaLogo from '@/assets/niza-group-logo.png';

interface ContractTemplateProps {
  employeeId: string;
  employeeData: {
    first_name: string;
    last_name: string;
    address?: string;
    job_title?: string;
    join_date?: string;
    organization_id: string;
    branch_id: string;
  };
  organizations: { id: string; name: string; vat_number?: string | null }[];
  onSave: () => void;
  onSubmit: () => void;
  readOnly?: boolean;
  isApprovalMode?: boolean;
  contractApproval?: any;
}

interface ContractData {
  contract_date: string;
  organization_id: string;
  registered_number: string;
  registered_office: string;
  vat_number: string;
  employee_name: string;
  employee_address: string;
  commencement_date: string;
  job_title: string;
  hours_per_week: string;
  salary_rate: string;
  salary_type: 'hourly' | 'annual';
  place_of_work: string;
  holiday_days: string;
}

export default function ContractTemplate({
  employeeId,
  employeeData,
  organizations,
  onSave,
  onSubmit,
  readOnly = false,
  isApprovalMode = false,
  contractApproval
}: ContractTemplateProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | 'uploaded'>('typed');
  const [typedSignature, setTypedSignature] = useState('');
  const [signatureDate, setSignatureDate] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [contractData, setContractData] = useState<ContractData>({
    contract_date: '',
    organization_id: employeeData.organization_id,
    registered_number: '',
    registered_office: '',
    vat_number: '',
    employee_name: `${employeeData.first_name} ${employeeData.last_name}`,
    employee_address: employeeData.address || '',
    commencement_date: employeeData.join_date || '',
    job_title: employeeData.job_title || '',
    hours_per_week: '',
    salary_rate: '',
    salary_type: 'hourly',
    place_of_work: '',
    holiday_days: ''
  });

  const selectedOrg = organizations.find(o => o.id === contractData.organization_id);

  // Auto-fill VAT number when organization changes
  useEffect(() => {
    if (selectedOrg?.vat_number && !contractData.vat_number) {
      setContractData(prev => ({ ...prev, vat_number: selectedOrg.vat_number || '' }));
    }
  }, [selectedOrg]);

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    if (contractApproval?.contract_content) {
      setContractData(prev => ({ ...prev, ...(contractApproval.contract_content as unknown as ContractData) }));
    } else {
      const { data } = await supabase
        .from('contract_approvals')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (data?.contract_content) {
        setContractData(prev => ({ ...prev, ...(data.contract_content as unknown as ContractData) }));
      }
    }
  };

  const updateField = (field: keyof ContractData, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('contract_approvals')
        .select('id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('contract_approvals')
          .update({ contract_content: contractData as any })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('contract_approvals')
          .insert({
            employee_id: employeeId,
            submitted_by: user?.id,
            contract_content: contractData as any,
            status: 'draft'
          } as any);
      }

      toast.success('Contract saved');
      onSave();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('contract_approvals')
        .select('id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('contract_approvals')
          .update({ 
            contract_content: contractData as any,
            status: 'pending',
            submitted_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('contract_approvals')
          .insert({
            employee_id: employeeId,
            submitted_by: user?.id,
            contract_content: contractData as any,
            status: 'pending',
            submitted_at: new Date().toISOString()
          } as any);
      }

      await supabase
        .from('employee_onboarding')
        .update({ contract_submitted_for_approval: true })
        .eq('employee_id', employeeId);

      await supabase
        .from('employees')
        .update({ status: 'waiting_approval' })
        .eq('id', employeeId);

      toast.success('Contract submitted for approval');
      onSubmit();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveContract = async () => {
    if (!typedSignature || !signatureDate) {
      toast.error('Please provide your signature and date');
      return;
    }

    setLoading(true);
    try {
      let signatureData = typedSignature;
      
      if (signatureType === 'drawn' && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL();
      }

      await supabase
        .from('contract_approvals')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          employer_signature: signatureData,
          employer_signature_type: signatureType,
          employer_signed_date: signatureDate
        })
        .eq('id', contractApproval?.id);

      await supabase
        .from('employee_onboarding')
        .update({ contract_approved: true })
        .eq('employee_id', employeeId);

      await supabase
        .from('employees')
        .update({ status: 'awaiting_signature' })
        .eq('id', employeeId);

      toast.success('Contract approved and signed');
      setShowSignatureDialog(false);
      onSubmit();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleDownloadPDF = async () => {
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

    // Add header with logo to current page
    const addHeader = () => {
      if (logoDataUrl) {
        // Add logo - positioned at top right, professional size
        const logoWidth = 40;
        const logoHeight = 12;
        doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - logoWidth, 10, logoWidth, logoHeight);
      }
      // Add subtle line under header
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
    };

    // Add header to first page
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
    
    addText(`1. ${selectedOrg?.name || '________________'} a company incorporated in England and Wales (registered number ${contractData.registered_number || '________'}) whose registered office is at ${contractData.registered_office || '________________'} (the Employer); and`);
    y += 2;
    addText(`2. ${contractData.employee_name || '[                  ]'} of ${contractData.employee_address || '[                                                                 ]'} (you).`);
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
    
    // Break table
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
    addText('4.3. You authorise the Employer at any time during your employment and/or on its termination to deduct any sums owed by you to the Employer at any time (to include, without limitation, the balance of salary, repayment of pay for holiday taken in excess of your accrued entitlement) from your Salary and/or from any other sums due to you under this contract.');

    // 5. Place of work
    addSectionTitle('5. Place of work and mobility');
    addText(`Your normal place of work will be at ${contractData.place_of_work || '…………………………………………………….....................'}`);

    // 6. Holiday
    addSectionTitle('6. Holiday');
    addText(`6.1. You will be entitled to ${contractData.holiday_days || '…….'} days' paid holiday in each holiday year, which runs from 1st of April to 31st of March, excluding bank and public holidays which you normally work. Your holiday entitlement includes your statutory basic entitlement. If your employment starts or finishes part way through the holiday year, your holiday entitlement during that year shall be calculated on a pro-rata basis rounded up to the nearest whole day.`);
    addText('6.2. You acknowledge that the Employer trades on the usual bank holidays in England and Wales and that you may be scheduled to work in accordance with availability unless on Annual Leave.');
    addText('6.3. You must take all of your entitlement in the holiday year in which it accrues and carrying forward holiday is not permitted.');
    addText('6.4. You must give your Manager not less than 6 weeks\' written notice of your proposed holiday dates. Holidays are to be taken at such time or times as your Manager agrees and your Manager may refuse a request having regard to the reasonable requirements of the business.');
    addText('6.5. The Employer reserves the right to require you to take holidays on particular dates including during any notice period or garden leave. You will be given reasonable notice of any such requirement.');
    addText('6.6. On termination of your employment, you will be paid in lieu of accrued but untaken holiday entitlement in respect of the holiday year in which your employment terminates.');

    // 7. Sickness
    addSectionTitle('7. Sickness');
    addText('7.1. If you are absent from work for any reason, you must inform your Manager by no later than 9.30 am on the first day of absence. The reason for absence and the expected duration of the absence should be given. If your absence from work is due to sickness or injury and continues for a period exceeding 7 consecutive days, you should provide your Manager with a Statement of Fitness for Work from your GP/other treating doctor as soon as possible after the 7th day of absence and weekly after that.');
    addText('7.2. There is no pay for any absence due to illness or injury, other than statutory sick pay if you are eligible.');
    addText('7.3. At any time during your employment, you will, at the Employer\'s request, submit yourself to a medical examination by a medical practitioner nominated by the Employer. You authorise any nominated practitioner to disclose to the Employer the results of any such examination.');

    // 8. Disciplinary and grievance matters
    addSectionTitle('8. Disciplinary and grievance matters');
    addText('8.1. You are subject to the Employer\'s disciplinary and grievance rules and procedures. Such rules and procedures do not form part of this contract and may be altered or added to from time to time.');
    addText('8.2. The Employer may, in its absolute discretion, suspend you in order to investigate any claim or allegation which it considers could constitute serious misconduct.');
    addText('8.3. If you wish to appeal against any disciplinary decision or decision to dismiss you, your appeal must be made in writing, and you should set out in detail the reasons for your appeal.');
    addText('8.4. If you wish to raise a grievance, you may do so by writing. You should set out in detail the circumstances of your complaint.');
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
      '8.5.9. Being inappropriately dressed whilst on duty. You should be clean and tidy.',
      '8.5.10. Failure to follow the appropriate procedure in relation staff purchases from the store.'
    ];
    disciplinaryItems.forEach(item => {
      addText(item, 10, false, 5);
    });
    addText('This list is not exhaustive.', 10, false, 5);

    // 9. Grievance Procedure
    addSectionTitle('9. Grievance Procedure');
    addText('9.1. The object of the grievance procedure is to enable employees who consider they have a grievance or complaint arising from their employment with the Employer to have it dealt with at the nearest appropriate level within as short a time as possible.');
    addText('9.2. At all stages of the grievance procedure, you may be accompanied by a fellow worker or a trade union official of your choice. Each step of the grievance procedure will be processed without unreasonable delay.');
    
    addSubTitle('Informal Resolution');
    addText('In many cases grievances can be resolved informally without activating the formal procedure. Employees should aim to resolve grievances informally by either writing to or speaking with their line manager or the person responsible for causing the grievance to arise.');
    
    addSubTitle('Formal Procedure');
    addText('STEP 1: In the first instance all grievances must be submitted in writing to your Manager who will attempt to deal with the matter after making such consultations as are necessary.');
    addText('STEP 2: Every opportunity will be given for your grievance to be stated and thoroughly discussed. You will be invited to attend a meeting to discuss your grievance and have the right to be accompanied by a union representative or workplace colleague.');
    addText('STEP 3: If you wish to appeal, you will be invited to a further meeting. This will be heard by a more senior manager where this is reasonably practicable. After the appeal meeting, you will be informed of the Employer\'s decision. This decision is final.');

    // 10. Disciplinary Action
    addSectionTitle('10. Disciplinary Action');
    addText('10.1. If your grievance concerns the imposition of an oral or written disciplinary warning, you may use the grievance procedure to seek redress rather than appealing under the Employer\'s disciplinary procedure.');
    addText('10.5. The Employer requires good standards of discipline from its employees, together with satisfactory standards of work.');
    addText('10.6. The purpose of this procedure is to be corrective rather than punitive.');
    addText('10.7. If your standard of work or conduct falls, and, after warnings, remains below the level which is acceptable, you may be dismissed.');
    addText('10.8. Summary dismissal without notice will take place if an act of gross misconduct is committed.');

    // 11. Disciplinary Procedure
    addSectionTitle('11. Disciplinary Procedure');
    addText('11.1. The following stages in the disciplinary procedure are outlined below. The Employer reserves the right to activate any stage of the procedure where appropriate.');
    
    addSubTitle('STAGE 1 – Improvement Notice: Unsatisfactory Performance');
    addText('If your performance does not meet the acceptable standards expected by the Employer, you may normally be given an improvement notice. A record of the improvement notice will remain live for 12 months, subject to satisfactory performance.');
    
    addSubTitle('STAGE 2 – First Written Warning');
    addText('If your conduct does not meet acceptable standards you will normally be given a written warning. A record of the warning will be kept on file, and will be disregarded for disciplinary purposes after 12 months.');
    
    addSubTitle('STAGE 3 – Second Written Warning');
    addText('If your conduct continues to fall below acceptable standards you may be given a second written warning.');
    
    addSubTitle('STAGE 4 – Final Written Warning');
    addText('If the offence is sufficiently serious, or there is a failure to improve during the currency of a prior warning, a final written warning may be given to the employee.');
    
    addSubTitle('STAGE 5 – Dismissal or Other Sanction');
    addText('If there is still a failure to improve, or where the conduct or performance is sufficiently serious, the final step in the procedure may be dismissal or some other action short of dismissal.');

    // 12. Appeals Procedure
    addSectionTitle('12. Appeals Procedure');
    addText('12.1. If you are dissatisfied with any disciplinary decision affecting you, you may appeal to your Manager within five working days of the disciplinary decision.');
    addText('12.2. Any appeal must be put in writing, stating the grounds for the appeal and including any documentation or evidence relied upon in support.');
    addText('12.3. You will be invited to attend an appeal meeting. A more senior manager will hear this where this is reasonably practicable.');
    addText('12.4. Within a reasonable period of time after the appeal meeting, you will be informed of the decision. The decision of the manager hearing the appeal is final.');

    // 13. Pension
    addSectionTitle('13. Pension');
    addText('The Employer will comply with the employer pension duties concerning pension auto-enrolment in accordance with Part 1 of the Pensions Act 2008. Subject to your age and earnings level, you will be automatically enrolled into either a qualifying pension scheme or the National Employment Savings Trusts ("NEST") whichever the Employer chooses. You can decide to opt out of auto-enrolment.');

    // 14. Termination
    addSectionTitle('14. Termination of employment');
    addText('14.1. You may terminate your employment at any time on giving to the Employer not less than three weeks prior written notice and the Employer may terminate your employment at any time on giving you the statutory minimum notice.');
    addText('14.2. Nothing in this contract will prevent the Employer from terminating your employment, without notice or payment in lieu of notice, in a case of gross misconduct justifying summary dismissal without notice.');
    addText('14.3. The Employer may in its sole and absolute discretion terminate your employment at any time with immediate effect by making a payment to you in lieu of notice.');

    // 15. Data protection
    addSectionTitle('15. Data protection and monitoring');
    addText('15.1. You consent to the Employer processing personal data and sensitive personal data (as defined in the Data Protection Act 1998) concerning you in its manual and computerised/automated filing systems internally and, so far as is reasonably necessary, externally.');
    addText('15.2. You consent to your personal data and sensitive personal data being transferred to and processed by: any Group Employer; professional advisors; any third-party providing services; HM Revenue and Customs or other authorities; and prospective purchasers of all or any part of the Employer\'s business.');
    addText('15.3. You consent to the Employer monitoring, intercepting, reading, and recording your telephone, email, and other electronic communications for the purpose of monitoring and recording to establish facts, to establish compliance with regulatory procedures, to prevent or detect crime, or to investigate or detect the unauthorised use of the Employer\'s systems.');

    // 16. Variation
    addSectionTitle('16. Variation');
    addText('The Employer reserves the right to make reasonable changes to any of your terms and conditions of employment. Changes to your terms and conditions of employment will be notified to you in writing before the date upon which they come into force.');

    // 17. Policies
    addSectionTitle('17. Policies and Procedures');
    addText('You agree to comply with the rules, policies, and procedures of the Employer from time to time in force, although these do not form part of your contract of employment (unless stated otherwise).');

    // 18. Collective Agreement
    addSectionTitle('18. Collective Agreement');
    addText('There is no collective agreement which directly affects your employment.');

    // 19. Entire agreement
    addSectionTitle('19. Entire agreement');
    addText('19.1. This contract is the entire agreement between you and the Employer in relation to its subject matter and replaces all previous agreements and arrangements (whether written or oral, express, or implied) relating to your employment by the Employer.');
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
    doc.text('Signed: ...............................................', margin, y);
    y += 8;
    doc.text('Date: ...............................................', margin, y);

    doc.save(`Contract_${contractData.employee_name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  // Editable field component
  const EditableField = ({ label, value, field, type = 'text', placeholder }: { 
    label: string; 
    value: string; 
    field: keyof ContractData; 
    type?: string;
    placeholder?: string;
  }) => (
    <span className="inline-flex items-center gap-1">
      {readOnly ? (
        <span className="border-b border-dotted border-foreground min-w-[100px] px-1">
          {value || '………………………'}
        </span>
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => updateField(field, e.target.value)}
          className="inline-block w-auto min-w-[120px] h-7 text-sm border-b border-dotted rounded-none px-1 py-0"
          placeholder={placeholder || '………………………'}
        />
      )}
    </span>
  );

  return (
    <div className="space-y-6">
      <Card className="p-8 print:shadow-none max-w-4xl mx-auto text-sm leading-relaxed">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={nizaLogo} alt="Logo" className="h-16 mx-auto mb-6" />
          <h1 className="text-xl font-bold uppercase">THIS CONTRACT OF EMPLOYMENT</h1>
          <p className="mt-4">
            is made on{' '}
            <EditableField label="Contract Date" value={contractData.contract_date} field="contract_date" type="date" />
          </p>
        </div>

        {/* PARTIES */}
        <section className="mb-6">
          <h2 className="font-bold text-base mb-4">PARTIES</h2>
          <div className="space-y-4">
            <p>
              1.{' '}
              {readOnly ? (
                <span>{selectedOrg?.name || '________________'}</span>
              ) : (
                <Select
                  value={contractData.organization_id}
                  onValueChange={(v) => updateField('organization_id', v)}
                >
                  <SelectTrigger className="inline-flex w-auto min-w-[200px] h-7">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {' '}a company incorporated in England and Wales (registered number{' '}
              <EditableField label="Registered Number" value={contractData.registered_number} field="registered_number" placeholder="04914942" />
              ){contractData.vat_number && ` (VAT: ${contractData.vat_number})`} whose registered office is at{' '}
              {readOnly ? (
                <span className="border-b border-dotted">{contractData.registered_office || '________________'}</span>
              ) : (
                <Textarea
                  value={contractData.registered_office}
                  onChange={(e) => updateField('registered_office', e.target.value)}
                  className="inline-block w-full h-12 text-sm mt-1"
                  placeholder="15 The Gallop, Sutton, Surrey, SM2 5RU"
                />
              )}
              {' '}(the Employer); and
            </p>
            <p>
              2.{' '}
              <EditableField label="Employee Name" value={contractData.employee_name} field="employee_name" />
              {' '}of{' '}
              <EditableField label="Employee Address" value={contractData.employee_address} field="employee_address" />
              {' '}(you).
            </p>
          </div>
        </section>

        {/* THE PARTIES AGREE */}
        <section className="mb-6">
          <h2 className="font-bold text-base mb-4">THE PARTIES AGREE:</h2>

          {/* 1. Appointment */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">1. Appointment</h3>
            <p className="mb-2">1.1. The Employer will employ you on the terms and conditions set out in this contract.</p>
            <p className="mb-2">
              1.2. Your employment with the Employer under this contract will commence on the date hereof{' '}
              <EditableField label="Commencement Date" value={contractData.commencement_date} field="commencement_date" type="date" />
              {' '}(The Commencement Date).
            </p>
            <p className="mb-2">1.3. Your period of continuous employment with the Employer commenced on the Commencement Date, and no period of employment with any previous employer counts as part of your period of continuous employment with the Employer.</p>
            <p className="mb-2">1.4. You warrant to the Employer that you have the unconditional right to work in the U.K. Should this right be withdrawn, or should your status materially change, you agree to notify the Employer immediately. The Employer reserves the right to terminate your employment, with or without notice (as appropriate), should your right to work in the U.K. be withdrawn.</p>
            <p className="mb-2">1.5. Any misrepresentation of your employment status is a serious disciplinary offence which may result in your dismissal.</p>
            <p className="mb-2">1.6. The first 6 months of your employment will be a probationary period (the Probationary Period), during which the Employer will monitor your performance and conduct. The Employer will confirm your continued employment to you when you have completed your Probationary Period to the Employer's satisfaction. During the Probationary Period, either the Employer or you may terminate your employment by giving one week's notice.</p>
          </div>

          {/* 2. Duties */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">2. Duties</h3>
            <p className="mb-2">
              2.1. You will be employed as a{' '}
              <EditableField label="Job Title" value={contractData.job_title} field="job_title" />
              {' '}or in such other capacity as the Employer may from time to time reasonably direct.
            </p>
            <p className="mb-2">2.2. In addition to your normal duties, you may be required to undertake alternative, additional, or ancillary duties from time to time or to transfer to another part of the business as the Employer may reasonably direct.</p>
            <p className="mb-2">2.3. Unless otherwise notified, you will report to the site manager (your Manager). The Employer may from time to time change your Manager.</p>
          </div>

          {/* 3. Hours of work */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">3. Hours of work</h3>
            <p className="mb-2">
              3.1. Your normal hours of work are{' '}
              <EditableField label="Hours per week" value={contractData.hours_per_week} field="hours_per_week" placeholder="40" />
              {' '}hours per week.
            </p>
            <p className="mb-2">3.2. The Employer may vary your hours of work or the pattern of your normal hours, as it considers necessary to meet the needs of the business.</p>
            <p className="mb-2">3.3. You are required to work such additional hours as are deemed necessary by the Employer for the proper performance of your duties. You will not be entitled to any further remuneration for any such additional hours worked.</p>
            <p className="mb-2">3.4. If you are late for work this will result in you losing pay. The equivalent of one quarter of an hour's gross pay will be deducted in respect of each 15 minute period, or part thereof, for which you fail to attend. Persistent poor time-keeping may result in disciplinary action being taken against you.</p>
            <p className="mb-2">3.5. Subject to clauses 3.5.i. to iv. (inclusive) below, you will be entitled to a break during your hours of work on the basis set out below:</p>
            <div className="ml-6 my-2 space-y-1">
              <p>• Less than 4 hours: None</p>
              <p>• 4 &lt; 6 hours: 1x15mins unpaid</p>
              <p>• 6 &lt; 7.5 hours: 1x20mins unpaid</p>
              <p>• 7.5 or above: 2x15mins unpaid, 1x30mins unpaid</p>
            </div>
          </div>

          {/* 4. Salary */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">4. Salary</h3>
            <p className="mb-2">
              4.1. The Employer will pay you a salary at the rate of £
              <EditableField label="Salary Rate" value={contractData.salary_rate} field="salary_rate" placeholder={contractData.salary_type === 'annual' ? '25000' : '12.50'} />
              {' '}per{' '}
              {readOnly ? (
                <span>{contractData.salary_type === 'annual' ? 'annum' : 'hour'}</span>
              ) : (
                <Select
                  value={contractData.salary_type}
                  onValueChange={(v) => updateField('salary_type', v)}
                >
                  <SelectTrigger className="inline-flex w-auto min-w-[100px] h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">hour</SelectItem>
                    <SelectItem value="annual">annum</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {' '}(Salary).
            </p>
            <p className="mb-2">4.2. All payments of Salary are subject to deductions for income tax and national insurance contributions and other authorised deductions or deductions required by law.</p>
            <p className="mb-2">4.3. You authorise the Employer at any time during your employment and/or on its termination to deduct any sums owed by you to the Employer at any time (to include, without limitation, the balance of salary, repayment of pay for holiday taken in excess of your accrued entitlement) from your Salary and/or from any other sums due to you under this contract.</p>
          </div>

          {/* 5. Place of work */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">5. Place of work and mobility</h3>
            <p>
              Your normal place of work will be at{' '}
              {readOnly ? (
                <span className="border-b border-dotted">{contractData.place_of_work || '………………………………………………………'}</span>
              ) : (
                <Textarea
                  value={contractData.place_of_work}
                  onChange={(e) => updateField('place_of_work', e.target.value)}
                  className="w-full h-12 text-sm mt-1"
                  placeholder="Enter workplace address"
                />
              )}
            </p>
          </div>

          {/* 6. Holiday */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">6. Holiday</h3>
            <p className="mb-2">
              6.1. You will be entitled to{' '}
              <EditableField label="Holiday Days" value={contractData.holiday_days} field="holiday_days" placeholder="28" />
              {' '}days' paid holiday in each holiday year, which runs from 1st of April to 31st of March, excluding bank and public holidays which you normally work. Your holiday entitlement includes your statutory basic entitlement. If your employment starts or finishes part way through the holiday year, your holiday entitlement during that year shall be calculated on a pro-rata basis rounded up to the nearest whole day.
            </p>
            <p className="mb-2">6.2. You acknowledge that the Employer trades on the usual bank holidays in England and Wales and that you may be scheduled to work in accordance with availability unless on Annual Leave.</p>
            <p className="mb-2">6.3. You must take all of your entitlement in the holiday year in which it accrues and carrying forward holiday is not permitted.</p>
            <p className="mb-2">6.4. You must give your Manager not less than 6 weeks' written notice of your proposed holiday dates. Holidays are to be taken at such time or times as your Manager agrees and your Manager may refuse a request having regard to the reasonable requirements of the business for example, if someone in a similar position to you has already booked your requested holiday dates.</p>
            <p className="mb-2">6.5. The Employer reserves the right to require you to take holidays on particular dates including during any notice period or garden leave. You will be given reasonable notice of any such requirement, which may be less than is required under statute.</p>
            <p className="mb-2">6.6. On termination of your employment, you will be paid in lieu of accrued but untaken holiday entitlement in respect of the holiday year in which your employment terminates. You will be required to pay the Employer for holiday taken in excess of your accrued entitlement on termination.</p>
          </div>

          {/* 7. Sickness */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">7. Sickness</h3>
            <p className="mb-2">7.1. If you are absent from work for any reason, you must inform your Manager by no later than 9.30 am on the first day of absence. The reason for absence and the expected duration of the absence should be given. If your absence from work is due to sickness or injury and continues for a period exceeding 7 consecutive days, you should provide your Manager with a Statement of Fitness for Work from your GP/other treating doctor as soon as possible after the 7th day of absence and weekly after that. You must keep your Manager informed on a regular basis of your progress and the date of your expected return to work.</p>
            <p className="mb-2">7.2. There is no pay for any absence due to illness or injury, other than statutory sick pay if you are eligible.</p>
            <p className="mb-2">7.3. At any time during your employment, you will, at the Employer's request, submit yourself to a medical examination by a medical practitioner nominated by the Employer. You authorise any nominated practitioner to disclose to the Employer the results of any such examination, your prognosis, your likely recovery time and/or fitness to return to work and any recommended treatment and to discuss it with the Employer. The Employer will pay all expenses associated with any such examination. The Employer reserves the right to postpone your return to work after a period of absence until it has received a report from a medical practitioner confirming that you are fit to return.</p>
          </div>

          {/* 8. Disciplinary and grievance matters */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">8. Disciplinary and grievance matters</h3>
            <p className="mb-2">8.1. You are subject to the Employer's disciplinary and grievance rules and procedures. Such rules and procedures do not form part of this contract and may be altered or added to from time to time.</p>
            <p className="mb-2">8.2. The Employer may, in its absolute discretion, suspend you in order to investigate any claim or allegation which it considers could constitute serious misconduct, where relationships have broken down, where the Employer has any grounds to consider that its property or responsibilities to other parties are at risk, and/or where the Employer considers that your continued presence at the Employer's premises could hinder an investigation. Any such suspension is without prejudice to the Employer's right to subsequently terminate your employment on the same or any other ground and will last no longer than is necessary to carry out any inquiry or investigation into the circumstances and to hold any appropriate disciplinary hearings.</p>
            <p className="mb-2">8.3. If you wish to appeal against any disciplinary decision or decision to dismiss you, your appeal must be made in writing, and you should set out in detail the reasons for your appeal.</p>
            <p className="mb-2">8.4. If you wish to raise a grievance, you may do so by writing. You should set out in detail the circumstances of your complaint.</p>
            <p className="mb-2">8.5. The following acts or omissions may result in disciplinary action being taken against you:</p>
            <div className="ml-6 space-y-1">
              <p>8.5.1. Failure or refusal to comply with a reasonable and lawful instruction given to you by a manager or supervisor.</p>
              <p>8.5.2. Unauthorised absence for a reason other than illness or injury.</p>
              <p>8.5.3. Poor time keeping</p>
              <p>8.5.4. Any act of theft or dishonesty</p>
              <p>8.5.5. Fighting</p>
              <p>8.5.6. Drinking or being under the influence of drink or drugs</p>
              <p>8.5.7. Smoking in or near the shop floor, forecourt, or stockroom</p>
              <p>8.5.8. Being impolite or discourteous to members of the public</p>
              <p>8.5.9. Being inappropriately dressed whilst on duty. You should be clean and tidy.</p>
              <p>8.5.10. Failure to follow the appropriate procedure in relation staff purchases from the store. If you wish to purchase goods from your store you should ensure that:</p>
              <div className="ml-6">
                <p>8.5.10.1. You are served by your immediate manager or supervisor</p>
                <p>8.5.10.2. You pay for the goods immediately; and</p>
                <p>8.5.10.3. You obtain and retain a receipt for the goods</p>
              </div>
            </div>
            <p className="ml-6 mt-2">This list is not exhaustive.</p>
          </div>

          {/* 9. Grievance Procedure */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">9. Grievance Procedure</h3>
            <p className="mb-2">9.1. The object of the grievance procedure is to enable employees who consider they have a grievance or complaint arising from their employment with the Employer to have it dealt with at the nearest appropriate level within as short a time as possible. Anyone wishing to use this procedure can do so freely and without prejudice to his/her position in the Employer. It applies to all employees, irrespective of job or grade.</p>
            <p className="mb-2">9.2. At all stages of the grievance procedure, you may be accompanied by a fellow worker or a trade union official of your choice. Each step of the grievance procedure will be processed without unreasonable delay.</p>
            <h4 className="font-semibold mt-4 mb-2">Informal Resolution</h4>
            <p className="mb-2">In many cases grievances can be resolved informally without activating the formal procedure. Employees should aim to resolve grievances informally by either writing to or speaking with their line manager or the person responsible for causing the grievance to arise. There is of course no obligation for an employee to use the informal procedure. By seeking to resolve grievances on an informal basis, this will often allow for problems to be resolved quickly. If the employee considers that the nature of the grievance is such that it cannot be resolved informally, or if the informal process does not resolve the issue, then the formal procedure should be used.</p>
            <h4 className="font-semibold mt-4 mb-2">Formal Procedure</h4>
            <p className="mb-2"><strong>STEP 1:</strong> In the first instance all grievances must be submitted in writing to your Manager who will attempt to deal with the matter after making such consultations as are necessary. Employees are expected to submit the full details of their grievance in writing and any documents relied upon in support to their employer at the earliest opportunity.</p>
            <p className="mb-2"><strong>STEP 2:</strong> Every opportunity will be given for your grievance to be stated and thoroughly discussed. You will be invited to attend a meeting to discuss your grievance and have the right to be accompanied by a union representative or workplace colleague. It is the responsibility of the employee to ensure that their union representative or workplace colleague is available to accompany them at the meeting. As appropriate further investigation may take place and action taken. After the meeting, you will be informed of the result, and what further action will be taken where appropriate. A decision will be given within 10 working days of the meeting unless further investigation is required or where this has been extended by mutual consent. If you are not satisfied with the response, you can appeal against the decision in writing within 5 working days of being informed of the outcome of the grievance.</p>
            <p className="mb-2"><strong>STEP 3:</strong> If you wish to appeal, you will be invited to a further meeting. Employees are expected to submit the grounds for appealing the earlier decision and relevant documentation in advance of the appeal hearing. This will be heard by a more senior manager where this is reasonably practicable. You will have the right to be accompanied by a union representative or workplace colleague and to make a submission for consideration. After the appeal meeting, you will be informed of the Employer's decision. This decision is final and the grievance procedure is exhausted following this stage.</p>
          </div>

          {/* 10. Disciplinary Action */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">10. Disciplinary Action</h3>
            <p className="mb-2">10.1. If your grievance concerns the imposition of an oral or written disciplinary warning, you may use the grievance procedure to seek redress rather than appealing under the Employer's disciplinary procedure.</p>
            <p className="mb-2">10.2. If your grievance is that the imposition of a disciplinary sanction amounts to discrimination or victimisation, or where you do not accept that the disciplinary sanction was imposed for the reasons relied upon by the Employer, you may seek redress under the grievance procedure.</p>
            <p className="mb-2">10.3. The Employer reserves the right to deal with such grievances through the disciplinary procedure where this is deemed to be more appropriate. If you are in any doubt as to which procedure to use, advice can be obtained from the Manager.</p>
            <p className="mb-2">10.4. In circumstances where it is not practicable to adhere to the above procedure within a reasonable period of time, the Employer will modify the procedure as appropriate following consultation with the employee.</p>
            <p className="mb-2">10.5. The Employer requires good standards of discipline from its employees, together with satisfactory standards of work. These disciplinary procedures apply to any misconduct or failure to meet standards of performance or attendance.</p>
            <p className="mb-2">10.6. The purpose of this procedure is to be corrective rather than punitive and it should be recognised that the existence of procedures such as these is to help and encourage the employee to achieve and maintain standards of conduct, attendance, and job performance and to ensure consistent and fair treatment for all employees.</p>
            <p className="mb-2">10.7. If your standard of work or conduct falls, and, after warnings, remains below the level which is acceptable, you may be dismissed.</p>
            <p className="mb-2">10.8. Summary dismissal without notice will take place if an act of gross misconduct is committed. Gross misconduct is any deliberate act by an employee that is detrimental to the good conduct of the Employer's business. Examples of misconduct and gross misconduct are listed at 8.5.</p>
          </div>

          {/* 11. Disciplinary Procedure */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">11. Disciplinary Procedure</h3>
            <p className="mb-2">11.1. The following stages in the disciplinary procedure are outlined below. The Employer reserves the right to activate any stage of the procedure where appropriate.</p>
            <h4 className="font-semibold mt-4 mb-2">STAGE 1 – Improvement Notice: Unsatisfactory Performance</h4>
            <p className="mb-2">If your performance does not meet the acceptable standards expected by the Employer, you may normally be given an improvement notice. This will set out the performance problem, the improvement that is required, and the time-scale and will also include details of any help that may be given following discussion with you. You will be advised that this constitutes the first stage of the formal procedure. A record of the improvement notice will remain live for 12 months, subject to satisfactory performance.</p>
            <h4 className="font-semibold mt-4 mb-2">STAGE 2 – First Written Warning</h4>
            <p className="mb-2">If your conduct does not meet acceptable standards you will normally be given a written warning. This will set out the nature of the misconduct and the standard of conduct expected. The written warning will confirm that a final written warning may be considered appropriate if there is no sustained satisfactory improvement. A record of the warning will be kept on file, and will be disregarded for disciplinary purposes after a specified period of 12 months depending upon satisfactory conduct/performance.</p>
            <h4 className="font-semibold mt-4 mb-2">STAGE 3 – Second Written Warning</h4>
            <p className="mb-2">If your conduct continues to fall below acceptable standards you may be given a second written warning. This will set out the nature of the misconduct and the standard of conduct expected. The second written warning will confirm that a final written warning may be considered appropriate if there is no sustained satisfactory improvement. A record of the warning will be kept on file, and will be disregarded for disciplinary purposes after a specified period of 12 months depending upon satisfactory conduct/performance. The decision to issue a sanction at Stage 3 is at the Employer's discretion depending upon the nature and circumstances of the unsatisfactory conduct or performance in question.</p>
            <h4 className="font-semibold mt-4 mb-2">STAGE 4 – Final Written Warning</h4>
            <p className="mb-2">If the offence is sufficiently serious, or there is a failure to improve during the currency of a prior warning for the same type of offence, a final written warning may be given to the employee. This will give details of the complaint, the improvement required and the timescale. It will also warn that failure to improve may lead to action under Stage 5 (dismissal or some other action short of dismissal), and will refer to the right of appeal. A copy of this written warning will be kept on file and will be disregarded for disciplinary purposes after 12 months subject to satisfactory conduct/performance.</p>
            <h4 className="font-semibold mt-4 mb-2">STAGE 5 – Dismissal or Other Sanction</h4>
            <p className="mb-2">If there is still a failure to improve, or where the conduct or performance is sufficiently serious, the final step in the procedure may be dismissal or some other action short of dismissal such as demotion or disciplinary suspension or transfer (as allowed in the contract of employment). Dismissal decisions can only be taken by your Manager and the employee will be provided, as soon as reasonably practicable, with written reasons for dismissal, the date on which the employment will terminate, as well as their right of appeal. The decision to dismiss will be confirmed in writing. In cases of gross misconduct, you will normally be dismissed without notice or pay in lieu of notice. In exceptional circumstances, or if there are any genuine mitigating circumstances, alternative disciplinary action may be taken.</p>
            <p className="mb-2">11.2. In circumstances where an employee faces dismissal, or certain action short of dismissal such as loss of pay or demotion (but excluding oral or written warnings) the minimum statutory procedure will be followed consisting of three steps. Step 1 consists of a written note to the employee setting out the allegation and the basis for it. Step 2 consists of a meeting to consider and discuss the allegation, following which a decision is taken. Step 3 involves the employee submitting a letter of appeal (including the reasons and basis for the appeal and documentation relied upon in support) followed by an appeal meeting. The employee will be reminded of their right to be accompanied prior to any meeting which is convened.</p>
          </div>

          {/* 12. Appeals Procedure */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">12. Appeals Procedure</h3>
            <p className="mb-2">12.1. If you are dissatisfied with any disciplinary decision affecting you, you may appeal to your Manager within five working days of the disciplinary decision.</p>
            <p className="mb-2">12.2. Any appeal must be put in writing, stating the grounds for the appeal and including any documentation or evidence relied upon in support. If the disciplinary action which is the subject of the appeal is your dismissal, the decision to dismiss will stand unless it is reversed on appeal.</p>
            <p className="mb-2">12.3. You will be invited to attend an appeal meeting. A more senior manager will hear this where this is reasonably practicable. At the appeal hearing, you will be permitted to state your case.</p>
            <p className="mb-2">12.4. Within a reasonable period of time after the appeal meeting, you will be informed of the decision. The decision of the manager hearing the appeal is final. There is no further right of internal appeal.</p>
          </div>

          {/* 13. Pension */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">13. Pension</h3>
            <p className="mb-2">The Employer will comply with the employer pension duties concerning pension auto-enrolment in accordance with Part 1 of the Pensions Act 2008 from that date that it is legally required to do so. Subject to your age and earnings level, you will be automatically enrolled into either a qualifying pension scheme or the National Employment Savings Trusts ("NEST") whichever the Employer chooses. You can decide to opt out of auto-enrolment. Further information about your pension choices will be provided at the appropriate time.</p>
          </div>

          {/* 14. Termination */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">14. Termination of employment</h3>
            <p className="mb-2">14.1. You may terminate your employment at any time on giving to the Employer not less than three weeks prior written notice and the Employer may terminate your employment at any time on giving you the statutory minimum notice.</p>
            <p className="mb-2">14.2. Nothing in this contract will prevent the Employer from terminating your employment, without notice or payment in lieu of notice, in a case of gross misconduct justifying summary dismissal without notice, or if you cease to be permitted to work in the United Kingdom. Examples of matters which will usually be regarded as gross misconduct are listed in clause 8.5.</p>
            <p className="mb-2">14.3. The Employer may in its sole and absolute discretion terminate your employment at any time with immediate effect by making a payment to you in lieu of notice.</p>
          </div>

          {/* 15. Data protection */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">15. Data protection and monitoring</h3>
            <p className="mb-2">15.1. You consent to the Employer processing personal data and sensitive personal data (as defined in the Data Protection Act 1998) concerning you in its manual and computerised/automated filing systems internally and, so far as is reasonably necessary, externally, for the purposes of complying with statutory requirements, meeting the Employer's legitimate interests, properly conducting the Employer's business, complying with the terms of this contract and for all purposes in connection with your employment with the Employer.</p>
            <p className="mb-2">15.2. You consent to your personal data and sensitive personal data for the purposes envisaged in clause 15.1 above being transferred to and processed by:</p>
            <div className="ml-6 space-y-1">
              <p>15.2.1. any Group Employer and their employees;</p>
              <p>15.2.2. professional advisors of the Employer or of the Group;</p>
              <p>15.2.3. any third-party providing services to the Employer or to the Group for the benefit of its employees;</p>
              <p>15.2.4. HM Revenue and Customs or other authorities; and</p>
              <p>15.2.5. Prospective purchasers of all or any part of the Employer's business in return for suitable confidentiality undertakings regardless of the country to which the data is to be transferred.</p>
            </div>
            <p className="mb-2 mt-2">15.3. You consent to the Employer monitoring, intercepting, reading, and recording your telephone, email, and other electronic communications for the purpose of monitoring and recording to establish facts, to establish compliance with regulatory procedures, to prevent or detect crime, to investigate or detect the unauthorised use of the Employer's systems or to ascertain compliance with the Employer's practices or procedures. The Employer may also monitor and record communications to check that they are relevant to its business.</p>
          </div>

          {/* 16. Variation */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">16. Variation</h3>
            <p className="mb-2">The Employer reserves the right to make reasonable changes to any of your terms and conditions of employment. Changes to your terms and conditions of employment will be notified to you in writing before the date upon which they come into force.</p>
          </div>

          {/* 17. Policies */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">17. Policies and Procedures</h3>
            <p className="mb-2">You agree to comply with the rules, policies, and procedures of the Employer from time to time in force, although these do not form part of your contract of employment (unless stated otherwise).</p>
          </div>

          {/* 18. Collective Agreement */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">18. Collective Agreement</h3>
            <p className="mb-2">There is no collective agreement which directly affects your employment.</p>
          </div>

          {/* 19. Entire agreement */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">19. Entire agreement</h3>
            <p className="mb-2">19.1. This contract is the entire agreement between you and the Employer in relation to its subject matter and replaces all previous agreements and arrangements (whether written or oral, express, or implied) relating to your employment by the Employer. Any such previous agreements and arrangements will be deemed to have been terminated by mutual consent as from the date of this contract.</p>
            <p className="mb-2">19.2. The information contained in this contract contains the particulars required for a written statement under Section 1 of the Employment Rights Act 1996.</p>
          </div>
        </section>

        {/* AGREED by the parties */}
        <section className="mt-8">
          <h2 className="font-bold text-base mb-6">AGREED by the parties</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Employee Signature */}
            <div className="border p-6 rounded-lg">
              <p className="mb-4">I agree to the above terms</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Signed:</p>
                  <div className="border-b-2 border-dotted h-10"></div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Date:</p>
                  <div className="border-b-2 border-dotted h-6"></div>
                </div>
              </div>
            </div>

            {/* Employer Signature */}
            <div className="border p-6 rounded-lg">
              <p className="mb-4">Signed on behalf of the Employer</p>
              {contractApproval?.employer_signature ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Signed:</p>
                    {contractApproval.employer_signature_type === 'drawn' ? (
                      <img src={contractApproval.employer_signature} alt="Signature" className="h-12" />
                    ) : (
                      <p className="text-2xl italic font-serif">{contractApproval.employer_signature}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Date:</p>
                    <p>{contractApproval.employer_signed_date}</p>
                  </div>
                </div>
              ) : isApprovalMode && user?.role === 'super_admin' ? (
                <Button onClick={() => setShowSignatureDialog(true)} className="gap-2 mt-4">
                  <PenTool className="h-4 w-4" />
                  Sign Contract
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Signed:</p>
                    <div className="border-b-2 border-dotted h-10"></div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Date:</p>
                    <div className="border-b-2 border-dotted h-6"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Actions */}
        {!readOnly && !isApprovalMode && (
          <div className="flex justify-between mt-8 print:hidden">
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Download / Print
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={handleSubmitForApproval} disabled={loading} className="gap-2">
                <Send className="h-4 w-4" />
                Submit for Approval
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign Contract</DialogTitle>
          </DialogHeader>
          
          <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="typed" className="gap-2">
                <Type className="h-4 w-4" />
                Type
              </TabsTrigger>
              <TabsTrigger value="drawn" className="gap-2">
                <PenTool className="h-4 w-4" />
                Draw
              </TabsTrigger>
              <TabsTrigger value="uploaded" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="typed" className="space-y-4">
              <div className="space-y-2">
                <Label>Type your name (will appear in cursive)</Label>
                <Input
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="Type your full name"
                  className="text-2xl italic font-serif"
                />
              </div>
              {typedSignature && (
                <div className="border p-4 rounded-lg text-center">
                  <p className="text-3xl italic font-serif">{typedSignature}</p>
                  <p className="text-sm text-muted-foreground mt-2">Signature Preview</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="drawn" className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full bg-white cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              <Button variant="outline" size="sm" onClick={clearCanvas}>
                Clear
              </Button>
            </TabsContent>

            <TabsContent value="uploaded" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="signature-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setTypedSignature(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label htmlFor="signature-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Click to upload signature image</p>
                </label>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={signatureDate}
              onChange={(e) => setSignatureDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveContract} disabled={loading}>
              {loading ? 'Signing...' : 'Approve & Sign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
