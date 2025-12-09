import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import nizaLogo from '@/assets/niza-group-logo.png';

interface StarterChecklistProps {
  employeeId: string;
  employeeData: {
    first_name: string;
    last_name: string;
  };
  onSave: () => void;
  onNext: () => void;
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
  has_student_loan: boolean;
  repaying_direct: boolean;
  student_loan_type: 'plan1' | 'plan2' | '';
  finished_before_april: boolean;
  signature: string;
  signature_date: string;
}

export default function StarterChecklist({
  employeeId,
  employeeData,
  onSave,
  onNext,
  readOnly = false
}: StarterChecklistProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    last_name: employeeData.last_name || '',
    first_names: employeeData.first_name || '',
    gender: '',
    date_of_birth: '',
    address: '',
    postcode: '',
    country: '',
    national_insurance: '',
    employment_start_date: '',
    statement: '',
    has_student_loan: false,
    repaying_direct: false,
    student_loan_type: '',
    finished_before_april: false,
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
      .eq('form_type', 'starter_checklist')
      .maybeSingle();

    if (data?.form_data) {
      setFormData(prev => ({ ...prev, ...(data.form_data as unknown as FormData) }));
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
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
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 print:shadow-none">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={nizaLogo} alt="Niza Group" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Starter Checklist</h1>
          <p className="text-sm text-muted-foreground mt-2">HMRC Starter Checklist for New Employees</p>
        </div>

        {/* Employee's Personal Details */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Employee's Personal Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>1. Last Name</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>2. First Name(s)</Label>
              <Input
                value={formData.first_names}
                onChange={(e) => updateField('first_names', e.target.value)}
                placeholder="Do not enter initials or shortened names"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="mt-4">
            <Label>3. Are you male or female?</Label>
            <RadioGroup
              value={formData.gender}
              onValueChange={(v) => updateField('gender', v)}
              className="flex gap-6 mt-2"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>4. Date of Birth</Label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>5. Home Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>6. National Insurance Number (if known)</Label>
              <Input
                value={formData.national_insurance}
                onChange={(e) => updateField('national_insurance', e.target.value)}
                placeholder="AB 12 34 56 C"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>7. Employment Start Date</Label>
              <Input
                type="date"
                value={formData.employment_start_date}
                onChange={(e) => updateField('employment_start_date', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Employee Statement */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Employee Statement</h3>
          <p className="text-sm text-muted-foreground mb-4">You need to select only one of the following statements A, B or C</p>
          
          <RadioGroup
            value={formData.statement}
            onValueChange={(v) => updateField('statement', v)}
            className="space-y-4"
            disabled={readOnly}
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="A" id="statementA" className="mt-1" />
              <div>
                <Label htmlFor="statementA" className="font-medium">Statement A</Label>
                <p className="text-sm text-muted-foreground">
                  This is my first job since last 6 April and I have not been receiving taxable Jobseeker's Allowance, 
                  Employment and Support Allowance, taxable Incapacity Benefit, State or Occupational Pension.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="B" id="statementB" className="mt-1" />
              <div>
                <Label htmlFor="statementB" className="font-medium">Statement B</Label>
                <p className="text-sm text-muted-foreground">
                  This is now my only job but since last 6 April I have had another job, or received taxable Jobseeker's Allowance, 
                  Employment and Support Allowance or taxable Incapacity Benefit. I do not receive a State or Occupational Pension.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="C" id="statementC" className="mt-1" />
              <div>
                <Label htmlFor="statementC" className="font-medium">Statement C</Label>
                <p className="text-sm text-muted-foreground">
                  As well as my new job, I have another job or receive a State or Occupational Pension.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Student Loan */}
        <div className="border-b pb-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Student Loan</h3>
          
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <h4 className="font-medium mb-2">Student Loan Plans</h4>
            <p className="text-sm text-muted-foreground mb-2">
              You will have a <strong>Plan 1</strong> Student Loan if:
            </p>
            <ul className="text-sm text-muted-foreground list-disc ml-5 mb-2">
              <li>You lived in Scotland or Northern Ireland when you started your course, or</li>
              <li>You lived in England or Wales and started your course before September 2012</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              You will have a <strong>Plan 2</strong> Student Loan if you lived in England or Wales and started your course on or after 1 September 2012.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label>9. Do you have a Student Loan which is not fully repaid?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.has_student_loan === true}
                    onCheckedChange={() => updateField('has_student_loan', true)}
                    disabled={readOnly}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.has_student_loan === false}
                    onCheckedChange={() => updateField('has_student_loan', false)}
                    disabled={readOnly}
                  />
                  No
                </label>
              </div>
            </div>

            {formData.has_student_loan && (
              <>
                <div className="flex items-center gap-4">
                  <Label>10. Are you repaying your Student Loan direct to the Student Loans Company?</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.repaying_direct === true}
                        onCheckedChange={() => updateField('repaying_direct', true)}
                        disabled={readOnly}
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.repaying_direct === false}
                        onCheckedChange={() => updateField('repaying_direct', false)}
                        disabled={readOnly}
                      />
                      No
                    </label>
                  </div>
                </div>

                {!formData.repaying_direct && (
                  <div>
                    <Label>11. What type of Student Loan do you have?</Label>
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

            <div className="flex items-center gap-4">
              <Label>12. Did you finish your studies before the last 6 April?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.finished_before_april === true}
                    onCheckedChange={() => updateField('finished_before_april', true)}
                    disabled={readOnly}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2">
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
        </div>

        {/* Signature */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-4">Declaration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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