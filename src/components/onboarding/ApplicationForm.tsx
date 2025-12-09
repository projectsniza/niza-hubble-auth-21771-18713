import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Save } from 'lucide-react';
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
    organization_id: string;
    branch_id: string;
  };
  organizations: { id: string; name: string }[];
  onSave: () => void;
  onNext: () => void;
  readOnly?: boolean;
}

interface FormData {
  organization_id: string;
  position: string;
  closing_date: string;
  title: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  eligible_to_work_uk: boolean;
  start_date: string;
  current_employer: string;
  current_job_title: string;
  employer_address: string;
  employment_commenced: string;
  present_salary: string;
  current_duties: string;
  reason_leaving: string;
  notice_required: boolean;
  notice_length: string;
  employment_history: { employer: string; job_title: string; dates: string }[];
  education: { institution: string; from: string; to: string; qualifications: string }[];
  other_qualifications: string;
  skills_experience: string;
  has_disability: boolean;
  reasonable_adjustments: string;
  unavailable_dates: string;
  has_convictions: boolean;
  referee1: { name: string; address: string; telephone: string; email: string; relationship: string };
  referee2: { name: string; address: string; telephone: string; email: string; relationship: string };
  declaration_agreed: boolean;
  signature: string;
  signature_date: string;
}

export default function ApplicationForm({
  employeeId,
  employeeData,
  organizations,
  onSave,
  onNext,
  readOnly = false
}: ApplicationFormProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    organization_id: employeeData.organization_id,
    position: '',
    closing_date: '',
    title: '',
    name: `${employeeData.first_name} ${employeeData.last_name}`,
    address: employeeData.address || '',
    postcode: '',
    phone: employeeData.phone || '',
    email: employeeData.email || '',
    eligible_to_work_uk: false,
    start_date: '',
    current_employer: '',
    current_job_title: '',
    employer_address: '',
    employment_commenced: '',
    present_salary: '',
    current_duties: '',
    reason_leaving: '',
    notice_required: false,
    notice_length: '',
    employment_history: [{ employer: '', job_title: '', dates: '' }],
    education: [{ institution: '', from: '', to: '', qualifications: '' }],
    other_qualifications: '',
    skills_experience: '',
    has_disability: false,
    reasonable_adjustments: '',
    unavailable_dates: '',
    has_convictions: false,
    referee1: { name: '', address: '', telephone: '', email: '', relationship: '' },
    referee2: { name: '', address: '', telephone: '', email: '', relationship: '' },
    declaration_agreed: false,
    signature: '',
    signature_date: ''
  });

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
      setFormData(prev => ({ ...prev, ...(data.form_data as unknown as FormData) }));
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectedOrg = organizations.find(o => o.id === formData.organization_id);

  const handleSave = async () => {
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
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 7;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedOrg?.name || 'Organization', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(14);
    doc.text('Application Form', pageWidth / 2, y, { align: 'center' });
    y += 15;
    
    // Section 1: Position
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Position', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Closing date: ${formData.closing_date || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Position applied for: ${formData.position || '__________'}`, margin, y);
    y += 12;
    
    // Section 2: Personal Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Personal Information', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Title: ${formData.title || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Name: ${formData.name || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Address: ${formData.address || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Postcode: ${formData.postcode || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Phone: ${formData.phone || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Email: ${formData.email || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Eligible to work in UK: ${formData.eligible_to_work_uk ? 'Yes' : 'No'}`, margin, y);
    y += lineHeight;
    doc.text(`Available start date: ${formData.start_date || '__________'}`, margin, y);
    y += 12;
    
    // Section 3: Employment
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Current Employment', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Current Employer: ${formData.current_employer || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Job Title: ${formData.current_job_title || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Present Salary: ${formData.present_salary || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Reason for leaving: ${formData.reason_leaving || '__________'}`, margin, y);
    y += 12;

    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    
    // Section 4: Referees
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Referees', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Referee 1: ${formData.referee1.name || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Contact: ${formData.referee1.email || '__________'} / ${formData.referee1.telephone || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Referee 2: ${formData.referee2.name || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`Contact: ${formData.referee2.email || '__________'} / ${formData.referee2.telephone || '__________'}`, margin, y);
    y += 15;
    
    // Signature
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Declaration', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('I confirm that all information provided is accurate.', margin, y);
    y += 15;
    doc.text(`Signature: ${formData.signature || '____________________'}`, margin, y);
    y += lineHeight;
    doc.text(`Date: ${formData.signature_date || '____________________'}`, margin, y);
    
    doc.save(`Application_Form_${formData.name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const addEmploymentHistory = () => {
    setFormData(prev => ({
      ...prev,
      employment_history: [...prev.employment_history, { employer: '', job_title: '', dates: '' }]
    }));
  };

  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { institution: '', from: '', to: '', qualifications: '' }]
    }));
  };

  return (
    <div className="space-y-6" ref={formRef}>
      <Card className="p-8 print:shadow-none">
        {/* Header */}
        <div className="text-center mb-8 print:mb-4">
          <img src={nizaLogo} alt="Niza Group" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary">{selectedOrg?.name || 'Organization'}</h1>
          <h2 className="text-xl font-semibold mt-2">Application Form</h2>
        </div>

        {/* Organization Selection */}
        <div className="mb-6 print:hidden">
          <Label>Select Organization</Label>
          <Select
            value={formData.organization_id}
            onValueChange={(v) => updateField('organization_id', v)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section 1: Position */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">1. Position</h3>
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
            <div className="space-y-2">
              <Label>Application for employment as</Label>
              <Input
                value={formData.position}
                onChange={(e) => updateField('position', e.target.value)}
                placeholder="Enter position"
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Personal Information */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">2. Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Select
                value={formData.title}
                onValueChange={(v) => updateField('title', v)}
                disabled={readOnly}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr">Mr</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Ms">Ms</SelectItem>
                  <SelectItem value="Miss">Miss</SelectItem>
                  <SelectItem value="Dr">Dr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Full Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input
                value={formData.postcode}
                onChange={(e) => updateField('postcode', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Label>Are you eligible to work in the U.K.? (Evidence required)</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.eligible_to_work_uk === true}
                  onCheckedChange={() => updateField('eligible_to_work_uk', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.eligible_to_work_uk === false}
                  onCheckedChange={() => updateField('eligible_to_work_uk', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>When can you start work?</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Section 3: Employment */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">3. Employment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current/Present Employer</Label>
              <Input
                value={formData.current_employer}
                onChange={(e) => updateField('current_employer', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input
                value={formData.current_job_title}
                onChange={(e) => updateField('current_job_title', e.target.value)}
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
              <Label>Date Employment Commenced</Label>
              <Input
                type="date"
                value={formData.employment_commenced}
                onChange={(e) => updateField('employment_commenced', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Present Salary</Label>
              <Input
                value={formData.present_salary}
                onChange={(e) => updateField('present_salary', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>Brief summary of current duties</Label>
            <Textarea
              value={formData.current_duties}
              onChange={(e) => updateField('current_duties', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label>Reason for leaving</Label>
            <Textarea
              value={formData.reason_leaving}
              onChange={(e) => updateField('reason_leaving', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Label>Are you required to work any period of notice?</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.notice_required === true}
                  onCheckedChange={() => updateField('notice_required', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
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
            <div className="mt-2 space-y-2">
              <Label>Length of notice</Label>
              <Input
                value={formData.notice_length}
                onChange={(e) => updateField('notice_length', e.target.value)}
                disabled={readOnly}
              />
            </div>
          )}
        </div>

        {/* Employment History */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Employment History (Last 5 years)</h3>
          <div className="space-y-4">
            {formData.employment_history.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <Input
                  placeholder="Employer name and address"
                  value={item.employer}
                  onChange={(e) => {
                    const updated = [...formData.employment_history];
                    updated[index].employer = e.target.value;
                    updateField('employment_history', updated);
                  }}
                  disabled={readOnly}
                />
                <Input
                  placeholder="Job Title"
                  value={item.job_title}
                  onChange={(e) => {
                    const updated = [...formData.employment_history];
                    updated[index].job_title = e.target.value;
                    updateField('employment_history', updated);
                  }}
                  disabled={readOnly}
                />
                <Input
                  placeholder="Dates (from - to)"
                  value={item.dates}
                  onChange={(e) => {
                    const updated = [...formData.employment_history];
                    updated[index].dates = e.target.value;
                    updateField('employment_history', updated);
                  }}
                  disabled={readOnly}
                />
              </div>
            ))}
            {!readOnly && (
              <Button type="button" variant="outline" onClick={addEmploymentHistory}>
                Add More
              </Button>
            )}
          </div>
        </div>

        {/* Section 4: Education */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">4. Education</h3>
          <div className="space-y-4">
            {formData.education.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <Input
                  placeholder="Institution"
                  value={item.institution}
                  onChange={(e) => {
                    const updated = [...formData.education];
                    updated[index].institution = e.target.value;
                    updateField('education', updated);
                  }}
                  disabled={readOnly}
                />
                <Input
                  placeholder="From (year)"
                  value={item.from}
                  onChange={(e) => {
                    const updated = [...formData.education];
                    updated[index].from = e.target.value;
                    updateField('education', updated);
                  }}
                  disabled={readOnly}
                />
                <Input
                  placeholder="To (year)"
                  value={item.to}
                  onChange={(e) => {
                    const updated = [...formData.education];
                    updated[index].to = e.target.value;
                    updateField('education', updated);
                  }}
                  disabled={readOnly}
                />
                <Input
                  placeholder="Qualifications gained"
                  value={item.qualifications}
                  onChange={(e) => {
                    const updated = [...formData.education];
                    updated[index].qualifications = e.target.value;
                    updateField('education', updated);
                  }}
                  disabled={readOnly}
                />
              </div>
            ))}
            {!readOnly && (
              <Button type="button" variant="outline" onClick={addEducation}>
                Add More
              </Button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <Label>Other qualifications</Label>
            <Textarea
              value={formData.other_qualifications}
              onChange={(e) => updateField('other_qualifications', e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Section 5: Skills */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">5. Information in support of your application</h3>
          <Textarea
            value={formData.skills_experience}
            onChange={(e) => updateField('skills_experience', e.target.value)}
            placeholder="Skills, experience and qualifications..."
            rows={4}
            disabled={readOnly}
          />
        </div>

        {/* Section 6: Medical */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">6. Medical</h3>
          <div className="flex items-center gap-4 mb-4">
            <Label>Do you consider yourself to have a disability?</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.has_disability === true}
                  onCheckedChange={() => updateField('has_disability', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.has_disability === false}
                  onCheckedChange={() => updateField('has_disability', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Please tell us if there are any 'reasonable adjustments' we can make</Label>
            <Textarea
              value={formData.reasonable_adjustments}
              onChange={(e) => updateField('reasonable_adjustments', e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label>Dates not available for interview</Label>
            <Input
              value={formData.unavailable_dates}
              onChange={(e) => updateField('unavailable_dates', e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* Section 7: Convictions */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">7. Convictions - Rehabilitation of Offenders Act 1974</h3>
          <div className="flex items-center gap-4">
            <Label>Do you have any unspent criminal convictions or cautions?</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.has_convictions === true}
                  onCheckedChange={() => updateField('has_convictions', true)}
                  disabled={readOnly}
                />
                Yes
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={formData.has_convictions === false}
                  onCheckedChange={() => updateField('has_convictions', false)}
                  disabled={readOnly}
                />
                No
              </label>
            </div>
          </div>
        </div>

        {/* Section 8: References */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">8. References</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Referee 1</h4>
              <Input
                placeholder="Name"
                value={formData.referee1.name}
                onChange={(e) => updateField('referee1', { ...formData.referee1, name: e.target.value })}
                disabled={readOnly}
              />
              <Textarea
                placeholder="Address"
                value={formData.referee1.address}
                onChange={(e) => updateField('referee1', { ...formData.referee1, address: e.target.value })}
                disabled={readOnly}
              />
              <Input
                placeholder="Telephone"
                value={formData.referee1.telephone}
                onChange={(e) => updateField('referee1', { ...formData.referee1, telephone: e.target.value })}
                disabled={readOnly}
              />
              <Input
                placeholder="Email"
                value={formData.referee1.email}
                onChange={(e) => updateField('referee1', { ...formData.referee1, email: e.target.value })}
                disabled={readOnly}
              />
              <Input
                placeholder="Relationship"
                value={formData.referee1.relationship}
                onChange={(e) => updateField('referee1', { ...formData.referee1, relationship: e.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">Referee 2</h4>
              <Input
                placeholder="Name"
                value={formData.referee2.name}
                onChange={(e) => updateField('referee2', { ...formData.referee2, name: e.target.value })}
                disabled={readOnly}
              />
              <Textarea
                placeholder="Address"
                value={formData.referee2.address}
                onChange={(e) => updateField('referee2', { ...formData.referee2, address: e.target.value })}
                disabled={readOnly}
              />
              <Input
                placeholder="Telephone"
                value={formData.referee2.telephone}
                onChange={(e) => updateField('referee2', { ...formData.referee2, telephone: e.target.value })}
                disabled={readOnly}
              />
              <Input
                placeholder="Email"
                value={formData.referee2.email}
                onChange={(e) => updateField('referee2', { ...formData.referee2, email: e.target.value })}
                disabled={readOnly}
              />
              <Input
                placeholder="Relationship"
                value={formData.referee2.relationship}
                onChange={(e) => updateField('referee2', { ...formData.referee2, relationship: e.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Declaration */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-4">Declaration</h3>
          <p className="text-sm text-muted-foreground mb-4">
            I understand that the data I have given will be processed and used in accordance with the EU General Data Protection Regulation (GDPR) and the Data Protection Act 1998 and hereby give permission for my details to be retained.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            I declare that all the information I have provided above is correct. I understand that any false statement, misrepresentation or withholding of information may lead to withdrawal of my application, withdrawal of any offer of employment, my dismissal and/or other action.
          </p>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.declaration_agreed}
              onCheckedChange={(checked) => updateField('declaration_agreed', checked)}
              disabled={readOnly}
            />
            <span>I agree to the above declaration</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Signature (Type your name)</Label>
              <Input
                value={formData.signature}
                onChange={(e) => updateField('signature', e.target.value)}
                placeholder="Type your full name as signature"
                className="italic"
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

        {/* Actions */}
        {!readOnly && (
          <div className="flex justify-between print:hidden">
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Download / Print
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button onClick={() => { handleSave(); onNext(); }} disabled={loading}>
                Save & Continue
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}