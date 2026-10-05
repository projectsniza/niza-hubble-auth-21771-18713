import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, ArrowRight, Check, Upload, FileSignature, 
  FilePen, CheckCircle2, Download, Eye, FileText, AlertCircle, 
  Printer, ShieldCheck, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildApplicationFormPdf,
  buildStarterChecklistPdf,
  buildBankDetailsPdf,
  buildCompleteContractPdf,
} from '@/lib/onboardingPdfs';
import {
  getOrCreateEmployeeFolder,
  ensureEmployeeDocuments,
} from '@/lib/ensureEmployeeDocuments';
import nizaLogo from '@/assets/niza-group-logo.png';

interface PostApprovalOnboardingProps {
  employeeId: string;
  onBack: () => void;
}

interface SignedDocRequirement {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
}

interface SignedDocUpload {
  requirement_id: string;
  file: File | null;
  uploaded: boolean;
  file_name?: string;
  file_path?: string;
}

export default function PostApprovalOnboarding({ employeeId, onBack }: PostApprovalOnboardingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [contractApproval, setContractApproval] = useState<any>(null);
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const [existingSignedContract, setExistingSignedContract] = useState<{ path: string; name: string } | null>(null);
  const [signedDocRequirements, setSignedDocRequirements] = useState<SignedDocRequirement[]>([]);
  const [signedDocUploads, setSignedDocUploads] = useState<SignedDocUpload[]>([]);
  const [hasSignedDocs, setHasSignedDocs] = useState(false);
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [downloadingForm, setDownloadingForm] = useState<string | null>(null);
  const [downloadingContract, setDownloadingContract] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docUploadProgress, setDocUploadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchEmployee();
    fetchContractApproval();
    fetchSignedDocRequirements();
    fetchFormResponses();
  }, [employeeId]);

  const fetchFormResponses = async () => {
    const { data } = await supabase
      .from('onboarding_form_responses')
      .select('form_type, form_data')
      .eq('employee_id', employeeId);

    if (data) {
      const map: Record<string, any> = {};
      data.forEach((r: any) => { map[r.form_type] = r.form_data; });
      setFormResponses(map);
    }
  };

  const getFilledFormForRequirement = (reqName: string): { type: string; data: any } | null => {
    const n = reqName.toLowerCase();
    if (n.includes('application')) {
      const appData = formResponses['application_form'] || {
        organization_id: employee?.organization_id,
        branch_id: employee?.branch_id,
        name: `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim(),
        position: employee?.job_title || '',
        phone: employee?.phone || '',
        email: employee?.email || '',
        address: employee?.address || '',
        start_date: employee?.join_date || '',
        declaration_agreed: true,
      };
      return { type: 'application_form', data: appData };
    }
    if (n.includes('starter') || n.includes('checklist')) {
      const appData = formResponses['application_form'] || {};
      const starterData = formResponses['starter_checklist'] || {
        first_names: employee?.first_name || appData.name?.split(' ')?.[0] || '',
        last_name: employee?.last_name || appData.name?.split(' ')?.slice(1)?.join(' ') || '',
        gender: '',
        date_of_birth: employee?.date_of_birth || '',
        address: employee?.address || appData.address || '',
        postcode: appData.postcode || '',
        country: 'United Kingdom',
        national_insurance: employee?.national_insurance_number || '',
        employment_start_date: employee?.join_date || appData.start_date || '',
        statement: 'A',
        has_student_loan: false,
        repaying_direct: false,
        declaration_agreed: true,
      };
      return { type: 'starter_checklist', data: starterData };
    }
    if (n.includes('bank')) {
      const appData = formResponses['application_form'] || {};
      const bankData = formResponses['bank_details'] || {
        your_name: `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || appData.name || '',
        telephone_number: employee?.phone || appData.phone || '',
        bank_name: '',
        bank_address: '',
        bank_telephone: '',
        sort_code: '',
        account_number: '',
        building_society_roll: '',
        account_holder_name: `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || appData.name || '',
        declaration_agreed: true,
      };
      return { type: 'bank_details', data: bankData };
    }
    return null;
  };

  const handleDownloadFilledForm = async (req: SignedDocRequirement) => {
    const filled = getFilledFormForRequirement(req.name);
    if (!filled) {
      toast.error('No filled form found for this document.');
      return;
    }
    setDownloadingForm(req.id);
    try {
      let doc: any;
      if (filled.type === 'application_form') {
        doc = await buildApplicationFormPdf(filled.data, employee?.organizations?.name, employee?.branches?.name);
      } else if (filled.type === 'starter_checklist') {
        doc = await buildStarterChecklistPdf(filled.data);
      } else {
        doc = await buildBankDetailsPdf(filled.data);
      }
      const safeName = req.name.replace(/[^a-z0-9]+/gi, '_');
      const empName = `${employee?.first_name || ''}_${employee?.last_name || ''}`.replace(/[^a-z0-9_]+/gi, '');
      doc.save(`${safeName}_${empName}.pdf`);
      toast.success(`${req.name} downloaded`);
    } catch (err) {
      console.error('Failed to generate filled form:', err);
      toast.error('Failed to generate the form PDF');
    } finally {
      setDownloadingForm(null);
    }
  };

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*, organizations(name), branches(name)')
      .eq('id', employeeId)
      .single();
    
    if (data) {
      setEmployee(data);
      ensureEmployeeDocuments(employeeId, null, user?.id).catch(console.error);
    }
  };

  const fetchContractApproval = async () => {
    const { data } = await supabase
      .from('contract_approvals')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .maybeSingle();
    
    if (data) {
      setContractApproval(data);
      if (data.signed_contract_path) {
        setExistingSignedContract({
          path: data.signed_contract_path,
          name: data.signed_contract_path.split('/').pop() || 'Signed Contract'
        });
      }
    }
  };

  const fetchSignedDocRequirements = async () => {
    const { data } = await supabase
      .from('signed_document_requirements')
      .select('*')
      .eq('enabled', true)
      .order('doc_order');
    
    if (data && data.length > 0) {
      setSignedDocRequirements(data);
      setHasSignedDocs(true);

      const { data: existingUploads } = await supabase
        .from('signed_document_uploads')
        .select('requirement_id, file_name, file_path')
        .eq('employee_id', employeeId);

      const uploads: SignedDocUpload[] = data.map(req => {
        const existing = existingUploads?.find(u => u.requirement_id === req.id);
        return {
          requirement_id: req.id,
          file: null,
          uploaded: !!existing,
          file_name: existing?.file_name,
          file_path: existing?.file_path,
        };
      });
      setSignedDocUploads(uploads);
    }
  };

  const steps = [
    { id: 'upload', name: 'Signed Contract', icon: FileSignature },
    ...(hasSignedDocs ? [{ id: 'signed-docs', name: 'Physical Signed Documents', icon: FilePen }] : []),
    { id: 'complete', name: 'Activate Profile', icon: Check }
  ];

  const handleDownloadApprovedContractPDF = async () => {
    setDownloadingContract(true);
    try {
      // Generate complete full multi-page 19-clause contract PDF
      const contractContent = (contractApproval?.contract_content as any) || {};
      const doc = await buildCompleteContractPdf({
        contractData: contractContent,
        employeeData: employee || {},
        organizationData: employee?.organizations || {},
        branchData: employee?.branches || {},
        approvalData: contractApproval || {},
      });

      const empName = `${employee?.first_name || ''}_${employee?.last_name || ''}`.trim().replace(/\s+/g, '_') || 'Employee';
      doc.save(`Approved_Employment_Contract_${empName}.pdf`);
      toast.success('Complete approved contract downloaded');
    } catch (err: any) {
      console.error('Failed to generate approved contract:', err);
      toast.error('Failed to download contract PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingContract(false);
    }
  };

  const handleOpenFileUrl = async (filePath?: string) => {
    if (!filePath) return;
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (e: any) {
      toast.error('Failed to open file: ' + e.message);
    }
  };

  const handleUploadSignedContract = async () => {
    if (!signedContractFile && !existingSignedContract) {
      toast.error('Please select the signed contract file to upload');
      return;
    }

    if (!signedContractFile && existingSignedContract) {
      setCurrentStep(prev => prev + 1);
      return;
    }

    setLoading(true);
    setUploadProgress(15);
    const interval = setInterval(() => {
      setUploadProgress(prev => (prev >= 88 ? prev : prev + Math.floor(Math.random() * 12) + 6));
    }, 120);

    try {
      const fileName = `signed_contract_${employeeId}_${Date.now()}.${signedContractFile!.name.split('.').pop()}`;
      const filePath = `employees/${employeeId}/contracts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, signedContractFile!);

      if (uploadError) throw uploadError;

      await supabase
        .from('contract_approvals')
        .update({
          signed_contract_path: filePath,
          signed_contract_uploaded_at: new Date().toISOString(),
          signed_contract_uploaded_by: user?.id
        })
        .eq('id', contractApproval.id);

      const empFolderId = await getOrCreateEmployeeFolder(employeeId, employee, user?.id);

      await supabase.from('documents').insert({
        title: 'Signed Employment Contract',
        file_name: signedContractFile!.name,
        file_path: filePath,
        file_type: signedContractFile!.type,
        file_size: signedContractFile!.size,
        employee_id: employeeId,
        folder_id: empFolderId,
        uploaded_by: user?.id,
      });

      await supabase
        .from('employee_onboarding')
        .update({
          contract_signed: true,
          current_step: 5
        })
        .eq('employee_id', employeeId);

      clearInterval(interval);
      setUploadProgress(100);
      setExistingSignedContract({ path: filePath, name: signedContractFile!.name });
      setSignedContractFile(null);
      toast.success('Signed contract uploaded successfully');
      setTimeout(() => {
        setUploadProgress(0);
        setCurrentStep(prev => prev + 1);
      }, 400);
    } catch (error: unknown) {
      clearInterval(interval);
      setUploadProgress(0);
      const message = error instanceof Error ? error.message : 'Failed to upload signed contract';
      toast.error(message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleSignedDocFileChange = async (requirementId: string, file: File | null) => {
    if (!file) return;

    // Set initial file in state
    setSignedDocUploads(prev => prev.map(u => 
      u.requirement_id === requirementId ? { ...u, file, file_name: file.name, uploaded: false } : u
    ));

    // Start progress animation
    setDocUploadProgress(prev => ({ ...prev, [requirementId]: 15 }));
    const interval = setInterval(() => {
      setDocUploadProgress(prev => {
        const current = prev[requirementId] || 15;
        if (current >= 90) return prev;
        return { ...prev, [requirementId]: Math.min(current + 15, 90) };
      });
    }, 100);

    try {
      const fileName = `signed_doc_${employeeId}_${requirementId}_${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `employees/${employeeId}/signed-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      await supabase
        .from('signed_document_uploads')
        .upsert({
          employee_id: employeeId,
          requirement_id: requirementId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
        }, { onConflict: 'employee_id,requirement_id' });

      const empFolderId = await getOrCreateEmployeeFolder(employeeId, employee, user?.id);
      const req = signedDocRequirements.find(r => r.id === requirementId);
      await supabase.from('documents').insert({
        title: req?.name || 'Signed Document',
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        employee_id: employeeId,
        folder_id: empFolderId,
        uploaded_by: user?.id,
      });

      clearInterval(interval);
      setDocUploadProgress(prev => ({ ...prev, [requirementId]: 100 }));
      
      setSignedDocUploads(prev => prev.map(u => 
        u.requirement_id === requirementId 
          ? { ...u, file: null, uploaded: true, file_name: file.name, file_path: filePath } 
          : u
      ));

      toast.success(`${req?.name || 'Document'} uploaded successfully`);
      setTimeout(() => {
        setDocUploadProgress(prev => {
          const next = { ...prev };
          delete next[requirementId];
          return next;
        });
      }, 1200);
    } catch (error: unknown) {
      clearInterval(interval);
      setDocUploadProgress(prev => {
        const next = { ...prev };
        delete next[requirementId];
        return next;
      });
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      toast.error(message);
    }
  };

  const handleUploadSignedDocs = async () => {
    const mandatoryDocs = signedDocRequirements.filter(r => r.is_mandatory);
    const missingMandatory = mandatoryDocs.filter(req => {
      const upload = signedDocUploads.find(u => u.requirement_id === req.id);
      return !upload?.uploaded && !upload?.file;
    });

    if (missingMandatory.length > 0) {
      toast.error(`Please upload all mandatory documents: ${missingMandatory.map(d => d.name).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const pendingUploads = signedDocUploads.filter(u => u.file && !u.uploaded);
      for (const doc of pendingUploads) {
        if (doc.file) {
          await handleSignedDocFileChange(doc.requirement_id, doc.file);
        }
      }

      toast.success('Physical signed documents confirmed');
      setCurrentStep(prev => prev + 1);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save signed documents';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await supabase
        .from('employees')
        .update({ status: 'active' })
        .eq('id', employeeId);

      await supabase
        .from('employee_onboarding')
        .update({ completed_at: new Date().toISOString() })
        .eq('employee_id', employeeId);

      await ensureEmployeeDocuments(employeeId, null, user?.id);

      toast.success('Onboarding process completed. Employee profile is now active.');
      onBack();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    const currentStepId = steps[currentStep]?.id;
    if (currentStepId === 'upload') {
      await handleUploadSignedContract();
      return;
    }
    if (currentStepId === 'signed-docs') {
      await handleUploadSignedDocs();
      return;
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepId = steps[currentStep]?.id;

  const canProceedSignedDocs = () => {
    const mandatoryDocs = signedDocRequirements.filter(r => r.is_mandatory);
    return mandatoryDocs.every(req => {
      const upload = signedDocUploads.find(u => u.requirement_id === req.id);
      return upload?.file || upload?.uploaded;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-background border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl border">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Final Physical Upload & Activation</h1>
              <Badge className="bg-emerald-600 text-white text-xs">Contract Approved</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Employee: <span className="font-semibold text-foreground">{employee?.first_name} {employee?.last_name}</span> • Stage {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>
      </div>

      {/* 3-Stage Process Roadmap Card */}
      <Card className="p-5 border bg-slate-50 dark:bg-slate-900/40">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Standard Post-Approval Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-background border rounded-xl p-3.5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">1</div>
                <span>Download Approved Documents</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Download the Super Admin approved employment contract and pre-filled onboarding forms.
              </p>
            </div>
            <div className="bg-background border rounded-xl p-3.5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">2</div>
                <span>Physical Employee Signature</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Print documents and obtain the candidate's physical wet-signature on all required pages.
              </p>
            </div>
            <div className="bg-background border rounded-xl p-3.5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">3</div>
                <span>Upload Scans & Complete</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Upload scanned copies to finalize records and transition candidate to active employee.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stepper Progress */}
      <Card className="p-5 shadow-sm border space-y-3">
        <Progress value={progress} className="h-2" />
        <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
          {steps.map((step, index) => {
            const isCurrent = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-2.5 p-2 rounded-xl text-left border ${
                  isCurrent 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                    : 'bg-muted/40 text-muted-foreground border-border/40 opacity-70'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold ${
                  isCurrent ? 'bg-white/20 text-white' : isCompleted ? 'bg-emerald-200 text-emerald-800' : 'bg-muted'
                }`}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span className="text-xs font-medium truncate">{step.name}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Container */}
      <Card className="p-6 md:p-8 shadow-sm border">
        {/* Step 1: Upload Signed Contract */}
        {currentStepId === 'upload' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Step 1: Upload Physical Signed Contract</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download the approved contract, have the employee sign it, then upload the scanned PDF/image.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-9 text-xs flex-shrink-0"
                onClick={handleDownloadApprovedContractPDF}
                disabled={downloadingContract}
              >
                <Download className="h-3.5 w-3.5" />
                {downloadingContract ? 'Generating Contract...' : 'Download Approved Contract'}
              </Button>
            </div>

            {/* Existing File Card */}
            {existingSignedContract && !signedContractFile && (
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-xs dark:bg-emerald-950/20 dark:border-emerald-900/40">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-foreground">Signed Contract On File</p>
                    <p className="text-muted-foreground text-[11px]">{existingSignedContract.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleOpenFileUrl(existingSignedContract.path)}>
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                  <label htmlFor="signed-contract" className="cursor-pointer">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                      <span>
                        <Upload className="h-3.5 w-3.5" />
                        Replace File
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            )}

            {/* File Upload Box */}
            {(!existingSignedContract || signedContractFile) && (
              <div className="max-w-xl mx-auto py-4 space-y-3">
                <div className="border-2 border-dashed rounded-2xl p-8 text-center hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                  <input
                    type="file"
                    id="signed-contract"
                    accept="application/pdf,image/*"
                    disabled={loading}
                    className="hidden"
                    onChange={(e) => setSignedContractFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="signed-contract" className="cursor-pointer space-y-3 block">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Upload className="h-6 w-6" />
                    </div>
                    {signedContractFile ? (
                      <div>
                        <p className="font-semibold text-primary text-sm">{signedContractFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(signedContractFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-foreground text-sm">Click to choose signed contract file</p>
                        <p className="text-xs text-muted-foreground mt-1">Accepted formats: PDF, JPG, PNG (Max 25MB)</p>
                      </div>
                    )}
                  </label>
                </div>

                {signedContractFile && uploadProgress > 0 && (
                  <div className="p-3 bg-muted/40 rounded-xl border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Uploading Contract</span>
                      <span className="font-semibold text-primary">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Physical Signed Documents */}
        {currentStepId === 'signed-docs' && (
          <div className="space-y-6">
            <div className="border-b pb-5">
              <h3 className="text-lg font-semibold tracking-tight">Step 2: Upload Physical Signed Form Copies</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download each pre-filled document, obtain the candidate's physical signature, then upload scanned copies.
              </p>
            </div>

            <div className="space-y-3">
              {signedDocRequirements.map((req) => {
                const upload = signedDocUploads.find(u => u.requirement_id === req.id);
                const isUploaded = upload?.uploaded;
                const hasFile = upload?.file;

                return (
                  <Card key={req.id} className={`p-4 border ${isUploaded || hasFile ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{req.name}</span>
                          {req.is_mandatory && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Required</Badge>
                          )}
                          {isUploaded && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 text-white">
                              <Check className="h-2.5 w-2.5 mr-1" />
                              Uploaded
                            </Badge>
                          )}
                          {hasFile && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              Ready to Save
                            </Badge>
                          )}
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground">{req.description}</p>
                        )}
                        {upload?.file_name && (
                          <p className="text-[11px] text-muted-foreground truncate">File: {upload.file_name}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {upload?.file_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => handleOpenFileUrl(upload.file_path)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        )}
                        {getFilledFormForRequirement(req.name) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            disabled={downloadingForm === req.id}
                            onClick={() => handleDownloadFilledForm(req)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {downloadingForm === req.id ? 'Generating...' : 'Download Form'}
                          </Button>
                        )}
                        <input
                          type="file"
                          id={`signed-doc-${req.id}`}
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={docUploadProgress[req.id] !== undefined && docUploadProgress[req.id] > 0 && docUploadProgress[req.id] < 100}
                          onChange={(e) => handleSignedDocFileChange(req.id, e.target.files?.[0] || null)}
                        />
                        <label htmlFor={`signed-doc-${req.id}`}>
                          <Button 
                            variant={isUploaded || hasFile ? "outline" : "default"} 
                            size="sm" 
                            className="h-8 text-xs gap-1.5 cursor-pointer" 
                            disabled={docUploadProgress[req.id] !== undefined && docUploadProgress[req.id] > 0 && docUploadProgress[req.id] < 100}
                            asChild
                          >
                            <span>
                              <Upload className="h-3.5 w-3.5" />
                              {isUploaded ? 'Replace' : hasFile ? 'Change' : 'Upload Signed'}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    {/* Progress Bar & Percentage */}
                    {docUploadProgress[req.id] !== undefined && docUploadProgress[req.id] > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-primary flex items-center gap-1.5">
                            <Upload className="h-3 w-3 animate-pulse" />
                            Uploading scanned copy ({upload?.file_name || upload?.file?.name || req.name})...
                          </span>
                          <span className="font-bold text-primary">{docUploadProgress[req.id]}%</span>
                        </div>
                        <Progress value={docUploadProgress[req.id]} className="h-2" />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Complete & Activate Profile */}
        {currentStepId === 'complete' && (
          <div className="text-center py-10 space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Ready to Activate Employee</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                All verification documents, approved contract signatures, and physical signed forms have been validated for{' '}
                <span className="font-semibold text-foreground">{employee?.first_name} {employee?.last_name}</span>.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={handleComplete} size="lg" className="gap-2 text-xs h-10 px-6 font-semibold" disabled={loading}>
                <Check className="h-4 w-4" />
                {loading ? 'Activating Profile...' : 'Complete Onboarding & Activate'}
              </Button>
            </div>
          </div>
        )}

        {/* Navigation Bar */}
        {currentStepId !== 'complete' && (
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
            
            <Button 
              onClick={handleNext} 
              disabled={
                loading || 
                (currentStepId === 'upload' && !signedContractFile && !existingSignedContract) ||
                (currentStepId === 'signed-docs' && !canProceedSignedDocs())
              } 
              className="gap-2 text-xs h-9 px-5"
            >
              {loading ? 'Saving Changes...' : 'Save & Continue'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}