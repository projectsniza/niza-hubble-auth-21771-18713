import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Building, User, FileText, CheckCircle, CheckCircle2, FileCheck, Check, XCircle, Download, PenTool, Upload, Type, Calendar, File, AlertCircle, Plus, Eye, X, Pencil, Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { buildCompleteContractPdf } from '@/lib/onboardingPdfs';
import nizaLogo from '@/assets/niza-group-logo.png';

interface ContractApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: any;
  onApprove: (signature: string, signatureType: string, signatureDate: string, employerName: string) => void;
  onReject: (reason: string) => void;
}

export default function ContractApprovalDialog({
  open,
  onOpenChange,
  approval,
  onApprove,
  onReject,
}: ContractApprovalDialogProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | 'uploaded'>('typed');
  const [typedSignature, setTypedSignature] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [signatureDate, setSignatureDate] = useState('');
  const [uploadedSignature, setUploadedSignature] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // RTW Document upload state
  const [rtwFile, setRtwFile] = useState<File | null>(null);
  const [rtwExpiry, setRtwExpiry] = useState('');
  const [isUploadingRtw, setIsUploadingRtw] = useState(false);
  const [rtwUploadProgress, setRtwUploadProgress] = useState(0);
  const [justUploadedRtw, setJustUploadedRtw] = useState(false);
  const [showReplaceRtw, setShowReplaceRtw] = useState(false);
  
  // Document viewer state
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');

  // Editable contract fields (Super Admin can fix details before approving)
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [empEdits, setEmpEdits] = useState<Record<string, any>>({});
  const [baseOverride, setBaseOverride] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    setEdits({});
    setEmpEdits({});
    setBaseOverride(null);
    setIsEditing(false);
  }, [approval?.id]);

  if (!approval) return null;

  const employee = approval.employee;
  if (!employee) return null;

  const baseContent = baseOverride || (approval.contract_content as any) || {};
  const contractContent = { ...baseContent, ...edits };

  const employeeData = { ...employee, ...empEdits };

  const updateField = (key: string, value: any) =>
    setEdits((p) => ({ ...p, [key]: value }));

  const updateEmpField = (key: string, value: any) =>
    setEmpEdits((p) => ({ ...p, [key]: value }));

  const handleSaveEdits = async () => {
    if (Object.keys(edits).length === 0 && Object.keys(empEdits).length === 0) {
      setIsEditing(false);
      return;
    }
    setIsSavingEdits(true);
    try {
      // Mirror employee-record edits into the contract content so the
      // CONTRACT OF EMPLOYMENT preview / PDF reflects the corrections.
      const emp = { ...employee, ...empEdits };
      const mirrored: Record<string, any> = {};
      if ('first_name' in empEdits || 'last_name' in empEdits) {
        mirrored.employee_name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
      }
      if ('address' in empEdits) mirrored.employee_address = emp.address || '';
      if ('job_title' in empEdits && !('job_title' in edits)) mirrored.job_title = emp.job_title || '';
      if ('join_date' in empEdits && !('commencement_date' in edits)) mirrored.commencement_date = emp.join_date || '';

      const merged = { ...baseContent, ...edits, ...mirrored };
      if (Object.keys(edits).length > 0 || Object.keys(mirrored).length > 0) {
        const { error } = await supabase
          .from('contract_approvals')
          .update({ contract_content: merged })
          .eq('id', approval.id);
        if (error) throw error;
        approval.contract_content = merged;
        setEdits({});
        setBaseOverride(merged);
      }
      if (Object.keys(empEdits).length > 0) {
        const { error: empError } = await supabase
          .from('employees')
          .update(empEdits)
          .eq('id', employee.id);
        if (empError) throw empError;
        Object.assign(approval.employee, empEdits);
      }

      setEdits({});
      setEmpEdits({});
      setIsEditing(false);
      toast.success('Details updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save edits');
    } finally {
      setIsSavingEdits(false);
    }
  };


  const handleDownloadContract = async () => {
    if (approval.contract_file_path) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(approval.contract_file_path, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleUploadRtwDocument = async () => {
    if (!rtwFile || !employee.id) return;
    
    setIsUploadingRtw(true);
    setRtwUploadProgress(15);

    const interval = setInterval(() => {
      setRtwUploadProgress((prev) => {
        if (prev >= 88) return prev;
        return prev + Math.floor(Math.random() * 12) + 6;
      });
    }, 120);

    try {
      // Get or create employee folder
      let folderId: string | null = null;
      const { data: existingFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', employee.id)
        .single();

      if (existingFolder) {
        folderId = existingFolder.id;
      }

      // Upload RTW document
      const fileExt = rtwFile.name.split('.').pop() || 'pdf';
      const fileName = `Right_to_Work_${employee.id}_${Date.now()}.${fileExt}`;
      const filePath = `employees/${employee.id}/documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, rtwFile);

      if (uploadError) throw uploadError;

      // Save document record
      await supabase.from('documents').insert({
        title: 'Right to Work (Verified)',
        file_name: rtwFile.name,
        file_path: filePath,
        file_type: rtwFile.type,
        file_size: rtwFile.size,
        employee_id: employee.id,
        folder_id: folderId,
        expiry_date: rtwExpiry || null,
        uploaded_by: user?.id,
        verified_at: new Date().toISOString(),
        verified_by_name: user?.name || 'Super Admin',
        verified_by_role: user?.role || 'super_admin'
      });

      clearInterval(interval);
      setRtwUploadProgress(100);

      setJustUploadedRtw(true);
      setShowReplaceRtw(false);
      toast.success('Verified Employee Share Code Document uploaded successfully!');
      
      // Refresh documents in approval
      if (!approval.documents) {
        approval.documents = [];
      }
      approval.documents.push({
        id: 'temp-' + Date.now(),
        title: 'Right to Work (Verified)',
        file_name: rtwFile.name,
        file_path: filePath,
        file_type: rtwFile.type,
        file_size: rtwFile.size,
        expiry_date: rtwExpiry || null,
        created_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        verified_by_name: user?.name || 'Super Admin',
        verified_by_role: user?.role || 'super_admin'
      });

      setTimeout(() => {
        setRtwFile(null);
        setRtwExpiry('');
        setRtwUploadProgress(0);
      }, 600);
    } catch (error: any) {
      clearInterval(interval);
      setRtwUploadProgress(0);
      toast.error(error.message || 'Failed to upload RTW document');
    } finally {
      clearInterval(interval);
      setIsUploadingRtw(false);
    }
  };

  const handleApprove = async () => {
    if (isEditing || Object.keys(edits).length > 0 || Object.keys(empEdits).length > 0) {
      toast.error('Please save or cancel your contract edits before approving');
      return;
    }
    if (!signatureDate) {
      toast.error('Please select a signature date');
      return;
    }
    if (!employerName.trim()) {
      toast.error('Please enter your name as employer representative');
      return;
    }
    
    let finalSignature = '';
    if (signatureType === 'typed') {
      if (!typedSignature.trim()) {
        toast.error('Please type your signature');
        return;
      }
      finalSignature = typedSignature;
    } else if (signatureType === 'drawn') {
      if (!canvasRef.current) return;
      finalSignature = canvasRef.current.toDataURL();
    } else if (signatureType === 'uploaded') {
      if (!uploadedSignature) {
        toast.error('Please upload a signature');
        return;
      }
      finalSignature = uploadedSignature;
    }

    setIsSubmitting(true);
    await onApprove(finalSignature, signatureType, signatureDate, employerName.trim());
    setIsSubmitting(false);
    setTypedSignature('');
    setSignatureDate('');
    setUploadedSignature('');
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setIsSubmitting(true);
    await onReject(rejectReason);
    setIsSubmitting(false);
    setRejectReason('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedSignature(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <img src={nizaLogo} alt="Logo" className="h-10" />
            <DialogTitle>Contract Approval</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Employee Details</TabsTrigger>
            <TabsTrigger value="documents" className="relative">
              Documents
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{approval.documents?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="contract">Contract Preview</TabsTrigger>
            <TabsTrigger value="action">Sign / Reject</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Employee & Contract Details</h3>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit details
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEdits({}); setIsEditing(false); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveEdits} disabled={isSavingEdits} className="gap-2">
                    <Save className="h-4 w-4" /> {isSavingEdits ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              )}
            </div>

            {isEditing && (
              <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2">
                You can correct the details submitted by the store. Employee fields update the employee record; contract fields update the contract used for signing & download. Organization and branch are not editable here.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">First Name</Label>
                {isEditing ? (
                  <Input value={employeeData.first_name ?? ''} onChange={(e) => updateEmpField('first_name', e.target.value)} />
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">{employeeData.first_name}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Last Name</Label>
                {isEditing ? (
                  <Input value={employeeData.last_name ?? ''} onChange={(e) => updateEmpField('last_name', e.target.value)} />
                ) : (
                  <p className="font-medium">{employeeData.last_name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{employeeData.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Phone</Label>
                {isEditing ? (
                  <Input value={employeeData.phone ?? ''} onChange={(e) => updateEmpField('phone', e.target.value)} />
                ) : (
                  <p className="font-medium">{employeeData.phone || 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Date of Birth</Label>
                {isEditing ? (
                  <Input type="date" value={employeeData.date_of_birth ?? ''} onChange={(e) => updateEmpField('date_of_birth', e.target.value)} />
                ) : (
                  <p className="font-medium">{employeeData.date_of_birth || 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Address</Label>
                {isEditing ? (
                  <Input value={employeeData.address ?? ''} onChange={(e) => updateEmpField('address', e.target.value)} />
                ) : (
                  <p className="font-medium">{employeeData.address || 'Not specified'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Job Title</Label>
                {isEditing ? (
                  <Input
                    value={contractContent?.job_title ?? employeeData.job_title ?? ''}
                    onChange={(e) => { updateField('job_title', e.target.value); updateEmpField('job_title', e.target.value); }}
                  />
                ) : (
                  <p className="font-medium">{contractContent?.job_title || employeeData.job_title || 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Department</Label>
                {isEditing ? (
                  <Input value={employeeData.department ?? ''} onChange={(e) => updateEmpField('department', e.target.value)} />
                ) : (
                  <p className="font-medium">{employeeData.department || 'Not specified'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Organization</Label>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  <span className="font-medium">{employee.organization?.name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Branch</Label>
                <p className="font-medium">{employee.branch?.name}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Commencement Date</Label>
                {isEditing ? (
                  <Input type="date" value={contractContent?.commencement_date ?? ''} onChange={(e) => updateField('commencement_date', e.target.value)} />
                ) : (
                  <p className="font-medium">{contractContent?.commencement_date || employee.join_date || 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Hours Per Week</Label>
                {isEditing ? (
                  <Input type="text" value={contractContent?.hours_per_week ?? ''} onChange={(e) => updateField('hours_per_week', e.target.value)} placeholder="e.g. 40 or Zero" />
                ) : (
                  <p className="font-medium">{contractContent?.hours_per_week || 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Salary Rate</Label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input type="text" placeholder="e.g. 12.50 or Basic per hour" value={contractContent?.salary_rate ?? ''} onChange={(e) => updateField('salary_rate', e.target.value)} />
                    <select
                      className="border rounded-md px-2 text-sm bg-background"
                      value={contractContent?.salary_type || 'hourly'}
                      onChange={(e) => updateField('salary_type', e.target.value)}
                    >
                      <option value="hourly">/hour</option>
                      <option value="annual">/annum</option>
                    </select>
                  </div>
                ) : (
                  <p className="font-medium">{contractContent?.salary_rate ? `£${contractContent.salary_rate}/${contractContent?.salary_type === 'annual' ? 'annum' : 'hour'}` : 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Place of Work</Label>
                {isEditing ? (
                  <Input value={contractContent?.place_of_work ?? ''} onChange={(e) => updateField('place_of_work', e.target.value)} />
                ) : (
                  <p className="font-medium">{contractContent?.place_of_work || 'Not specified'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Holiday Entitlement (days/year)</Label>
                {isEditing ? (
                  <Input type="text" value={contractContent?.holiday_days ?? ''} onChange={(e) => updateField('holiday_days', e.target.value)} placeholder="e.g. 28 or Pro rata" />
                ) : (
                  <p className="font-medium">{contractContent?.holiday_days || '28'} days</p>
                )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-muted-foreground">Contract Date</Label>
                {isEditing ? (
                  <Input type="date" value={contractContent?.contract_date ?? ''} onChange={(e) => updateField('contract_date', e.target.value)} />
                ) : (
                  <p className="font-medium">{contractContent?.contract_date || 'Not specified'}</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Employee Documents</h3>
              {approval.documents?.length > 0 ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {approval.documents.length} document(s) uploaded
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No documents uploaded
                </Badge>
              )}
            </div>

            {/* Employee Share Code section - shown on top */}
            {(() => {
              const contractContent = approval.contract_content as any;
              const shareCode = contractContent?.share_code;
              const govLink = contractContent?.gov_portal_link;
              if (shareCode || govLink) {
                return (
                  <Card className="p-5 border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 shadow-md mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      </div>
                      <h4 className="font-bold text-amber-800 dark:text-amber-300 text-lg">Employee Share Code</h4>
                    </div>
                    {shareCode && <p className="text-sm font-medium"><strong className="text-amber-700">Share Code:</strong> <span className="font-mono text-base bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">{shareCode}</span></p>}
                    {govLink && (
                      <p className="text-sm mt-2">
                        <strong className="text-amber-700">Gov Portal:</strong>{' '}
                        <a href={govLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">{govLink}</a>
                      </p>
                    )}
                  </Card>
                );
              }
              return null;
            })()}

            {/* RTW Upload Section for Super Admin - Unique Share Code Design */}
            {(() => {
              const verifiedRtwDoc = (approval.documents || []).find((doc: any) => 
                doc.verified_at || 
                doc.title?.toLowerCase().includes('right to work (verified)') ||
                (doc.title?.toLowerCase().includes('right to work') && doc.title?.toLowerCase().includes('verified'))
              );
              const isRtwUploaded = justUploadedRtw || !!verifiedRtwDoc;

              return (
                <Card className={cn(
                  "p-5 border-2 shadow-sm rounded-xl transition-all",
                  isRtwUploaded 
                    ? "border-emerald-500 bg-gradient-to-br from-emerald-50/90 to-green-50/70 dark:from-emerald-950/40 dark:to-green-950/30"
                    : "border-amber-500/50 bg-gradient-to-br from-amber-50/70 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20"
                )}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                        isRtwUploaded 
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      )}>
                        {isRtwUploaded ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn(
                            "font-bold text-base",
                            isRtwUploaded ? "text-emerald-950 dark:text-emerald-100" : "text-amber-900 dark:text-amber-200"
                          )}>
                            Upload Verified Employee Share Code Document
                          </h4>
                          {isRtwUploaded && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs font-semibold shadow-xs">
                              <Check className="h-3 w-3" /> Uploaded & Verified
                            </Badge>
                          )}
                        </div>
                        <p className={cn(
                          "text-xs mt-0.5",
                          isRtwUploaded ? "text-emerald-800/90 dark:text-emerald-300/90" : "text-amber-700/90 dark:text-amber-400/80"
                        )}>
                          {isRtwUploaded 
                            ? "Verified employee share code document has been successfully uploaded and saved to the employee's folder."
                            : "Verify the share code and upload the Right to Work document. This will be saved to the employee's folder."}
                        </p>
                      </div>
                    </div>
                    {isRtwUploaded && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowReplaceRtw(!showReplaceRtw)}
                        className={cn(
                          "text-xs gap-1 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
                          showReplaceRtw && "bg-emerald-100 text-emerald-900"
                        )}
                      >
                        {showReplaceRtw ? (
                          <>
                            <X className="h-3.5 w-3.5" /> Cancel
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" /> Replace Document
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {isRtwUploaded && !showReplaceRtw ? (
                    <div className="mt-3 p-3.5 rounded-lg bg-white/90 dark:bg-card/90 border border-emerald-200 dark:border-emerald-800/70 shadow-xs flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {verifiedRtwDoc?.file_name || 'Right_to_Work_Verified.pdf'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Status: Uploaded & Verified</span>
                            {verifiedRtwDoc?.expiry_date && (
                              <span>• Expires: {format(new Date(verifiedRtwDoc.expiry_date), 'dd MMM yyyy')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {verifiedRtwDoc && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument(verifiedRtwDoc)}
                          className="text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Document
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {showReplaceRtw && isRtwUploaded && (
                        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-3">
                          Select a new file below to replace the existing verified Right to Work document:
                        </p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Select Document</Label>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={isUploadingRtw}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setRtwFile(file);
                              setRtwUploadProgress(0);
                            }}
                            className="bg-background text-xs cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Expiry Date (if applicable)</Label>
                          <Input
                            type="date"
                            disabled={isUploadingRtw}
                            value={rtwExpiry}
                            onChange={(e) => setRtwExpiry(e.target.value)}
                            className="bg-background text-xs"
                          />
                        </div>
                        <div className="space-y-1.5 flex items-end">
                          <Button
                            onClick={handleUploadRtwDocument}
                            disabled={!rtwFile || isUploadingRtw}
                            className={cn(
                              "w-full gap-2 font-medium shadow-sm transition-all text-white",
                              isRtwUploaded
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            )}
                          >
                            {isUploadingRtw ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span>Uploading ({rtwUploadProgress}%)</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                <span>{isRtwUploaded ? "Upload New Document" : "Upload RTW"}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {rtwFile && (
                        <div className={cn(
                          "mt-3 p-3 rounded-lg bg-background/80 border flex flex-col gap-2",
                          isRtwUploaded ? "border-emerald-200/70" : "border-amber-200/60"
                        )}>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className={cn("h-4 w-4 flex-shrink-0", isRtwUploaded ? "text-emerald-600" : "text-amber-600")} />
                              <span className="font-medium truncate text-foreground">{rtwFile.name}</span>
                              <span className="text-muted-foreground flex-shrink-0 text-[11px]">({(rtwFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                            </div>
                            {isUploadingRtw && (
                              <span className={cn("font-semibold flex-shrink-0", isRtwUploaded ? "text-emerald-700" : "text-amber-700")}>
                                {rtwUploadProgress}%
                              </span>
                            )}
                          </div>
                          {isUploadingRtw && (
                            <Progress value={rtwUploadProgress} className={cn(
                              "h-2 w-full",
                              isRtwUploaded ? "bg-emerald-100 [&>div]:bg-emerald-600" : "bg-amber-100 [&>div]:bg-amber-600"
                            )} />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </Card>
              );
            })()}

            {/* Share Code / RTW documents shown separately at top */}
            {(() => {
              const shareCodeDocs = (approval.documents || []).filter((doc: any) => 
                doc.title?.toLowerCase().includes('right to work') || 
                doc.title?.toLowerCase().includes('share code') ||
                doc.title?.toLowerCase().includes('rtw')
              );
              const otherDocs = (approval.documents || []).filter((doc: any) => 
                !doc.title?.toLowerCase().includes('right to work') && 
                !doc.title?.toLowerCase().includes('share code') &&
                !doc.title?.toLowerCase().includes('rtw')
              );

              return (
                <>
                  {shareCodeDocs.length > 0 && (
                    <Card className="p-4 border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <h4 className="font-bold text-amber-800 dark:text-amber-300">Employee Share Code Documents</h4>
                        <Badge className="bg-amber-500 ml-auto">{shareCodeDocs.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {shareCodeDocs.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-white/60 dark:bg-background/40 border border-amber-200">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                <File className="h-4 w-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Employee Share Code</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{doc.file_name}</span>
                                  {doc.expiry_date && (
                                    <>
                                      <span>•</span>
                                      <span>Expires: {(() => {
                                        const dt = new Date(doc.expiry_date);
                                        if (isNaN(dt.getTime())) return doc.expiry_date;
                                        return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                                      })()}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from('documents')
                                  .createSignedUrl(doc.file_path, 3600);
                                if (data?.signedUrl) {
                                  setViewerUrl(data.signedUrl);
                                  setViewerTitle(doc.title || doc.file_name || 'Document');
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                      {shareCodeDocs.some((d: any) => d.verified_by_name) && (
                        <div className="mt-3 pt-2 border-t border-amber-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">Verified</span>
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {otherDocs.length === 0 && shareCodeDocs.length === 0 ? (
                    <Card className="p-8 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
                      <p className="text-muted-foreground">
                        No documents have been uploaded for this employee yet. 
                        You can upload the Right to Work document above before approving.
                      </p>
                    </Card>
                  ) : otherDocs.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground">Other Documents</h4>
                      {otherDocs.map((doc: any) => (
                        <Card key={doc.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <File className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{doc.title}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{doc.file_name}</span>
                                  {doc.expiry_date && (
                                    <>
                                      <span>•</span>
                                      <span>Expires: {(() => {
                                        const dt = new Date(doc.expiry_date);
                                        if (isNaN(dt.getTime())) return doc.expiry_date;
                                        return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                                      })()}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from('documents')
                                  .createSignedUrl(doc.file_path, 3600);
                                if (data?.signedUrl) {
                                  setViewerUrl(data.signedUrl);
                                  setViewerTitle(doc.title || doc.file_name || 'Document');
                                }
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                          {doc.verified_by_name && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-600">
                                  Verified by {doc.verified_by_name} ({doc.verified_by_role})
                                </span>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="contract" className="space-y-4 pt-4">
            <div className="border rounded-lg p-6 bg-muted/20 max-h-[60vh] overflow-y-auto">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">CONTRACT OF EMPLOYMENT</h2>
                <p className="text-sm text-muted-foreground">Date: {(() => {
                  const d = contractContent?.contract_date;
                  if (!d) return 'Not specified';
                  const parts = d.split('-');
                  const dt = parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) : new Date(d);
                  if (isNaN(dt.getTime())) return d;
                  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} - ${days[dt.getDay()]}`;
                })()}</p>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold">PARTIES</h3>
                  <p>1. <strong>{employee.organization?.name}</strong> (registered number {contractContent?.registered_number || '________'}) whose registered office is at {contractContent?.registered_office || '________'} (the Employer)</p>
                  <p className="mt-2">2. <strong>{contractContent?.employee_name || `${employee.first_name} ${employee.last_name}`}</strong> of {contractContent?.employee_address || employee.address || '________'} (the Employee)</p>
                </div>

                <div>
                  <h3 className="font-semibold">KEY TERMS</h3>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Job Title: {contractContent?.job_title || '________'}</li>
                    <li>Commencement Date: {(() => {
                      const d = contractContent?.commencement_date;
                      if (!d) return '________';
                      const dt = new Date(d);
                      if (isNaN(dt.getTime())) return d;
                      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                    })()}</li>
                    <li>Hours per Week: {contractContent?.hours_per_week || '________'}</li>
                    <li>Salary Rate: £{contractContent?.salary_rate || '________'} per hour</li>
                    <li>Place of Work: {contractContent?.place_of_work || '________'}</li>
                    <li>Holiday Entitlement: {contractContent?.holiday_days || '28'} days per year</li>
                  </ul>
                </div>

                {/* Full contract sections */}
                <div><h3 className="font-semibold">1. Appointment</h3>
                  <p className="mb-1">1.1. The Employer will employ you on the terms and conditions set out in this contract.</p>
                  <p className="mb-1">1.2. Your employment will commence on {(() => { const d = contractContent?.commencement_date; if (!d) return '________'; const dt = new Date(d); if (isNaN(dt.getTime())) return d; return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; })()}.</p>
                  <p className="mb-1">1.3-1.6. Standard appointment terms including probationary period of 6 months.</p>
                </div>
                <div><h3 className="font-semibold">2. Duties</h3><p>Employed as {contractContent?.job_title || '________'} with standard duty terms.</p></div>
                <div><h3 className="font-semibold">3. Hours of work</h3><p>{contractContent?.hours_per_week || '________'} hours per week with standard break entitlements.</p></div>
                <div><h3 className="font-semibold">4. Salary</h3><p>£{contractContent?.salary_rate || '________'} per {contractContent?.salary_type === 'annual' ? 'annum' : 'hour'}, subject to standard deductions.</p></div>
                <div><h3 className="font-semibold">5. Place of work and mobility</h3><p>Normal place of work: {contractContent?.place_of_work || '________'}</p></div>
                <div><h3 className="font-semibold">6. Holiday</h3><p>{contractContent?.holiday_days || '28'} days per year (April-March), standard holiday terms.</p></div>
                <div><h3 className="font-semibold">7-19.</h3><p>Standard clauses covering sickness, disciplinary, grievance, pension, termination, data protection, policies, and entire agreement.</p></div>

                {/* Signatures section - matching reference PDF layout */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-6">AGREED by the parties</h3>
                  
                  {/* Employee signature */}
                  <div className="mb-8">
                    {contractContent?.employee_signature_data && contractContent.employee_signature_data.startsWith('data:image') && (
                      <img src={contractContent.employee_signature_data} alt="Employee signature" className="h-16 mb-1" />
                    )}
                    <p className="text-muted-foreground border-b border-dotted pb-1 mb-1">______________________________</p>
                    <p className="text-xs text-muted-foreground mb-3">(Employee Signature)</p>
                    <p className="mb-3">I agree to the above terms</p>
                    <p className="mb-1">Signed: <strong>{contractContent?.employee_name?.toUpperCase() || `${employee.first_name} ${employee.last_name}`.toUpperCase()}</strong></p>
                    <p>Date: {(() => {
                      const d = contractContent?.employee_signed_date;
                      if (!d) return '';
                      const dt = new Date(d);
                      if (isNaN(dt.getTime())) return d;
                      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                    })()}</p>
                  </div>

                  {/* Employer signature */}
                  <div>
                    {approval.employer_signature && (
                      <>
                        {/* 1. Signature above line */}
                        {approval.employer_signature_type === 'drawn' ? (
                          <img src={approval.employer_signature} alt="Employer signature" className="h-16 mb-1" />
                        ) : (
                          <p className="text-2xl font-bold italic font-serif mb-1">{approval.employer_signature}</p>
                        )}
                        <p className="text-muted-foreground border-b border-dotted pb-1 mb-1">______________________________</p>
                        <p className="text-xs text-muted-foreground mb-3">(Authorized Signature)</p>
                        {/* 2. Signed on behalf of the Employer */}
                        <p className="mb-3">Signed on behalf of the Employer</p>
                        {/* 3. Admin name */}
                        <p className="mb-1"><strong>{((approval.contract_content as any)?.employer_name || '').toUpperCase()}</strong></p>
                        {/* 4. Date */}
                        <p>Date: {(() => {
                          const d = approval.employer_signed_date;
                          if (!d) return '';
                          const dt = new Date(d);
                          if (isNaN(dt.getTime())) return d;
                          return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                        })()}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{approval.contract_file_name || 'Contract Document'}</p>
                  <p className="text-sm text-muted-foreground">
                    Submitted: {(() => {
                      const d = approval.submitted_at;
                      if (!d) return '';
                      const dt = new Date(d);
                      if (isNaN(dt.getTime())) return d;
                      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                    })()}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={async () => {
                toast.info('Generating complete contract PDF...');
                try {
                  const doc = await buildCompleteContractPdf({
                    contractData: contractContent || {},
                    employeeData: employeeData || {},
                    organizationData: employee.organization || {},
                    branchData: employee.branch || {},
                    approvalData: approval || {},
                  });
                  const empName = `${employeeData.first_name || ''}_${employeeData.last_name || ''}`.trim().replace(/\s+/g, '_') || 'Employee';
                  doc.save(`Contract_${empName}.pdf`);
                  toast.success('Complete contract PDF downloaded');
                } catch (err) {
                  console.error('Failed to generate contract PDF:', err);
                  toast.error('Failed to generate PDF');
                }
              }}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="action" className="space-y-6 pt-4">
            {/* Approve Section - Signature */}
            <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Signed on behalf of the Employer</h3>
              </div>

              <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="typed" className="gap-2">
                    <Type className="h-4 w-4" />
                    Type Name
                  </TabsTrigger>
                  <TabsTrigger value="drawn" className="gap-2">
                    <PenTool className="h-4 w-4" />
                    Draw
                  </TabsTrigger>
                  <TabsTrigger value="uploaded" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="typed" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Type your name (appears in cursive)</Label>
                    <Input
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      placeholder="Type your full name"
                      className="text-2xl italic font-serif"
                    />
                  </div>
                  {typedSignature && (
                    <div className="border p-4 rounded-lg text-center bg-white">
                      <p className="text-3xl italic font-serif text-black">{typedSignature}</p>
                      <p className="text-sm text-muted-foreground mt-2">Signature Preview</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="drawn" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Draw your signature below</Label>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={150}
                        className="w-full cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={clearCanvas}>
                      Clear
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="uploaded" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="signature-upload-dialog"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="signature-upload-dialog" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Click to upload signature image</p>
                    </label>
                    {uploadedSignature && (
                      <div className="mt-4">
                        <img src={uploadedSignature} alt="Uploaded signature" className="max-h-20 mx-auto" />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label>Your Name (Employer Representative) <span className="text-destructive">*</span></Label>
                <Input
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  placeholder="Type your full name"
                  className="font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={signatureDate}
                  onChange={(e) => setSignatureDate(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleApprove} 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={
                  isSubmitting || 
                  !signatureDate || 
                  (signatureType === 'typed' && !typedSignature.trim()) ||
                  (signatureType === 'uploaded' && !uploadedSignature)
                }
              >
                {isSubmitting ? 'Approving...' : 'Approve & Sign Contract'}
              </Button>
            </div>

            {/* Reject Section */}
            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <h3 className="font-semibold">Reject Contract</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Rejection Reason</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Explain why the contract is being rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                variant="destructive" 
                onClick={handleReject}
                className="w-full"
                disabled={!rejectReason.trim() || isSubmitting}
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Contract'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewerUrl} onOpenChange={() => setViewerUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <DialogTitle>{viewerTitle}</DialogTitle>
          </DialogHeader>
          <div className="w-full h-[75vh] px-4 pb-4">
            {viewerUrl && (
              viewerUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                <img src={viewerUrl} alt={viewerTitle} className="w-full h-full object-contain" />
              ) : (
                <iframe src={viewerUrl} className="w-full h-full rounded border" title={viewerTitle} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
