import { useState, useRef } from 'react';
import { Download, Copy, Upload, Code, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface SignatureData {
  name: string;
  designation: string;
  email: string;
  phone: string;
  website: string;
  tagline: string;
  photo: string | null;
}

const defaultData: SignatureData = {
  name: '',
  designation: '',
  email: '',
  phone: '',
  website: '',
  tagline: '',
  photo: null,
};

export default function EmailSignature() {
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [signatureData, setSignatureData] = useState<SignatureData>(defaultData);
  const { brandSettings } = useBrandSettings();
  const { toast } = useToast();
  const signatureRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const logoUrl = brandSettings?.primary_logo_path;
  const primaryColor = brandSettings?.primary_color || '#0057D9';

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
    const email = signatureData.email || 'email@company.com';
    const phone = signatureData.phone || '+44 123 456 7890';
    const website = signatureData.website || 'www.company.com';
    const tagline = signatureData.tagline || 'Company Tagline';
    const photoSrc = signatureData.photo || 'https://via.placeholder.com/100';
    const logoSrc = logoUrl || 'https://via.placeholder.com/150x50';

    if (template === 1) {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; line-height: 1.4; border-left: 4px solid ${primaryColor}; background: #ffffff; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 600px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="padding-right:20px; vertical-align: top; width: 120px;">
            <img src="${photoSrc}" style="display: block; border: 2px solid ${primaryColor}; border-radius: 12px; height: 140px; width: auto;">
          </td>
          <td style="vertical-align: top;">
            <div style="font-size: 18px; font-weight: bold; color: #000; margin-bottom: 2px;">${name}</div>
            <div style="font-size: 14px; font-weight: bold; color: ${primaryColor}; margin-bottom: 12px;">${designation}</div>
            <img src="${logoSrc}" width="120" style="display: block; margin-bottom: 8px;">
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 8px 0;">
            <div style="font-size: 12px; color: #444; line-height: 1.6;">
              <div>📧 ${email}</div>
              <div>📞 ${phone}</div>
              <div>🌐 ${website}</div>
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 8px; font-style: italic;">${tagline}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    }

    if (template === 2) {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 20px; border-radius: 12px; max-width: 500px;">
  <tr>
    <td style="text-align: center; padding-bottom: 15px;">
      <img src="${logoSrc}" width="140" style="display: inline-block;">
    </td>
  </tr>
  <tr>
    <td style="text-align: center;">
      <img src="${photoSrc}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid ${primaryColor}; object-fit: cover;">
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-top: 12px;">
      <div style="font-size: 20px; font-weight: bold;">${name}</div>
      <div style="font-size: 14px; color: ${primaryColor}; margin-top: 4px;">${designation}</div>
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-top: 15px;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="padding: 0 10px; font-size: 12px; color: #aaa;">${phone}</td>
          <td style="padding: 0 10px; font-size: 12px; color: #aaa; border-left: 1px solid #444;">${email}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-top: 10px; font-size: 11px; color: #666;">${tagline}</td>
  </tr>
</table>`;
    }

    // Template 3
    return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: 550px;">
  <tr>
    <td style="background: ${primaryColor}; height: 4px; border-radius: 4px 4px 0 0;"></td>
  </tr>
  <tr>
    <td style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="vertical-align: top; width: 80px;">
            <img src="${photoSrc}" style="width: 70px; height: 70px; border-radius: 8px; object-fit: cover;">
          </td>
          <td style="vertical-align: top; padding-left: 15px;">
            <div style="font-size: 18px; font-weight: bold; color: #333;">${name}</div>
            <div style="font-size: 13px; color: ${primaryColor}; font-weight: 500;">${designation}</div>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
              <tr>
                <td style="font-size: 12px; color: #666; padding-right: 15px;">📧 ${email}</td>
                <td style="font-size: 12px; color: #666;">📞 ${phone}</td>
              </tr>
            </table>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <img src="${logoSrc}" width="100" style="display: inline-block;">
          </td>
        </tr>
      </table>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #888; text-align: center;">
        ${tagline} | ${website}
      </div>
    </td>
  </tr>
</table>`;
  };

  const handleCopyCode = () => {
    const code = generateHTMLCode(selectedTemplate);
    navigator.clipboard.writeText(code);
    toast({ title: 'HTML code copied to clipboard!' });
  };

  const handleDownloadImage = async () => {
    if (!signatureRef.current) return;
    
    const canvas = await html2canvas(signatureRef.current, { scale: 2, backgroundColor: null });
    const link = document.createElement('a');
    link.download = `email-signature-${signatureData.name || 'template'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const renderSignaturePreview = (template: number) => {
    const name = signatureData.name || 'Your Name';
    const designation = signatureData.designation || 'Designation';
    const email = signatureData.email || 'email@company.com';
    const phone = signatureData.phone || '+44 123 456 7890';
    const website = signatureData.website || 'www.company.com';
    const tagline = signatureData.tagline || 'Company Tagline';

    if (template === 1) {
      return (
        <div 
          ref={signatureRef}
          className="bg-white p-3 rounded-lg shadow-md border-l-4"
          style={{ borderLeftColor: primaryColor, maxWidth: '500px' }}
        >
          <div className="flex gap-4">
            {/* Photo */}
            <div className="flex-shrink-0">
              {signatureData.photo ? (
                <img 
                  src={signatureData.photo} 
                  alt="Profile" 
                  className="w-[100px] h-[130px] object-cover rounded-xl"
                  style={{ border: `2px solid ${primaryColor}` }}
                />
              ) : (
                <div 
                  className="w-[100px] h-[130px] bg-muted rounded-xl flex items-center justify-center text-muted-foreground text-xs"
                  style={{ border: `2px solid ${primaryColor}` }}
                >
                  Photo
                </div>
              )}
            </div>
            {/* Details */}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground">{name}</h3>
              <p className="text-sm font-semibold" style={{ color: primaryColor }}>{designation}</p>
              
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 my-2" />}
              
              <hr className="my-2 border-border" />
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📧 {email}</p>
                <p>📞 {phone}</p>
                <p>🌐 {website}</p>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2 italic">{tagline}</p>
            </div>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div 
          ref={signatureRef}
          className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-5 rounded-xl text-center"
          style={{ maxWidth: '400px' }}
        >
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 mx-auto mb-3 brightness-0 invert" />}
          
          {signatureData.photo ? (
            <img 
              src={signatureData.photo} 
              alt="Profile" 
              className="w-16 h-16 rounded-full mx-auto object-cover"
              style={{ border: `3px solid ${primaryColor}` }}
            />
          ) : (
            <div 
              className="w-16 h-16 rounded-full mx-auto bg-gray-700 flex items-center justify-center text-xs"
              style={{ border: `3px solid ${primaryColor}` }}
            >
              Photo
            </div>
          )}
          
          <h3 className="text-lg font-bold mt-3">{name}</h3>
          <p className="text-sm" style={{ color: primaryColor }}>{designation}</p>
          
          <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
            <span>{phone}</span>
            <span className="border-l border-gray-600 pl-4">{email}</span>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">{tagline}</p>
        </div>
      );
    }

    // Template 3
    return (
      <div ref={signatureRef} style={{ maxWidth: '450px' }}>
        <div className="h-1 rounded-t" style={{ backgroundColor: primaryColor }} />
        <div className="bg-gray-50 p-4 rounded-b-lg">
          <div className="flex gap-4">
            {signatureData.photo ? (
              <img 
                src={signatureData.photo} 
                alt="Profile" 
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                Photo
              </div>
            )}
            
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">{name}</h3>
              <p className="text-sm font-medium" style={{ color: primaryColor }}>{designation}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span>📧 {email}</span>
                <span>📞 {phone}</span>
              </div>
            </div>
            
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 flex-shrink-0" />}
          </div>
          
          <div className="mt-3 pt-3 border-t text-center text-xs text-gray-500">
            {tagline} | {website}
          </div>
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
              <Label>Template</Label>
              <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Professional Card</SelectItem>
                  <SelectItem value="2">Dark Centered</SelectItem>
                  <SelectItem value="3">Minimal Header</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Photo</Label>
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
                Upload Photo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                value={signatureData.email}
                onChange={(e) => setSignatureData({ ...signatureData, email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={signatureData.phone}
                  onChange={(e) => setSignatureData({ ...signatureData, phone: e.target.value })}
                  placeholder="+44 123 456 7890"
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input 
                  value={signatureData.website}
                  onChange={(e) => setSignatureData({ ...signatureData, website: e.target.value })}
                  placeholder="www.company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input 
                value={signatureData.tagline}
                onChange={(e) => setSignatureData({ ...signatureData, tagline: e.target.value })}
                placeholder="Your company tagline"
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
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
              Download as Image
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
