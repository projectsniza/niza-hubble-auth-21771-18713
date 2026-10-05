import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, Plus, Lock, AlertCircle, CheckCircle2, Upload, 
  PenTool, Eraser, Eye, Clock, Check, ShieldCheck, RefreshCw, Trash2
} from 'lucide-react';
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

interface ExistingDoc {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  created_at?: string;
  expiry_date?: string | null;
  verified_by_name?: string | null;
  verified_by_signature?: string | null;
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
  const [existingDocs, setExistingDocs] = useState<Record<string, ExistingDoc>>({});
  const [requirementFiles, setRequirementFiles] = useState<Record<string, File | null>>({});
  const [requirementExpiry, setRequirementExpiry] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatusText, setSaveStatusText] = useState('');
  
  // E-signature state per requirement
  const [esignNames, setEsignNames] = useState<Record<string, string>>({});
  const [esignRoles, setEsignRoles] = useState<Record<string, string>>({});
  const [esignHasSignature, setEsignHasSignature] = useState<Record<string, boolean>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [drawingReqId, setDrawingReqId] = useState<string | null>(null);
  const [esignDialogReqId, setEsignDialogReqId] = useState<string | null>(null);

  useEffect(() => {
    loadRequirementsAndExistingDocs();
  }, [employeeId]);

  const loadRequirementsAndExistingDocs = async () => {
    setLoading(true);
    try {
      // 1. Fetch active requirements
      const { data: reqData, error: reqError } = await supabase
        .from('document_requirements')
        .select('*')
        .eq('enabled', true)
        .order('doc_order');

      if (reqError) throw reqError;
      const reqList: DocumentRequirement[] = reqData || [];
      setRequirements(reqList);

      // 2. Fetch existing documents uploaded for this employee
      if (employeeId) {
        const { data: docsData, error: docsError } = await supabase
          .from('documents')
          .select('id, title, file_name, file_path, file_size, created_at, expiry_date, verified_by_name, verified_by_signature')
          .eq('employee_id', employeeId);

        if (!docsError && docsData) {
          const matched: Record<string, ExistingDoc> = {};
          const expiryMap: Record<string, string> = {};

          docsData.forEach((doc: any) => {
            const matchedReq = reqList.find(
              r => r.name.toLowerCase().trim() === (doc.title || '').toLowerCase().trim()
            );
            if (matchedReq) {
              matched[matchedReq.id] = doc;
              if (doc.expiry_date) {
                expiryMap[matchedReq.id] = doc.expiry_date;
              }
            }
          });

          setExistingDocs(matched);
          setRequirementExpiry(prev => ({ ...expiryMap, ...prev }));
        }
      }
    } catch (error) {
      console.error('Error fetching requirements and docs:', error);
      toast.error('Failed to load document requirements');
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

  const handleViewExistingDocument = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error('Could not open document: ' + (err.message || 'File not found'));
    }
  };

  // E-signature canvas helpers
  const initCanvas = (reqId: string, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    if (canvasRefs.current[reqId] === canvas) return;
    canvasRefs.current[reqId] = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0f172a';
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

  // Check if all mandatory requirements are satisfied (either newly selected or already uploaded)
  const hasAllMandatoryDocuments = () => {
    const mandatoryReqs = requirements.filter(r => r.is_mandatory);
    return mandatoryReqs.every(req => {
      const hasNewFile = !!requirementFiles[req.id];
      const hasExisting = !!existingDocs[req.id];
      return hasNewFile || hasExisting;
    });
  };

  const saveDocuments = async (): Promise<boolean> => {
    const filesToUploadCount = Object.values(requirementFiles).filter(f => !!f).length + 
      additionalDocuments.filter(d => !!d.file && !!d.title).length;

    // If nothing new to upload but mandatory docs already exist in DB, we can proceed
    if (filesToUploadCount === 0) {
      if (!hasAllMandatoryDocuments()) {
        toast.error('Please upload all mandatory documents before continuing');
        return false;
      }
      return true;
    }

    setSaving(true);
    setSaveProgress(10);
    setSaveStatusText('Preparing secure document storage...');

    try {
      // Get or create employee folder
      let folderId: string | null = null;
      const { data: existingFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existingFolder) {
        folderId = existingFolder.id;
      }

      let processed = 0;
      const totalToUpload = filesToUploadCount;

      // Upload requirement-based documents
      for (const req of requirements) {
        const file = requirementFiles[req.id];
        if (file) {
          setSaveStatusText(`Uploading ${req.name}...`);
          const fileExt = file.name.split('.').pop() || 'bin';
          const fileName = `${req.name.replace(/[^a-z0-9]/gi, '_')}_${employeeId}_${Date.now()}.${fileExt}`;
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

          const { data: newDocRecord, error: insertError } = await supabase
            .from('documents')
            .insert(insertData)
            .select()
            .single();

          if (insertError) throw insertError;

          // Update local existing state
          if (newDocRecord) {
            setExistingDocs(prev => ({
              ...prev,
              [req.id]: newDocRecord
            }));
          }

          processed++;
          setSaveProgress(Math.round((processed / totalToUpload) * 90));
        }
      }

      // Upload additional documents
      for (const doc of additionalDocuments) {
        if (doc.file && doc.title) {
          setSaveStatusText(`Uploading ${doc.title}...`);
          const fileName = `${doc.title.replace(/[^a-z0-9]/gi, '_')}_${employeeId}_${Date.now()}.${doc.file.name.split('.').pop()}`;
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

          processed++;
          setSaveProgress(Math.round((processed / totalToUpload) * 90));
        }
      }

      // Update onboarding record
      await supabase
        .from('employee_onboarding')
        .update({ documents_uploaded: true })
        .eq('employee_id', employeeId);

      setSaveProgress(100);
      setSaveStatusText('All documents uploaded and verified');
      toast.success('Documents saved successfully');
      
      // Clear staged files
      setRequirementFiles({});
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateString = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="space-y-6 py-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Loading required document checklists...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-900/50 border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">Required Verification Documents</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload all compliance and right-to-work documents before submitting the employment contract for official approval.
            </p>
          </div>
          <Badge variant="outline" className="text-xs bg-background py-1 px-2.5 font-normal">
            Compliance Checklist
          </Badge>
        </div>
      </div>

      {/* Mandatory Documents Section */}
      {mandatoryRequirements.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Mandatory Documents ({mandatoryRequirements.length})</h3>
            </div>
            <span className="text-xs text-muted-foreground">Required for contract generation</span>
          </div>

          <div className="space-y-3">
            {mandatoryRequirements.map((req) => {
              const existing = existingDocs[req.id];
              const stagedFile = requirementFiles[req.id];
              const hasDoc = !!existing || !!stagedFile;
              const isShareCode = req.name.toLowerCase().includes('right to work') || req.name.toLowerCase().includes('share code');

              return (
                <Card 
                  key={req.id} 
                  className={`p-5 transition-all border ${
                    hasDoc 
                      ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10' 
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          hasDoc 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{req.name}</span>
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Required</Badge>
                            {req.requires_esignature && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">E-Signature</Badge>
                            )}
                            {hasDoc && (
                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 hover:bg-emerald-600 text-white">
                                <Check className="h-2.5 w-2.5 mr-1" />
                                {stagedFile ? 'Selected for Upload' : 'Uploaded'}
                              </Badge>
                            )}
                          </div>
                          {req.description && (
                            <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                          )}
                        </div>
                      </div>

                      {hasDoc ? (
                        <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                      )}
                    </div>

                    {/* Staged or Existing File Overview */}
                    {existing && !stagedFile && (
                      <div className="bg-background border rounded-lg p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-foreground truncate">{existing.file_name}</p>
                            <p className="text-muted-foreground text-[11px]">
                              {formatFileSize(existing.file_size)} {existing.created_at ? `• Uploaded ${formatDateString(existing.created_at)}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs gap-1"
                            onClick={() => handleViewExistingDocument(existing.file_path)}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <label htmlFor={`req-${req.id}`} className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                              <span>
                                <RefreshCw className="h-3 w-3" />
                                Replace
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>
                    )}

                    {stagedFile && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Upload className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-primary truncate">{stagedFile.name}</p>
                            <p className="text-muted-foreground text-[11px]">{formatFileSize(stagedFile.size)} • Ready to save</p>
                          </div>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => handleRequirementFileChange(req.id, null)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    )}

                    {/* File Upload Selector (When not staged or replacing) */}
                    {!stagedFile && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            {existing ? 'Replace Document File' : 'Upload Document File *'}
                          </Label>
                          <input
                            type="file"
                            id={`req-${req.id}`}
                            className="hidden"
                            onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                          />
                          <label 
                            htmlFor={`req-${req.id}`} 
                            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3.5 text-center cursor-pointer hover:bg-accent/40 transition-colors"
                          >
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-foreground">
                              {existing ? 'Choose new file to replace' : 'Click to select file'}
                            </span>
                          </label>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Document Expiry Date</Label>
                          <Input 
                            type="date"
                            value={requirementExpiry[req.id] || ''}
                            onChange={(e) => handleRequirementExpiryChange(req.id, e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* E-Signature Button */}
                    {req.requires_esignature && (hasDoc || stagedFile) && (
                      <div className="pt-1 flex items-center justify-between border-t border-dashed mt-3 pt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <PenTool className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {esignHasSignature[req.id] || existing?.verified_by_name 
                              ? `Verified by: ${esignNames[req.id] || existing?.verified_by_name}` 
                              : 'Admin verification required for this document'}
                          </span>
                        </div>
                        <Button 
                          type="button" 
                          variant={esignHasSignature[req.id] || existing?.verified_by_name ? "outline" : "default"} 
                          size="sm" 
                          className="h-7 text-xs gap-1.5" 
                          onClick={() => setEsignDialogReqId(req.id)}
                        >
                          <PenTool className="h-3 w-3" />
                          {esignHasSignature[req.id] || existing?.verified_by_name ? 'Update Verification' : 'Add Verification'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional Documents Section */}
      {optionalRequirements.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-base">Optional Documents ({optionalRequirements.length})</h3>
            </div>
            <span className="text-xs text-muted-foreground">Optional supporting files</span>
          </div>

          <div className="space-y-3">
            {optionalRequirements.map((req) => {
              const existing = existingDocs[req.id];
              const stagedFile = requirementFiles[req.id];
              const hasDoc = !!existing || !!stagedFile;

              return (
                <Card key={req.id} className="p-4 border">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{req.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Optional</Badge>
                      </div>
                      {hasDoc && (
                        <Badge className="text-[10px] bg-emerald-600 text-white">
                          <Check className="h-2.5 w-2.5 mr-1" />
                          Attached
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Upload File</Label>
                        <input
                          type="file"
                          id={`req-${req.id}`}
                          className="hidden"
                          onChange={(e) => handleRequirementFileChange(req.id, e.target.files?.[0] || null)}
                        />
                        <label 
                          htmlFor={`req-${req.id}`} 
                          className="flex items-center justify-between border rounded-lg px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <span className="truncate text-muted-foreground">
                            {stagedFile ? stagedFile.name : existing ? existing.file_name : 'Select file...'}
                          </span>
                          <Upload className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 ml-2" />
                        </label>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Expiry Date</Label>
                        <Input 
                          type="date"
                          value={requirementExpiry[req.id] || ''}
                          onChange={(e) => handleRequirementExpiryChange(req.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Additional Custom Documents */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Additional Supporting Documents</h3>
          <Button variant="outline" size="sm" onClick={onAddDocument} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Custom Document
          </Button>
        </div>

        {additionalDocuments.map((doc, index) => (
          <Card key={index} className="p-4 border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Document Title</Label>
                <Input 
                  value={doc.title} 
                  onChange={(e) => onUpdateDocument(index, { title: e.target.value })}
                  placeholder="e.g., Driver License, Reference Letter"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">File</Label>
                <Input 
                  type="file"
                  onChange={(e) => onUpdateDocument(index, { file: e.target.files?.[0] || null })}
                  className="h-9 text-xs cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date</Label>
                <Input 
                  type="date"
                  value={doc.expiryDate} 
                  onChange={(e) => onUpdateDocument(index, { expiryDate: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Live Upload Progress Feedback */}
      {saving && (
        <Card className="p-5 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{saveStatusText}</span>
            <span className="font-semibold text-primary">{saveProgress}%</span>
          </div>
          <Progress value={saveProgress} className="h-2" />
        </Card>
      )}

      {/* E-Signature Verification Dialog */}
      <Dialog open={!!esignDialogReqId} onOpenChange={(open) => { if (!open) setEsignDialogReqId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <PenTool className="h-4 w-4 text-primary" />
              Admin E-Signature & Verification
            </DialogTitle>
          </DialogHeader>
          {esignDialogReqId && (() => {
            const req = requirements.find(r => r.id === esignDialogReqId);
            if (!req) return null;
            return (
              <div className="space-y-4 pt-1">
                {req.verification_message && (
                  <div className="bg-muted/60 rounded-lg p-3 border text-xs text-muted-foreground leading-relaxed">
                    {req.verification_message}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Verifier Name *</Label>
                    <Input 
                      placeholder="Full Name" 
                      value={esignNames[esignDialogReqId] || ''} 
                      onChange={(e) => setEsignNames(p => ({ ...p, [esignDialogReqId]: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Verifier Role *</Label>
                    <Input 
                      placeholder="e.g., HR Manager" 
                      value={esignRoles[esignDialogReqId] || ''} 
                      onChange={(e) => setEsignRoles(p => ({ ...p, [esignDialogReqId]: e.target.value }))} 
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Signature *</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => clearCanvasSignature(esignDialogReqId)} 
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Eraser className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden bg-white shadow-inner">
                    <canvas 
                      ref={(el) => initCanvas(esignDialogReqId, el)} 
                      width={400} 
                      height={140} 
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={(e) => startDrawingOnCanvas(esignDialogReqId, e)} 
                      onMouseMove={(e) => drawOnCanvas(esignDialogReqId, e)} 
                      onMouseUp={stopDrawing} 
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawingOnCanvas(esignDialogReqId, e)} 
                      onTouchMove={(e) => drawOnCanvas(esignDialogReqId, e)} 
                      onTouchEnd={stopDrawing} 
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Draw signature inside the box using mouse or touch.</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setEsignDialogReqId(null)} className="h-9 text-xs">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (esignDialogReqId && esignNames[esignDialogReqId] && esignRoles[esignDialogReqId] && esignHasSignature[esignDialogReqId]) {
                  toast.success('Verification details attached');
                  setEsignDialogReqId(null);
                } else {
                  toast.error('Please provide verifier name, role, and signature');
                }
              }}
              className="h-9 text-xs"
            >
              Confirm Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

DocumentUploadStep.displayName = 'DocumentUploadStep';

export default DocumentUploadStep;