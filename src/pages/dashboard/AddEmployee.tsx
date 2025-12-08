import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Send, Upload, FileText, Check, User, Briefcase, FileCheck, Shield, File } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STEPS = [
  { id: 1, name: 'Basic Details', icon: User },
  { id: 2, name: 'Contract Creation', icon: Briefcase },
  { id: 3, name: 'Submit for Approval', icon: FileCheck },
  { id: 4, name: 'Right to Work', icon: Shield },
  { id: 5, name: 'Document Upload', icon: File },
  { id: 6, name: 'Complete', icon: Check }
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
  organizationId: string;
  branchId: string;
  managerId: string;
  contractFile: File | null;
  shareCode: string;
  govPortalLink: string;
  rightToWorkDocument: File | null;
  additionalDocuments: { title: string; file: File | null; expiryDate: string; followUpDate: string }[];
}

export default function AddEmployee() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  
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
    organizationId: '',
    branchId: '',
    managerId: '',
    contractFile: null,
    shareCode: '',
    govPortalLink: '',
    rightToWorkDocument: null,
    additionalDocuments: [{ title: '', file: null, expiryDate: '', followUpDate: '' }]
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (formData.organizationId) {
      fetchBranches(formData.organizationId);
    }
  }, [formData.organizationId]);

  useEffect(() => {
    if (formData.branchId) {
      fetchManagers(formData.branchId);
    }
  }, [formData.branchId]);

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

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      // Validate basic details
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.organizationId || !formData.branchId) {
        toast.error('Please fill in all required fields');
        return;
      }
    }

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

  const handleSubmitForApproval = async () => {
    setLoading(true);
    try {
      // Create employee record
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
          organization_id: formData.organizationId,
          branch_id: formData.branchId,
          manager_id: formData.managerId || null,
          created_by: user?.id,
          status: 'pending'
        })
        .select()
        .single();

      if (empError) throw empError;

      // Upload contract if provided
      if (formData.contractFile && employee) {
        const filePath = `contracts/${employee.id}/${formData.contractFile.name}`;
        await supabase.storage.from('documents').upload(filePath, formData.contractFile);

        // Create contract approval record
        await supabase.from('contract_approvals').insert({
          employee_id: employee.id,
          submitted_by: user?.id,
          contract_file_path: filePath,
          contract_file_name: formData.contractFile.name,
          status: 'pending'
        });
      }

      toast.success('Employee submitted for approval');
      setCurrentStep(3); // Move to Right to Work step
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit employee');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    toast.success('Employee onboarding completed!');
    navigate('/dashboard/employees');
  };

  const addDocument = () => {
    updateFormData({
      additionalDocuments: [...formData.additionalDocuments, { title: '', file: null, expiryDate: '', followUpDate: '' }]
    });
  };

  const updateDocument = (index: number, updates: Partial<typeof formData.additionalDocuments[0]>) => {
    const docs = [...formData.additionalDocuments];
    docs[index] = { ...docs[index], ...updates };
    updateFormData({ additionalDocuments: docs });
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/employees')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Employee Onboarding</h1>
            <p className="text-muted-foreground">Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].name}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className={`flex flex-col items-center gap-1 ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-center hidden sm:block">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-8">
          {/* Step 1: Basic Details */}
          {currentStep === 0 && (
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
                  <Input value={formData.department} onChange={(e) => updateFormData({ department: e.target.value })} placeholder="Engineering" />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input value={formData.emergencyContactName} onChange={(e) => updateFormData({ emergencyContactName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input value={formData.emergencyContactPhone} onChange={(e) => updateFormData({ emergencyContactPhone: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contract Creation */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Contract Creation</h2>
              <p className="text-muted-foreground">Upload the employment contract for this employee. This will be submitted for Super Admin approval.</p>
              
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="contract-upload"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => updateFormData({ contractFile: e.target.files?.[0] || null })}
                />
                <label htmlFor="contract-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    {formData.contractFile ? (
                      <div className="flex items-center gap-2 text-primary">
                        <FileText className="h-5 w-5" />
                        <span>{formData.contractFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-foreground font-medium">Click to upload contract</p>
                        <p className="text-sm text-muted-foreground">PDF, DOC, or DOCX</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Submit for Approval */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Submit for Approval</h2>
              <p className="text-muted-foreground">Review the details and submit for Super Admin approval. The contract will be reviewed and signed by the Super Admin.</p>
              
              <Card className="p-6 bg-muted/50">
                <h3 className="font-medium mb-4">Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {formData.firstName} {formData.lastName}</div>
                  <div><span className="text-muted-foreground">Email:</span> {formData.email}</div>
                  <div><span className="text-muted-foreground">Job Title:</span> {formData.jobTitle}</div>
                  <div><span className="text-muted-foreground">Department:</span> {formData.department}</div>
                  <div><span className="text-muted-foreground">Contract:</span> {formData.contractFile?.name || 'Not uploaded'}</div>
                </div>
              </Card>

              <Button onClick={handleSubmitForApproval} disabled={loading} className="w-full gap-2">
                <Send className="h-4 w-4" />
                {loading ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </div>
          )}

          {/* Step 4: Right to Work */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Right to Work Check</h2>
              <p className="text-muted-foreground">Enter the Right to Work details for this employee.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Share Code</Label>
                  <Input value={formData.shareCode} onChange={(e) => updateFormData({ shareCode: e.target.value })} placeholder="Enter share code" />
                </div>
                <div className="space-y-2">
                  <Label>Gov.uk Portal Link</Label>
                  <Input value={formData.govPortalLink} onChange={(e) => updateFormData({ govPortalLink: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Right to Work Document</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="rtw-upload"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => updateFormData({ rightToWorkDocument: e.target.files?.[0] || null })}
                  />
                  <label htmlFor="rtw-upload" className="cursor-pointer">
                    {formData.rightToWorkDocument ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileText className="h-5 w-5" />
                        <span>{formData.rightToWorkDocument.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Upload document (PDF, JPG, PNG)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Document Upload */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Final Document Upload</h2>
              <p className="text-muted-foreground">Upload any additional documents for this employee. Each document can have an expiry and follow-up date for tracking.</p>
              
              {formData.additionalDocuments.map((doc, index) => (
                <Card key={index} className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Document Title *</Label>
                      <Input
                        value={doc.title}
                        onChange={(e) => updateDocument(index, { title: e.target.value })}
                        placeholder="e.g., Passport, DBS Check"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Upload File *</Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => updateDocument(index, { file: e.target.files?.[0] || null })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input
                        type="date"
                        value={doc.expiryDate}
                        onChange={(e) => updateDocument(index, { expiryDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up Date</Label>
                      <Input
                        type="date"
                        value={doc.followUpDate}
                        onChange={(e) => updateDocument(index, { followUpDate: e.target.value })}
                      />
                    </div>
                  </div>
                </Card>
              ))}
              
              <Button variant="outline" onClick={addDocument} className="w-full">
                + Add Another Document
              </Button>
            </div>
          )}

          {/* Step 6: Complete */}
          {currentStep === 5 && (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Onboarding Complete!</h2>
                <p className="text-muted-foreground mt-2">The employee has been successfully onboarded. All documents have been saved to their folder.</p>
              </div>
              <Button onClick={handleComplete} className="gap-2">
                View Employee List
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>

        {/* Navigation */}
        {currentStep !== 5 && currentStep !== 2 && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
