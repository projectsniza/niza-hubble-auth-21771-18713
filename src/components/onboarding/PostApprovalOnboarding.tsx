import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Upload, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PostApprovalOnboardingProps {
  employeeId: string;
  onBack: () => void;
}

const STEPS = [
  { id: 'upload', name: 'Upload Signed Contract', icon: Upload },
  { id: 'complete', name: 'Complete', icon: Check }
];

export default function PostApprovalOnboarding({ employeeId, onBack }: PostApprovalOnboardingProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [contractApproval, setContractApproval] = useState<any>(null);
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);

  useEffect(() => {
    fetchEmployee();
    fetchContractApproval();
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

      // Update contract approval with signed contract path
      await supabase
        .from('contract_approvals')
        .update({
          signed_contract_path: filePath,
          signed_contract_uploaded_at: new Date().toISOString(),
          signed_contract_uploaded_by: user?.id
        })
        .eq('id', contractApproval.id);

      // Update onboarding status
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    const currentStepId = STEPS[currentStep]?.id;
    
    if (currentStepId === 'upload') {
      await handleUploadSignedContract();
      return;
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

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const currentStepId = STEPS[currentStep]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Final Contract Upload</h1>
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
            
            <Button onClick={handleNext} disabled={loading || (currentStepId === 'upload' && !signedContractFile)} className="gap-2">
              {loading ? 'Saving...' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}