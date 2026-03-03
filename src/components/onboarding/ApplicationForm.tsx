import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Save, Plus, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

interface ApplicationFormProps {
  employeeId: string;
  employeeData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    address?: string;
    date_of_birth?: string;
    national_insurance_number?: string;
    job_title?: string;
    join_date?: string;
    organization_id: string;
    branch_id: string;
  };
  organizations: { id: string; name: string }[];
  branches?: { id: string; name: string; address?: string }[];
  onSave: () => void;
  onNext: () => void;
  onBack?: () => void;
  readOnly?: boolean;
}

interface FormData {
  organization_id: string;
  branch_id: string;
  branch_address: string;
  position: string;
  closing_date: string;
  title: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  eligible_to_work_uk: boolean | null;
  start_date: string;
  has_previous_employment: boolean | null;
  current_employer: string;
  current_job_title: string;
  employer_address: string;
  employment_commenced: string;
  present_salary: string;
  current_duties: string;
  reason_leaving: string;
  notice_required: boolean | null;
  notice_length: string;
  employment_history: { employer: string; job_title: string; dates: string }[];
  education: { institution: string; from: string; to: string; qualifications: string }[];
  other_qualifications: string;
  skills_experience: string;
  has_disability: boolean | null;
  reasonable_adjustments: string;
  unavailable_dates: string;
  has_convictions: boolean | null;
  referee1: { name: string; address: string; telephone: string; email: string; relationship: string };
  referee2: { name: string; address: string; telephone: string; email: string; relationship: string };
  declaration_agreed: boolean;
  signature: string;
  signature_date: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function ApplicationForm({
  employeeId,
  employeeData,
  organizations,
  branches = [],
  onSave,
  onNext,
  onBack,
  readOnly = false
}: ApplicationFormProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<FormData>({
    organization_id: employeeData.organization_id,
    branch_id: employeeData.branch_id,
    branch_address: '',
    position: employeeData.job_title || '',
    closing_date: '',
    title: '',
    name: `${employeeData.first_name} ${employeeData.last_name}`,
    address: employeeData.address || '',
    postcode: '',
    phone: employeeData.phone || '',
    email: employeeData.email || '',
    eligible_to_work_uk: null,
    start_date: employeeData.join_date || '',
    has_previous_employment: null,
    current_employer: '',
    current_job_title: '',
    employer_address: '',
    employment_commenced: '',
    present_salary: '',
    current_duties: '',
    reason_leaving: '',
    notice_required: null,
    notice_length: '',
    employment_history: [{ employer: '', job_title: '', dates: '' }],
    education: [{ institution: '', from: '', to: '', qualifications: '' }],
    other_qualifications: '',
    skills_experience: '',
    has_disability: null,
    reasonable_adjustments: '',
    unavailable_dates: '',
    has_convictions: null,
    referee1: { name: '', address: '', telephone: '', email: '', relationship: '' },
    referee2: { name: '', address: '', telephone: '', email: '', relationship: '' },
    declaration_agreed: false,
    signature: '',
    signature_date: ''
  });

  // Set branch_address when branches change or form data changes
  useEffect(() => {
    const selectedBranch = branches.find(b => b.id === formData.branch_id);
    if (selectedBranch?.address && (!formData.branch_address || formData.branch_address.trim() === '')) {
      setFormData(prev => ({ ...prev, branch_address: selectedBranch.address || '' }));
    }
  }, [branches, formData.branch_id, formData.branch_address]);

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    const { data } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'application_form')
      .maybeSingle();

    if (data?.form_data) {
      const savedData = data.form_data as unknown as FormData;

      const sanitizeReferee = (ref: FormData['referee1']) => {
        const applicantName = (savedData.name || '').trim();
        const applicantAddress = (savedData.address || '').trim();
        const isProbablyAutofill =
          (ref?.name || '').trim() === applicantName || (ref?.name || '').trim() === '';

        if (isProbablyAutofill && (ref?.address || '').trim() === applicantAddress) {
          return { ...ref, address: '' };
        }
        return ref;
      };

      savedData.referee1 = sanitizeReferee(savedData.referee1);
      savedData.referee2 = sanitizeReferee(savedData.referee2);

      if (!savedData.branch_address) {
        const selectedBranch = branches.find(b => b.id === savedData.branch_id || b.id === employeeData.branch_id);
        savedData.branch_address = selectedBranch?.address || '';
      }
      setFormData(prev => ({ ...prev, ...savedData }));
    } else {
      if (employeeData.address && !formData.postcode) {
        const ukPostcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i;
        const match = employeeData.address.match(ukPostcodeRegex);
        if (match) {
          setFormData(prev => ({ ...prev, postcode: match[1].toUpperCase() }));
        }
      }
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is updated
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

    // Section 1: Position - mandatory
    if (!formData.position.trim()) {
      newErrors.position = 'Position is required';
    }

    // Section 2: Personal Information - mandatory fields
    if (!formData.title) {
      newErrors.title = 'Title is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-+()]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (formData.eligible_to_work_uk === null) {
      newErrors.eligible_to_work_uk = 'Please confirm eligibility to work in UK';
    }
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    // Section 3: Employment - must answer yes/no
    if (formData.has_previous_employment === null) {
      newErrors.has_previous_employment = 'Please indicate if you have previous employment';
    }

    // Section 6: Medical - must answer disability question
    if (formData.has_disability === null) {
      newErrors.has_disability = 'Please answer the disability question';
    }

    // Section 7: Convictions - must answer
    if (formData.has_convictions === null) {
      newErrors.has_convictions = 'Please answer the convictions question';
    }

    // Section 8: References - at least first referee is mandatory
    if (!formData.referee1.name.trim()) {
      newErrors['referee1.name'] = 'Referee 1 name is required';
    }
    if (!formData.referee1.telephone.trim() && !formData.referee1.email.trim()) {
      newErrors['referee1.contact'] = 'Referee 1 phone or email is required';
    }
    if (!formData.referee1.relationship.trim()) {
      newErrors['referee1.relationship'] = 'Referee 1 relationship is required';
    }

    // Declaration - mandatory
    if (!formData.declaration_agreed) {
      newErrors.declaration_agreed = 'You must agree to the declaration';
    }
    if (!formData.signature.trim()) {
      newErrors.signature = 'Signature is required';
    }
    if (!formData.signature_date) {
      newErrors.signature_date = 'Signature date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const selectedOrg = organizations.find(o => o.id === formData.organization_id);
  const selectedBranch = branches.find(b => b.id === formData.branch_id);
  const branchAddress = formData.branch_address || selectedBranch?.address || '';

  const addEmploymentHistory = () => {
    setFormData(prev => ({
      ...prev,
      employment_history: [...prev.employment_history, { employer: '', job_title: '', dates: '' }]
    }));
  };

  const removeEmploymentHistory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      employment_history: prev.employment_history.filter((_, i) => i !== index)
    }));
  };

  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { institution: '', from: '', to: '', qualifications: '' }]
    }));
  };

  const removeEducation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('onboarding_form_responses')
        .upsert({
          employee_id: employeeId,
          form_type: 'application_form',
          form_data: formData as any,
          signature: formData.signature,
          signed_at: formData.signature ? new Date().toISOString() : null
        }, { onConflict: 'employee_id,form_type' });

      if (error) throw error;
      toast.success('Application form saved');
      onSave();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save form';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      const errorElement = document.querySelector(`[data-field="${firstErrorKey}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    const saved = await handleSave();
    if (saved) {
      onNext();
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

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    const headerHeight = 25;
    let y = headerHeight + 5;
    const lineHeight = 6;
    const sectionGap = 8;

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
        doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 40, 8, 40, 12);
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
        return true;
      }
      return false;
    };

    const drawLine = (startY: number) => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.line(margin, startY, pageWidth - margin, startY);
    };

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

    // Header - Organization Name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedOrg?.name?.toUpperCase() || 'NIZA GROUP', pageWidth / 2, y, { align: 'center' });
    y += 12;

    doc.setFontSize(18);
    doc.text('Application form', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const contactText = `Please contact the site manager at ${branchAddress || 'the branch location'} if you require this form in an alternative format.`;
    doc.text(contactText, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
    y += 12;

    // Section 1: Position
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Position', margin, y);
    y += lineHeight + 2;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Closing date for applications: ${formatDateDDMMYYYY(formData.closing_date) || '............................'}`, margin, y);
    y += lineHeight + 2;
    doc.text(`Application for employment as a ${formData.position || '.....................'} at ${branchAddress || '.....................'}`, margin, y, { maxWidth: contentWidth });
    y += sectionGap + 4;

    // Section 2: Personal Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Personal Information', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const personalFields = [
      ['Title:', formData.title || ''],
      ['Name:', formData.name || ''],
      ['Address:', formData.address || ''],
      ['Postcode:', formData.postcode || ''],
      ['Phone:', formData.phone || ''],
      ['Email:', formData.email || '']
    ];
    
    personalFields.forEach(([label, value]) => {
      doc.text(`${label}`, margin, y);
      doc.text(value || '....................................', margin + 30, y);
      y += lineHeight;
    });

    y += 2;
    doc.text(`Are you eligible to work in the U.K. (Evidence will be required)?`, margin, y);
    const eligibleX = margin + 110;
    doc.text('Yes', eligibleX, y);
    drawCheckbox(eligibleX + 10, y, formData.eligible_to_work_uk === true);
    doc.text('No', eligibleX + 20, y);
    drawCheckbox(eligibleX + 28, y, formData.eligible_to_work_uk === false);
    y += lineHeight + 2;
    doc.text(`When can you start work?: ${formatDateDDMMYYYY(formData.start_date) || '............................'}`, margin, y);
    y += sectionGap + 4;

    // Section 3: Employment
    checkNewPage(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Employment', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Do you have previous employment to declare?`, margin, y);
    const prevEmpX = margin + 80;
    doc.text('Yes', prevEmpX, y);
    drawCheckbox(prevEmpX + 10, y, formData.has_previous_employment === true);
    doc.text('No', prevEmpX + 20, y);
    drawCheckbox(prevEmpX + 28, y, formData.has_previous_employment === false);
    y += sectionGap;

    if (formData.has_previous_employment === true) {
      doc.text(`Previous Employment:`, margin, y);
      y += lineHeight;
      doc.text(`Job Title: ${formData.current_job_title || '............................'}`, margin, y);
      y += lineHeight;
      doc.text(`Name and Address of Employer: ${formData.employer_address || ''}`, margin, y, { maxWidth: contentWidth });
      y += lineHeight + 2;
      doc.text(`Date Employment Commenced: ${formatDateDDMMYYYY(formData.employment_commenced) || '............................'}`, margin, y);
      y += lineHeight;
      doc.text(`Previous Salary: ${formData.present_salary || '............................'}`, margin, y);
      y += lineHeight + 4;

      doc.text('Please provide a brief summary of your previous duties:', margin, y);
      y += lineHeight;
      doc.text(formData.current_duties || '', margin, y, { maxWidth: contentWidth });
      y += Math.max(15, (formData.current_duties?.length || 0) / 80 * lineHeight);

      doc.text('Reason for leaving:', margin, y);
      y += lineHeight;
      doc.text(formData.reason_leaving || '', margin, y, { maxWidth: contentWidth });
      y += 10;

      doc.text(`Are you required to work any period of notice?`, margin, y);
      const noticeX = margin + 80;
      doc.text('Yes', noticeX, y);
      drawCheckbox(noticeX + 10, y, formData.notice_required === true);
      doc.text('No', noticeX + 20, y);
      drawCheckbox(noticeX + 28, y, formData.notice_required === false);
      y += lineHeight;
      doc.text(`Length of notice: ${formData.notice_length || '............................'}`, margin, y);
      y += sectionGap;

      checkNewPage(50);
      doc.setFontSize(9);
      doc.text('Please list in order the organisations you have worked for in the last 5 years:', margin, y, { maxWidth: contentWidth });
      y += lineHeight + 2;

      doc.setFont('helvetica', 'bold');
      doc.text('Name and address of employer', margin, y);
      doc.text('Job Title', margin + 80, y);
      doc.text('Dates employed', margin + 130, y);
      y += lineHeight;
      drawLine(y - 3);
      
      doc.setFont('helvetica', 'normal');
      formData.employment_history.forEach((emp) => {
        checkNewPage(10);
        doc.text(emp.employer || '', margin, y, { maxWidth: 75 });
        doc.text(emp.job_title || '', margin + 80, y, { maxWidth: 45 });
        doc.text(emp.dates || '', margin + 130, y, { maxWidth: 40 });
        y += lineHeight + 2;
      });
      y += sectionGap;
    }

    // Section 4: Education
    checkNewPage(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Education and Training', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Institution', margin, y);
    doc.text('From', margin + 60, y);
    doc.text('To', margin + 85, y);
    doc.text('Qualifications', margin + 110, y);
    y += lineHeight;
    drawLine(y - 3);
    doc.setFont('helvetica', 'normal');
    formData.education.forEach((edu) => {
      checkNewPage(10);
      doc.text(edu.institution || '', margin, y, { maxWidth: 55 });
      doc.text(edu.from || '', margin + 60, y);
      doc.text(edu.to || '', margin + 85, y);
      doc.text(edu.qualifications || '', margin + 110, y, { maxWidth: 60 });
      y += lineHeight + 2;
    });
    if (formData.other_qualifications) {
      y += 4;
      doc.text('Other qualifications:', margin, y);
      y += lineHeight;
      doc.text(formData.other_qualifications, margin, y, { maxWidth: contentWidth });
      y += lineHeight + 4;
    }
    y += sectionGap;

    // Section 5: Supporting Information
    checkNewPage(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Information in support of your application', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (formData.skills_experience) {
      const skillLines = doc.splitTextToSize(formData.skills_experience, contentWidth);
      checkNewPage(skillLines.length * 5 + 10);
      doc.text(skillLines, margin, y);
      y += skillLines.length * 5 + sectionGap;
    }
    y += sectionGap;

    // Section 6: Medical
    checkNewPage(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Medical', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Do you consider yourself to have a disability?', margin, y);
    const disX = margin + 80;
    doc.text('Yes', disX, y);
    drawCheckbox(disX + 10, y, formData.has_disability === true);
    doc.text('No', disX + 20, y);
    drawCheckbox(disX + 28, y, formData.has_disability === false);
    y += lineHeight + 2;
    if (formData.reasonable_adjustments) {
      doc.text(`Reasonable adjustments: ${formData.reasonable_adjustments}`, margin, y, { maxWidth: contentWidth });
      y += lineHeight + 2;
    }
    if (formData.unavailable_dates) {
      doc.text(`Unavailable dates: ${formData.unavailable_dates}`, margin, y);
      y += lineHeight + 2;
    }
    y += sectionGap;

    // Section 7: Convictions
    checkNewPage(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('7. Convictions', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Do you have any unspent criminal convictions or cautions?', margin, y);
    const convX = margin + 100;
    doc.text('Yes', convX, y);
    drawCheckbox(convX + 10, y, formData.has_convictions === true);
    doc.text('No', convX + 20, y);
    drawCheckbox(convX + 28, y, formData.has_convictions === false);
    y += sectionGap + 4;

    // Section 8: References
    checkNewPage(50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('8. References', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(10);

    const printReferee = (ref: typeof formData.referee1, label: string) => {
      checkNewPage(40);
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      y += lineHeight;
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${ref.name || '............................'}`, margin, y);
      y += lineHeight;
      doc.text(`Address: ${ref.address || '............................'}`, margin, y, { maxWidth: contentWidth });
      y += lineHeight;
      doc.text(`Telephone: ${ref.telephone || '............................'}`, margin, y);
      doc.text(`Email: ${ref.email || '............................'}`, margin + 80, y);
      y += lineHeight;
      doc.text(`Relationship: ${ref.relationship || '............................'}`, margin, y);
      y += lineHeight + 4;
    };
    printReferee(formData.referee1, 'Referee 1');
    printReferee(formData.referee2, 'Referee 2');

    // Declaration
    checkNewPage(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DECLARATION', margin, y);
    y += lineHeight + 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const declText = 'I declare that to the best of my knowledge the information given on this form is correct. I understand that any false information may result in my application not being considered, or if I am subsequently employed by the organisation, in the termination of my employment.';
    const declLines = doc.splitTextToSize(declText, contentWidth);
    doc.text(declLines, margin, y);
    y += declLines.length * 5 + 8;

    doc.setFontSize(10);
    doc.text(`Signature: ${formData.signature || '............................'}`, margin, y);
    y += lineHeight;
    doc.text(`Date: ${formatDateDDMMYYYY(formData.signature_date) || '............................'}`, margin, y);

    doc.save(`Application_Form_${formData.name.replace(/\s/g, '_')}.pdf`);
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
    <div className="space-y-6" ref={formRef}>
      <Card className="p-8 print:shadow-none bg-card">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={nizaLogo} alt="Niza Group" className="h-16 mx-auto mb-2" />
          <h2 className="text-xl font-bold">{selectedOrg?.name?.toUpperCase() || 'NIZA GROUP'}</h2>
          <h1 className="text-2xl font-bold text-primary mt-2">Application form</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please contact the site manager at {branchAddress || 'the branch location'} if you require this form in an alternative format.
          </p>
          <p className="text-sm text-amber-600 mt-2">Fields marked with * are mandatory</p>
        </div>

        {/* Section 1: Position */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">1. Position</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Closing date for applications</Label>
              <Input
                type="date"
                value={formData.closing_date}
                onChange={(e) => updateField('closing_date', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2" data-field="position">
              <RequiredLabel error={errors.position}>Position applied for</RequiredLabel>
              <Input
                value={formData.position}
                onChange={(e) => updateField('position', e.target.value)}
                placeholder="e.g., Sales Assistant"
                disabled={readOnly}
                className={errors.position ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.position} />
            </div>
          </div>
        </div>

        {/* Section 2: Personal Information */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">2. Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2" data-field="title">
              <RequiredLabel error={errors.title}>Title</RequiredLabel>
              <Select
                value={formData.title}
                onValueChange={(v) => updateField('title', v)}
                disabled={readOnly}
              >
                <SelectTrigger className={errors.title ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr">Mr</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Ms">Ms</SelectItem>
                  <SelectItem value="Miss">Miss</SelectItem>
                  <SelectItem value="Dr">Dr</SelectItem>
                </SelectContent>
              </Select>
              <ErrorMessage error={errors.title} />
            </div>
            <div className="space-y-2 md:col-span-3" data-field="name">
              <RequiredLabel error={errors.name}>Full Name</RequiredLabel>
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={readOnly}
                className={errors.name ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.name} />
            </div>
            <div className="space-y-2 md:col-span-3" data-field="address">
              <RequiredLabel error={errors.address}>Address</RequiredLabel>
              <Input
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                disabled={readOnly}
                className={errors.address ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.address} />
            </div>
            <div className="space-y-2" data-field="postcode">
              <RequiredLabel error={errors.postcode}>Postcode</RequiredLabel>
              <Input
                value={formData.postcode}
                onChange={(e) => updateField('postcode', e.target.value.toUpperCase())}
                disabled={readOnly}
                placeholder="e.g., SW1A 1AA"
                className={errors.postcode ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.postcode} />
            </div>
            <div className="space-y-2 md:col-span-2" data-field="phone">
              <RequiredLabel error={errors.phone}>Phone</RequiredLabel>
              <Input
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                disabled={readOnly}
                placeholder="e.g., 07123 456789"
                className={errors.phone ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.phone} />
            </div>
            <div className="space-y-2 md:col-span-2" data-field="email">
              <RequiredLabel error={errors.email}>Email</RequiredLabel>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                disabled={readOnly}
                className={errors.email ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.email} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4" data-field="eligible_to_work_uk">
            <RequiredLabel error={errors.eligible_to_work_uk}>Are you eligible to work in the U.K.? (Evidence will be required)</RequiredLabel>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.eligible_to_work_uk === true}
                  onCheckedChange={() => updateField('eligible_to_work_uk', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.eligible_to_work_uk === false}
                  onCheckedChange={() => updateField('eligible_to_work_uk', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
            <ErrorMessage error={errors.eligible_to_work_uk} />
          </div>
          <div className="mt-4 space-y-2 max-w-xs" data-field="start_date">
            <RequiredLabel error={errors.start_date}>When can you start work?</RequiredLabel>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              disabled={readOnly}
              className={errors.start_date ? 'border-destructive' : ''}
            />
            <ErrorMessage error={errors.start_date} />
          </div>
        </div>

        {/* Section 3: Employment */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">3. Employment</h3>
          <div className="flex flex-wrap items-center gap-4 mb-4" data-field="has_previous_employment">
            <RequiredLabel error={errors.has_previous_employment}>Do you have previous employment to declare?</RequiredLabel>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.has_previous_employment === true}
                  onCheckedChange={() => updateField('has_previous_employment', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.has_previous_employment === false}
                  onCheckedChange={() => updateField('has_previous_employment', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
            <ErrorMessage error={errors.has_previous_employment} />
          </div>
          
          {formData.has_previous_employment === true && (
            <>
              <p className="text-sm text-muted-foreground mb-4">Previous Employment:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input
                    value={formData.current_job_title}
                    onChange={(e) => updateField('current_job_title', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date Employment Commenced</Label>
                  <Input
                    type="date"
                    value={formData.employment_commenced}
                    onChange={(e) => updateField('employment_commenced', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Name and Address of Employer</Label>
                  <Textarea
                    value={formData.employer_address}
                    onChange={(e) => updateField('employer_address', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Previous Salary</Label>
                  <Input
                    value={formData.present_salary}
                    onChange={(e) => updateField('present_salary', e.target.value)}
                    placeholder="e.g., £25,000 per annum"
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Please provide a brief summary of your previous duties:</Label>
                <Textarea
                  value={formData.current_duties}
                  onChange={(e) => updateField('current_duties', e.target.value)}
                  disabled={readOnly}
                  rows={4}
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label>Reason for leaving:</Label>
                <Textarea
                  value={formData.reason_leaving}
                  onChange={(e) => updateField('reason_leaving', e.target.value)}
                  disabled={readOnly}
                  rows={2}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Label>Are you required to work any period of notice?</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.notice_required === true}
                      onCheckedChange={() => updateField('notice_required', true)}
                      disabled={readOnly}
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.notice_required === false}
                      onCheckedChange={() => updateField('notice_required', false)}
                      disabled={readOnly}
                    />
                    No
                  </label>
                </div>
              </div>
              {formData.notice_required && (
                <div className="mt-2 space-y-2 max-w-xs">
                  <Label>Length of notice:</Label>
                  <Input
                    value={formData.notice_length}
                    onChange={(e) => updateField('notice_length', e.target.value)}
                    placeholder="e.g., 2 weeks"
                    disabled={readOnly}
                  />
                </div>
              )}

              {/* Employment History Table */}
              <div className="mt-6">
                <Label className="text-sm">
                  Please list in order the organisations you have worked for in the last 5 years, full-time and part-time, paid and unpaid, including relevant voluntary work:
                </Label>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="border border-border p-2 text-left text-sm font-medium">Name and address of employer</th>
                        <th className="border border-border p-2 text-left text-sm font-medium">Job Title</th>
                        <th className="border border-border p-2 text-left text-sm font-medium">Dates employed from and to</th>
                        {!readOnly && <th className="border border-border p-2 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.employment_history.map((emp, index) => (
                        <tr key={index}>
                          <td className="border border-border p-1">
                            <Input
                              value={emp.employer}
                              onChange={(e) => {
                                const updated = [...formData.employment_history];
                                updated[index].employer = e.target.value;
                                updateField('employment_history', updated);
                              }}
                              className="border-0"
                              disabled={readOnly}
                            />
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={emp.job_title}
                              onChange={(e) => {
                                const updated = [...formData.employment_history];
                                updated[index].job_title = e.target.value;
                                updateField('employment_history', updated);
                              }}
                              className="border-0"
                              disabled={readOnly}
                            />
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={emp.dates}
                              onChange={(e) => {
                                const updated = [...formData.employment_history];
                                updated[index].dates = e.target.value;
                                updateField('employment_history', updated);
                              }}
                              className="border-0"
                              placeholder="e.g., Jan 2020 - Dec 2022"
                              disabled={readOnly}
                            />
                          </td>
                          {!readOnly && (
                            <td className="border border-border p-1">
                              {formData.employment_history.length > 1 && (
                                <Button variant="ghost" size="icon" onClick={() => removeEmploymentHistory(index)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={addEmploymentHistory} className="mt-2 gap-2">
                    <Plus className="h-4 w-4" />
                    Add Row
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Section 4: Education */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">4. Education</h3>
          <Label className="text-sm">
            Please list in order the schools/colleges/universities you have attended from the age of 11 years old:
          </Label>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse border border-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-border p-2 text-left text-sm font-medium">Institution</th>
                  <th className="border border-border p-2 text-left text-sm font-medium">From (year)</th>
                  <th className="border border-border p-2 text-left text-sm font-medium">To (year)</th>
                  <th className="border border-border p-2 text-left text-sm font-medium">Qualifications gained</th>
                  {!readOnly && <th className="border border-border p-2 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {formData.education.map((edu, index) => (
                  <tr key={index}>
                    <td className="border border-border p-1">
                      <Input
                        value={edu.institution}
                        onChange={(e) => {
                          const updated = [...formData.education];
                          updated[index].institution = e.target.value;
                          updateField('education', updated);
                        }}
                        className="border-0"
                        disabled={readOnly}
                      />
                    </td>
                    <td className="border border-border p-1">
                      <Input
                        value={edu.from}
                        onChange={(e) => {
                          const updated = [...formData.education];
                          updated[index].from = e.target.value;
                          updateField('education', updated);
                        }}
                        className="border-0"
                        placeholder="e.g., 2015"
                        disabled={readOnly}
                      />
                    </td>
                    <td className="border border-border p-1">
                      <Input
                        value={edu.to}
                        onChange={(e) => {
                          const updated = [...formData.education];
                          updated[index].to = e.target.value;
                          updateField('education', updated);
                        }}
                        className="border-0"
                        placeholder="e.g., 2020"
                        disabled={readOnly}
                      />
                    </td>
                    <td className="border border-border p-1">
                      <Input
                        value={edu.qualifications}
                        onChange={(e) => {
                          const updated = [...formData.education];
                          updated[index].qualifications = e.target.value;
                          updateField('education', updated);
                        }}
                        className="border-0"
                        disabled={readOnly}
                      />
                    </td>
                    {!readOnly && (
                      <td className="border border-border p-1">
                        {formData.education.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeEducation(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addEducation} className="mt-2 gap-2">
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          )}
          <div className="mt-4 space-y-2">
            <Label>Please list any other qualifications gained which you feel may support your application:</Label>
            <Textarea
              value={formData.other_qualifications}
              onChange={(e) => updateField('other_qualifications', e.target.value)}
              disabled={readOnly}
              rows={3}
            />
          </div>
        </div>

        {/* Section 5: Supporting Information */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">5. Information in support of your application</h3>
          <Label className="text-sm">
            Please include any skills, experience and qualifications you have acquired that can support this application whether within the working environment or outside.
          </Label>
          <Textarea
            value={formData.skills_experience}
            onChange={(e) => updateField('skills_experience', e.target.value)}
            disabled={readOnly}
            rows={6}
            className="mt-4"
          />
        </div>

        {/* Section 6: Medical */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">6. Medical</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {selectedOrg?.name || 'The Company'} is an equal opportunities employer. The sole criterion for selection is the suitability of an applicant for the job for which they are applying. We do not discriminate on any grounds.
          </p>
          <div className="flex flex-wrap items-center gap-4" data-field="has_disability">
            <RequiredLabel error={errors.has_disability}>Do you consider yourself to have a disability?</RequiredLabel>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.has_disability === true}
                  onCheckedChange={() => updateField('has_disability', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.has_disability === false}
                  onCheckedChange={() => updateField('has_disability', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
            <ErrorMessage error={errors.has_disability} />
          </div>
          <div className="mt-4 space-y-2">
            <Label>Please tell us if there are any 'reasonable adjustments' we can make to assist you in your application or with our recruitment process:</Label>
            <Textarea
              value={formData.reasonable_adjustments}
              onChange={(e) => updateField('reasonable_adjustments', e.target.value)}
              disabled={readOnly}
              rows={2}
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label>Please list any dates you are not available for interview:</Label>
            <Input
              value={formData.unavailable_dates}
              onChange={(e) => updateField('unavailable_dates', e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Section 7: Convictions */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">7. Convictions - Rehabilitation of Offenders Act 1974</h3>
          <div className="flex flex-wrap items-center gap-4" data-field="has_convictions">
            <RequiredLabel error={errors.has_convictions}>Do you have any unspent criminal convictions or cautions?</RequiredLabel>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.has_convictions === true}
                  onCheckedChange={() => updateField('has_convictions', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.has_convictions === false}
                  onCheckedChange={() => updateField('has_convictions', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
            <ErrorMessage error={errors.has_convictions} />
          </div>
        </div>

        {/* Section 8: References */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">8. References</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Please give the names and addresses of two persons as referees who we can approach now for references. No approach will be made to your present or previous employers before an offer of employment is made.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Referee 1 */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium">Referee 1 <span className="text-destructive">*</span></h4>
              <div className="space-y-2" data-field="referee1.name">
                <RequiredLabel error={errors['referee1.name']}>Name</RequiredLabel>
                <Input
                  value={formData.referee1.name}
                  onChange={(e) => updateField('referee1', { ...formData.referee1, name: e.target.value })}
                  disabled={readOnly}
                  className={errors['referee1.name'] ? 'border-destructive' : ''}
                />
                <ErrorMessage error={errors['referee1.name']} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={formData.referee1.address}
                  onChange={(e) => updateField('referee1', { ...formData.referee1, address: e.target.value })}
                  disabled={readOnly}
                  rows={2}
                />
              </div>
              <div className="space-y-2" data-field="referee1.contact">
                <Label>Telephone</Label>
                <Input
                  value={formData.referee1.telephone}
                  onChange={(e) => updateField('referee1', { ...formData.referee1, telephone: e.target.value })}
                  disabled={readOnly}
                  placeholder="Phone or email required"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.referee1.email}
                  onChange={(e) => updateField('referee1', { ...formData.referee1, email: e.target.value })}
                  disabled={readOnly}
                />
                <ErrorMessage error={errors['referee1.contact']} />
              </div>
              <div className="space-y-2" data-field="referee1.relationship">
                <RequiredLabel error={errors['referee1.relationship']}>Relationship</RequiredLabel>
                <Input
                  value={formData.referee1.relationship}
                  onChange={(e) => updateField('referee1', { ...formData.referee1, relationship: e.target.value })}
                  disabled={readOnly}
                  placeholder="e.g., Former Manager"
                  className={errors['referee1.relationship'] ? 'border-destructive' : ''}
                />
                <ErrorMessage error={errors['referee1.relationship']} />
              </div>
            </div>

            {/* Referee 2 */}
            <div className="space-y-3 p-4 border rounded-lg">
              <h4 className="font-medium">Referee 2</h4>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.referee2.name}
                  onChange={(e) => updateField('referee2', { ...formData.referee2, name: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={formData.referee2.address}
                  onChange={(e) => updateField('referee2', { ...formData.referee2, address: e.target.value })}
                  disabled={readOnly}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Telephone</Label>
                <Input
                  value={formData.referee2.telephone}
                  onChange={(e) => updateField('referee2', { ...formData.referee2, telephone: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.referee2.email}
                  onChange={(e) => updateField('referee2', { ...formData.referee2, email: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Input
                  value={formData.referee2.relationship}
                  onChange={(e) => updateField('referee2', { ...formData.referee2, relationship: e.target.value })}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        </div>

        {/* GDPR Notice */}
        <p className="text-xs text-muted-foreground mb-6">
          I understand that the data I have given will be processed and used in accordance with the EU General Data Protection Regulation (GDPR) and the Data Protection Act 1998 and hereby give permission for my details to be retained.
        </p>

        {/* Declaration */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-bold text-lg mb-4">DECLARATION</h3>
          <p className="text-sm text-muted-foreground mb-4">
            I declare that to the best of my knowledge the information given on this form is correct. I understand that any false information may result in my application not being considered, or if I am subsequently employed by the organisation, in the termination of my employment.
          </p>
          <div className="flex items-center gap-2 mb-4" data-field="declaration_agreed">
            <Checkbox
              checked={formData.declaration_agreed}
              onCheckedChange={(checked) => updateField('declaration_agreed', checked)}
              disabled={readOnly}
            />
            <RequiredLabel error={errors.declaration_agreed}>I agree to the above declaration</RequiredLabel>
            <ErrorMessage error={errors.declaration_agreed} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2" data-field="signature">
              <RequiredLabel error={errors.signature}>Signature (To be signed by employee while uploading)</RequiredLabel>
              <Input
                value={formData.signature}
                onChange={(e) => updateField('signature', e.target.value)}
                placeholder="To be signed by employee"
                disabled={readOnly}
                readOnly={readOnly}
                className={`font-serif italic text-lg bg-muted/50 ${errors.signature ? 'border-destructive' : ''}`}
              />
              <ErrorMessage error={errors.signature} />
            </div>
            <div className="space-y-2" data-field="signature_date">
              <RequiredLabel error={errors.signature_date}>Date</RequiredLabel>
              <Input
                type="date"
                value={formData.signature_date}
                onChange={(e) => updateField('signature_date', e.target.value)}
                disabled={readOnly}
                className={errors.signature_date ? 'border-destructive' : ''}
              />
              <ErrorMessage error={errors.signature_date} />
            </div>
          </div>
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
