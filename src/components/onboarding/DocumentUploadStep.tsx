import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { File, Plus, Lock, AlertCircle, CheckCircle, Upload, PenTool, Eraser } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // E-signature state per requirement
  const [esignNames, setEsignNames] = useState<Record<string, string>>({});
  const [esignRoles, setEsignRoles] = useState<Record<string, string>>({});
  const [esignHasSignature, setEsignHasSignature] = useState<Record<string, boolean>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [drawingReqId, setDrawingReqId] = useState<string | null>(null);
  const [esignDialogReqId, setEsignDialogReqId] = useState<string | null>(null);

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

  // E-signature canvas helpers
  const initCanvas = (reqId: string, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    // Only initialize if not already set (prevents wiping on re-render)
    if (canvasRefs.current[reqId] === canvas) return;
    canvasRefs.current[reqId] = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  };

  const getCanvasCoords = (reqId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRefs.current[reqId];
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawingOnCanvas = (reqId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setDrawingReqId(reqId);
    const canvas = canvasRefs.current[reqId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(reqId, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawOnCanvas = (reqId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (drawingReqId !== reqId) return;
    const canvas = canvasRefs.current[reqId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(reqId, e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setEsignHasSignature(prev => ({ ...prev, [reqId]: true }));
  };

  const stopDrawing = () => setDrawingReqId(null);

  const clearCanvasSignature = (reqId: string) => {
    const canvas = canvasRefs.current[reqId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEsignHasSignature(prev => ({ ...prev, [reqId]: false }));
  };

  const getCanvasDataUrl = (reqId: string): string | null => {
    if (!esignHasSignature[reqId] || !canvasRefs.current[reqId]) return null;
    return canvasRefs.current[reqId]!.toDataURL('image/png');
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
          const fileExt = file.name.split('.').pop() || 'bin';
          const fileName = `${req.name}_${employeeId}_${Date.now()}.${fileExt}`;
          const filePath = `employees/${employeeId}/documents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const insertData: any = {
            title: req.name,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            employee_id: employeeId,
            folder_id: folderId,
            expiry_date: requirementExpiry[req.id] || null,
            uploaded_by: user?.id
          };

          // Add e-signature data if required
          if (req.requires_esignature) {
            insertData.verified_by_name = esignNames[req.id] || null;
            insertData.verified_by_role = esignRoles[req.id] || null;
            insertData.verified_by_signature = getCanvasDataUrl(req.id);
            insertData.verified_at = new Date().toISOString();
            insertData.verification_message = req.verification_message || null;
          }

          await supabase.from('documents').insert(insertData);
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
            <h3 className="font-semibold text-lg">Required Documents</h3>
          </div>
          
          {mandatoryRequirements.map((req) => {
            const isShareCode = req.name.toLowerCase().includes('right to work') || req.name.toLowerCase().includes('share code');
            const displayName = isShareCode ? 'Employee Share Code' : req.name;
            const displayDescription = isShareCode ? 'Provide your Employee Share Code for right to work verification' : req.description;
            
            if (isShareCode) {
              return (
                <Card key={req.id} className="p-5 border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 shadow-md">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-800 dark:text-amber-300">{displayName}</span>
                            <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Required</Badge>
                            {req.requires_esignature && (
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">E-Sign</Badge>
                            )}
                          </div>
                          <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-1">{displayDescription}</p>
                        </div>
                      </div>
                      {requirementFiles[req.id] && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-amber-800 dark:text-amber-300">Upload Document *</Label>
                        <div className="border-2 border-dashed border-amber-400 rounded-lg p-4 text-center bg-white/60 dark:bg-background/40">
                          <input
                            type="file"
                            id={`req-${req.id}`}
                            className="hidden"
                            onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                          />
                          <label htmlFor={`req-${req.id}`} className="cursor-pointer">
                            <Upload className="h-6 w-6 mx-auto text-amber-500" />
                            {requirementFiles[req.id] ? (
                              <p className="text-sm text-primary mt-1 truncate">{requirementFiles[req.id]?.name}</p>
                            ) : (
                              <p className="text-sm text-amber-600 mt-1">Click to upload</p>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* E-Signature button for share code */}
                    {req.requires_esignature && requirementFiles[req.id] && (
                      <div className="pt-2">
                        <Button type="button" variant={esignHasSignature[req.id] ? "outline" : "default"} size="sm" className="gap-2" onClick={() => setEsignDialogReqId(req.id)}>
                          <PenTool className="h-4 w-4" />
                          {esignHasSignature[req.id] ? 'E-Signature Added ✓' : 'Add E-Signature Verification'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            }

            return (
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    {/* E-Signature button */}
                    {req.requires_esignature && requirementFiles[req.id] && (
                      <div className="pt-2">
                        <Button type="button" variant={esignHasSignature[req.id] ? "outline" : "default"} size="sm" className="gap-2" onClick={() => setEsignDialogReqId(req.id)}>
                          <PenTool className="h-4 w-4" />
                          {esignHasSignature[req.id] ? 'E-Signature Added ✓' : 'Add E-Signature Verification'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
            );
          })}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* E-Signature Verification Dialog */}
      <Dialog open={!!esignDialogReqId} onOpenChange={(open) => { if (!open) setEsignDialogReqId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              E-Signature Verification
            </DialogTitle>
          </DialogHeader>
          {esignDialogReqId && (() => {
            const req = requirements.find(r => r.id === esignDialogReqId);
            if (!req) return null;
            return (
              <div className="space-y-4">
                {req.verification_message && (
                  <div className="bg-muted/50 rounded-lg p-3 border">
                    <p className="text-sm">{req.verification_message}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Your Name *</Label>
                    <Input placeholder="Full name" value={esignNames[esignDialogReqId] || ''} onChange={(e) => setEsignNames(p => ({ ...p, [esignDialogReqId]: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Your Role *</Label>
                    <Input placeholder="e.g., HR Manager" value={esignRoles[esignDialogReqId] || ''} onChange={(e) => setEsignRoles(p => ({ ...p, [esignDialogReqId]: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Signature *</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => clearCanvasSignature(esignDialogReqId)} className="h-6 text-xs"><Eraser className="h-3 w-3 mr-1" />Clear</Button>
                  </div>
                  <div className="border-2 rounded-lg overflow-hidden bg-white">
                    <canvas ref={(el) => initCanvas(esignDialogReqId, el)} width={400} height={150} className="w-full cursor-crosshair touch-none"
                      onMouseDown={(e) => startDrawingOnCanvas(esignDialogReqId, e)} onMouseMove={(e) => drawOnCanvas(esignDialogReqId, e)} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawingOnCanvas(esignDialogReqId, e)} onTouchMove={(e) => drawOnCanvas(esignDialogReqId, e)} onTouchEnd={stopDrawing} />
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEsignDialogReqId(null)}>Cancel</Button>
            <Button onClick={() => {
              if (esignDialogReqId && esignNames[esignDialogReqId] && esignRoles[esignDialogReqId] && esignHasSignature[esignDialogReqId]) {
                toast.success('E-Signature verification added');
                setEsignDialogReqId(null);
              } else {
                toast.error('Please fill in all fields and provide a signature');
              }
            }}>
              Confirm Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

DocumentUploadStep.displayName = 'DocumentUploadStep';

export default DocumentUploadStep;