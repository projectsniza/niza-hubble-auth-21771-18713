import { useState, useRef } from 'react';
import { Plus, Download, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CardData {
  name: string;
  designation: string;
  employeeId: string;
  department: string;
  bloodGroup: string;
  emergencyContact: string;
  photo: string | null;
  validFrom: string;
  validUntil: string;
  visitorCompany: string;
  visitPurpose: string;
  hostName: string;
}

const defaultCardData: CardData = {
  name: '',
  designation: '',
  employeeId: '',
  department: '',
  bloodGroup: '',
  emergencyContact: '',
  photo: null,
  validFrom: '',
  validUntil: '',
  visitorCompany: '',
  visitPurpose: '',
  hostName: '',
};

const templateStyles = [
  { id: 1, name: 'Corporate Blue', accent: '#0057D9' },
  { id: 2, name: 'Modern Teal', accent: '#0D9488' },
  { id: 3, name: 'Executive Navy', accent: '#1E3A5F' },
  { id: 4, name: 'Elegant Purple', accent: '#7C3AED' },
  { id: 5, name: 'Professional Green', accent: '#059669' },
];

export default function IDCards() {
  const [activeTab, setActiveTab] = useState('id-card');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardType, setCardType] = useState<'id' | 'visitor'>('id');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [cardData, setCardData] = useState<CardData>(defaultCardData);
  const { brandSettings } = useBrandSettings();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const logoUrl = brandSettings?.primary_logo_path;
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
    
    const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: '#ffffff' });
    
    if (format === 'pdf') {
      const pdf = new jsPDF({
        orientation: orientation === 'vertical' ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a6',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${cardType}-card-${cardData.name || 'template'}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `${cardType}-card-${cardData.name || 'template'}.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
      link.click();
    }
  };

  const renderIDCardTemplate = (template: number, isPreview = false) => {
    const isVertical = orientation === 'vertical';
    const accent = currentStyle.accent;
    const ref = isPreview ? cardRef : undefined;
    
    const baseStyles = isVertical 
      ? 'w-[260px] h-[400px]' 
      : 'w-[400px] h-[260px]';

    const alignClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    if (template === 1) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border relative`}>
          <div className="p-4" style={{ backgroundColor: accent }}>
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain brightness-0 invert" />}
            <p className="text-xs text-white/80 mt-1">{cardType === 'id' ? 'Employee ID Card' : 'Visitor Pass'}</p>
          </div>
          
          <div className={`p-4 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4'}`}>
            <div className={`${isVertical ? 'w-20 h-20 -mt-12' : 'w-16 h-16'} rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center`}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-gray-300" />
              )}
            </div>
            
            <div className={`${isVertical ? 'mt-3 w-full' : 'flex-1'} ${alignClass}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.name || 'Full Name'}</h3>
              <p className="text-sm font-medium" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
              <div className={`mt-3 space-y-1 text-xs text-gray-600 ${alignClass}`}>
                {cardType === 'id' ? (
                  <>
                    <p><span className="font-medium">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                    <p><span className="font-medium">Dept:</span> {cardData.department || 'Department'}</p>
                    {cardData.bloodGroup && <p><span className="font-medium">Blood:</span> {cardData.bloodGroup}</p>}
                  </>
                ) : (
                  <>
                    <p><span className="font-medium">From:</span> {cardData.visitorCompany || 'Company'}</p>
                    <p><span className="font-medium">Purpose:</span> {cardData.visitPurpose || 'Meeting'}</p>
                    <p><span className="font-medium">Host:</span> {cardData.hostName || 'Host Name'}</p>
                    <p><span className="font-medium">Valid:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-2 text-center" style={{ backgroundColor: `${accent}15` }}>
            <p className="text-[10px] text-gray-500">If found, please return to reception</p>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div ref={ref} className={`${baseStyles} bg-gradient-to-br from-gray-50 to-white rounded-xl overflow-hidden shadow-lg relative`}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ backgroundColor: accent }} />
          
          <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex justify-between items-start mb-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain" />}
              <span className="text-xs font-medium" style={{ color: accent }}>{cardType === 'id' ? 'ID CARD' : 'VISITOR'}</span>
            </div>
            
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-20 h-20' : 'w-16 h-16'} rounded-xl overflow-hidden border-2 bg-gray-100`} style={{ borderColor: accent }}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'mt-4 w-full' : ''} ${alignClass}`}>
                <h3 className="font-bold text-gray-900">{cardData.name || 'Full Name'}</h3>
                <p className="text-sm" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
              </div>
            </div>
            
            <div className="mt-auto rounded-lg p-3 text-xs" style={{ backgroundColor: `${accent}10` }}>
              {cardType === 'id' ? (
                <div className="flex justify-between">
                  <span>ID: {cardData.employeeId || 'EMP-0000'}</span>
                  <span>{cardData.department || 'Dept'}</span>
                </div>
              ) : (
                <div className="text-center">Valid: {cardData.validUntil || 'DD/MM/YYYY'}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (template === 3) {
      return (
        <div ref={ref} className={`${baseStyles} rounded-xl overflow-hidden shadow-lg`} style={{ backgroundColor: accent }}>
          <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5 text-white`}>
            <div className="flex justify-between items-start mb-3">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain brightness-0 invert" />}
              <span className="text-xs opacity-80">{cardType === 'id' ? 'EMPLOYEE' : 'VISITOR'}</span>
            </div>
            
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-24 h-24' : 'w-20 h-20'} rounded-full overflow-hidden border-3 border-white/30 bg-white/20`}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-10 h-10 text-white/50" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'mt-4 w-full' : ''} ${alignClass}`}>
                <h3 className="font-bold text-xl">{cardData.name || 'Full Name'}</h3>
                <p className="text-sm opacity-90">{cardData.designation || 'Designation'}</p>
                <div className="mt-3 space-y-1 text-xs opacity-80">
                  {cardType === 'id' ? (
                    <>
                      <p>ID: {cardData.employeeId || 'EMP-0000'}</p>
                      <p>{cardData.department || 'Department'}</p>
                    </>
                  ) : (
                    <>
                      <p>From: {cardData.visitorCompany || 'Company'}</p>
                      <p>Host: {cardData.hostName || 'Host'}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-auto text-center text-xs opacity-70 pt-3 border-t border-white/20">
              {cardType === 'id' ? (cardData.emergencyContact ? `Emergency: ${cardData.emergencyContact}` : 'Emergency Contact') : `Valid: ${cardData.validUntil || 'DD/MM/YYYY'}`}
            </div>
          </div>
        </div>
      );
    }

    if (template === 4) {
      return (
        <div ref={ref} className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border-l-4`} style={{ borderLeftColor: accent }}>
          <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5`}>
            <div className="flex items-center gap-3 mb-4">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
              <div className="h-8 w-px bg-gray-200" />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
                {cardType === 'id' ? 'Employee' : 'Visitor'}
              </span>
            </div>
            
            <div className={`flex-1 ${isVertical ? '' : 'flex gap-4'}`}>
              <div className={`${isVertical ? 'flex gap-4 mb-4' : ''}`}>
                <div className={`${isVertical ? 'w-16 h-16' : 'w-20 h-20'} rounded-lg overflow-hidden bg-gray-100`}>
                  {cardData.photo ? (
                    <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                </div>
                {isVertical && (
                  <div className={alignClass}>
                    <h3 className="font-bold text-gray-900">{cardData.name || 'Full Name'}</h3>
                    <p className="text-sm" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
                  </div>
                )}
              </div>
              
              {!isVertical && (
                <div className={`flex-1 ${alignClass}`}>
                  <h3 className="font-bold text-gray-900">{cardData.name || 'Full Name'}</h3>
                  <p className="text-sm" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-1 text-xs text-gray-600 border-t pt-3">
              {cardType === 'id' ? (
                <div className="grid grid-cols-2 gap-2">
                  <p><span className="font-medium">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                  <p><span className="font-medium">Dept:</span> {cardData.department || 'Dept'}</p>
                  {cardData.bloodGroup && <p><span className="font-medium">Blood:</span> {cardData.bloodGroup}</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <p><span className="font-medium">Purpose:</span> {cardData.visitPurpose || 'Meeting'}</p>
                  <p><span className="font-medium">Valid:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Template 5
    return (
      <div ref={ref} className={`${baseStyles} bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden shadow-lg relative`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20" style={{ backgroundColor: accent }} />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full -ml-16 -mb-16" style={{ backgroundColor: accent }} />
        </div>
        
        <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-5 text-white`}>
          <div className="flex justify-between items-start mb-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 object-contain brightness-0 invert" />}
            <div className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: accent }}>
              {cardType === 'id' ? 'ID CARD' : 'VISITOR'}
            </div>
          </div>
          
          <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
            <div className={`${isVertical ? 'w-20 h-20' : 'w-16 h-16'} rounded-xl overflow-hidden bg-white/10 border border-white/20`}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white/40" />
                </div>
              )}
            </div>
            
            <div className={`${isVertical ? 'mt-4 w-full' : ''} ${alignClass}`}>
              <h3 className="font-bold text-lg">{cardData.name || 'Full Name'}</h3>
              <p className="text-sm" style={{ color: accent }}>{cardData.designation || 'Designation'}</p>
            </div>
          </div>
          
          <div className="mt-auto grid grid-cols-2 gap-2 text-xs text-white/70">
            {cardType === 'id' ? (
              <>
                <p>ID: {cardData.employeeId || 'EMP-0000'}</p>
                <p>{cardData.department || 'Department'}</p>
              </>
            ) : (
              <>
                <p>Host: {cardData.hostName || 'Host'}</p>
                <p>Valid: {cardData.validUntil || 'DD/MM/YYYY'}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ID Cards & Visitor Passes</h1>
          <p className="text-muted-foreground mt-1">Create professional ID cards and visitor passes</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="id-card">ID Cards</TabsTrigger>
          <TabsTrigger value="visitor-pass">Visitor Passes</TabsTrigger>
        </TabsList>

        <TabsContent value="id-card" className="mt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {templateStyles.map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setCardType('id');
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
        </TabsContent>

        <TabsContent value="visitor-pass" className="mt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {templateStyles.map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setCardType('visitor');
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
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cardType === 'id' ? 'Create ID Card' : 'Create Visitor Pass'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
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
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={(v) => setOrientation(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vertical">Vertical</SelectItem>
                      <SelectItem value="horizontal">Horizontal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Text Align</Label>
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

              <div className="space-y-2">
                <Label>Photo</Label>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <Button variant="outline" className="w-full gap-2" onClick={() => photoInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {cardData.photo ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>

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
                    placeholder="Manager"
                  />
                </div>
              </div>

              {cardType === 'id' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Employee ID</Label>
                      <Input 
                        value={cardData.employeeId}
                        onChange={(e) => setCardData({ ...cardData, employeeId: e.target.value })}
                        placeholder="EMP-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input 
                        value={cardData.department}
                        onChange={(e) => setCardData({ ...cardData, department: e.target.value })}
                        placeholder="Operations"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Blood Group</Label>
                      <Input 
                        value={cardData.bloodGroup}
                        onChange={(e) => setCardData({ ...cardData, bloodGroup: e.target.value })}
                        placeholder="A+"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Emergency Contact</Label>
                      <Input 
                        value={cardData.emergencyContact}
                        onChange={(e) => setCardData({ ...cardData, emergencyContact: e.target.value })}
                        placeholder="+44 123 456 7890"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Visitor Company</Label>
                      <Input 
                        value={cardData.visitorCompany}
                        onChange={(e) => setCardData({ ...cardData, visitorCompany: e.target.value })}
                        placeholder="ABC Ltd"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Visit Purpose</Label>
                      <Input 
                        value={cardData.visitPurpose}
                        onChange={(e) => setCardData({ ...cardData, visitPurpose: e.target.value })}
                        placeholder="Meeting"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Host Name</Label>
                      <Input 
                        value={cardData.hostName}
                        onChange={(e) => setCardData({ ...cardData, hostName: e.target.value })}
                        placeholder="John Smith"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valid Until</Label>
                      <Input 
                        type="date"
                        value={cardData.validUntil}
                        onChange={(e) => setCardData({ ...cardData, validUntil: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center bg-gray-100 rounded-lg p-6">
              <h3 className="text-sm font-medium mb-4">Preview</h3>
              <div className="flex justify-center">
                {renderIDCardTemplate(selectedTemplate, true)}
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
