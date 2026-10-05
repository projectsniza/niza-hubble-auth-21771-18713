import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, ArrowRight, User, Briefcase, FileCheck, 
  ClipboardList, Wallet, Edit, Check, ShieldCheck, Clock, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ApplicationForm from '@/components/onboarding/ApplicationForm';
import StarterChecklist from '@/components/onboarding/StarterChecklist';
import BankDetailsForm from '@/components/onboarding/BankDetailsForm';
import ContractTemplate from '@/components/onboarding/ContractTemplate';
import DocumentUploadStep, { DocumentUploadStepRef } from '@/components/onboarding/DocumentUploadStep';
import { logActivity } from '@/hooks/useActivityLogs';
import { ensureEmployeeDocuments } from '@/lib/ensureEmployeeDocuments';

interface FormSettings {
  application: boolean;
  checklist: boolean;
  bank_details: boolean;
}

const BASE_STEPS = [
  { id: 'basic', name: 'Basic Details', icon: User, description: 'Personal, contact & employment basics' },
  { id: 'application', name: 'Application Form', icon: ClipboardList, description: 'Full employment history & qualifications' },
  { id: 'checklist', name: 'Starter Checklist', icon: FileCheck, description: 'HMRC tax code & student loan declaration' },
  { id: 'bank_details', name: 'Bank Details', icon: Wallet, description: 'Salary deposit & payroll account details' },
  { id: 'documents', name: 'Verification Docs', icon: ShieldCheck, description: 'Mandatory ID & right-to-work files' },
  { id: 'contract', name: 'Employment Contract', icon: Briefcase, description: 'Terms & Super Admin approval submission' }
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
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
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
      return true;
    });
  };

  const STEPS = getActiveSteps();

  useEffect(() => {
    fetchOrganizations();
    fetchDepartments();
    fetchFormSettings().then((loadedSettings) => {
      if (employeeId) {
        fetchEmployee(employeeId, loadedSettings);
      }
    });
  }, [employeeId]);

  useEffect(() => {
    if (formData.organizationId) {
      fetchBranches(formData.organizationId);
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
      return settings;
    }
    return formSettings;
  };

  const fetchEmployee = async (id: string, loadedSettings?: FormSettings) => {
    const { data } = await supabase
      .from('employees')
      .select('*, employee_onboarding(*)')
      .eq('id', id)
      .single();
    
    if (data) {
      setEmployeeRecord(data);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
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
      
      const onboarding = data.employee_onboarding?.[0];
      
      const { data: formResponses } = await supabase
        .from('onboarding_form_responses')
        .select('form_type')
        .eq('employee_id', id);
      
      const completedForms = new Set((formResponses || []).map((r: any) => r.form_type));
      
      const { data: contractApproval } = await supabase
        .from('contract_approvals')
        .select('id, status')
        .eq('employee_id', id)
        .maybeSingle();

      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', id);
      
      const activeSettings = loadedSettings || formSettings;
      const getStepsForSettings = (s: FormSettings) => {
        return BASE_STEPS.filter(step => {
          if (step.id === 'application') return s.application;
          if (step.id === 'checklist') return s.checklist;
          if (step.id === 'bank_details') return s.bank_details;
          return true;
        });
      };
      
      const determineStep = () => {
        const steps = getStepsForSettings(activeSettings);
        
        for (let i = 0; i < steps.length; i++) {
          const stepId = steps[i].id;
          if (stepId === 'basic') continue;
          if (stepId === 'application' && !completedForms.has('application_form')) return i;
          if (stepId === 'checklist' && !completedForms.has('starter_checklist')) return i;
          if (stepId === 'bank_details' && !completedForms.has('bank_details')) return i;
          if (stepId === 'documents') {
            if (!docCount || docCount === 0) return i;
            if (onboarding) {
              const storedStep = onboarding.current_step || 1;
              const docsStepIndex = steps.findIndex(s => s.id === 'documents');
              if (storedStep - 1 <= docsStepIndex) return i;
            }
            continue;
          }
          if (stepId === 'contract') {
            if (!contractApproval) return i;
            continue;
          }
        }
        return steps.length - 1;
      };
      
      setCurrentStep(determineStep());
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
      .eq('branch_id', branchId)
      .eq('is_active', true);
    if (data) setManagers(data);
  };

  const fetchDepartments = async (orgId?: string) => {
    try {
      let query = supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (orgId) {
        query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
      }
      
      const { data, error } = await query;
      if (error) return;
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
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.organizationId || !formData.branchId) {
        toast.error('Please fill in all required fields (Name, Email, Organization, Branch)');
        return;
      }
      if (!formData.nationalInsuranceNumber) {
        toast.error('National Insurance Number is required');
        return;
      }
      if (!formData.emergencyContactName || !formData.emergencyContactPhone) {
        toast.error('Emergency contact name and phone are required');
        return;
      }
      
      if (formData.phone && formData.emergencyContactPhone && 
          formData.phone.replace(/\s/g, '') === formData.emergencyContactPhone.replace(/\s/g, '')) {
        toast.error('Emergency contact phone cannot be the same as employee phone');
        return;
      }
      
      if (!employeeRecord) {
        await saveBasicDetails();
      } else {
        await updateBasicDetails();
      }
    }

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
      if (employeeRecord) {
        await supabase
          .from('employee_onboarding')
          .upsert({
            employee_id: employeeRecord.id,
            current_step: nextStep + 1
          }, { onConflict: 'employee_id' });
      }
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if (employeeRecord) {
        await supabase
          .from('employee_onboarding')
          .upsert({
            employee_id: employeeRecord.id,
            current_step: prevStep + 1
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
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      toast.success('Basic details updated');
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
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      toast.success('Basic details saved');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save details';
      toast.error(message);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-slate-50/50 dark:bg-background p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/employees')} className="rounded-xl border">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Employee Onboarding</h1>
                {employeeRecord && (
                  <Badge variant="outline" className="text-xs bg-muted font-mono">
                    {employeeRecord.first_name} {employeeRecord.last_name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stage {currentStep + 1} of {STEPS.length}: <span className="font-semibold text-foreground">{STEPS[currentStep]?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastSavedTime && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Saved at {lastSavedTime}</span>
              </div>
            )}
            {employeeRecord && currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)} className="h-8 text-xs gap-1.5">
                <Edit className="h-3 w-3" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* Stepper Navigation */}
        <Card className="p-5 shadow-sm border">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Overall Onboarding Progress</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
              {STEPS.map((step, index) => {
                const isCurrent = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (employeeRecord && index <= currentStep) {
                        setCurrentStep(index);
                      }
                    }}
                    disabled={!employeeRecord && index > 0}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all border ${
                      isCurrent 
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20' 
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                        : 'bg-muted/40 text-muted-foreground border-border/40 opacity-70 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                      isCurrent 
                        ? 'bg-white/20 text-white' 
                        : isCompleted 
                        ? 'bg-emerald-200/60 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-medium leading-tight truncate">{step.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Step Content Container */}
        <Card className="p-6 md:p-8 shadow-sm border">
          {/* Step: Basic Details */}
          {currentStepId === 'basic' && (
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-xl font-semibold tracking-tight">Basic Employment Details</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter candidate's personal identity, contact details, organization placement, and emergency contacts.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">First Name *</Label>
                  <Input value={formData.firstName} onChange={(e) => updateFormData({ firstName: e.target.value })} placeholder="John" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Last Name *</Label>
                  <Input value={formData.lastName} onChange={(e) => updateFormData({ lastName: e.target.value })} placeholder="Doe" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email Address *</Label>
                  <Input type="email" value={formData.email} onChange={(e) => updateFormData({ email: e.target.value })} placeholder="john@example.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Phone Number</Label>
                  <Input 
                    value={formData.phone} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9\s\-+()]/g, '');
                      updateFormData({ phone: val });
                    }} 
                    placeholder="+44 7xxx xxx xxx" 
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date of Birth</Label>
                  <Input type="date" value={formData.dateOfBirth} onChange={(e) => updateFormData({ dateOfBirth: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">National Insurance Number *</Label>
                  <Input value={formData.nationalInsuranceNumber} onChange={(e) => updateFormData({ nationalInsuranceNumber: e.target.value })} placeholder="AB 12 34 56 C" className="h-9 text-sm font-mono uppercase" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Residential Address</Label>
                <Textarea value={formData.address} onChange={(e) => updateFormData({ address: e.target.value })} placeholder="Full residential address and postcode" rows={2} className="text-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Organization *</Label>
                  <Select value={formData.organizationId} onValueChange={(v) => updateFormData({ organizationId: v, branchId: '' })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Branch Location *</Label>
                  <Select value={formData.branchId} onValueChange={(v) => updateFormData({ branchId: v })} disabled={!formData.organizationId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Job Title</Label>
                  <Input value={formData.jobTitle} onChange={(e) => updateFormData({ jobTitle: e.target.value })} placeholder="Store Assistant" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Department</Label>
                  <Select value={formData.department} onValueChange={(v) => updateFormData({ department: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Commencement Date</Label>
                  <Input type="date" value={formData.joinDate} onChange={(e) => updateFormData({ joinDate: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Reporting Line Manager</Label>
                  <Select value={formData.managerId} onValueChange={(v) => updateFormData({ managerId: v })} disabled={!formData.branchId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      {managers.map(manager => (
                        <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-foreground">Emergency Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Contact Full Name *</Label>
                    <Input value={formData.emergencyContactName} onChange={(e) => updateFormData({ emergencyContactName: e.target.value })} placeholder="Emergency contact name" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Contact Phone Number *</Label>
                    <Input value={formData.emergencyContactPhone} onChange={(e) => updateFormData({ emergencyContactPhone: e.target.value })} placeholder="+44 7xxx xxx xxx" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Relationship</Label>
                    <Select value={formData.emergencyContactRelationship} onValueChange={(v) => updateFormData({ emergencyContactRelationship: v })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select relationship" /></SelectTrigger>
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
            </div>
          )}

          {/* Step: Application Form */}
          {currentStepId === 'application' && employeeRecord && (
            <ApplicationForm 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              organizations={organizations}
              branches={branches}
              onSave={() => setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              onNext={handleNext}
              onBack={handlePrevious}
            />
          )}

          {/* Step: Starter Checklist */}
          {currentStepId === 'checklist' && employeeRecord && (
            <StarterChecklist 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              onSave={() => setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              onNext={handleNext}
              onBack={handlePrevious}
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
              onDocumentsSaved={() => setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
            />
          )}

          {/* Step: Bank Details */}
          {currentStepId === 'bank_details' && employeeRecord && (
            <BankDetailsForm 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              onSave={() => setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              onNext={handleNext}
              onBack={handlePrevious}
            />
          )}

          {/* Step: Contract */}
          {currentStepId === 'contract' && employeeRecord && (
            <ContractTemplate 
              employeeId={employeeRecord.id}
              employeeData={employeeRecord}
              organizations={organizations}
              branches={branches}
              onSave={() => setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              onBack={handlePrevious}
              onSubmit={() => {
                toast.success('Contract submitted for Super Admin review. You can track approval status in Contract Approvals.');
                navigate('/dashboard/employees');
              }}
            />
          )}

          {/* Bottom Navigation for Basic and Documents Steps */}
          {(currentStepId === 'basic' || currentStepId === 'documents') && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={handlePrevious} 
                disabled={currentStep === 0}
                className="gap-2 text-xs h-9"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous Stage
              </Button>
              
              <div className="flex items-center gap-3">
                <Button onClick={handleNext} disabled={loading} className="gap-2 text-xs h-9 px-5">
                  {loading ? 'Saving Details...' : 'Save & Continue'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
