import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, Send, PenTool, Upload, Type } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/contexts/AuthContext';
import nizaLogo from '@/assets/niza-group-logo.png';

interface ContractTemplateProps {
  employeeId: string;
  employeeData: {
    first_name: string;
    last_name: string;
    address?: string;
    job_title?: string;
    join_date?: string;
    organization_id: string;
    branch_id: string;
  };
  organizations: { id: string; name: string }[];
  onSave: () => void;
  onSubmit: () => void;
  readOnly?: boolean;
  isApprovalMode?: boolean;
  contractApproval?: any;
}

interface ContractData {
  contract_date: string;
  organization_id: string;
  registered_number: string;
  registered_office: string;
  employee_name: string;
  employee_address: string;
  commencement_date: string;
  job_title: string;
  hours_per_week: string;
  salary_rate: string;
  place_of_work: string;
  holiday_days: string;
}

export default function ContractTemplate({
  employeeId,
  employeeData,
  organizations,
  onSave,
  onSubmit,
  readOnly = false,
  isApprovalMode = false,
  contractApproval
}: ContractTemplateProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | 'uploaded'>('typed');
  const [typedSignature, setTypedSignature] = useState('');
  const [signatureDate, setSignatureDate] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [contractData, setContractData] = useState<ContractData>({
    contract_date: '',
    organization_id: employeeData.organization_id,
    registered_number: '',
    registered_office: '',
    employee_name: `${employeeData.first_name} ${employeeData.last_name}`,
    employee_address: employeeData.address || '',
    commencement_date: employeeData.join_date || '',
    job_title: employeeData.job_title || '',
    hours_per_week: '',
    salary_rate: '',
    place_of_work: '',
    holiday_days: '28'
  });

  const selectedOrg = organizations.find(o => o.id === contractData.organization_id);

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    if (contractApproval?.contract_content) {
      setContractData(prev => ({ ...prev, ...(contractApproval.contract_content as unknown as ContractData) }));
    } else {
      const { data } = await supabase
        .from('contract_approvals')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (data?.contract_content) {
        setContractData(prev => ({ ...prev, ...(data.contract_content as unknown as ContractData) }));
      }
    }
  };

  const updateField = (field: keyof ContractData, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('contract_approvals')
        .select('id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('contract_approvals')
          .update({ contract_content: contractData as any })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('contract_approvals')
          .insert({
            employee_id: employeeId,
            submitted_by: user?.id,
            contract_content: contractData as any,
            status: 'draft'
          } as any);
      }

      toast.success('Contract saved');
      onSave();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('contract_approvals')
        .select('id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('contract_approvals')
          .update({ 
            contract_content: contractData as any,
            status: 'pending',
            submitted_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('contract_approvals')
          .insert({
            employee_id: employeeId,
            submitted_by: user?.id,
            contract_content: contractData as any,
            status: 'pending',
            submitted_at: new Date().toISOString()
          } as any);
      }

      // Update employee onboarding status
      await supabase
        .from('employee_onboarding')
        .update({ contract_submitted_for_approval: true })
        .eq('employee_id', employeeId);

      // Update employee status
      await supabase
        .from('employees')
        .update({ status: 'waiting_approval' })
        .eq('id', employeeId);

      toast.success('Contract submitted for approval');
      onSubmit();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveContract = async () => {
    if (!typedSignature || !signatureDate) {
      toast.error('Please provide your signature and date');
      return;
    }

    setLoading(true);
    try {
      let signatureData = typedSignature;
      
      // If drawn signature, get canvas data
      if (signatureType === 'drawn' && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL();
      }

      await supabase
        .from('contract_approvals')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          employer_signature: signatureData,
          employer_signature_type: signatureType,
          employer_signed_date: signatureDate
        })
        .eq('id', contractApproval?.id);

      // Update onboarding status
      await supabase
        .from('employee_onboarding')
        .update({ contract_approved: true })
        .eq('employee_id', employeeId);

      // Update employee status
      await supabase
        .from('employees')
        .update({ status: 'awaiting_signature' })
        .eq('id', employeeId);

      toast.success('Contract approved and signed');
      setShowSignatureDialog(false);
      onSubmit();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
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

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 7;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRACT OF EMPLOYMENT', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${contractData.contract_date || '__________'}`, pageWidth / 2, y, { align: 'center' });
    y += 15;
    
    // PARTIES
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PARTIES', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    doc.text(`1. ${selectedOrg?.name || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`   Registered Number: ${contractData.registered_number || '__________'}`, margin, y);
    y += lineHeight;
    doc.text(`   Registered Office: ${contractData.registered_office || '__________'}`, margin, y, { maxWidth: pageWidth - 2 * margin - 10 });
    y += 12;
    
    doc.text(`2. ${contractData.employee_name || '__________'} (Employee)`, margin, y);
    y += lineHeight;
    doc.text(`   Address: ${contractData.employee_address || '__________'}`, margin, y);
    y += 15;
    
    // THE PARTIES AGREE
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('THE PARTIES AGREE:', margin, y);
    y += 10;
    
    // 1. Appointment
    doc.setFontSize(11);
    doc.text('1. Appointment', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Commencement Date: ${contractData.commencement_date || '__________'}`, margin, y);
    y += 10;
    
    // 2. Duties
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Duties', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Job Title: ${contractData.job_title || '__________'}`, margin, y);
    y += 10;
    
    // 3. Hours
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Hours of Work', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Normal hours per week: ${contractData.hours_per_week || '__________'}`, margin, y);
    y += 10;
    
    // 4. Salary
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Salary', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Salary Rate: £${contractData.salary_rate || '__________'} per hour`, margin, y);
    y += 10;
    
    // 5. Place of Work
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Place of Work', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${contractData.place_of_work || '__________'}`, margin, y, { maxWidth: pageWidth - 2 * margin });
    y += 10;
    
    // 6. Holiday
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Holiday', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Holiday entitlement: ${contractData.holiday_days || '28'} days per year`, margin, y);
    y += 20;
    
    // Signatures
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('AGREED by the parties', margin, y);
    y += 15;
    
    doc.setFontSize(10);
    doc.text('Employee Signature:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text('Signature: ____________________', margin, y);
    y += lineHeight;
    doc.text('Date: ____________________', margin, y);
    y += 15;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Signed on behalf of the Employer:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text('Signature: ____________________', margin, y);
    y += lineHeight;
    doc.text('Date: ____________________', margin, y);
    
    doc.save(`Contract_${contractData.employee_name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 print:shadow-none">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={nizaLogo} alt="Niza Group" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">CONTRACT OF EMPLOYMENT</h1>
          <div className="mt-4">
            <Label>Contract Date</Label>
            <Input
              type="date"
              value={contractData.contract_date}
              onChange={(e) => updateField('contract_date', e.target.value)}
              className="max-w-xs mx-auto mt-2"
              disabled={readOnly}
            />
          </div>
        </div>

        {/* PARTIES */}
        <div className="border-b pb-6 mb-6">
          <h2 className="font-bold text-lg mb-4">PARTIES</h2>
          
          <div className="space-y-4">
            <div>
              <p className="mb-2">1.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization (Employer)</Label>
                  <Select
                    value={contractData.organization_id}
                    onValueChange={(v) => updateField('organization_id', v)}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Registered Number</Label>
                  <Input
                    value={contractData.registered_number}
                    onChange={(e) => updateField('registered_number', e.target.value)}
                    placeholder="e.g., 04914942"
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Registered Office Address</Label>
                <Textarea
                  value={contractData.registered_office}
                  onChange={(e) => updateField('registered_office', e.target.value)}
                  placeholder="e.g., 15 The Gallop, Sutton, Surrey, SM2 5RU"
                  disabled={readOnly}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                a company incorporated in England and Wales (registered number {contractData.registered_number || '________'}) 
                whose registered office is at {contractData.registered_office || '______________________'} (the Employer); and
              </p>
            </div>

            <div>
              <p className="mb-2">2.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee Name</Label>
                  <Input
                    value={contractData.employee_name}
                    onChange={(e) => updateField('employee_name', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee Address</Label>
                  <Input
                    value={contractData.employee_address}
                    onChange={(e) => updateField('employee_address', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">(you).</p>
            </div>
          </div>
        </div>

        {/* THE PARTIES AGREE */}
        <div className="border-b pb-6 mb-6">
          <h2 className="font-bold text-lg mb-4">THE PARTIES AGREE:</h2>

          {/* 1. Appointment */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">1. Appointment</h3>
            <p className="text-sm mb-4">1.1. The Employer will employ you on the terms and conditions set out in this contract.</p>
            <div className="space-y-2">
              <Label>1.2. Commencement Date</Label>
              <Input
                type="date"
                value={contractData.commencement_date}
                onChange={(e) => updateField('commencement_date', e.target.value)}
                className="max-w-xs"
                disabled={readOnly}
              />
            </div>
            <p className="text-sm mt-4 text-muted-foreground">
              1.3. Your period of continuous employment with the Employer commenced on the Commencement Date.
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              1.4. You warrant to the Employer that you have the unconditional right to work in the U.K.
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              1.6. The first 6 months of your employment will be a probationary period.
            </p>
          </div>

          {/* 2. Duties */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">2. Duties</h3>
            <div className="space-y-2">
              <Label>2.1. Job Title</Label>
              <Input
                value={contractData.job_title}
                onChange={(e) => updateField('job_title', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* 3. Hours of Work */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">3. Hours of Work</h3>
            <div className="space-y-2">
              <Label>3.1. Normal hours of work per week</Label>
              <Input
                value={contractData.hours_per_week}
                onChange={(e) => updateField('hours_per_week', e.target.value)}
                placeholder="e.g., 40"
                className="max-w-xs"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* 4. Salary */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">4. Salary</h3>
            <div className="space-y-2">
              <Label>Salary Rate (£ per hour)</Label>
              <Input
                value={contractData.salary_rate}
                onChange={(e) => updateField('salary_rate', e.target.value)}
                placeholder="e.g., 12.50"
                className="max-w-xs"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* 5. Place of Work */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">5. Place of Work</h3>
            <div className="space-y-2">
              <Label>Normal place of work</Label>
              <Textarea
                value={contractData.place_of_work}
                onChange={(e) => updateField('place_of_work', e.target.value)}
                placeholder="Enter work location address"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* 6. Holiday */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">6. Holiday</h3>
            <div className="space-y-2">
              <Label>Holiday entitlement (days per year)</Label>
              <Input
                value={contractData.holiday_days}
                onChange={(e) => updateField('holiday_days', e.target.value)}
                placeholder="e.g., 28"
                className="max-w-xs"
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-8">
          <h2 className="font-bold text-lg mb-4">AGREED by the parties</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Employee Signature */}
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium mb-4">Employee Signature</h3>
              <p className="text-sm text-muted-foreground mb-4">I agree to the above terms</p>
              <div className="border-b-2 border-dashed h-12 mb-2"></div>
              <p className="text-sm">Signature: _______________</p>
              <p className="text-sm mt-2">Date: _______________</p>
            </div>

            {/* Employer Signature */}
            <div className="border p-4 rounded-lg">
              <h3 className="font-medium mb-4">Signed on behalf of the Employer</h3>
              {contractApproval?.employer_signature ? (
                <div>
                  {contractApproval.employer_signature_type === 'drawn' ? (
                    <img src={contractApproval.employer_signature} alt="Signature" className="h-16 mb-2" />
                  ) : (
                    <p className="text-2xl italic font-serif mb-2">{contractApproval.employer_signature}</p>
                  )}
                  <p className="text-sm">Date: {contractApproval.employer_signed_date}</p>
                </div>
              ) : isApprovalMode && user?.role === 'super_admin' ? (
                <Button onClick={() => setShowSignatureDialog(true)} className="gap-2">
                  <PenTool className="h-4 w-4" />
                  Sign Contract
                </Button>
              ) : (
                <div>
                  <div className="border-b-2 border-dashed h-12 mb-2"></div>
                  <p className="text-sm">Signature: _______________</p>
                  <p className="text-sm mt-2">Date: _______________</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!readOnly && !isApprovalMode && (
          <div className="flex justify-between mt-8 print:hidden">
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Download / Print
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={handleSubmitForApproval} disabled={loading} className="gap-2">
                <Send className="h-4 w-4" />
                Submit for Approval
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign Contract</DialogTitle>
          </DialogHeader>
          
          <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="typed" className="gap-2">
                <Type className="h-4 w-4" />
                Type
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

            <TabsContent value="typed" className="space-y-4">
              <div className="space-y-2">
                <Label>Type your name (will appear in cursive)</Label>
                <Input
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="Type your full name"
                  className="text-2xl italic font-serif"
                />
              </div>
              {typedSignature && (
                <div className="border p-4 rounded-lg text-center">
                  <p className="text-3xl italic font-serif">{typedSignature}</p>
                  <p className="text-sm text-muted-foreground mt-2">Signature Preview</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="drawn" className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full bg-white cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              <Button variant="outline" size="sm" onClick={clearCanvas}>
                Clear
              </Button>
            </TabsContent>

            <TabsContent value="uploaded" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="signature-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setTypedSignature(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label htmlFor="signature-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Click to upload signature image</p>
                </label>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={signatureDate}
              onChange={(e) => setSignatureDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveContract} disabled={loading}>
              {loading ? 'Signing...' : 'Approve & Sign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}