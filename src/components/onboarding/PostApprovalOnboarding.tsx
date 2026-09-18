import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, Upload, FileSignature, FilePen, CheckCircle2, Download } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Helper: find or create the employee's folder inside the branch folder tree
// Hierarchy: Company Documents → Org folder → Branch folder → Employee folder
// ---------------------------------------------------------------------------
async function getOrCreateEmployeeFolder(
  employeeId: string,
  employee: any,
  uploadedBy: string | undefined
): Promise<string | null> {
  try {
    let branchId = employee?.branch_id;
    let organizationId = employee?.organization_id;
    let empFirstName = employee?.first_name || '';
    let empLastName = employee?.last_name || '';

    // If employee object doesn't have branch_id yet, fetch it from DB
    if (!branchId) {
      const { data: empDb } = await supabase
        .from('employees')
        .select('branch_id, organization_id, first_name, last_name')
        .eq('id', employeeId)
        .maybeSingle();
      if (empDb) {
        branchId = empDb.branch_id;
        organizationId = empDb.organization_id;
        empFirstName = empDb.first_name || '';
        empLastName = empDb.last_name || '';
      }
    }

    if (!branchId) return null;

    // 1. Find the branch folder
    const { data: branchFolder } = await supabase
      .from('folders')
      .select('id, path')
      .eq('folder_type', 'branch')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!branchFolder) return null;

    // 2. Try to find an existing employee folder for this employee
    const { data: existingEmpFolder } = await supabase
      .from('folders')
      .select('id, parent_id')
      .eq('folder_type', 'employee')
      .eq('employee_id', employeeId)
      .maybeSingle();

    let folderId: string | null = null;

    if (existingEmpFolder) {
      folderId = existingEmpFolder.id;
      // If it exists but parent_id was null or wrong, update it to point to branch folder
      if (existingEmpFolder.parent_id !== branchFolder.id) {
        await supabase
          .from('folders')
          .update({
            parent_id: branchFolder.id,
            branch_id: branchId,
            organization_id: organizationId ?? null,
          })
          .eq('id', existingEmpFolder.id);
      }
    } else {
      // 3. Create the employee folder under the branch folder
      const empName = `${empFirstName} ${empLastName}`.trim() || 'Employee Documents';
      const folderPath = `${branchFolder.path}/${empName}`;

      const { data: newFolder, error: createErr } = await supabase
        .from('folders')
        .insert({
          name: empName,
          path: folderPath,
          parent_id: branchFolder.id,
          folder_type: 'employee',
          employee_id: employeeId,
          branch_id: branchId,
          organization_id: organizationId ?? null,
          created_by: uploadedBy ?? null,
        })
        .select('id')
        .single();

      if (createErr) {
        console.error('Failed to create employee folder:', createErr);
        return null;
      }

      folderId = newFolder?.id ?? null;
    }

    // 4. Update any existing documents for this employee that have null folder_id
    if (folderId) {
      await supabase
        .from('documents')
        .update({ folder_id: folderId })
        .eq('employee_id', employeeId)
        .is('folder_id', null);
    }

    return folderId;
  } catch (err) {
    console.error('getOrCreateEmployeeFolder error:', err);
    return null;
  }
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
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [downloadingForm, setDownloadingForm] = useState<string | null>(null);

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

  // Build filled or default form data for a signed document requirement
  const getFilledFormData = (reqName: string) => {
    const n = reqName.toLowerCase();
    const orgName = employee?.organizations?.name;
    const branchName = employee?.branches?.name;

    const appFormData = formResponses['application_form'] || {
      first_name: employee?.first_name || '',
      last_name: employee?.last_name || '',
      phone: employee?.phone || '',
      email: employee?.email || '',
      address: employee?.address || '',
      date_of_birth: employee?.date_of_birth || '',
      job_title: employee?.job_title || '',
      department: employee?.department || '',
      start_date: employee?.join_date || '',
      ni_number: employee?.national_insurance_number || '',
      emergency_contact_name: employee?.emergency_contact_name || '',
      emergency_contact_phone: employee?.emergency_contact_phone || '',
      emergency_contact_relationship: employee?.emergency_contact_relationship || '',
    };

    if (n.includes('application')) {
      return {
        type: 'application_form',
        getDoc: () => buildApplicationFormPdf(appFormData, orgName, branchName),
      };
    }

    if (n.includes('starter') || n.includes('checklist')) {
      const starterFormData = formResponses['starter_checklist'] || {
        last_name: appFormData.last_name || employee?.last_name || '',
        first_names: appFormData.first_name || employee?.first_name || '',
        gender: appFormData.gender || '',
        date_of_birth: appFormData.date_of_birth || employee?.date_of_birth || '',
        address: appFormData.address || employee?.address || '',
        postcode: appFormData.postcode || '',
        country: appFormData.country || 'United Kingdom',
        national_insurance: appFormData.ni_number || employee?.national_insurance_number || '',
        employment_start_date: appFormData.start_date || employee?.join_date || '',
        statement: 'A',
        has_student_loan: false,
        declaration_agreed: true,
        signature: appFormData.signature || '',
        signature_date: appFormData.signature_date || '',
      };
      return {
        type: 'starter_checklist',
        getDoc: () => buildStarterChecklistPdf(starterFormData),
      };
    }

    if (n.includes('bank')) {
      const bankFormData = formResponses['bank_details'] || {
        your_name: `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim(),
        telephone_number: appFormData.phone || employee?.phone || '',
        bank_name: '',
        bank_address: '',
        bank_telephone: '',
        sort_code: '',
        account_number: '',
        building_society_roll: '',
        account_holder_name: `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim(),
        declaration_agreed: true,
        signature: appFormData.signature || '',
        signature_date: appFormData.signature_date || '',
      };
      return {
        type: 'bank_details',
        getDoc: () => buildBankDetailsPdf(bankFormData),
      };
    }

    return null;
  };

  const handleDownloadFilledForm = async (req: SignedDocRequirement) => {
    const filled = getFilledFormData(req.name);
    if (!filled) {
      toast.error('No template found for this document.');
      return;
    }
    setDownloadingForm(req.id);
    try {
      const doc = await filled.getDoc();
      const safeName = req.name.replace(/[^a-z0-9]+/gi, '_');
      const empName = `${employee?.first_name || ''}_${employee?.last_name || ''}`.replace(/[^a-z0-9_]+/gi, '');
      doc.save(`${safeName}_${empName}.pdf`);
    } catch (err) {
      console.error('Failed to generate filled form:', err);
      toast.error('Failed to generate the filled form');
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
      // Automatically ensure employee folder and all 3 documents are synced
      generateAndSaveOnboardingPdfs(data);
    }
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

      const empFolderId = await getOrCreateEmployeeFolder(employeeId, employee, user?.id);

      await supabase.from('documents').insert({
        title: 'Signed Contract',
        file_name: signedContractFile.name,
        file_path: filePath,
        file_type: signedContractFile.type,
        file_size: signedContractFile.size,
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

      // Also ensure all 3 onboarding PDFs are in place
      await generateAndSaveOnboardingPdfs();

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
        const empFolderId = await getOrCreateEmployeeFolder(employeeId, employee, user?.id);
        const req = signedDocRequirements.find(r => r.id === doc.requirement_id);
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
      }

      // Also ensure all 3 onboarding PDFs are in place
      await generateAndSaveOnboardingPdfs();

      toast.success('Signed documents uploaded successfully');
      setCurrentStep(prev => prev + 1);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload signed documents';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const generateAndSaveOnboardingPdfs = async (empData?: any) => {
    try {
      const emp = empData || employee;
      if (!emp) return;

      // Find or create the employee's folder inside the Company Documents hierarchy
      const folderId = await getOrCreateEmployeeFolder(employeeId, emp, user?.id);

      // Fetch all 3 form responses in parallel
      const [appRes, starterRes, bankRes] = await Promise.all([
        supabase.from('onboarding_form_responses').select('form_data').eq('employee_id', employeeId).eq('form_type', 'application_form').maybeSingle(),
        supabase.from('onboarding_form_responses').select('form_data').eq('employee_id', employeeId).eq('form_type', 'starter_checklist').maybeSingle(),
        supabase.from('onboarding_form_responses').select('form_data').eq('employee_id', employeeId).eq('form_type', 'bank_details').maybeSingle(),
      ]);

      const orgName = emp?.organizations?.name;
      const branchName = emp?.branches?.name;

      const appFormData = appRes.data?.form_data || {
        first_name: emp?.first_name || '',
        last_name: emp?.last_name || '',
        phone: emp?.phone || '',
        email: emp?.email || '',
        address: emp?.address || '',
        date_of_birth: emp?.date_of_birth || '',
        job_title: emp?.job_title || '',
        department: emp?.department || '',
        start_date: emp?.join_date || '',
        ni_number: emp?.national_insurance_number || '',
        emergency_contact_name: emp?.emergency_contact_name || '',
        emergency_contact_phone: emp?.emergency_contact_phone || '',
        emergency_contact_relationship: emp?.emergency_contact_relationship || '',
      };

      const starterFormData = starterRes.data?.form_data || {
        last_name: appFormData.last_name || emp?.last_name || '',
        first_names: appFormData.first_name || emp?.first_name || '',
        gender: appFormData.gender || '',
        date_of_birth: appFormData.date_of_birth || emp?.date_of_birth || '',
        address: appFormData.address || emp?.address || '',
        postcode: appFormData.postcode || '',
        country: appFormData.country || 'United Kingdom',
        national_insurance: appFormData.ni_number || emp?.national_insurance_number || '',
        employment_start_date: appFormData.start_date || emp?.join_date || '',
        statement: 'A',
        has_student_loan: false,
        declaration_agreed: true,
        signature: appFormData.signature || '',
        signature_date: appFormData.signature_date || '',
      };

      const bankFormData = bankRes.data?.form_data || {
        your_name: `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
        telephone_number: appFormData.phone || emp?.phone || '',
        bank_name: '',
        bank_address: '',
        bank_telephone: '',
        sort_code: '',
        account_number: '',
        building_society_roll: '',
        account_holder_name: `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
        declaration_agreed: true,
        signature: appFormData.signature || '',
        signature_date: appFormData.signature_date || '',
      };

      // Check existing documents in DB
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id, title, folder_id')
        .eq('employee_id', employeeId)
        .in('title', ['Application Form', 'Starter Checklist', 'Bank Details']);

      const docMap = new Map((existingDocs || []).map((d: any) => [d.title, d]));

      // If any existing doc is missing folder_id or in wrong folder, update it
      if (folderId && existingDocs) {
        for (const doc of existingDocs) {
          if (!doc.folder_id || doc.folder_id !== folderId) {
            await supabase
              .from('documents')
              .update({ folder_id: folderId })
              .eq('id', doc.id);
          }
        }
      }

      // Generate any missing documents among the 3
      const toGenerate: Array<{ title: string; getDoc: () => Promise<any>; baseName: string }> = [
        {
          title: 'Application Form',
          getDoc: () => buildApplicationFormPdf(appFormData, orgName, branchName),
          baseName: 'Application_Form',
        },
        {
          title: 'Starter Checklist',
          getDoc: () => buildStarterChecklistPdf(starterFormData),
          baseName: 'Starter_Checklist',
        },
        {
          title: 'Bank Details',
          getDoc: () => buildBankDetailsPdf(bankFormData),
          baseName: 'Bank_Details',
        },
      ];

      for (const item of toGenerate) {
        if (!docMap.has(item.title)) {
          const doc = await item.getDoc();
          const blob: Blob = doc.output('blob');
          const fileName = `${item.baseName}_${employeeId}_${Date.now()}.pdf`;
          const filePath = `employees/${employeeId}/onboarding-forms/${fileName}`;

          const { error: upErr } = await supabase.storage
            .from('documents')
            .upload(filePath, blob, { contentType: 'application/pdf' });

          if (upErr) {
            console.error(`Failed to upload ${item.title}:`, upErr);
            continue;
          }

          await supabase.from('documents').insert({
            title: item.title,
            file_name: `${item.baseName}.pdf`,
            file_path: filePath,
            file_type: 'application/pdf',
            file_size: blob.size,
            employee_id: employeeId,
            folder_id: folderId,
            uploaded_by: user?.id,
          });
        }
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

                      <div className="flex items-center gap-2">
                        {getFilledFormData(req.name) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={downloadingForm === req.id}
                            onClick={() => handleDownloadFilledForm(req)}
                          >
                            <Download className="h-4 w-4" />
                            {downloadingForm === req.id ? 'Generating…' : 'Download'}
                          </Button>
                        )}
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