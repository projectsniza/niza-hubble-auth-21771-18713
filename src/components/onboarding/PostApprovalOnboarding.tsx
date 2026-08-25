import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, Upload, FileSignature, FilePen, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildApplicationFormPdf,
  buildStarterChecklistPdf,
  buildBankDetailsPdf,
} from '@/lib/onboardingPdfs';

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
}

export default function PostApprovalOnboarding({ employeeId, onBack }: PostApprovalOnboardingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [contractApproval, setContractApproval] = useState<any>(null);
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const [signedDocRequirements, setSignedDocRequirements] = useState<SignedDocRequirement[]>([]);
  const [signedDocUploads, setSignedDocUploads] = useState<SignedDocUpload[]>([]);
  const [hasSignedDocs, setHasSignedDocs] = useState(false);

  useEffect(() => {
    fetchEmployee();
    fetchContractApproval();
    fetchSignedDocRequirements();
  }, [employeeId]);

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*, organizations(name), branches(name)')
      .eq('id', employeeId)
      .single();
    
    if (data) setEmployee(data);
  };

  const fetchContractApproval = async () => {
    const { data } = await supabase
      .from('contract_approvals')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .single();
    
    if (data) setContractApproval(data);
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

      // Check for existing uploads
      const { data: existingUploads } = await supabase
        .from('signed_document_uploads')
        .select('requirement_id, file_name')
        .eq('employee_id', employeeId);

      const uploads: SignedDocUpload[] = data.map(req => {
        const existing = existingUploads?.find(u => u.requirement_id === req.id);
        return {
          requirement_id: req.id,
          file: null,
          uploaded: !!existing,
          file_name: existing?.file_name,
        };
      });
      setSignedDocUploads(uploads);
    }
  };

  // Dynamic steps based on whether signed docs exist
  const steps = [
    { id: 'upload', name: 'Upload Signed Contract', icon: Upload },
    ...(hasSignedDocs ? [{ id: 'signed-docs', name: 'Signed Documents', icon: FilePen }] : []),
    { id: 'complete', name: 'Complete', icon: Check }
  ];

  const handleDownloadContract = async () => {
    if (contractApproval?.contract_file_path) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(contractApproval.contract_file_path, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } else {
      toast.error('No contract file available');
    }
  };

  const handleUploadSignedContract = async () => {
    if (!signedContractFile) {
      toast.error('Please select the signed contract file');
      return;
    }

    setLoading(true);
    try {
      const fileName = `signed_contract_${employeeId}_${Date.now()}.${signedContractFile.name.split('.').pop()}`;
      const filePath = `employees/${employeeId}/contracts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, signedContractFile);

      if (uploadError) throw uploadError;

      await supabase
        .from('contract_approvals')
        .update({
          signed_contract_path: filePath,
          signed_contract_uploaded_at: new Date().toISOString(),
          signed_contract_uploaded_by: user?.id
        })
        .eq('id', contractApproval.id);

      const { data: employeeFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('folder_type', 'employee')
        .maybeSingle();

      if (employeeFolder) {
        await supabase.from('documents').insert({
          title: 'Signed Contract',
          file_name: signedContractFile.name,
          file_path: filePath,
          file_type: signedContractFile.type,
          file_size: signedContractFile.size,
          employee_id: employeeId,
          folder_id: employeeFolder.id,
          uploaded_by: user?.id,
        });
      }

      await supabase
        .from('employee_onboarding')
        .update({
          contract_signed: true,
          current_step: 5
        })
        .eq('employee_id', employeeId);

      toast.success('Signed contract uploaded successfully');
      setCurrentStep(prev => prev + 1);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload signed contract';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignedDocFileChange = (requirementId: string, file: File | null) => {
    setSignedDocUploads(prev => prev.map(u => 
      u.requirement_id === requirementId ? { ...u, file, uploaded: false } : u
    ));
  };

  const handleUploadSignedDocs = async () => {
    // Validate mandatory docs have files or are already uploaded
    const mandatoryDocs = signedDocRequirements.filter(r => r.is_mandatory);
    const missingMandatory = mandatoryDocs.filter(req => {
      const upload = signedDocUploads.find(u => u.requirement_id === req.id);
      return !upload?.file && !upload?.uploaded;
    });

    if (missingMandatory.length > 0) {
      toast.error(`Please upload all mandatory documents: ${missingMandatory.map(d => d.name).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const docsToUpload = signedDocUploads.filter(u => u.file && !u.uploaded);

      for (const doc of docsToUpload) {
        const file = doc.file!;
        const fileName = `signed_doc_${employeeId}_${doc.requirement_id}_${Date.now()}.${file.name.split('.').pop()}`;
        const filePath = `employees/${employeeId}/signed-documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        await supabase
          .from('signed_document_uploads')
          .upsert({
            employee_id: employeeId,
            requirement_id: doc.requirement_id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user?.id,
          }, { onConflict: 'employee_id,requirement_id' });

        // Also save to employee's document folder
        const { data: employeeFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('employee_id', employeeId)
          .eq('folder_type', 'employee')
          .maybeSingle();

        if (employeeFolder) {
          const req = signedDocRequirements.find(r => r.id === doc.requirement_id);
          await supabase.from('documents').insert({
            title: req?.name || 'Signed Document',
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            employee_id: employeeId,
            folder_id: employeeFolder.id,
            uploaded_by: user?.id,
          });
        }
      }

      toast.success('Signed documents uploaded successfully');
      setCurrentStep(prev => prev + 1);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload signed documents';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const generateAndSaveOnboardingPdfs = async () => {
    try {
      // Fetch employee folder (fall back to any folder linked to the employee)
      let { data: employeeFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('folder_type', 'employee')
        .maybeSingle();
      if (!employeeFolder) {
        const { data: anyFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('employee_id', employeeId)
          .limit(1)
          .maybeSingle();
        employeeFolder = anyFolder || null;
      }
      const folderId = employeeFolder?.id ?? null;


      // Fetch all 3 form responses in parallel
      const [appRes, starterRes, bankRes] = await Promise.all([
        supabase.from('onboarding_form_responses').select('form_data').eq('employee_id', employeeId).eq('form_type', 'application_form').maybeSingle(),
        supabase.from('onboarding_form_responses').select('form_data').eq('employee_id', employeeId).eq('form_type', 'starter_checklist').maybeSingle(),
        supabase.from('onboarding_form_responses').select('form_data').eq('employee_id', employeeId).eq('form_type', 'bank_details').maybeSingle(),
      ]);

      // Skip files that already exist in this folder (avoid duplicates)
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('title')
        .eq('folder_id', employeeFolder.id)
        .in('title', ['Application Form', 'Starter Checklist', 'Bank Details']);
      const existingTitles = new Set((existingDocs || []).map((d: any) => d.title));

      const orgName = employee?.organizations?.name;
      const branchName = employee?.branches?.name;

      const uploads: Array<{ title: string; doc: any; baseName: string }> = [];
      if (appRes.data?.form_data && !existingTitles.has('Application Form')) {
        const doc = await buildApplicationFormPdf(appRes.data.form_data as any, orgName, branchName);
        uploads.push({ title: 'Application Form', doc, baseName: 'Application_Form' });
      }
      if (starterRes.data?.form_data && !existingTitles.has('Starter Checklist')) {
        const doc = await buildStarterChecklistPdf(starterRes.data.form_data as any);
        uploads.push({ title: 'Starter Checklist', doc, baseName: 'Starter_Checklist' });
      }
      if (bankRes.data?.form_data && !existingTitles.has('Bank Details')) {
        const doc = await buildBankDetailsPdf(bankRes.data.form_data as any);
        uploads.push({ title: 'Bank Details', doc, baseName: 'Bank_Details' });
      }

      for (const u of uploads) {
        const blob: Blob = u.doc.output('blob');
        const fileName = `${u.baseName}_${employeeId}_${Date.now()}.pdf`;
        const filePath = `employees/${employeeId}/onboarding-forms/${fileName}`;
        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(filePath, blob, { contentType: 'application/pdf' });
        if (upErr) {
          console.error(`Failed to upload ${u.title}:`, upErr);
          continue;
        }
        await supabase.from('documents').insert({
          title: u.title,
          file_name: `${u.baseName}.pdf`,
          file_path: filePath,
          file_type: 'application/pdf',
          file_size: blob.size,
          employee_id: employeeId,
          folder_id: employeeFolder.id,
          uploaded_by: user?.id,
        });
      }
    } catch (err) {
      console.error('Onboarding PDF generation error:', err);
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

      // Auto-generate Application Form, Starter Checklist and Bank Details PDFs
      // and save them into the employee's document folder.
      await generateAndSaveOnboardingPdfs();

      toast.success('Onboarding completed!');
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Final Contract Upload</h1>
          <p className="text-muted-foreground">
            {employee?.first_name} {employee?.last_name} - Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Progress value={progress} className="h-2" />
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
          {steps.map((step, index) => (
            <div key={step.id} className={`flex flex-col items-center gap-2 ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <step.icon className="h-5 w-5" />
              </div>
              <span className="text-sm text-center">{step.name}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-6">
        {/* Upload Signed Contract Step */}
        {currentStepId === 'upload' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileSignature className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Upload Signed Contract</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Upload the scanned or photographed copy of the signed contract.
              </p>
              
              <div className="max-w-md mx-auto">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="signed-contract"
                    accept="*/*"
                    className="hidden"
                    onChange={(e) => setSignedContractFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="signed-contract" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    {signedContractFile ? (
                      <div>
                        <p className="font-medium text-primary">{signedContractFile.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Click to upload signed contract</p>
                        <p className="text-sm text-muted-foreground mt-1">PDF, JPG, or PNG</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signed Documents Step */}
        {currentStepId === 'signed-docs' && (
          <div className="space-y-6">
           <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FilePen className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Upload Signed Documents</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Download and print the Application Form, Starter Checklist, and Bank Details. 
                Get the employee to sign them physically, then scan or photograph and upload each signed document below.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              {signedDocRequirements.map((req) => {
                const upload = signedDocUploads.find(u => u.requirement_id === req.id);
                const isUploaded = upload?.uploaded;
                const hasFile = upload?.file;

                return (
                  <Card key={req.id} className={`p-4 ${isUploaded ? 'border-green-300 bg-green-50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{req.name}</span>
                          {req.is_mandatory && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                          {isUploaded && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                        )}
                        {isUploaded && upload?.file_name && (
                          <p className="text-xs text-green-700 mt-1">Previously uploaded: {upload.file_name}</p>
                        )}
                        {hasFile && (
                          <p className="text-xs text-primary mt-1">Selected: {upload?.file?.name}</p>
                        )}
                      </div>

                      <div>
                        <input
                          type="file"
                          id={`signed-doc-${req.id}`}
                          accept="*/*"
                          className="hidden"
                          onChange={(e) => handleSignedDocFileChange(req.id, e.target.files?.[0] || null)}
                        />
                        <label htmlFor={`signed-doc-${req.id}`}>
                          <Button variant={isUploaded || hasFile ? "outline" : "default"} size="sm" className="gap-2 cursor-pointer" asChild>
                            <span>
                              <Upload className="h-4 w-4" />
                              {isUploaded ? 'Replace' : hasFile ? 'Change' : 'Upload'}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Complete Step */}
        {currentStepId === 'complete' && (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold">Ready to Complete!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              All onboarding steps have been completed for {employee?.first_name} {employee?.last_name}. 
              Click below to activate the employee in the system.
            </p>
            <Button onClick={handleComplete} size="lg" className="gap-2" disabled={loading}>
              <Check className="h-5 w-5" />
              {loading ? 'Completing...' : 'Complete Onboarding'}
            </Button>
          </div>
        )}

        {/* Navigation */}
        {currentStepId !== 'complete' && (
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
            
            <Button 
              onClick={handleNext} 
              disabled={
                loading || 
                (currentStepId === 'upload' && !signedContractFile) ||
                (currentStepId === 'signed-docs' && !canProceedSignedDocs())
              } 
              className="gap-2"
            >
              {loading ? 'Saving...' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}