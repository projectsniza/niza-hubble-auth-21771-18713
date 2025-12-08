import { EmployeeFormData } from '@/pages/dashboard/AddEmployee';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Printer } from 'lucide-react';
import nizaGroupLogo from '@/assets/niza-group-logo.png';

interface StarterChecklistStepProps {
  formData: EmployeeFormData;
  updateFormData: (updates: Partial<EmployeeFormData>) => void;
}

export default function StarterChecklistStep({ formData, updateFormData }: StarterChecklistStepProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Starter Checklist</h2>
          <p className="text-muted-foreground">HMRC New Starter Information</p>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print Form
        </Button>
      </div>

      <div className="border rounded-lg p-6 space-y-6 bg-white print:shadow-none">
        <div className="flex items-center gap-4 pb-4 border-b">
          <img src={nizaGroupLogo} alt="Niza Group" className="h-16" />
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions for employers</h3>
            <p className="text-sm text-muted-foreground">
              This Starter Checklist can be used to gather information about your new employee. 
              You can use this information to help fill in your first Full Payment Submission (FPS) 
              for this employee. You need to keep the information recorded on the Starter Checklist 
              record for the current and previous three tax years. Do not send this form to HMRC.
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions for employees</h3>
            <p className="text-sm text-muted-foreground">
              As a new employee your employer needs the information on this form before your first 
              payday to tell HMRC about you and help them use the correct tax code. Fill in this form 
              then give it to your employer. Do not send this form to HMRC.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Employee's personal details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Last name</p>
              <p className="font-medium">{formData.lastName || '_______________'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">First name(s)</p>
              <p className="font-medium">{formData.firstName} {formData.middleName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gender</p>
              <p className="font-medium">{formData.gender}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date of birth</p>
              <p className="font-medium">{formData.dateOfBirth?.toLocaleDateString() || 'DD/MM/YYYY'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Home address</p>
              <p className="font-medium">
                {formData.address1 && `${formData.address1}, `}
                {formData.address2 && `${formData.address2}, `}
                {formData.townCity && `${formData.townCity}, `}
                {formData.postcode || '_______________'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">National Insurance number</p>
              <p className="font-medium">{formData.niNumber || '_______________'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Employment start date</p>
              <p className="font-medium">{formData.employmentStartDate?.toLocaleDateString() || 'DD/MM/YYYY'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Employee statement</h3>
          <p className="text-sm text-muted-foreground">
            You need to select only one of the following statements A, B or C
          </p>
          <RadioGroup
            value={formData.starterStatement}
            onValueChange={(value) => updateFormData({ starterStatement: value })}
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="A" id="statement-a" />
              <Label htmlFor="statement-a" className="text-sm leading-relaxed cursor-pointer">
                <span className="font-semibold">A</span> - This is my first job since last 6 April 
                and I have not been receiving taxable Jobseeker's Allowance, Employment and Support 
                Allowance, taxable Incapacity Benefit, State or Occupational Pension.
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="B" id="statement-b" />
              <Label htmlFor="statement-b" className="text-sm leading-relaxed cursor-pointer">
                <span className="font-semibold">B</span> - This is now my only job but since last 6 April 
                I have had another job, or received taxable Jobseeker's Allowance, Employment and Support 
                Allowance or taxable Incapacity Benefit. I do not receive a State or Occupational Pension.
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="C" id="statement-c" />
              <Label htmlFor="statement-c" className="text-sm leading-relaxed cursor-pointer">
                <span className="font-semibold">C</span> - As well as my new job, I have another job 
                or receive a State or Occupational Pension.
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Student Loan</h3>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>Do you have a Student Loan which is not fully repaid?</Label>
            </div>
            <Switch
              checked={formData.hasStudentLoan}
              onCheckedChange={(checked) => updateFormData({ hasStudentLoan: checked })}
            />
          </div>

          {formData.hasStudentLoan && (
            <>
              <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
                <h4 className="font-semibold">Student Loan Plans</h4>
                <p>You will have a <strong>Plan 1</strong> Student Loan if:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>You lived in Scotland or Northern Ireland when you started your course, or</li>
                  <li>You lived in England or Wales and started your course before September 2012</li>
                </ul>
                <p>You will have a <strong>Plan 2</strong> Student Loan if you lived in England or 
                Wales and started your course on or after 1 September 2012.</p>
              </div>

              <RadioGroup
                value={formData.studentLoanPlan}
                onValueChange={(value) => updateFormData({ studentLoanPlan: value })}
              >
                <div className="flex items-center space-x-3 p-4 border rounded-lg">
                  <RadioGroupItem value="plan1" id="plan1" />
                  <Label htmlFor="plan1" className="cursor-pointer">Plan 1</Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg">
                  <RadioGroupItem value="plan2" id="plan2" />
                  <Label htmlFor="plan2" className="cursor-pointer">Plan 2</Label>
                </div>
              </RadioGroup>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Did you finish your studies before the last 6 April?</Label>
                </div>
                <Switch
                  checked={formData.finishedStudiesBeforeApril}
                  onCheckedChange={(checked) => updateFormData({ finishedStudiesBeforeApril: checked })}
                />
              </div>
            </>
          )}
        </div>

        <div className="text-sm text-muted-foreground pt-4 border-t">
          <p>For further guidance about repaying Student Loans go to <strong>www.gov.uk/new-employee/student-loans</strong></p>
        </div>
      </div>
    </div>
  );
}
