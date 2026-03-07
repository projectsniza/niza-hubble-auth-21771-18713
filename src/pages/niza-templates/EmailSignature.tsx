import { useState, useRef } from 'react';
import { Download, Copy, Upload, Code, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import { useToast } from '@/hooks/use-toast';
import { captureElementToCanvas } from '@/lib/captureElementToCanvas';

interface SignatureData {
  name: string;
  designation: string;
  companyName: string;
  email: string;
  phone: string;
  photo: string | null;
}

interface SignatureDimensions {
  width: number;
  height: number;
  label: string;
}

const dimensionOptions: SignatureDimensions[] = [
  { width: 400, height: 150, label: '400 x 150 (Standard)' },
  { width: 500, height: 180, label: '500 x 180 (Wide)' },
  { width: 600, height: 200, label: '600 x 200 (Large)' },
  { width: 350, height: 120, label: '350 x 120 (Compact)' },
];

const defaultData: SignatureData = {
  name: '',
  designation: '',
  companyName: '',
  email: '',
  phone: '',
  photo: null,
};

const templates = [
  { id: 1, name: 'Classic Professional', hasPhoto: false },
  { id: 2, name: 'Modern Minimal', hasPhoto: false },
  { id: 3, name: 'Executive Portrait', hasPhoto: true },
  { id: 4, name: 'Corporate Banner', hasPhoto: false },
  { id: 5, name: 'Elegant Sidebar', hasPhoto: false },
];

export default function EmailSignature() {
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [signatureData, setSignatureData] = useState<SignatureData>(defaultData);
  const [selectedDimensions, setSelectedDimensions] = useState<SignatureDimensions>(dimensionOptions[0]);
  const { brandSettings } = useBrandSettings();
  const { toast } = useToast();
  const signatureRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const logoUrl = brandSettings?.primary_logo_path;
  const primaryColor = brandSettings?.primary_color || '#0066B3';

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureData({ ...signatureData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateHTMLCode = (template: number): string => {
    const name = signatureData.name || 'Your Name';
    const designation = signatureData.designation || 'Designation';
    const companyName = signatureData.companyName || 'Company Name';
    const email = signatureData.email || 'email@company.com';
    const phone = signatureData.phone || '+44 123 456 7890';
    const photoSrc = signatureData.photo || 'https://via.placeholder.com/80';
    const logoSrc = logoUrl || 'https://via.placeholder.com/120x40';

    if (template === 1) {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: ${selectedDimensions.width}px;">
  <tr>
    <td style="border-left: 3px solid ${primaryColor}; padding-left: 16px;">
      <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 2px;">${name}</div>
      <div style="font-size: 13px; color: ${primaryColor}; margin-bottom: 8px;">${designation}</div>
      <img src="${logoSrc}" height="32" style="display: block; margin-bottom: 8px;">
      <div style="font-size: 12px; color: #666;">${companyName}</div>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">${phone} | ${email}</div>
    </td>
  </tr>
</table>`;
    }

    if (template === 2) {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: ${selectedDimensions.width}px;">
  <tr>
    <td style="text-align: center; padding: 16px 0;">
      <img src="${logoSrc}" height="36" style="display: inline-block; margin-bottom: 12px;">
      <div style="height: 1px; background: #e5e5e5; margin: 12px 0;"></div>
      <div style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${name}</div>
      <div style="font-size: 12px; color: ${primaryColor}; margin-top: 2px;">${designation}</div>
      <div style="font-size: 11px; color: #888; margin-top: 8px;">${companyName}</div>
      <div style="font-size: 11px; color: #666; margin-top: 4px;">${phone} | ${email}</div>
    </td>
  </tr>
</table>`;
    }

    if (template === 3) {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: ${selectedDimensions.width}px;">
  <tr>
    <td style="padding-right: 16px; vertical-align: top;">
      <img src="${photoSrc}" width="70" height="70" style="border-radius: 8px; object-fit: cover; border: 2px solid ${primaryColor};">
    </td>
    <td style="vertical-align: top;">
      <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${name}</div>
      <div style="font-size: 13px; color: ${primaryColor}; margin: 2px 0 8px;">${designation}</div>
      <img src="${logoSrc}" height="28" style="display: block;">
      <div style="font-size: 11px; color: #666; margin-top: 6px;">${companyName}</div>
      <div style="font-size: 10px; color: #888; margin-top: 4px;">${phone} | ${email}</div>
    </td>
  </tr>
</table>`;
    }

    if (template === 4) {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: ${selectedDimensions.width}px;">
  <tr>
    <td style="background: ${primaryColor}; padding: 12px 20px; border-radius: 6px 6px 0 0;">
      <img src="${logoSrc}" height="28" style="display: block; filter: brightness(0) invert(1);">
    </td>
  </tr>
  <tr>
    <td style="background: #f8f9fa; padding: 14px 20px; border-radius: 0 0 6px 6px;">
      <div style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${name}</div>
      <div style="font-size: 12px; color: ${primaryColor};">${designation}</div>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">${companyName}</div>
      <div style="font-size: 10px; color: #666; margin-top: 4px;">${phone} | ${email}</div>
    </td>
  </tr>
</table>`;
    }

    // Template 5
    return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: ${selectedDimensions.width}px;">
  <tr>
    <td style="width: 4px; background: linear-gradient(180deg, ${primaryColor} 0%, #1a1a1a 100%); border-radius: 2px;"></td>
    <td style="padding: 12px 0 12px 16px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <img src="${logoSrc}" height="30" style="display: block; margin-bottom: 10px;">
            <div style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${name}</div>
            <div style="font-size: 12px; color: ${primaryColor}; margin-top: 2px;">${designation}</div>
            <div style="font-size: 11px; color: #666; margin-top: 6px;">${companyName}</div>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">${phone} | ${email}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  };

  const handleCopyCode = () => {
    const code = generateHTMLCode(selectedTemplate);
    navigator.clipboard.writeText(code);
    toast({ title: 'HTML code copied to clipboard' });
  };

  const handleDownloadImage = async () => {
    if (!signatureRef.current) return;

    const canvas = await captureElementToCanvas(signatureRef.current, {
      scale: 3,
      backgroundColor: '#ffffff',
    });
    const link = document.createElement('a');
    link.download = `email-signature-${signatureData.name || 'template'}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplate);

  const renderSignaturePreview = (template: number) => {
    const name = signatureData.name || 'Your Name';
    const designation = signatureData.designation || 'Designation';
    const companyName = signatureData.companyName || 'Company Name';
    const email = signatureData.email || 'email@company.com';
    const phone = signatureData.phone || '+44 123 456 7890';

    if (template === 1) {
      return (
        <div ref={signatureRef} className="bg-white p-4" style={{ width: selectedDimensions.width, minHeight: selectedDimensions.height }}>
          <div className="border-l-[3px] pl-4" style={{ borderColor: primaryColor }}>
            <h3 className="text-base font-semibold text-gray-900">{name}</h3>
            <p className="text-sm" style={{ color: primaryColor }}>{designation}</p>
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 mt-2 object-contain" />}
            <p className="text-xs text-gray-600 mt-1">{companyName}</p>
            <p className="text-[11px] text-gray-500 mt-1">{phone} | {email}</p>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div ref={signatureRef} className="bg-white p-4 text-center" style={{ width: selectedDimensions.width, minHeight: selectedDimensions.height }}>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-9 mx-auto mb-3 object-contain" />}
          <div className="h-px bg-gray-200 my-3" />
          <h3 className="text-base font-semibold text-gray-900">{name}</h3>
          <p className="text-sm mt-0.5" style={{ color: primaryColor }}>{designation}</p>
          <p className="text-xs text-gray-500 mt-2">{companyName}</p>
          <p className="text-[11px] text-gray-400 mt-1">{phone} | {email}</p>
        </div>
      );
    }

    if (template === 3) {
      return (
        <div ref={signatureRef} className="bg-white p-4 flex gap-4" style={{ width: selectedDimensions.width, minHeight: selectedDimensions.height }}>
          <div className="flex-shrink-0">
            {signatureData.photo ? (
              <img 
                src={signatureData.photo} 
                alt="Profile" 
                className="w-[70px] h-[70px] rounded-lg object-cover"
                style={{ border: `2px solid ${primaryColor}` }}
              />
            ) : (
              <div 
                className="w-[70px] h-[70px] rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400"
                style={{ border: `2px solid ${primaryColor}` }}
              >
                Photo
              </div>
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{name}</h3>
            <p className="text-sm mb-1" style={{ color: primaryColor }}>{designation}</p>
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
            <p className="text-xs text-gray-600 mt-1">{companyName}</p>
            <p className="text-[10px] text-gray-500 mt-1">{phone} | {email}</p>
          </div>
        </div>
      );
    }

    if (template === 4) {
      return (
        <div ref={signatureRef} className="bg-white" style={{ width: selectedDimensions.width, minHeight: selectedDimensions.height }}>
          <div className="px-5 py-3 rounded-t-md" style={{ backgroundColor: primaryColor }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-7 object-contain brightness-0 invert" />
            ) : (
              <div className="h-7 w-24 bg-white/20 rounded" />
            )}
          </div>
          <div className="bg-gray-50 px-5 py-3.5 rounded-b-md">
            <h3 className="text-base font-semibold text-gray-900">{name}</h3>
            <p className="text-sm" style={{ color: primaryColor }}>{designation}</p>
            <p className="text-xs text-gray-500 mt-1">{companyName}</p>
            <p className="text-[10px] text-gray-400 mt-1">{phone} | {email}</p>
          </div>
        </div>
      );
    }

    // Template 5
    return (
      <div ref={signatureRef} className="bg-white p-4 flex" style={{ width: selectedDimensions.width, minHeight: selectedDimensions.height }}>
        <div 
          className="w-1 rounded-sm mr-4" 
          style={{ background: `linear-gradient(180deg, ${primaryColor} 0%, #1a1a1a 100%)` }}
        />
        <div>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 mb-2 object-contain" />}
          <h3 className="text-base font-semibold text-gray-900">{name}</h3>
          <p className="text-sm mt-0.5" style={{ color: primaryColor }}>{designation}</p>
          <p className="text-xs text-gray-600 mt-1">{companyName}</p>
          <p className="text-[10px] text-gray-500 mt-1">{phone} | {email}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Signature</h1>
        <p className="text-muted-foreground mt-1">Create professional email signatures with your brand</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Signature Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template Style</Label>
              <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name} {t.hasPhoto && '(with photo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTemplate?.hasPhoto && (
              <div className="space-y-2">
                <Label>Profile Photo</Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {signatureData.photo ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                value={signatureData.name}
                onChange={(e) => setSignatureData({ ...signatureData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <Input 
                value={signatureData.designation}
                onChange={(e) => setSignatureData({ ...signatureData, designation: e.target.value })}
                placeholder="Director"
              />
            </div>

            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input 
                value={signatureData.companyName}
                onChange={(e) => setSignatureData({ ...signatureData, companyName: e.target.value })}
                placeholder="Your Company Ltd"
              />
            </div>

            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input 
                type="email"
                value={signatureData.email}
                onChange={(e) => setSignatureData({ ...signatureData, email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input 
                value={signatureData.phone}
                onChange={(e) => setSignatureData({ ...signatureData, phone: e.target.value })}
                placeholder="+44 123 456 7890"
              />
            </div>

            <div className="space-y-2">
              <Label>Dimensions</Label>
              <Select 
                value={`${selectedDimensions.width}x${selectedDimensions.height}`} 
                onValueChange={(v) => {
                  const dim = dimensionOptions.find(d => `${d.width}x${d.height}` === v);
                  if (dim) setSelectedDimensions(dim);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dimensionOptions.map((dim) => (
                    <SelectItem key={`${dim.width}x${dim.height}`} value={`${dim.width}x${dim.height}`}>
                      {dim.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preview & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center py-6 bg-gray-50 rounded-b-lg">
              {renderSignaturePreview(selectedTemplate)}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCopyCode} className="gap-2 flex-1">
              <Code className="h-4 w-4" />
              Copy HTML Code
            </Button>
            <Button variant="outline" onClick={handleDownloadImage} className="gap-2 flex-1">
              <Image className="h-4 w-4" />
              Download as PNG
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">HTML Code</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-48">
                <code>{generateHTMLCode(selectedTemplate)}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
