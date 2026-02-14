import { useState, useRef } from 'react';
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
import { Building, User, FileText, CheckCircle, XCircle, Download, PenTool, Upload, Type, Calendar, File, AlertCircle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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

  if (!approval) return null;

  const employee = approval.employee;
  if (!employee) return null;

  const contractContent = approval.contract_content as any;

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

      toast.success('Right to Work document uploaded successfully');
      setRtwFile(null);
      setRtwExpiry('');
      
      // Refresh documents in approval
      if (approval.documents) {
        approval.documents.push({
          id: 'temp-' + Date.now(),
          title: 'Right to Work (Verified)',
          file_name: rtwFile.name,
          file_path: filePath,
          verified_by_name: user?.name,
          verified_by_role: user?.role
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload RTW document');
    } finally {
      setIsUploadingRtw(false);
    }
  };

  const handleApprove = async () => {
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Employee Name</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{employee.first_name} {employee.last_name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{employee.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Job Title</Label>
                <p className="font-medium">{contractContent?.job_title || employee.job_title || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Department</Label>
                <p className="font-medium">{employee.department || 'Not specified'}</p>
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
                <p className="font-medium">{contractContent?.commencement_date || employee.join_date || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Hours Per Week</Label>
                <p className="font-medium">{contractContent?.hours_per_week || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Salary Rate</Label>
                <p className="font-medium">{contractContent?.salary_rate ? `£${contractContent.salary_rate}/hour` : 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Place of Work</Label>
                <p className="font-medium">{contractContent?.place_of_work || 'Not specified'}</p>
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
            <Card className="p-5 border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-800 dark:text-amber-300">Upload Verified Employee Share Code Document</h4>
                  <p className="text-sm text-amber-700/80 dark:text-amber-400/80">Verify the share code and upload the Right to Work document. This will be saved to the employee's folder.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Select Document</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setRtwFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date (if applicable)</Label>
                  <Input
                    type="date"
                    value={rtwExpiry}
                    onChange={(e) => setRtwExpiry(e.target.value)}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button
                    onClick={handleUploadRtwDocument}
                    disabled={!rtwFile || isUploadingRtw}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isUploadingRtw ? 'Uploading...' : 'Upload RTW'}
                  </Button>
                </div>
              </div>
              {rtwFile && (
                <p className="text-sm text-primary mt-2">Selected: {rtwFile.name}</p>
              )}
            </Card>

            {approval.documents?.length === 0 ? (
              <Card className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
                <p className="text-muted-foreground">
                  No documents have been uploaded for this employee yet. 
                  You can upload the Right to Work document above before approving.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {approval.documents?.map((doc: any) => (
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
                            window.open(data.signedUrl, '_blank');
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
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

                {/* Signatures section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-3">AGREED by the parties</h3>
                  <div className="space-y-2">
                    <p>Employee: <strong>{contractContent?.employee_name || `${employee.first_name} ${employee.last_name}`}</strong></p>
                    {approval.employer_signature && (
                      <div>
                        <p className="text-sm text-muted-foreground">Signed on behalf of the Employer:</p>
                        {approval.employer_signature_type === 'drawn' ? (
                          <img src={approval.employer_signature} alt="Employer signature" className="h-10" />
                        ) : (
                          <p className="text-lg font-bold italic font-serif">{approval.employer_signature}</p>
                        )}
                        <p className="text-sm">Date: {(() => {
                          const d = approval.employer_signed_date;
                          if (!d) return '';
                          const dt = new Date(d);
                          if (isNaN(dt.getTime())) return d;
                          return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
                        })()}</p>
                      </div>
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
              <Button variant="outline" onClick={handleDownloadContract} disabled={!approval.contract_file_path}>
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
  );
}
