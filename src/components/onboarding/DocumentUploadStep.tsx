import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { File, Plus, Lock, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DocumentRequirement {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_locked: boolean;
  enabled: boolean;
  requires_esignature: boolean;
  verification_message: string | null;
}

interface AdditionalDocument {
  title: string;
  file: File | null;
  expiryDate: string;
  followUpDate: string;
}

interface DocumentUploadStepProps {
  employeeId: string;
  additionalDocuments: AdditionalDocument[];
  onUpdateDocument: (index: number, updates: Partial<AdditionalDocument>) => void;
  onAddDocument: () => void;
  onDocumentsSaved?: () => void;
}

export interface DocumentUploadStepRef {
  saveDocuments: () => Promise<boolean>;
  hasAllMandatoryDocuments: () => boolean;
}

const DocumentUploadStep = forwardRef<DocumentUploadStepRef, DocumentUploadStepProps>(({
  employeeId,
  additionalDocuments,
  onUpdateDocument,
  onAddDocument,
  onDocumentsSaved
}, ref) => {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [requirementFiles, setRequirementFiles] = useState<Record<string, File | null>>({});
  const [requirementExpiry, setRequirementExpiry] = useState<Record<string, string>>({});
  const [requirementFollowUp, setRequirementFollowUp] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDocumentRequirements();
  }, []);

  const fetchDocumentRequirements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_requirements')
        .select('*')
        .eq('enabled', true)
        .order('doc_order');

      if (error) throw error;
      setRequirements(data || []);
    } catch (error) {
      console.error('Error fetching requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequirementFileChange = (reqId: string, file: File | null) => {
    setRequirementFiles(prev => ({ ...prev, [reqId]: file }));
  };

  const handleRequirementExpiryChange = (reqId: string, date: string) => {
    setRequirementExpiry(prev => ({ ...prev, [reqId]: date }));
  };

  const handleRequirementFollowUpChange = (reqId: string, date: string) => {
    setRequirementFollowUp(prev => ({ ...prev, [reqId]: date }));
  };

  const hasAllMandatoryDocuments = () => {
    const mandatoryReqs = requirements.filter(r => r.is_mandatory);
    return mandatoryReqs.every(req => !!requirementFiles[req.id]);
  };

  const saveDocuments = async (): Promise<boolean> => {
    setSaving(true);
    try {
      // Get or create employee folder
      let folderId: string | null = null;
      const { data: existingFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', employeeId)
        .single();

      if (existingFolder) {
        folderId = existingFolder.id;
      }

      // Upload requirement-based documents
      for (const req of requirements) {
        const file = requirementFiles[req.id];
        if (file) {
          const fileName = `${req.name}_${employeeId}_${Date.now()}.${file.name.split('.').pop()}`;
          const filePath = `employees/${employeeId}/documents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          await supabase.from('documents').insert({
            title: req.name,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            employee_id: employeeId,
            folder_id: folderId,
            expiry_date: requirementExpiry[req.id] || null,
            follow_up_date: requirementFollowUp[req.id] || null,
            uploaded_by: user?.id
          });
        }
      }

      // Upload additional documents
      for (const doc of additionalDocuments) {
        if (doc.file && doc.title) {
          const fileName = `${doc.title}_${employeeId}_${Date.now()}.${doc.file.name.split('.').pop()}`;
          const filePath = `employees/${employeeId}/documents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, doc.file);

          if (uploadError) throw uploadError;

          await supabase.from('documents').insert({
            title: doc.title,
            file_name: doc.file.name,
            file_path: filePath,
            file_type: doc.file.type,
            file_size: doc.file.size,
            employee_id: employeeId,
            folder_id: folderId,
            expiry_date: doc.expiryDate || null,
            follow_up_date: doc.followUpDate || null,
            uploaded_by: user?.id
          });
        }
      }

      // Update onboarding status
      await supabase
        .from('employee_onboarding')
        .update({ documents_uploaded: true })
        .eq('employee_id', employeeId);

      toast.success('Documents uploaded successfully');
      onDocumentsSaved?.();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload documents');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    saveDocuments,
    hasAllMandatoryDocuments
  }));

  const mandatoryRequirements = requirements.filter(r => r.is_mandatory);
  const optionalRequirements = requirements.filter(r => !r.is_mandatory);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Required Documents</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Required Documents</h2>
        <p className="text-muted-foreground">Upload required documents before submitting contract for approval.</p>
      </div>

      {/* Mandatory Documents Section */}
      {mandatoryRequirements.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-lg">Mandatory Documents</h3>
          </div>
          
          {mandatoryRequirements.map((req) => (
            <Card key={req.id} className="p-4 border-destructive/30 bg-destructive/5">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {req.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{req.name}</span>
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                        {req.requires_esignature && (
                          <Badge variant="outline" className="text-xs">E-Sign</Badge>
                        )}
                      </div>
                      {req.description && (
                        <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                      )}
                    </div>
                  </div>
                  {requirementFiles[req.id] && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Upload Document *</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <input
                        type="file"
                        id={`req-${req.id}`}
                        className="hidden"
                        onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                      />
                      <label htmlFor={`req-${req.id}`} className="cursor-pointer">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                        {requirementFiles[req.id] ? (
                          <p className="text-sm text-primary mt-1 truncate">{requirementFiles[req.id]?.name}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">Click to upload</p>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input 
                      type="date"
                      value={requirementExpiry[req.id] || ''}
                      onChange={(e) => handleRequirementExpiryChange(req.id, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Follow-up Date</Label>
                    <Input 
                      type="date"
                      value={requirementFollowUp[req.id] || ''}
                      onChange={(e) => handleRequirementFollowUpChange(req.id, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Optional Documents Section */}
      {optionalRequirements.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Optional Documents</h3>
          
          {optionalRequirements.map((req) => (
            <Card key={req.id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{req.name}</span>
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                      </div>
                      {req.description && (
                        <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                      )}
                    </div>
                  </div>
                  {requirementFiles[req.id] && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Upload Document</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <input
                        type="file"
                        id={`req-${req.id}`}
                        className="hidden"
                        onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                      />
                      <label htmlFor={`req-${req.id}`} className="cursor-pointer">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                        {requirementFiles[req.id] ? (
                          <p className="text-sm text-primary mt-1 truncate">{requirementFiles[req.id]?.name}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">Click to upload</p>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input 
                      type="date"
                      value={requirementExpiry[req.id] || ''}
                      onChange={(e) => handleRequirementExpiryChange(req.id, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Follow-up Date</Label>
                    <Input 
                      type="date"
                      value={requirementFollowUp[req.id] || ''}
                      onChange={(e) => handleRequirementFollowUpChange(req.id, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Additional Documents Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Additional Documents</h3>
        <p className="text-sm text-muted-foreground">Upload any other documents not listed above.</p>
        
        {additionalDocuments.map((doc, index) => (
          <Card key={index} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document Title</Label>
                <Input 
                  value={doc.title} 
                  onChange={(e) => onUpdateDocument(index, { title: e.target.value })}
                  placeholder="e.g., Passport, ID Card"
                />
              </div>
              <div className="space-y-2">
                <Label>File</Label>
                <Input 
                  type="file"
                  onChange={(e) => onUpdateDocument(index, { file: e.target.files?.[0] || null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input 
                  type="date"
                  value={doc.expiryDate} 
                  onChange={(e) => onUpdateDocument(index, { expiryDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input 
                  type="date"
                  value={doc.followUpDate} 
                  onChange={(e) => onUpdateDocument(index, { followUpDate: e.target.value })}
                />
              </div>
            </div>
          </Card>
        ))}
        
        <Button variant="outline" onClick={onAddDocument} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Another Document
        </Button>
      </div>

      {saving && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Uploading documents...</p>
        </div>
      )}
    </div>
  );
});

DocumentUploadStep.displayName = 'DocumentUploadStep';

export default DocumentUploadStep;