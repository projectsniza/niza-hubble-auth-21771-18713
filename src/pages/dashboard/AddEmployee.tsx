import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Send, User, Briefcase, FileCheck, ClipboardList, Wallet, File, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ApplicationForm from '@/components/onboarding/ApplicationForm';
import StarterChecklist from '@/components/onboarding/StarterChecklist';
import BankDetailsForm from '@/components/onboarding/BankDetailsForm';
import ContractTemplate from '@/components/onboarding/ContractTemplate';
import DocumentUploadStep, { DocumentUploadStepRef } from '@/components/onboarding/DocumentUploadStep';


interface FormSettings {
  application: boolean;
  checklist: boolean;
  bank_details: boolean;
}

const BASE_STEPS = [
  { id: 'basic', name: 'Basic Details', icon: User },
  { id: 'application', name: 'Application Form', icon: ClipboardList },
  { id: 'checklist', name: 'Starter Checklist', icon: FileCheck },
  { id: 'bank_details', name: 'Bank Details', icon: Wallet },
  { id: 'documents', name: 'Required Documents', icon: FileCheck },
  { id: 'contract', name: 'Contract', icon: Briefcase }
];

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  jobTitle: string;
  department: string;
  joinDate: string;
  nationalInsuranceNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  organizationId: string;
  branchId: string;
  managerId: string;
  contractFile: File | null;
  shareCode: string;
  govPortalLink: string;
  rightToWorkDocument: File | null;
  additionalDocuments: { title: string; file: File | null; expiryDate: string }[];
}

interface Department {
  id: string;
  name: string;
  organization_id: string | null;
  is_active: boolean;
}

export default function AddEmployee() {
  const { id: employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeRecord, setEmployeeRecord] = useState<any>(null);
  const documentUploadRef = useRef<DocumentUploadStepRef>(null);
  
  // Form settings from database
  const [formSettings, setFormSettings] = useState<FormSettings>({
    application: true,
    checklist: true,
    bank_details: true
  });
  
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    jobTitle: '',
    department: '',
    joinDate: '',
    nationalInsuranceNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    organizationId: '',
    branchId: '',
    managerId: '',
    contractFile: null,
    shareCode: '',
    govPortalLink: '',
    rightToWorkDocument: null,
    additionalDocuments: [{ title: '', file: null, expiryDate: '' }]
  });

  // Get active steps based on form settings
  const getActiveSteps = () => {
    return BASE_STEPS.filter(step => {
      if (step.id === 'application') return formSettings.application;
      if (step.id === 'checklist') return formSettings.checklist;
      if (step.id === 'bank_details') return formSettings.bank_details;
      if (step.id === 'documents') return true; // Always show documents step
      return true;
    });
  };

  const STEPS = getActiveSteps();

  useEffect(() => {
    fetchOrganizations();
    fetchFormSettings();
    fetchDepartments();
    if (employeeId) {
      fetchEmployee(employeeId);
    }
  }, [employeeId]);

  useEffect(() => {
    if (formData.organizationId) {
      fetchBranches(formData.organizationId);
      // Filter departments by organization
      fetchDepartments(formData.organizationId);
    }
  }, [formData.organizationId]);

  useEffect(() => {
    if (formData.branchId) {
      fetchManagers(formData.branchId);
    }
  }, [formData.branchId]);

  const fetchFormSettings = async () => {
    const { data } = await supabase
      .from('onboarding_form_settings')
      .select('*');
    
    if (data) {
      const settings: FormSettings = {
        application: true,
        checklist: true,
        bank_details: true
      };
      
      data.forEach(setting => {
        if (setting.form_type === 'application') settings.application = setting.enabled ?? true;
        if (setting.form_type === 'checklist') settings.checklist = setting.enabled ?? true;
        if (setting.form_type === 'bank_details') settings.bank_details = setting.enabled ?? true;
      });
      
      setFormSettings(settings);
    }
  };

  const fetchEmployee = async (id: string) => {
    const { data } = await supabase
      .from('employees')
      .select('*, employee_onboarding(*)')
      .eq('id', id)
      .single();
    
    if (data) {
      setEmployeeRecord(data);
      setFormData({
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        dateOfBirth: data.date_of_birth || '',
        address: data.address || '',
        jobTitle: data.job_title || '',
        department: data.department || '',
        joinDate: data.join_date || '',
        nationalInsuranceNumber: data.national_insurance_number || '',
        emergencyContactName: data.emergency_contact_name || '',
        emergencyContactPhone: data.emergency_contact_phone || '',
        emergencyContactRelationship: data.emergency_contact_relationship || '',
        organizationId: data.organization_id || '',
        branchId: data.branch_id || '',
        managerId: data.manager_id || '',
        contractFile: null,
        shareCode: '',
        govPortalLink: '',
        rightToWorkDocument: null,
        additionalDocuments: [{ title: '', file: null, expiryDate: '' }]
      });
      
      // Set current step based on onboarding progress
      if (data.employee_onboarding?.[0]) {
        const onboarding = data.employee_onboarding[0];
        setCurrentStep(onboarding.current_step - 1 || 0);
      }
    }
  };

  const fetchOrganizations = async () => {
    const { data } = await supabase.from('organizations').select('*').order('name');
    if (data) setOrganizations(data);
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('organization_id', orgId).order('name');
    if (data) setBranches(data);
  };

  const fetchManagers = async (branchId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('branch_id', branchId);
    if (data) setManagers(data);
  };

  const fetchDepartments = async (orgId?: string) => {
    try {
      let query = supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      // If an organization is selected, filter by that org OR global departments (null org_id)
      if (orgId) {
        query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching departments:', error);
        return;
      }
      setDepartments(data || []);
    } catch (err) {
      console.error('Exception fetching departments:', err);
    }
  };

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = async () => {
    const currentStepId = STEPS[currentStep]?.id;
    
    if (currentStepId === 'basic') {
      // Validate all required fields including emergency contact
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.organizationId || !formData.branchId) {
        toast.error('Please fill in all required fields (Name, Email, Organization, Branch)');
        return;
      }
      if (!formData.emergencyContactName || !formData.emergencyContactPhone) {
        toast.error('Emergency contact name and phone are required');
        return;
      }
      
      // Create or update employee record after basic details
      if (!employeeRecord) {
        await saveBasicDetails();
      } else {
        // Update existing employee with latest data
        await updateBasicDetails();
      }
    }

    // For Application Form, Starter Checklist, Bank Details - the forms handle their own save
    // Just validate they have been saved (form responses exist)
    if ((currentStepId === 'application' || currentStepId === 'checklist' || currentStepId === 'bank_details') && employeeRecord) {
      const formType = currentStepId === 'application' ? 'application_form' : currentStepId === 'checklist' ? 'starter_checklist' : 'bank_details';
      const { data: formResponse } = await supabase
        .from('onboarding_form_responses')
        .select('id')
        .eq('employee_id', employeeRecord.id)
        .eq('form_type', formType)
        .maybeSingle();
      
      if (!formResponse) {
        toast.error(`Please save the ${STEPS[currentStep]?.name} before continuing`);
        return;
      }
    }

    // Save documents before moving to contract step
    if (currentStepId === 'documents' && documentUploadRef.current) {
      if (!documentUploadRef.current.hasAllMandatoryDocuments()) {
        toast.error('Please upload all mandatory documents');
        return;
      }
      const success = await documentUploadRef.current.saveDocuments();
      if (!success) return;
    }

    if (currentStep < STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Persist step to database
      if (employeeRecord) {
        await supabase
          .from('employee_onboarding')
          .upsert({
            employee_id: employeeRecord.id,
            current_step: nextStep + 1 // 1-indexed in DB
          }, { onConflict: 'employee_id' });
      }
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      // Persist step to database
      if (employeeRecord) {
        await supabase
          .from('employee_onboarding')
          .upsert({
            employee_id: employeeRecord.id,
            current_step: prevStep + 1 // 1-indexed in DB
          }, { onConflict: 'employee_id' });
      }
      window.scrollTo(0, 0);
    }
  };

  const updateBasicDetails = async () => {
    if (!employeeRecord) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          date_of_birth: formData.dateOfBirth || null,
          address: formData.address,
          job_title: formData.jobTitle,
          department: formData.department,
          join_date: formData.joinDate || null,
          national_insurance_number: formData.nationalInsuranceNumber,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_phone: formData.emergencyContactPhone,
          emergency_contact_relationship: formData.emergencyContactRelationship || null,
          organization_id: formData.organizationId,
          branch_id: formData.branchId,
          manager_id: formData.managerId || null
        })
        .eq('id', employeeRecord.id);

      if (error) throw error;
      toast.success('Details updated');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update details';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const saveBasicDetails = async () => {
    setLoading(true);
    try {
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          date_of_birth: formData.dateOfBirth || null,
          address: formData.address,
          job_title: formData.jobTitle,
          department: formData.department,
          join_date: formData.joinDate || null,
          national_insurance_number: formData.nationalInsuranceNumber,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_phone: formData.emergencyContactPhone,
          emergency_contact_relationship: formData.emergencyContactRelationship || null,
          organization_id: formData.organizationId,
          branch_id: formData.branchId,
          manager_id: formData.managerId || null,
          created_by: user?.id,
          status: 'onboarding'
        })
        .select()
        .single();

      if (empError) throw empError;
      setEmployeeRecord(employee);
      toast.success('Basic details saved');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save details';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!employeeRecord) {
      toast.error('Employee record not found');
      return;
    }

    setLoading(true);
    try {
      // Create contract approval record
      await supabase.from('contract_approvals').insert({
        employee_id: employeeRecord.id,
        submitted_by: user?.id,
        status: 'pending'
      });

      // Update onboarding status
      await supabase
        .from('employee_onboarding')
        .update({ 
          contract_submitted_for_approval: true,
          current_step: getStepIndex('approval') + 2
        })
        .eq('employee_id', employeeRecord.id);

      toast.success('Contract submitted for approval');
      handleNext();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit for approval';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!employeeRecord) return;

    try {
      await supabase
        .from('employees')
        .update({ status: 'active' })
        .eq('id', employeeRecord.id);

      await supabase
        .from('employee_onboarding')
        .update({ completed_at: new Date().toISOString() })
        .eq('employee_id', employeeRecord.id);

      toast.success('Employee onboarding completed!');
      navigate('/dashboard/employees');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
      toast.error(message);
    }
  };

  const getStepIndex = (stepId: string) => {
    return STEPS.findIndex(s => s.id === stepId);
  };

  const addDocument = () => {
    updateFormData({
      additionalDocuments: [...formData.additionalDocuments, { title: '', file: null, expiryDate: '' }]
    });
  };

  const updateDocument = (index: number, updates: Partial<typeof formData.additionalDocuments[0]>) => {
    const docs = [...formData.additionalDocuments];
    docs[index] = { ...docs[index], ...updates };
    updateFormData({ additionalDocuments: docs });
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const currentStepId = STEPS[currentStep]?.id;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/employees')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Employee Onboarding</h1>
            <p className="text-muted-foreground">Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]?.name}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-5 gap-2 overflow-x-auto pb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className={`flex flex-col items-center gap-1 ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${index <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] text-center leading-tight">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-8">
          {/* Step: Basic Details */}
          {currentStepId === 'basic' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Basic Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={formData.firstName} onChange={(e) => updateFormData({ firstName: e.target.value })} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={formData.lastName} onChange={(e) => updateFormData({ lastName: e.target.value })} placeholder="Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={formData.email} onChange={(e) => updateFormData({ email: e.target.value })} placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => updateFormData({ phone: e.target.value })} placeholder="+44 7xxx xxx xxx" />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={formData.dateOfBirth} onChange={(e) => updateFormData({ dateOfBirth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>National Insurance Number</Label>
                  <Input value={formData.nationalInsuranceNumber} onChange={(e) => updateFormData({ nationalInsuranceNumber: e.target.value })} placeholder="AB 12 34 56 C" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={formData.address} onChange={(e) => updateFormData({ address: e.target.value })} placeholder="Full address" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization *</Label>
                  <Select value={formData.organizationId} onValueChange={(v) => updateFormData({ organizationId: v, branchId: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select value={formData.branchId} onValueChange={(v) => updateFormData({ branchId: v })} disabled={!formData.organizationId}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input value={formData.jobTitle} onChange={(e) => updateFormData({ jobTitle: e.target.value })} placeholder="Software Engineer" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={formData.department} onValueChange={(v) => updateFormData({ department: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Join Date</Label>
                  <Input type="date" value={formData.joinDate} onChange={(e) => updateFormData({ joinDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Reporting Manager</Label>
                  <Select value={formData.managerId} onValueChange={(v) => updateFormData({ managerId: v })} disabled={!formData.branchId}>
                    <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      {managers.map(manager => (
                        <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Emergency Contact Name *</Label>
                  <Input value={formData.emergencyContactName} onChange={(e) => updateFormData({ emergencyContactName: e.target.value })} placeholder="Contact name" />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone *</Label>
                  <Input value={formData.emergencyContactPhone} onChange={(e) => updateFormData({ emergencyContactPhone: e.target.value })} placeholder="+44 7xxx xxx xxx" />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Select value={formData.emergencyContactRelationship} onValueChange={(v) => updateFormData({ emergencyContactRelationship: v })}>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Friend">Friend</SelectItem>
                      <SelectItem value="Partner">Partner</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step: Application Form */}
          {currentStepId === 'application' && employeeRecord && (
            <ApplicationForm 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              organizations={organizations}
              onSave={() => {}}
              onNext={handleNext}
            />
          )}

          {/* Step: Starter Checklist */}
          {currentStepId === 'checklist' && employeeRecord && (
            <StarterChecklist 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              onSave={() => {}}
              onNext={handleNext}
            />
          )}

          {/* Step: Documents */}
          {currentStepId === 'documents' && employeeRecord && (
            <DocumentUploadStep
              ref={documentUploadRef}
              employeeId={employeeRecord.id}
              additionalDocuments={formData.additionalDocuments}
              onUpdateDocument={updateDocument}
              onAddDocument={addDocument}
            />
          )}

          {/* Step: Bank Details */}
          {currentStepId === 'bank_details' && employeeRecord && (
            <BankDetailsForm 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              onSave={() => {}}
              onNext={handleNext}
            />
          )}

          {/* Step: Contract */}
          {currentStepId === 'contract' && employeeRecord && (
            <ContractTemplate 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              organizations={organizations}
              branches={branches}
              onSave={() => {}}
              onSubmit={() => {
                toast.success('Contract submitted for approval. Continue in Approved Contracts tab after Super Admin approves.');
                navigate('/dashboard/employees');
              }}
            />
          )}

          {/* Navigation - only show on basic and documents steps, forms have their own buttons */}
          {(currentStepId === 'basic' || currentStepId === 'documents') && (
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={handlePrevious} 
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex gap-2">
                {/* Edit Basic Details button - available on all steps except first */}
                {currentStep > 0 && employeeRecord && (
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(0)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Basic Details
                  </Button>
                )}
                
                <Button onClick={handleNext} disabled={loading} className="gap-2">
                  {loading ? 'Saving...' : 'Save & Continue'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
