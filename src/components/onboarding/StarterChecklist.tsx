import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Save, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

interface StarterChecklistProps {
  employeeId: string;
  employeeData: {
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    address?: string;
    national_insurance_number?: string;
    join_date?: string;
  };
  onSave: () => void;
  onNext: () => void;
  onBack?: () => void;
  readOnly?: boolean;
}

interface FormData {
  last_name: string;
  first_names: string;
  gender: 'male' | 'female' | '';
  date_of_birth: string;
  address: string;
  postcode: string;
  country: string;
  national_insurance: string;
  employment_start_date: string;
  statement: 'A' | 'B' | 'C' | '';
  has_student_loan: boolean | null;
  repaying_direct: boolean | null;
  student_loan_type: 'plan1' | 'plan2' | '';
  finished_before_april: boolean | null;
  signature: string;
  name_printed: string;
  signature_date: string;
}

export default function StarterChecklist({
  employeeId,
  employeeData,
  onSave,
  onNext,
  onBack,
  readOnly = false
}: StarterChecklistProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    last_name: employeeData.last_name || '',
    first_names: employeeData.first_name || '',
    gender: '',
    date_of_birth: employeeData.date_of_birth || '',
    address: employeeData.address || '',
    postcode: '',
    country: '',
    national_insurance: employeeData.national_insurance_number || '',
    employment_start_date: employeeData.join_date || '',
    statement: '',
    has_student_loan: null,
    repaying_direct: null,
    student_loan_type: '',
    finished_before_april: null,
    signature: '',
    name_printed: '',
    signature_date: ''
  });

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    // First, try to load saved starter checklist data
    const { data: checklistData } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'starter_checklist')
      .maybeSingle();

    if (checklistData?.form_data) {
      setFormData(prev => ({ ...prev, ...(checklistData.form_data as unknown as FormData) }));
      return; // If we have saved data, use it as-is
    }

    // If no saved checklist, try to auto-populate from Application Form
    const { data: applicationData } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'application_form')
      .maybeSingle();

    if (applicationData?.form_data) {
      const appForm = applicationData.form_data as any;
      setFormData(prev => ({
        ...prev,
        // Auto-populate from Application Form if not already set
        address: prev.address || appForm.address || '',
        postcode: prev.postcode || appForm.postcode || '',
        employment_start_date: prev.employment_start_date || appForm.start_date || '',
      }));
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('onboarding_form_responses')
        .upsert({
          employee_id: employeeId,
          form_type: 'starter_checklist',
          form_data: formData as any,
          signature: formData.signature,
          signed_at: formData.signature ? new Date().toISOString() : null
        }, { onConflict: 'employee_id,form_type' });

      if (error) throw error;
      toast.success('Starter checklist saved');
      onSave();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save checklist';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    const saved = await handleSave();
    if (saved) {
      onNext();
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let y = 15;
    const lineHeight = 6;

    // Format date as DD MM YYYY
    const formatDateDDMMYYYY = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    // Load and add logo
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
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 40, 10, 40, 12);
    }

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Starter checklist', margin, y);
    y += 12;

    // Instructions for employers
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Instructions for employers', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const employerInstructions = 'This Starter Checklist can be used to gather information about your new employee. You can use this information to help fill in your first Full Payment Submission (FPS) for this employee. You need to keep the information recorded on the Starter Checklist record for the current and previous three tax years. Do not send this form to HM Revenue and Customs (HMRC).';
    doc.text(employerInstructions, margin, y, { maxWidth: contentWidth });
    y += 18;

    // Instructions for employees
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Instructions for employees', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const employeeInstructions = 'As a new employee your employer needs the information on this form before your first payday to tell HMRC about you and help them use the correct tax code. Fill in this form then give it to your employer. Do not send this form to HMRC.';
    doc.text(employeeInstructions, margin, y, { maxWidth: contentWidth });
    y += 15;

    // Employee's personal details section
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Employee's personal details", margin + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Question 1
    doc.setFont('helvetica', 'bold');
    doc.text('1', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Last name', margin + 8, y);
    y += lineHeight;
    doc.text(formData.last_name || '', margin + 8, y);
    y += 8;

    // Question 2
    doc.setFont('helvetica', 'bold');
    doc.text('2', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('First name(s)', margin + 8, y);
    y += lineHeight - 2;
    doc.setFontSize(7);
    doc.text('Do not enter initials or shortened names such as Jim for James or Liz for Elizabeth', margin + 8, y);
    doc.setFontSize(9);
    y += lineHeight;
    doc.text(formData.first_names || '', margin + 8, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('3', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Are you male or female?', margin + 8, y);
    y += lineHeight;
    doc.text(`Male ${formData.gender === 'male' ? '☑' : '☐'}      Female ${formData.gender === 'female' ? '☑' : '☐'}`, margin + 8, y);
    y += 8;

    // Question 4 - Format date properly
    doc.setFont('helvetica', 'bold');
    doc.text('4', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Date of birth', margin + 8, y);
    doc.text('DD MM YYYY', margin + 50, y);
    y += lineHeight;
    doc.text(formatDateDDMMYYYY(formData.date_of_birth), margin + 8, y);
    y += 8;

    // Question 5
    doc.setFont('helvetica', 'bold');
    doc.text('5', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Home address', margin + 8, y);
    y += lineHeight;
    doc.text(formData.address || '', margin + 8, y, { maxWidth: contentWidth - 15 });
    y += 8;
    doc.text('Postcode', margin + 8, y);
    doc.text(formData.postcode || '', margin + 35, y);
    y += lineHeight;
    doc.text('Country', margin + 8, y);
    doc.text(formData.country || '', margin + 35, y);
    y += 8;

    // Question 6
    doc.setFont('helvetica', 'bold');
    doc.text('6', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('National Insurance number (if known)', margin + 8, y);
    y += lineHeight;
    doc.text(formData.national_insurance || '', margin + 8, y);
    y += 8;

    // Question 7 - Format date properly
    doc.setFont('helvetica', 'bold');
    doc.text('7', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Employment start date', margin + 8, y);
    doc.text('DD MM YYYY', margin + 60, y);
    y += lineHeight;
    doc.text(formatDateDDMMYYYY(formData.employment_start_date), margin + 8, y);
    y += 12;

    // Employee statement section
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee statement', margin + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('You need to select only one of the following statements A, B or C', margin, y);
    y += 8;

    // Statement A
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formData.statement === 'A' ? '☑' : '☐'} A`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += lineHeight;
    doc.text("This is my first job since last 6 April and I have not been receiving taxable Jobseeker's", margin + 8, y);
    y += 4;
    doc.text("Allowance, Employment and Support Allowance, taxable Incapacity Benefit, State or Occupational Pension.", margin + 8, y);
    y += 8;

    // Statement B
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formData.statement === 'B' ? '☑' : '☐'} B`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += lineHeight;
    doc.text("This is now my only job but since last 6 April I have had another job, or received taxable", margin + 8, y);
    y += 4;
    doc.text("Jobseeker's Allowance, Employment and Support Allowance or taxable Incapacity Benefit.", margin + 8, y);
    y += 4;
    doc.text("I do not receive a State or Occupational Pension.", margin + 8, y);
    y += 8;

    // Statement C
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formData.statement === 'C' ? '☑' : '☐'} C`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += lineHeight;
    doc.text("As well as my new job, I have another job or receive a State or Occupational Pension.", margin + 8, y);
    y += 12;

    // Page 2
    doc.addPage();
    y = 15;

    // Student Loan section header
    doc.setFillColor(0, 0, 0);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Loan', margin + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Student Loan Plans explanation
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Loan Plans', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('You will have a Plan 1 Student Loan if:', margin, y);
    y += lineHeight;
    doc.text('1. You lived in Scotland or Northern Ireland when you started your course, or', margin + 5, y);
    y += 4;
    doc.text('2. You lived in England or Wales and started your course before September 2012', margin + 5, y);
    y += 8;
    doc.text('You will have a Plan 2 Student Loan if you lived in England or Wales and started your course', margin, y);
    y += 4;
    doc.text('on or after 1 September 2012.', margin, y);
    y += 12;

    // Question 9
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('9', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Do you have a Student Loan which is not fully repaid?', margin + 8, y);
    y += lineHeight;
    doc.text(`Yes ${formData.has_student_loan === true ? '☑' : '☐'}    No ${formData.has_student_loan === false ? '☑' : '☐'}`, margin + 8, y);
    doc.setFontSize(7);
    doc.text('If yes, go to question 10', margin + 50, y);
    doc.text('If no, go to question 12', margin + 95, y);
    y += 10;

    // Question 10
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('10', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Are you repaying your Student Loan direct to the Student Loans Company', margin + 10, y);
    y += 4;
    doc.text('by agreed monthly payments?', margin + 10, y);
    y += lineHeight;
    doc.text(`Yes ${formData.repaying_direct === true ? '☑' : '☐'}    No ${formData.repaying_direct === false ? '☑' : '☐'}`, margin + 10, y);
    doc.setFontSize(7);
    doc.text('If yes, go to question 12', margin + 50, y);
    doc.text('If no, go to question 11', margin + 95, y);
    y += 10;

    // Question 11
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('11', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('What type of Student Loan do you have?', margin + 10, y);
    y += lineHeight;
    doc.text(`Plan 1 ${formData.student_loan_type === 'plan1' ? '☑' : '☐'}    Plan 2 ${formData.student_loan_type === 'plan2' ? '☑' : '☐'}`, margin + 10, y);
    y += 10;

    // Question 12
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('12', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Did you finish your studies before the last 6 April?', margin + 10, y);
    y += lineHeight;
    doc.text(`Yes ${formData.finished_before_april === true ? '☑' : '☐'}    No ${formData.finished_before_april === false ? '☑' : '☐'}`, margin + 10, y);
    y += 12;

    doc.setFontSize(7);
    doc.text('For further guidance about repaying Student Loans go to www.gov.uk/new-employee/student-loans', margin, y);
    y += 15;

    // Signature section - Format date properly
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Signature:', margin, y);
    doc.text(formData.signature || '____________________', margin + 25, y);
    y += 10;
    doc.text('Name:', margin, y);
    doc.text(formData.name_printed || '____________________', margin + 25, y);
    y += 10;
    doc.text('Date:', margin, y);
    doc.text(formData.signature_date ? formatDateDDMMYYYY(formData.signature_date) : 'DD MM YYYY', margin + 25, y);
    y += 15;

    // Footer
    doc.setFontSize(8);
    doc.text('Starter checklist', margin, y);
    doc.text('Page 2', pageWidth / 2, y, { align: 'center' });
    doc.text('HMRC 04/16', pageWidth - margin, y, { align: 'right' });

    doc.save(`Starter_Checklist_${formData.first_names}_${formData.last_name}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 print:shadow-none bg-card">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <h1 className="text-2xl font-bold">Starter checklist</h1>
          <img src={nizaLogo} alt="Niza Group" className="h-12" />
        </div>

        {/* Instructions for employers */}
        <div className="bg-muted/30 p-4 rounded-lg mb-6">
          <h3 className="font-bold text-sm mb-2">Instructions for employers</h3>
          <p className="text-sm text-muted-foreground">
            This Starter Checklist can be used to gather information about your new employee. You can use this information to help fill in your first Full Payment Submission (FPS) for this employee. You need to keep the information recorded on the Starter Checklist record for the current and previous three tax years. Do not send this form to HM Revenue and Customs (HMRC).
          </p>
        </div>

        {/* Instructions for employees */}
        <div className="bg-muted/30 p-4 rounded-lg mb-6">
          <h3 className="font-bold text-sm mb-2">Instructions for employees</h3>
          <p className="text-sm text-muted-foreground">
            As a new employee your employer needs the information on this form before your first payday to tell HMRC about you and help them use the correct tax code. Fill in this form then give it to your employer. Do not send this form to HMRC.
          </p>
        </div>

        {/* Employee's Personal Details */}
        <div className="border-b pb-6 mb-6">
          <div className="bg-primary text-primary-foreground p-3 rounded-t-lg -mx-8 -mt-2 px-8 mb-4">
            <h3 className="font-bold">Employee's personal details</h3>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="font-bold">1</span> Last name
                </Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="font-bold">2</span> First name(s)
                </Label>
                <Input
                  value={formData.first_names}
                  onChange={(e) => updateField('first_names', e.target.value)}
                  disabled={readOnly}
                />
                <p className="text-xs text-muted-foreground">Do not enter initials or shortened names such as Jim for James or Liz for Elizabeth</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="font-bold">3</span> Are you male or female?
              </Label>
              <RadioGroup
                value={formData.gender}
                onValueChange={(v) => updateField('gender', v)}
                className="flex gap-6"
                disabled={readOnly}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female">Female</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2 max-w-xs">
              <Label className="flex items-center gap-2">
                <span className="font-bold">4</span> Date of birth
                <span className="text-muted-foreground text-xs ml-2">DD MM YYYY</span>
              </Label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="font-bold">5</span> Home address
              </Label>
              <Input
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                disabled={readOnly}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    value={formData.postcode}
                    onChange={(e) => updateField('postcode', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="font-bold">6</span> National Insurance number (if known)
                </Label>
                <Input
                  value={formData.national_insurance}
                  onChange={(e) => updateField('national_insurance', e.target.value.toUpperCase())}
                  placeholder="AB 12 34 56 C"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span className="font-bold">7</span> Employment start date
                  <span className="text-muted-foreground text-xs ml-2">DD MM YYYY</span>
                </Label>
                <Input
                  type="date"
                  value={formData.employment_start_date}
                  onChange={(e) => updateField('employment_start_date', e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Employee Statement */}
        <div className="border-b pb-6 mb-6">
          <div className="bg-primary text-primary-foreground p-3 rounded-t-lg -mx-8 px-8 mb-4">
            <h3 className="font-bold">Employee statement</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">You need to select only one of the following statements A, B or C</p>
          
          <RadioGroup
            value={formData.statement}
            onValueChange={(v) => updateField('statement', v)}
            className="space-y-4"
            disabled={readOnly}
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="A" id="statementA" className="mt-1" />
              <div>
                <Label htmlFor="statementA" className="font-bold cursor-pointer">A</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  This is my first job since last 6 April and I have not been receiving taxable Jobseeker's Allowance, 
                  Employment and Support Allowance, taxable Incapacity Benefit, State or Occupational Pension.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="B" id="statementB" className="mt-1" />
              <div>
                <Label htmlFor="statementB" className="font-bold cursor-pointer">B</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  This is now my only job but since last 6 April I have had another job, or received taxable Jobseeker's Allowance, 
                  Employment and Support Allowance or taxable Incapacity Benefit. I do not receive a State or Occupational Pension.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
              <RadioGroupItem value="C" id="statementC" className="mt-1" />
              <div>
                <Label htmlFor="statementC" className="font-bold cursor-pointer">C</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  As well as my new job, I have another job or receive a State or Occupational Pension.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Student Loan */}
        <div className="border-b pb-6 mb-6">
          <div className="bg-primary text-primary-foreground p-3 rounded-t-lg -mx-8 px-8 mb-4">
            <h3 className="font-bold">Student Loan</h3>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg mb-6">
            <h4 className="font-bold text-sm mb-2">Student Loan Plans</h4>
            <p className="text-sm text-muted-foreground mb-2">
              You will have a <strong>Plan 1</strong> Student Loan if:
            </p>
            <ul className="text-sm text-muted-foreground list-disc ml-5 mb-3">
              <li>You lived in Scotland or Northern Ireland when you started your course, or</li>
              <li>You lived in England or Wales and started your course before September 2012</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              You will have a <strong>Plan 2</strong> Student Loan if you lived in England or Wales and started your course on or after 1 September 2012.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="font-bold">9</span> Do you have a Student Loan which is not fully repaid?
              </Label>
              <div className="flex gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.has_student_loan === true}
                    onCheckedChange={() => updateField('has_student_loan', true)}
                    disabled={readOnly}
                  />
                  Yes <span className="text-xs text-muted-foreground ml-1">If yes, go to question 10</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.has_student_loan === false}
                    onCheckedChange={() => updateField('has_student_loan', false)}
                    disabled={readOnly}
                  />
                  No <span className="text-xs text-muted-foreground ml-1">If no, go to question 12</span>
                </label>
              </div>
            </div>

            {formData.has_student_loan === true && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <span className="font-bold">10</span> Are you repaying your Student Loan direct to the Student Loans Company by agreed monthly payments?
                  </Label>
                  <div className="flex gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formData.repaying_direct === true}
                        onCheckedChange={() => updateField('repaying_direct', true)}
                        disabled={readOnly}
                      />
                      Yes <span className="text-xs text-muted-foreground ml-1">If yes, go to question 12</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formData.repaying_direct === false}
                        onCheckedChange={() => updateField('repaying_direct', false)}
                        disabled={readOnly}
                      />
                      No <span className="text-xs text-muted-foreground ml-1">If no, go to question 11</span>
                    </label>
                  </div>
                </div>

                {formData.repaying_direct === false && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <span className="font-bold">11</span> What type of Student Loan do you have?
                    </Label>
                    <RadioGroup
                      value={formData.student_loan_type}
                      onValueChange={(v) => updateField('student_loan_type', v)}
                      className="flex gap-6 mt-2"
                      disabled={readOnly}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="plan1" id="plan1" />
                        <Label htmlFor="plan1">Plan 1</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="plan2" id="plan2" />
                        <Label htmlFor="plan2">Plan 2</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="font-bold">12</span> Did you finish your studies before the last 6 April?
              </Label>
              <div className="flex gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.finished_before_april === true}
                    onCheckedChange={() => updateField('finished_before_april', true)}
                    disabled={readOnly}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.finished_before_april === false}
                    onCheckedChange={() => updateField('finished_before_april', false)}
                    disabled={readOnly}
                  />
                  No
                </label>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            For further guidance about repaying Student Loans go to www.gov.uk/new-employee/student-loans
          </p>
        </div>

        {/* Signature */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Signature (type your full name)</Label>
              <Input
                value={formData.signature}
                onChange={(e) => updateField('signature', e.target.value)}
                placeholder="Type your full name"
                disabled={readOnly}
                className="font-serif italic text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Name (printed)</Label>
              <Input
                value={formData.name_printed}
                onChange={(e) => updateField('name_printed', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.signature_date}
                onChange={(e) => updateField('signature_date', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between text-xs text-muted-foreground border-t pt-4 mb-6">
          <span>Starter checklist</span>
          <span>HMRC 04/16</span>
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex flex-wrap justify-between gap-4 print:hidden">
            <div className="flex gap-2">
              {onBack && (
                <Button variant="outline" onClick={onBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Button>
              )}
              <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
                <Download className="h-4 w-4" />
                Download / Print
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button onClick={handleSaveAndContinue} disabled={loading}>
                {loading ? 'Saving...' : 'Save & Continue'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
