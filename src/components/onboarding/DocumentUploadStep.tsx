import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { File, Plus, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DocumentRequirement {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_locked: boolean;
  enabled: boolean;
}

interface AdditionalDocument {
  title: string;
  file: File | null;
  expiryDate: string;
  followUpDate: string;
}

interface DocumentUploadStepProps {
  employeeId?: string;
  additionalDocuments: AdditionalDocument[];
  onUpdateDocument: (index: number, updates: Partial<AdditionalDocument>) => void;
  onAddDocument: () => void;
}

export default function DocumentUploadStep({
  employeeId,
  additionalDocuments,
  onUpdateDocument,
  onAddDocument
}: DocumentUploadStepProps) {
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [requirementFiles, setRequirementFiles] = useState<Record<string, File | null>>({});
  const [requirementExpiry, setRequirementExpiry] = useState<Record<string, string>>({});
  const [requirementFollowUp, setRequirementFollowUp] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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

  const mandatoryRequirements = requirements.filter(r => r.is_mandatory);
  const optionalRequirements = requirements.filter(r => !r.is_mandatory);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Document Upload</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Document Upload</h2>
        <p className="text-muted-foreground">Upload required documents for the employee.</p>
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
                    <Input 
                      type="file"
                      onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                    />
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
                    <Input 
                      type="file"
                      onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                    />
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
    </div>
  );
}