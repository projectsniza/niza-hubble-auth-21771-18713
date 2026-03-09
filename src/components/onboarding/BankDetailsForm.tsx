import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Save, ArrowLeft, AlertCircle } from 'lucide-react';
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
    address?: string;
  };
  onSave: () => void;
  onNext: () => void;
  onBack?: () => void;
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
  declaration_agreed: boolean;
  signature: string;
  signature_date: string;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function BankDetailsForm({
  employeeId,
  employeeData,
  onSave,
  onNext,
  onBack,
  readOnly = false
}: BankDetailsFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<FormData>({
    your_name: `${employeeData.first_name} ${employeeData.last_name}`,
    telephone_number: employeeData.phone || '',
    bank_name: '',
    bank_address: '',
    bank_telephone: '',
    sort_code: '',
    account_number: '',
    building_society_roll: '',
    account_holder_name: `${employeeData.first_name} ${employeeData.last_name}`,
    signature: '',
    signature_date: ''
  });

  useEffect(() => {
    loadSavedData();
  }, [employeeId]);

  const loadSavedData = async () => {
    const { data: bankData } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'bank_details')
      .maybeSingle();

    if (bankData?.form_data) {
      setFormData(prev => ({ ...prev, ...(bankData.form_data as unknown as FormData) }));
      return;
    }

    const { data: applicationData } = await supabase
      .from('onboarding_form_responses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('form_type', 'application_form')
      .maybeSingle();

    if (applicationData?.form_data) {
      const appForm = applicationData.form_data as any;
      setFormData(prev => ({
        ...prev,
        telephone_number: prev.telephone_number || appForm.phone || '',
      }));
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Mandatory fields
    if (!formData.your_name.trim()) {
      newErrors.your_name = 'Your name is required';
    }
    if (!formData.telephone_number.trim()) {
      newErrors.telephone_number = 'Telephone number is required';
    } else if (!/^[\d\s\-+()]+$/.test(formData.telephone_number)) {
      newErrors.telephone_number = 'Invalid phone number format';
    }
    if (!formData.bank_name.trim()) {
      newErrors.bank_name = 'Bank name is required';
    }
    if (!formData.bank_address.trim()) {
      newErrors.bank_address = 'Bank address is required';
    }
    if (!formData.sort_code.trim()) {
      newErrors.sort_code = 'Sort code is required';
    } else if (!/^\d{2}-\d{2}-\d{2}$/.test(formData.sort_code)) {
      newErrors.sort_code = 'Sort code must be in format XX-XX-XX';
    }
    if (!formData.account_number.trim()) {
      newErrors.account_number = 'Account number is required';
    } else if (!/^\d{8}$/.test(formData.account_number)) {
      newErrors.account_number = 'Account number must be 8 digits';
    }
    if (!formData.account_holder_name.trim()) {
      newErrors.account_holder_name = 'Account holder name is required';
    }
    // Signature fields are optional - to be signed by employee while uploading

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (): Promise<boolean> => {
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
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save bank details';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields correctly');
      return;
    }
    
    const saved = await handleSave();
    if (saved) {
      onNext();
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    const labelX = margin;
    const valueX = margin + 75; // consistent value column
    const lineHeight = 7;
    let y = 20;
    
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

    // Header - Logo centered
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 20, y - 10, 40, 12);
      y += 12;
    }

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE BANK DETAILS FORM', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Please complete the following information carefully.', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setTextColor(200, 100, 0);
    doc.text('Incorrect information will result in a delay in payment.', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Helper to draw a label-value row
    const addRow = (label: string, value: string, bold = true) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label, labelX, y);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFont('helvetica', 'normal');
      doc.text(value || '____________________', valueX, y);
      y += lineHeight;
    };

    // Form fields - aligned consistently
    addRow('YOUR NAME:', formData.your_name);
    addRow('YOUR TELEPHONE NUMBER:', formData.telephone_number);
    y += 4;

    // Bank name - full width
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NAME OF BANK OR BUILDING SOCIETY:', labelX, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.bank_name || '____________________', labelX, y);
    y += lineHeight + 4;

    // Bank address - multi-line
    doc.setFont('helvetica', 'bold');
    doc.text('BANK OR BUILDING SOCIETY ADDRESS:', labelX, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(formData.bank_address || '____________________', contentWidth);
    doc.text(addressLines, labelX, y);
    y += addressLines.length * 5 + 4;

    // Bank telephone
    addRow('TELEPHONE NUMBER OF BRANCH:', formData.bank_telephone);
    y += 4;

    // Sort code and Account number side by side
    doc.setFont('helvetica', 'bold');
    doc.text('BANK SORT CODE:', labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.sort_code || '__ - __ - __', labelX + 45, y);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNT NUMBER:', labelX + 95, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.account_number || '________', labelX + 140, y);
    y += lineHeight + 2;

    // Building society roll
    addRow('BUILDING SOCIETY ROLL NO:', formData.building_society_roll);
    y += 4;

    // Account holder name
    doc.setFont('helvetica', 'bold');
    doc.text('NAME OF ACCOUNT HOLDER:', labelX, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.account_holder_name || '____________________', labelX, y);
    y += lineHeight + 8;

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Declaration
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Declaration', labelX, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const declText = 'I confirm that the bank details provided above are correct and that payments should be made to this account.';
    const declLines = doc.splitTextToSize(declText, contentWidth);
    doc.text(declLines, labelX, y);
    y += declLines.length * 4 + 6;

    // Format date as DD/MM/YYYY
    const formatDateDisplay = (dateStr: string) => {
      if (!dateStr) return '____________________';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Signature and Date on same line
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature:', labelX, y);
    doc.setFont('helvetica', 'italic');
    doc.text(formData.signature || '____________________', labelX + 25, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', labelX + 105, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateDisplay(formData.signature_date), labelX + 118, y);
    
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

  const RequiredLabel = ({ children, error }: { children: React.ReactNode; error?: string }) => (
    <Label className={`text-base font-medium ${error ? 'text-destructive' : ''}`}>
      {children} <span className="text-destructive">*</span>
    </Label>
  );

  const ErrorMessage = ({ error }: { error?: string }) => {
    if (!error) return null;
    return (
      <p className="text-sm text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    );
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
          <p className="text-sm text-amber-600 mt-2">Fields marked with * are mandatory</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2" data-field="your_name">
              <RequiredLabel error={errors.your_name}>YOUR NAME:</RequiredLabel>
              <Input
                value={formData.your_name}
                onChange={(e) => updateField('your_name', e.target.value)}
                className={`text-lg ${errors.your_name ? 'border-destructive' : ''}`}
                disabled={readOnly}
              />
              <ErrorMessage error={errors.your_name} />
            </div>
            <div className="space-y-2" data-field="telephone_number">
              <RequiredLabel error={errors.telephone_number}>YOUR TELEPHONE NUMBER:</RequiredLabel>
              <Input
                value={formData.telephone_number}
                onChange={(e) => updateField('telephone_number', e.target.value)}
                className={`text-lg ${errors.telephone_number ? 'border-destructive' : ''}`}
                disabled={readOnly}
                placeholder="e.g., 07123 456789"
              />
              <ErrorMessage error={errors.telephone_number} />
            </div>
          </div>

          <div className="space-y-2" data-field="bank_name">
            <RequiredLabel error={errors.bank_name}>NAME OF BANK OR BUILDING SOCIETY:</RequiredLabel>
            <Input
              value={formData.bank_name}
              onChange={(e) => updateField('bank_name', e.target.value)}
              placeholder="e.g., Barclays, HSBC, Nationwide"
              className={`text-lg ${errors.bank_name ? 'border-destructive' : ''}`}
              disabled={readOnly}
            />
            <ErrorMessage error={errors.bank_name} />
          </div>

          <div className="space-y-2" data-field="bank_address">
            <RequiredLabel error={errors.bank_address}>BANK OR BUILDING SOCIETY ADDRESS:</RequiredLabel>
            <Textarea
              value={formData.bank_address}
              onChange={(e) => updateField('bank_address', e.target.value)}
              placeholder="Full branch address"
              rows={3}
              disabled={readOnly}
              className={errors.bank_address ? 'border-destructive' : ''}
            />
            <ErrorMessage error={errors.bank_address} />
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
            <div className="space-y-2" data-field="sort_code">
              <RequiredLabel error={errors.sort_code}>BANK SORT CODE:</RequiredLabel>
              <Input
                value={formData.sort_code}
                onChange={(e) => updateField('sort_code', formatSortCode(e.target.value))}
                placeholder="00-00-00"
                className={`text-lg font-mono tracking-wider ${errors.sort_code ? 'border-destructive' : ''}`}
                disabled={readOnly}
              />
              <ErrorMessage error={errors.sort_code} />
            </div>
            <div className="space-y-2" data-field="account_number">
              <RequiredLabel error={errors.account_number}>BANK ACCOUNT NUMBER:</RequiredLabel>
              <Input
                value={formData.account_number}
                onChange={(e) => updateField('account_number', e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                className={`text-lg font-mono tracking-wider ${errors.account_number ? 'border-destructive' : ''}`}
                maxLength={8}
                disabled={readOnly}
              />
              <ErrorMessage error={errors.account_number} />
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

          <div className="space-y-2" data-field="account_holder_name">
            <RequiredLabel error={errors.account_holder_name}>NAME OF ACCOUNT HOLDER:</RequiredLabel>
            <Input
              value={formData.account_holder_name}
              onChange={(e) => updateField('account_holder_name', e.target.value)}
              placeholder="As it appears on your bank account"
              className={`text-lg ${errors.account_holder_name ? 'border-destructive' : ''}`}
              disabled={readOnly}
            />
            <ErrorMessage error={errors.account_holder_name} />
          </div>

          {/* Signature */}
          <div className="border-t pt-6 mt-6">
            <h3 className="font-semibold text-lg mb-4">Declaration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              I confirm that the bank details provided above are correct and that payments should be made to this account.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2" data-field="signature">
              <Label>Signature (To be signed by employee while uploading)</Label>
                <Input
                  value="To be signed by employee while uploading"
                  readOnly
                  disabled
                  className="italic bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div className="space-y-2" data-field="signature_date">
                <Label>Date</Label>
                <Input
                  type="date"
                  value=""
                  readOnly
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex flex-wrap justify-between gap-4 print:hidden mt-6">
            <div className="flex gap-2">
              {onBack && (
                <Button variant="outline" onClick={onBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Button>
              )}
              <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
                <Download className="h-4 w-4" />
                Download / Print
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button onClick={handleSaveAndContinue} disabled={loading}>
                {loading ? 'Saving...' : 'Save & Continue'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
