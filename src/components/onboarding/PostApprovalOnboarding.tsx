import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, File, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PostApprovalOnboardingProps {
  employeeId: string;
  onBack: () => void;
}

interface DocumentRequirement {
  id: string;
  name: string;
  is_mandatory: boolean;
  is_locked: boolean;
}

const STEPS = [
  { id: 'documents', name: 'Document Upload', icon: File },
  { id: 'complete', name: 'Complete', icon: Check }
];

export default function PostApprovalOnboarding({ employeeId, onBack }: PostApprovalOnboardingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  
  const [additionalDocuments, setAdditionalDocuments] = useState<{
    requirementId: string;
    file: File | null;
    expiryDate: string;
    followUpDate: string;
  }[]>([]);

  useEffect(() => {
    fetchEmployee();
    fetchDocumentRequirements();
  }, [employeeId]);

  const fetchEmployee = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*, organizations(name), branches(name)')
      .eq('id', employeeId)
      .single();
    
    if (data) setEmployee(data);
  };

  const fetchDocumentRequirements = async () => {
    const { data } = await supabase
      .from('document_requirements')
      .select('*')
      .eq('enabled', true)
      .order('doc_order');
    
    if (data) {
      setDocumentRequirements(data);
      // Initialize document uploads for each requirement
      setAdditionalDocuments(
        data.map(req => ({
          requirementId: req.id,
          file: null,
          expiryDate: '',
          followUpDate: ''
        }))
      );
    }
  };

  const handleNext = async () => {
    const currentStepId = STEPS[currentStep]?.id;
    
    if (currentStepId === 'documents') {
      await saveDocuments();
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const saveDocuments = async () => {
    setLoading(true);
    try {
      // Get employee folder
      const { data: folder } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', employeeId)
        .single();

      for (const doc of additionalDocuments) {
        if (doc.file) {
          const requirement = documentRequirements.find(r => r.id === doc.requirementId);
          const fileName = `${requirement?.name || 'document'}_${employeeId}_${Date.now()}.${doc.file.name.split('.').pop()}`;
          const filePath = `employees/${employeeId}/documents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, doc.file);

          if (uploadError) throw uploadError;

          await supabase.from('documents').insert({
            title: requirement?.name || doc.file.name,
            file_name: doc.file.name,
            file_path: filePath,
            file_type: doc.file.type,
            file_size: doc.file.size,
            employee_id: employeeId,
            folder_id: folder?.id,
            expiry_date: doc.expiryDate || null,
            follow_up_date: doc.followUpDate || null,
            uploaded_by: user?.id
          });
        }
      }

      await supabase
        .from('employee_onboarding')
        .update({ documents_uploaded: true })
        .eq('employee_id', employeeId);

      toast.success('Documents saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save documents');
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

      toast.success('Onboarding completed!');
      onBack();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateDocument = (index: number, updates: Partial<typeof additionalDocuments[0]>) => {
    setAdditionalDocuments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const currentStepId = STEPS[currentStep]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Post-Approval Onboarding</h1>
          <p className="text-muted-foreground">
            {employee?.first_name} {employee?.last_name} - Step {currentStep + 1} of {STEPS.length}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Progress value={progress} className="h-2" />
        <div className="grid grid-cols-2 gap-4">
          {STEPS.map((step, index) => (
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
        {/* Document Upload Step */}
        {currentStepId === 'documents' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Document Upload</h2>
            <p className="text-muted-foreground">Upload required documents for this employee.</p>

            {documentRequirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No document requirements configured. You can proceed to complete onboarding.
              </div>
            ) : (
              <div className="space-y-6">
                {documentRequirements.map((req, index) => (
                  <Card key={req.id} className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{req.name}</h3>
                        {req.is_mandatory && (
                          <span className="text-xs text-destructive">Required</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Document</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                          <input
                            type="file"
                            id={`doc-${req.id}`}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            className="hidden"
                            onChange={(e) => updateDocument(index, { file: e.target.files?.[0] || null })}
                          />
                          <label htmlFor={`doc-${req.id}`} className="cursor-pointer">
                            <div className="flex flex-col items-center gap-1">
                              <Upload className="h-5 w-5 text-muted-foreground" />
                              {additionalDocuments[index]?.file ? (
                                <span className="text-xs text-primary truncate max-w-full">
                                  {additionalDocuments[index].file.name}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Upload</span>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={additionalDocuments[index]?.expiryDate || ''}
                          onChange={(e) => updateDocument(index, { expiryDate: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Follow-up Date</Label>
                        <Input
                          type="date"
                          value={additionalDocuments[index]?.followUpDate || ''}
                          onChange={(e) => updateDocument(index, { followUpDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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
            
            <Button onClick={handleNext} disabled={loading} className="gap-2">
              {loading ? 'Saving...' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}