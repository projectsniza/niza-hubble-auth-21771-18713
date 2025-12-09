import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, User, FileText, CheckCircle, XCircle, Download, PenTool, Upload, Type, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import nizaLogo from '@/assets/niza-group-logo.png';

interface ContractApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: any;
  onApprove: (signature: string, signatureType: string, signatureDate: string) => void;
  onReject: (reason: string) => void;
}

export default function ContractApprovalDialog({
  open,
  onOpenChange,
  approval,
  onApprove,
  onReject,
}: ContractApprovalDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | 'uploaded'>('typed');
  const [typedSignature, setTypedSignature] = useState('');
  const [signatureDate, setSignatureDate] = useState('');
  const [uploadedSignature, setUploadedSignature] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
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

  const handleApprove = async () => {
    if (!signatureDate) {
      return;
    }
    
    let finalSignature = '';
    if (signatureType === 'typed') {
      if (!typedSignature.trim()) return;
      finalSignature = typedSignature;
    } else if (signatureType === 'drawn') {
      if (!canvasRef.current) return;
      finalSignature = canvasRef.current.toDataURL();
    } else if (signatureType === 'uploaded') {
      if (!uploadedSignature) return;
      finalSignature = uploadedSignature;
    }

    setIsSubmitting(true);
    await onApprove(finalSignature, signatureType, signatureDate);
    setIsSubmitting(false);
    setTypedSignature('');
    setSignatureDate('');
    setUploadedSignature('');
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <img src={nizaLogo} alt="Logo" className="h-10" />
            <DialogTitle>Contract Approval</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Employee Details</TabsTrigger>
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

          <TabsContent value="contract" className="space-y-4 pt-4">
            <div className="border rounded-lg p-6 bg-muted/20">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">CONTRACT OF EMPLOYMENT</h2>
                <p className="text-sm text-muted-foreground">Date: {contractContent?.contract_date || 'Not specified'}</p>
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
                    <li>Commencement Date: {contractContent?.commencement_date || '________'}</li>
                    <li>Hours per Week: {contractContent?.hours_per_week || '________'}</li>
                    <li>Salary Rate: £{contractContent?.salary_rate || '________'} per hour</li>
                    <li>Place of Work: {contractContent?.place_of_work || '________'}</li>
                    <li>Holiday Entitlement: {contractContent?.holiday_days || '28'} days per year</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{approval.contract_file_name || 'Contract Document'}</p>
                  <p className="text-sm text-muted-foreground">
                    Submitted: {new Date(approval.submitted_at).toLocaleDateString()}
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
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
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