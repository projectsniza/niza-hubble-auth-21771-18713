import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import BasicDetailsStep from '@/components/add-employee/BasicDetailsStep';
import ContractLeaveStep from '@/components/add-employee/ContractLeaveStep';
import StarterChecklistStep from '@/components/add-employee/StarterChecklistStep';
import ContractStep from '@/components/add-employee/ContractStep';
import DocumentsUploadStep from '@/components/add-employee/DocumentsUploadStep';
import { toast } from 'sonner';

export interface EmployeeFormData {
  // Basic Details
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  ethnicity: string;
  dateOfBirth: Date | undefined;
  email: string;
  mobile: string;
  workPhone: string;
  jobTitle: string;
  employmentStartDate: Date | undefined;
  probationEndDate: Date | undefined;
  address1: string;
  address2: string;
  address3: string;
  townCity: string;
  county: string;
  postcode: string;
  emergencyContact: { name: string; phone: string; relationship: string } | null;
  bankAccountName: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  sortCode: string;
  salary: string;
  salaryRate: string;
  paymentFrequency: string;
  effectiveFrom: Date | undefined;
  reason: string;
  payrollNumber: string;
  taxCode: string;
  niNumber: string;
  passportNumber: string;
  passportCountry: string;
  passportExpiry: Date | undefined;
  licenceNumber: string;
  licenceCountry: string;
  licenceClass: string;
  licenceExpiry: Date | undefined;
  visaNumber: string;
  visaExpiry: Date | undefined;

  // Contract & Leave
  employmentType: string;
  entitlementUnit: string;
  leaveContractStartDate: Date | undefined;
  workingTimePattern: string;
  contractedHours: string;
  annualLeaveYearStart: string;
  minLeaveEntitlement: string;
  placeOfWork: string;
  publicHolidays: string;
  contractType: string;
  team: string;
  reportsTo: string;
  probationRequired: boolean;
  noticePeriod: string;

  // Starter Checklist
  starterStatement: string;
  hasStudentLoan: boolean;
  studentLoanPlan: string;
  finishedStudiesBeforeApril: boolean;
  
  // Contract
  entity: string;
  contractDate: Date | undefined;
  contractEmployeeName: string;
  contractEmployeeAddress: string;
  contractJobTitle: string;
  contractHoursPerWeek: string;
  contractSalaryPerHour: string;
  contractStartDate: Date | undefined;
  
  // Documents
  rightToWorkShareCode: string;
  additionalDocuments: { title: string; file: File | null }[];
}

const STEPS = [
  'Basic Details',
  'Contract & Leave',
  'Starter Checklist',
  'Contract',
  'Documents Upload'
];

export default function AddEmployee() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<EmployeeFormData>({
    title: '',
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'unspecified',
    ethnicity: 'unspecified',
    dateOfBirth: undefined,
    email: '',
    mobile: '',
    workPhone: '',
    jobTitle: '',
    employmentStartDate: undefined,
    probationEndDate: undefined,
    address1: '',
    address2: '',
    address3: '',
    townCity: '',
    county: '',
    postcode: '',
    emergencyContact: null,
    bankAccountName: '',
    bankName: '',
    bankBranch: '',
    accountNumber: '',
    sortCode: '',
    salary: '',
    salaryRate: '',
    paymentFrequency: '',
    effectiveFrom: undefined,
    reason: '',
    payrollNumber: '',
    taxCode: '',
    niNumber: '',
    passportNumber: '',
    passportCountry: '',
    passportExpiry: undefined,
    licenceNumber: '',
    licenceCountry: '',
    licenceClass: '',
    licenceExpiry: undefined,
    visaNumber: '',
    visaExpiry: undefined,
    employmentType: 'fixed',
    entitlementUnit: 'days',
    leaveContractStartDate: undefined,
    workingTimePattern: 'Mon-Fri 9-5',
    contractedHours: '35',
    annualLeaveYearStart: '01 January',
    minLeaveEntitlement: '28',
    placeOfWork: '',
    publicHolidays: 'England & Wales',
    contractType: '',
    team: '',
    reportsTo: '',
    probationRequired: true,
    noticePeriod: '',
    starterStatement: '',
    hasStudentLoan: false,
    studentLoanPlan: '',
    finishedStudiesBeforeApril: false,
    entity: 'niza-superstores',
    contractDate: undefined,
    contractEmployeeName: '',
    contractEmployeeAddress: '',
    contractJobTitle: '',
    contractHoursPerWeek: '',
    contractSalaryPerHour: '',
    contractStartDate: undefined,
    rightToWorkShareCode: '',
    additionalDocuments: Array(8).fill(null).map(() => ({ title: '', file: null }))
  });

  const updateFormData = (updates: Partial<EmployeeFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = () => {
    // Here you would submit the form data
    toast.success('Employee onboarding submitted for approval');
    navigate('/dashboard/employees');
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/employees')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Add New Employee</h1>
            <p className="text-muted-foreground">Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            {STEPS.map((step, index) => (
              <span
                key={step}
                className={index <= currentStep ? 'text-primary font-medium' : ''}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-8 shadow-sm">
          {currentStep === 0 && (
            <BasicDetailsStep formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 1 && (
            <ContractLeaveStep formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 2 && (
            <StarterChecklistStep formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 3 && (
            <ContractStep formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 4 && (
            <DocumentsUploadStep formData={formData} updateFormData={updateFormData} />
          )}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              Submit for Approval
              <Send className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
