import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

interface BankDetailsFormProps {
  employeeId: string;
  employeeData: {
    first_name: string;
    last_name: string;
    phone?: string;
  };
  onSave: () => void;
  onNext: () => void;
  readOnly?: boolean;
}

interface FormData {
  your_name: string;
  telephone_number: string;
  bank_name: string;
  bank_address: string;
  bank_telephone: string;
  sort_code: string;
  account_number: string;
  building_society_roll: string;
  account_holder_name: string;
  signature: string;
  signature_date: string;
}

export default function BankDetailsForm({
  employeeId,
  employeeData,
  onSave,
  onNext,
  readOnly = false
}: BankDetailsFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    your_name: `${employeeData.first_name} ${employeeData.last_name}`,
    telephone_number: employeeData.phone || '',
    bank_name: '',
    bank_address: '',
    bank_telephone: '',
    sort_code: '',
    account_number: '',
    building_society_roll: '',
    account_holder_name: '',
    signature: '',
    signature_date: ''
  });

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    const { data } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'bank_details')
      .maybeSingle();

    if (data?.form_data) {
      setFormData(prev => ({ ...prev, ...(data.form_data as unknown as FormData) }));
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('onboarding_form_responses')
        .upsert({
          employee_id: employeeId,
          form_type: 'bank_details',
          form_data: formData as any,
          signature: formData.signature,
          signed_at: formData.signature ? new Date().toISOString() : null
        }, { onConflict: 'employee_id,form_type' });

      if (error) throw error;
      toast.success('Bank details saved');
      onSave();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save bank details';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    let y = 20;
    const lineHeight = 8;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Load and add logo
    const loadLogoImage = (): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('');
        img.src = nizaLogo;
      });
    };

    const logoDataUrl = await loadLogoImage();
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 20, y - 10, 40, 12);
      y += 15;
    }
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE BANK DETAILS FORM', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Please complete the following information carefully.', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setTextColor(200, 100, 0);
    doc.text('Incorrect information will result in a delay in payment.', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 15;
    
    // Form Fields
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('YOUR NAME:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.your_name || '____________________', margin + 50, y);
    y += lineHeight;
    
    doc.setFont('helvetica', 'bold');
    doc.text('YOUR TELEPHONE NUMBER:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.telephone_number || '____________________', margin + 70, y);
    y += lineHeight * 2;
    
    doc.setFont('helvetica', 'bold');
    doc.text('NAME OF BANK OR BUILDING SOCIETY:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.bank_name || '____________________', margin, y);
    y += lineHeight * 2;
    
    doc.setFont('helvetica', 'bold');
    doc.text('BANK OR BUILDING SOCIETY ADDRESS:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(formData.bank_address || '____________________', pageWidth - 2 * margin);
    doc.text(addressLines, margin, y);
    y += addressLines.length * 6 + lineHeight;
    
    doc.setFont('helvetica', 'bold');
    doc.text('TELEPHONE NUMBER OF YOUR BRANCH:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.bank_telephone || '____________________', margin + 85, y);
    y += lineHeight * 2;
    
    doc.setFont('helvetica', 'bold');
    doc.text('BANK SORT CODE:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.sort_code || '__ - __ - __', margin + 50, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('BANK ACCOUNT NUMBER:', margin + 100, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.account_number || '________', margin + 165, y);
    y += lineHeight * 2;
    
    doc.setFont('helvetica', 'bold');
    doc.text('BUILDING SOCIETY ROLL NUMBER (if applicable):', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.building_society_roll || '____________________', margin, y);
    y += lineHeight * 2;
    
    doc.setFont('helvetica', 'bold');
    doc.text('NAME OF ACCOUNT HOLDER:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.account_holder_name || '____________________', margin, y);
    y += lineHeight * 2;
    
    // Declaration
    doc.setFont('helvetica', 'bold');
    doc.text('Declaration', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('I confirm that the bank details provided above are correct and that payments should be made to this account.', margin, y, { maxWidth: pageWidth - 2 * margin });
    y += 15;
    
    doc.setFontSize(11);
    doc.text(`Signature: ${formData.signature || '____________________'}`, margin, y);
    doc.text(`Date: ${formData.signature_date || '____________________'}`, margin + 100, y);
    
    doc.save(`Bank_Details_${formData.your_name.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const formatSortCode = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 6);
    if (numbers.length >= 4) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4)}`;
    } else if (numbers.length >= 2) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    }
    return numbers;
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 print:shadow-none">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={nizaLogo} alt="Niza Group" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary">EMPLOYEE BANK DETAILS FORM</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please complete the following information carefully.
          </p>
          <p className="text-sm text-amber-600 font-medium mt-1">
            Incorrect information will result in a delay in payment.
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-base font-medium">YOUR NAME:</Label>
              <Input
                value={formData.your_name}
                onChange={(e) => updateField('your_name', e.target.value)}
                className="text-lg"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">YOUR TELEPHONE NUMBER:</Label>
              <Input
                value={formData.telephone_number}
                onChange={(e) => updateField('telephone_number', e.target.value)}
                className="text-lg"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">NAME OF BANK OR BUILDING SOCIETY:</Label>
            <Input
              value={formData.bank_name}
              onChange={(e) => updateField('bank_name', e.target.value)}
              placeholder="e.g., Barclays, HSBC, Nationwide"
              className="text-lg"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">BANK OR BUILDING SOCIETY ADDRESS:</Label>
            <Textarea
              value={formData.bank_address}
              onChange={(e) => updateField('bank_address', e.target.value)}
              placeholder="Full branch address"
              rows={3}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">TELEPHONE NUMBER OF YOUR BRANCH:</Label>
            <Input
              value={formData.bank_telephone}
              onChange={(e) => updateField('bank_telephone', e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-base font-medium">BANK SORT CODE:</Label>
              <Input
                value={formData.sort_code}
                onChange={(e) => updateField('sort_code', formatSortCode(e.target.value))}
                placeholder="00-00-00"
                className="text-lg font-mono tracking-wider"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">BANK ACCOUNT NUMBER:</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => updateField('account_number', e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                className="text-lg font-mono tracking-wider"
                maxLength={8}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">BUILDING SOCIETY ROLL NUMBER (if applicable):</Label>
            <Input
              value={formData.building_society_roll}
              onChange={(e) => updateField('building_society_roll', e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">NAME OF ACCOUNT HOLDER:</Label>
            <Input
              value={formData.account_holder_name}
              onChange={(e) => updateField('account_holder_name', e.target.value)}
              placeholder="As it appears on your bank account"
              className="text-lg"
              disabled={readOnly}
            />
          </div>

          {/* Signature */}
          <div className="border-t pt-6 mt-6">
            <h3 className="font-semibold text-lg mb-4">Declaration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              I confirm that the bank details provided above are correct and that payments should be made to this account.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signature (Type your name)</Label>
                <Input
                  value={formData.signature}
                  onChange={(e) => updateField('signature', e.target.value)}
                  placeholder="Type your full name as signature"
                  className="italic"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.signature_date}
                  onChange={(e) => updateField('signature_date', e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex justify-between mt-8 print:hidden">
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Download / Print
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button onClick={() => { handleSave(); onNext(); }} disabled={loading}>
                Save & Continue
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}