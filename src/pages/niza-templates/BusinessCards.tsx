import { useState, useRef } from 'react';
import { Plus, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import { captureElementToCanvas } from '@/lib/captureElementToCanvas';
import jsPDF from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

interface BusinessCardData {
  name: string;
  designation: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  organization: string;
  branch: string;
  linkedIn: string;
  photo: string | null;
}

const defaultData: BusinessCardData = {
  name: '',
  designation: '',
  email: '',
  phone: '',
  mobile: '',
  website: '',
  address: '',
  organization: '',
  branch: '',
  linkedIn: '',
  photo: null,
};

const templateStyles = [
  { id: 1, name: 'Niza Classic', accent: '#0066B3' },
  { id: 2, name: 'Deep Navy', accent: '#004C8C' },
  { id: 3, name: 'Sky Blue', accent: '#00A3E0' },
  { id: 4, name: 'Corporate Slate', accent: '#1B3A5C' },
  { id: 5, name: 'Executive Blue', accent: '#2C5F8A' },
];

export default function BusinessCards() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [cardData, setCardData] = useState<BusinessCardData>(defaultData);
  const { brandSettings } = useBrandSettings();
  const cardRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const logoUrl = brandSettings?.primary_logo_path || nizaLogo;
  const currentStyle = templateStyles.find(t => t.id === selectedTemplate) || templateStyles[0];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardData({ ...cardData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!cardRef.current) return;

    const canvas = await captureElementToCanvas(cardRef.current, {
      scale: 3,
      backgroundColor: '#ffffff',
    });

    if (format === 'pdf') {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [90, 55],
      });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 90, 55);
      pdf.save(`business-card-${cardData.name || 'template'}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `business-card-${cardData.name || 'template'}.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 1.0);
      link.click();
    }
  };

  const renderBusinessCard = (template: number, isPreview = false) => {
    const accent = currentStyle.accent;
    const ref = isPreview ? cardRef : undefined;
    const cardStyles = 'w-[350px] h-[200px] rounded-lg shadow-lg overflow-hidden';
    const alignClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    if (template === 1) {
      return (
        <div ref={ref} className={`${cardStyles} bg-white relative`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: accent }} />
          
          <div className="h-full flex flex-col justify-between p-5 pl-5">
            <div className="flex justify-between items-start">
              <div className={alignClass}>
                <h2 className="text-lg font-bold text-gray-900">{cardData.name || 'Your Name'}</h2>
                <p className="text-sm font-medium" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {cardData.organization || 'Organization'}{cardData.branch && ` | ${cardData.branch}`}
                </p>
              </div>
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain" />}
            </div>
            
            <div className={`space-y-0.5 text-xs text-gray-600 ${alignClass}`}>
              {cardData.email && <p>{cardData.email}</p>}
              {cardData.phone && <p>{cardData.phone}</p>}
              {cardData.mobile && <p>{cardData.mobile}</p>}
              {cardData.website && <p>{cardData.website}</p>}
            </div>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div ref={ref} className={`${cardStyles} bg-gradient-to-br text-white relative`} style={{ background: `linear-gradient(135deg, ${accent} 0%, #000 100%)` }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
          
          <div className="h-full flex flex-col justify-between p-5 relative z-10">
            <div className="flex justify-between items-start">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain brightness-0 invert" />}
              <div className={`${textAlign === 'left' ? 'text-right' : alignClass}`}>
                <p className="text-xs text-white/60">{cardData.organization || 'COMPANY'}</p>
                {cardData.branch && <p className="text-xs text-white/40">{cardData.branch}</p>}
              </div>
            </div>
            
            <div className={alignClass}>
              <h2 className="text-xl font-light">{cardData.name || 'Your Name'}</h2>
              <p className="text-sm opacity-80">{cardData.designation || 'Designation'}</p>
            </div>
            
            <div className={`flex flex-wrap gap-4 text-xs text-white/70 ${alignClass}`}>
              {cardData.phone && <span>{cardData.phone}</span>}
              {cardData.email && <span>{cardData.email}</span>}
            </div>
          </div>
        </div>
      );
    }

    if (template === 3) {
      return (
        <div ref={ref} className={`${cardStyles} bg-white relative`}>
          <div className="absolute top-0 right-0 w-28 h-28 rounded-bl-full" style={{ backgroundColor: accent }} />
          
          <div className="h-full flex flex-col justify-between p-5 relative z-10">
            <div className="flex justify-between">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
            </div>
            
            <div className={alignClass}>
              <h2 className="text-lg font-bold text-gray-900">{cardData.name || 'Your Name'}</h2>
              <p className="text-sm font-medium" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {cardData.organization || 'Organization'}{cardData.branch && ` | ${cardData.branch}`}
              </p>
            </div>
            
            <div className={`flex flex-wrap gap-3 text-xs text-gray-600 ${alignClass}`}>
              {cardData.phone && <span>{cardData.phone}</span>}
              {cardData.email && <span>{cardData.email}</span>}
              {cardData.website && <span>{cardData.website}</span>}
            </div>
          </div>
        </div>
      );
    }

    if (template === 4) {
      return (
        <div ref={ref} className={`${cardStyles} bg-white relative border`}>
          <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ backgroundColor: accent }} />
          
          <div className="h-full flex p-5">
            {cardData.photo && (
              <div className="w-20 h-full mr-4 flex-shrink-0">
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover rounded-lg" />
              </div>
            )}
            
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className={alignClass}>
                  <h2 className="text-lg font-bold text-gray-900">{cardData.name || 'Your Name'}</h2>
                  <p className="text-sm" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
                </div>
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
              </div>
              
              <div className={`text-xs text-gray-600 space-y-0.5 ${alignClass}`}>
                <p>{cardData.organization || 'Organization'}{cardData.branch && ` | ${cardData.branch}`}</p>
                {cardData.email && <p>{cardData.email}</p>}
                {cardData.phone && <p>{cardData.phone}</p>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Template 5
    return (
      <div ref={ref} className={`${cardStyles} bg-gradient-to-br from-gray-50 to-white relative border`}>
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(180deg, ${accent} 0%, transparent 100%)` }} />
        
        <div className="h-full flex flex-col justify-between p-5 pl-5">
          <div className="flex justify-between items-start">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-9 object-contain" />}
            <div className="text-right">
              <p className="text-xs font-medium" style={{ color: accent }}>{cardData.organization || 'Organization'}</p>
              {cardData.branch && <p className="text-xs text-gray-400">{cardData.branch}</p>}
            </div>
          </div>
          
          <div className={alignClass}>
            <h2 className="text-lg font-bold text-gray-900">{cardData.name || 'Your Name'}</h2>
            <p className="text-sm" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
          </div>
          
          <div className={`grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 ${alignClass}`}>
            {cardData.email && <p>{cardData.email}</p>}
            {cardData.phone && <p>{cardData.phone}</p>}
            {cardData.mobile && <p>{cardData.mobile}</p>}
            {cardData.website && <p>{cardData.website}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Cards</h1>
          <p className="text-muted-foreground mt-1">Design professional business cards</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Business Card
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-5">
        {templateStyles.map((template) => (
          <Card 
            key={template.id} 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => {
              setSelectedTemplate(template.id);
              setDialogOpen(true);
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{template.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-4">
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: template.accent }} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Business Card</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templateStyles.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Text Alignment</Label>
                  <Select value={textAlign} onValueChange={(v) => setTextAlign(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedTemplate === 4 && (
                <div className="space-y-2">
                  <Label>Photo (Optional)</Label>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <Button variant="outline" className="w-full gap-2" onClick={() => photoInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {cardData.photo ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={cardData.name}
                    onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input 
                    value={cardData.designation}
                    onChange={(e) => setCardData({ ...cardData, designation: e.target.value })}
                    placeholder="CEO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input 
                    value={cardData.organization}
                    onChange={(e) => setCardData({ ...cardData, organization: e.target.value })}
                    placeholder="Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Input 
                    value={cardData.branch}
                    onChange={(e) => setCardData({ ...cardData, branch: e.target.value })}
                    placeholder="Head Office"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={cardData.email}
                  onChange={(e) => setCardData({ ...cardData, email: e.target.value })}
                  placeholder="john@company.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    value={cardData.phone}
                    onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                    placeholder="+44 20 1234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input 
                    value={cardData.mobile}
                    onChange={(e) => setCardData({ ...cardData, mobile: e.target.value })}
                    placeholder="+44 7123 456789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Website</Label>
                <Input 
                  value={cardData.website}
                  onChange={(e) => setCardData({ ...cardData, website: e.target.value })}
                  placeholder="www.company.com"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center bg-gray-100 rounded-lg p-6">
              <h3 className="text-sm font-medium mb-4">Preview</h3>
              <div className="flex justify-center">
                {renderBusinessCard(selectedTemplate, true)}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleDownload('png')} className="gap-2">
              <Download className="h-4 w-4" />
              PNG
            </Button>
            <Button variant="outline" onClick={() => handleDownload('jpg')} className="gap-2">
              <Download className="h-4 w-4" />
              JPG
            </Button>
            <Button onClick={() => handleDownload('pdf')} className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
