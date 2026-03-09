import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Save, ArrowLeft, AlertCircle } from 'lucide-react';
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
  declaration_agreed: boolean;
  signature: string;
  name_printed: string;
  signature_date: string;
}

interface ValidationErrors {
  [key: string]: string;
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
  const [errors, setErrors] = useState<ValidationErrors>({});
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
    declaration_agreed: false,
    signature: '',
    name_printed: '',
    signature_date: ''
  });

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    const { data: checklistData } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'starter_checklist')
      .maybeSingle();

    if (checklistData?.form_data) {
      setFormData(prev => ({ ...prev, ...(checklistData.form_data as unknown as FormData) }));
      return;
    }

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
        address: prev.address || appForm.address || '',
        postcode: prev.postcode || appForm.postcode || '',
        employment_start_date: prev.employment_start_date || appForm.start_date || '',
      }));
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Mandatory personal details
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    if (!formData.first_names.trim()) {
      newErrors.first_names = 'First name(s) is required';
    }
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = 'Date of birth is required';
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required';
    }
    if (!formData.employment_start_date) {
      newErrors.employment_start_date = 'Employment start date is required';
    }

    // Employee statement is mandatory
    if (!formData.statement) {
      newErrors.statement = 'Please select a statement (A, B, or C)';
    }

    // Student loan question is mandatory
    if (formData.has_student_loan === null) {
      newErrors.has_student_loan = 'Please answer the student loan question';
    }

    // Declaration is mandatory
    if (!formData.declaration_agreed) {
      newErrors.declaration_agreed = 'You must agree to the declaration';
    }

    // Signature fields are optional - to be signed by employee while uploading

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const saved = await handleSave();
    if (saved) {
      onNext();
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const headerHeight = 25;
    let y = headerHeight + 5;
    const lineHeight = 6;
    const labelCol = margin;
    const valueCol = margin + 55;

    const drawCheckbox = (x: number, yPos: number, checked: boolean) => {
      const size = 3;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(x, yPos - size, size, size);
      if (checked) {
        doc.line(x + 0.5, yPos - size / 2, x + size / 2, yPos - 0.5);
        doc.line(x + size / 2, yPos - 0.5, x + size - 0.5, yPos - size + 0.5);
      }
    };

    const formatDateDDMMYYYY = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

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

    const checkNewPage = (requiredSpace: number) => {
      if (y + requiredSpace > pageHeight - 20) {
        doc.addPage();
        addHeader();
        y = headerHeight + 5;
      }
    };

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Starter checklist', margin, y);
    y += 10;

    // Instructions
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const instrText = 'This Starter Checklist can be used to gather information about your new employee. You can use this information to help fill in your first Full Payment Submission (FPS) for this employee.';
    const instrLines = doc.splitTextToSize(instrText, contentWidth);
    doc.text(instrLines, margin, y);
    y += instrLines.length * 4 + 6;

    // ── Employee's personal details ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(0, 102, 179);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text("Employee's personal details", margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setFontSize(10);
    const fields: [string, string][] = [
      ['1  Last name:', formData.last_name],
      ['2  First name(s):', formData.first_names],
      ['3  Gender:', formData.gender === 'male' ? 'Male' : formData.gender === 'female' ? 'Female' : ''],
      ['4  Date of birth:', formatDateDDMMYYYY(formData.date_of_birth)],
      ['5  Home address:', formData.address],
      ['    Postcode:', formData.postcode?.toUpperCase() || ''],
      ['    Country:', formData.country],
      ['6  National Insurance number:', formData.national_insurance],
      ['7  Employment start date:', formatDateDDMMYYYY(formData.employment_start_date)],
    ];

    fields.forEach(([label, value]) => {
      checkNewPage(lineHeight + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(label, labelCol, y);
      doc.setFont('helvetica', 'normal');
      // Handle long addresses
      if (label.includes('address')) {
        const valLines = doc.splitTextToSize(value || '', contentWidth - 55);
        doc.text(valLines, valueCol, y);
        y += Math.max(valLines.length, 1) * 5 + 2;
      } else {
        doc.text(value || '', valueCol, y);
        y += lineHeight;
      }
    });
    y += 4;

    // ── Employee statement ──
    checkNewPage(60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(0, 102, 179);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Employee statement', margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('You need to select only one of the following statements A, B or C.', margin, y);
    y += lineHeight + 3;

    // Statement A
    drawCheckbox(margin, y, formData.statement === 'A');
    doc.setFont('helvetica', 'bold');
    doc.text('A', margin + 6, y);
    doc.setFont('helvetica', 'normal');
    const stmtA = "This is my first job since last 6 April and I have not been receiving taxable Jobseeker's Allowance, Employment and Support Allowance, taxable Incapacity Benefit, State or Occupational Pension.";
    const stmtALines = doc.splitTextToSize(stmtA, contentWidth - 10);
    doc.text(stmtALines, margin + 10, y);
    y += stmtALines.length * 4 + 5;

    // Statement B
    checkNewPage(20);
    drawCheckbox(margin, y, formData.statement === 'B');
    doc.setFont('helvetica', 'bold');
    doc.text('B', margin + 6, y);
    doc.setFont('helvetica', 'normal');
    const stmtB = "This is now my only job, but since last 6 April I have had another job, or received taxable Jobseeker's Allowance, Employment and Support Allowance or taxable Incapacity Benefit. I do not receive a State or Occupational Pension.";
    const stmtBLines = doc.splitTextToSize(stmtB, contentWidth - 10);
    doc.text(stmtBLines, margin + 10, y);
    y += stmtBLines.length * 4 + 5;

    // Statement C
    checkNewPage(20);
    drawCheckbox(margin, y, formData.statement === 'C');
    doc.setFont('helvetica', 'bold');
    doc.text('C', margin + 6, y);
    doc.setFont('helvetica', 'normal');
    const stmtC = 'As well as my new job, I have another job or receive a State or Occupational Pension.';
    const stmtCLines = doc.splitTextToSize(stmtC, contentWidth - 10);
    doc.text(stmtCLines, margin + 10, y);
    y += stmtCLines.length * 4 + 6;

    // ── Student Loan ──
    checkNewPage(30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(0, 102, 179);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Student Loan', margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Do you have a student loan which is not fully repaid?', margin, y);
    const slX = margin + 95;
    doc.text('Yes', slX, y);
    drawCheckbox(slX + 10, y, formData.has_student_loan === true);
    doc.text('No', slX + 20, y);
    drawCheckbox(slX + 28, y, formData.has_student_loan === false);
    y += lineHeight + 3;

    if (formData.has_student_loan === true) {
      doc.text('Are you repaying your Student Loan direct to the Student Loans Company?', margin, y);
      y += lineHeight;
      doc.text('Yes', margin + 10, y);
      drawCheckbox(margin + 20, y, formData.repaying_direct === true);
      doc.text('No', margin + 30, y);
      drawCheckbox(margin + 38, y, formData.repaying_direct === false);
      y += lineHeight;
      doc.text(`Student Loan type: ${formData.student_loan_type === 'plan1' ? 'Plan 1' : formData.student_loan_type === 'plan2' ? 'Plan 2' : ''}`, margin, y);
      y += lineHeight + 2;
    }

    // ── Employee declaration ──
    checkNewPage(30);
    y += 2;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(0, 102, 179);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Employee declaration', margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature:', margin, y);
    doc.setFont('helvetica', 'italic');
    doc.text(formData.signature || '............................', margin + 25, y);
    y += lineHeight + 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateDDMMYYYY(formData.signature_date) || '............................', margin + 15, y);

    doc.save(`Starter_Checklist_${formData.first_names}_${formData.last_name}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const RequiredLabel = ({ children, error }: { children: React.ReactNode; error?: string }) => (
    <Label className={error ? 'text-destructive' : ''}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );

  const ErrorMessage = ({ error }: { error?: string }) => {
    if (!error) return null;
    return (
      <p className="text-sm text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 print:shadow-none bg-card">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Starter checklist</h1>
            <p className="text-sm text-amber-600 mt-2">Fields marked with * are mandatory</p>
          </div>
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
              <div className="space-y-2" data-field="last_name">
                <RequiredLabel error={errors.last_name}>
                  <span className="font-bold">1</span> Last name
                </RequiredLabel>
                <Input
                  value={formData.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  disabled={readOnly}
                  className={errors.last_name ? 'border-destructive' : ''}
                />
                <ErrorMessage error={errors.last_name} />
              </div>
              <div className="space-y-2" data-field="first_names">
                <RequiredLabel error={errors.first_names}>
                  <span className="font-bold">2</span> First name(s)
                </RequiredLabel>
                <Input
                  value={formData.first_names}
                  onChange={(e) => updateField('first_names', e.target.value)}
                  disabled={readOnly}
                  className={errors.first_names ? 'border-destructive' : ''}
                />
                <p className="text-xs text-muted-foreground">Do not enter initials or shortened names such as Jim for James or Liz for Elizabeth</p>
                <ErrorMessage error={errors.first_names} />
              </div>
            </div>

            <div className="space-y-2" data-field="gender">
              <RequiredLabel error={errors.gender}>
                <span className="font-bold">3</span> Are you male or female?
              </RequiredLabel>
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
              <ErrorMessage error={errors.gender} />
            </div>

            <div className="space-y-2 max-w-xs" data-field="date_of_birth">
              <RequiredLabel error={errors.date_of_birth}>
                <span className="font-bold">4</span> Date of birth
                <span className="text-muted-foreground text-xs ml-2">DD MM YYYY</span>
              </RequiredLabel>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
                disabled={readOnly}
                className={errors.date_of_birth ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.date_of_birth} />
            </div>

            <div className="space-y-2" data-field="address">
              <RequiredLabel error={errors.address}>
                <span className="font-bold">5</span> Home address
              </RequiredLabel>
              <Input
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                disabled={readOnly}
                className={errors.address ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.address} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="space-y-2" data-field="postcode">
                  <RequiredLabel error={errors.postcode}>Postcode</RequiredLabel>
                  <Input
                    value={formData.postcode}
                    onChange={(e) => updateField('postcode', e.target.value.toUpperCase())}
                    disabled={readOnly}
                    className={errors.postcode ? 'border-destructive' : ''}
                  />
                  <ErrorMessage error={errors.postcode} />
                </div>
                <div className="space-y-2" data-field="country">
                  <RequiredLabel error={errors.country}>Country</RequiredLabel>
                  <Input
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    disabled={readOnly}
                    placeholder="e.g., United Kingdom"
                    className={errors.country ? 'border-destructive' : ''}
                  />
                  <ErrorMessage error={errors.country} />
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
                  readOnly
                  disabled
                  placeholder="AB 12 34 56 C"
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2" data-field="employment_start_date">
                <RequiredLabel error={errors.employment_start_date}>
                  <span className="font-bold">7</span> Employment start date
                  <span className="text-muted-foreground text-xs ml-2">DD MM YYYY</span>
                </RequiredLabel>
                <Input
                  type="date"
                  value={formData.employment_start_date}
                  onChange={(e) => updateField('employment_start_date', e.target.value)}
                  disabled={readOnly}
                  className={errors.employment_start_date ? 'border-destructive' : ''}
                />
                <ErrorMessage error={errors.employment_start_date} />
              </div>
            </div>
          </div>
        </div>

        {/* Employee Statement */}
        <div className="border-b pb-6 mb-6">
          <div className="bg-primary text-primary-foreground p-3 rounded-t-lg -mx-8 px-8 mb-4">
            <h3 className="font-bold">Employee statement</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">You need to select only one of the following statements A, B or C <span className="text-destructive">*</span></p>
          
          <div data-field="statement">
            <RadioGroup
              value={formData.statement}
              onValueChange={(v) => updateField('statement', v)}
              className="space-y-4"
              disabled={readOnly}
            >
              <div className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors ${errors.statement ? 'border-destructive' : ''}`}>
                <RadioGroupItem value="A" id="statementA" className="mt-1" />
                <div>
                  <Label htmlFor="statementA" className="font-bold cursor-pointer">A</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is my first job since last 6 April and I have not been receiving taxable Jobseeker's Allowance, 
                    Employment and Support Allowance, taxable Incapacity Benefit, State or Occupational Pension.
                  </p>
                </div>
              </div>
              
              <div className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors ${errors.statement ? 'border-destructive' : ''}`}>
                <RadioGroupItem value="B" id="statementB" className="mt-1" />
                <div>
                  <Label htmlFor="statementB" className="font-bold cursor-pointer">B</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is now my only job but since last 6 April I have had another job, or received taxable Jobseeker's Allowance, 
                    Employment and Support Allowance or taxable Incapacity Benefit. I do not receive a State or Occupational Pension.
                  </p>
                </div>
              </div>
              
              <div className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors ${errors.statement ? 'border-destructive' : ''}`}>
                <RadioGroupItem value="C" id="statementC" className="mt-1" />
                <div>
                  <Label htmlFor="statementC" className="font-bold cursor-pointer">C</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    As well as my new job, I have another job or receive a State or Occupational Pension.
                  </p>
                </div>
              </div>
            </RadioGroup>
            <ErrorMessage error={errors.statement} />
          </div>
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
            <div className="space-y-2" data-field="has_student_loan">
              <RequiredLabel error={errors.has_student_loan}>
                <span className="font-bold">9</span> Do you have a Student Loan which is not fully repaid?
              </RequiredLabel>
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
              <ErrorMessage error={errors.has_student_loan} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2" data-field="signature">
              <Label>Signature (To be signed by employee while uploading)</Label>
              <Input
                value="To be signed by employee while uploading"
                readOnly
                disabled
                className="font-serif italic text-lg bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2" data-field="signature_date">
              <Label>Date</Label>
              <Input
                type="date"
                value=""
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed"
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
