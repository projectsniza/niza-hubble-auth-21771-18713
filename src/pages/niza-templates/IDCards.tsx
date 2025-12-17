import { useState, useRef } from 'react';
import { Plus, Download, Eye, Upload, User } from 'lucide-react';
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
  photo: string | null;
  validUntil: string;
}

const defaultCardData: CardData = {
  name: '',
  designation: '',
  employeeId: '',
  department: '',
  photo: null,
  validUntil: '',
};

export default function IDCards() {
  const [activeTab, setActiveTab] = useState('id-card');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [cardType, setCardType] = useState<'id' | 'visitor'>('id');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [cardData, setCardData] = useState<CardData>(defaultCardData);
  const { brandSettings } = useBrandSettings();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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
    
    const canvas = await html2canvas(cardRef.current, { scale: 2 });
    
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

  const renderIDCardTemplate = (template: number) => {
    const isVertical = orientation === 'vertical';
    const logoUrl = brandSettings?.primary_logo_path;
    
    const baseStyles = isVertical 
      ? 'w-[240px] h-[380px]' 
      : 'w-[380px] h-[240px]';

    if (template === 1) {
      return (
        <div 
          ref={cardRef}
          className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border relative`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 mb-2 object-contain" />}
            <p className="text-xs opacity-80">
              {cardType === 'id' ? 'Employee ID Card' : 'Visitor Pass'}
            </p>
          </div>
          
          {/* Content */}
          <div className={`p-4 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4'}`}>
            {/* Photo */}
            <div className={`${isVertical ? 'w-24 h-24 -mt-8' : 'w-20 h-20'} rounded-full border-4 border-white shadow-lg overflow-hidden bg-muted flex items-center justify-center`}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            
            {/* Details */}
            <div className={`${isVertical ? 'text-center mt-3' : 'flex-1'}`}>
              <h3 className="font-bold text-lg text-gray-900">{cardData.name || 'Employee Name'}</h3>
              <p className="text-sm text-blue-600 font-medium">{cardData.designation || 'Designation'}</p>
              <div className={`mt-3 space-y-1 text-xs text-gray-600 ${isVertical ? '' : 'text-left'}`}>
                {cardType === 'id' && (
                  <>
                    <p><span className="font-medium">ID:</span> {cardData.employeeId || 'EMP-0000'}</p>
                    <p><span className="font-medium">Dept:</span> {cardData.department || 'Department'}</p>
                  </>
                )}
                {cardType === 'visitor' && (
                  <p><span className="font-medium">Valid Until:</span> {cardData.validUntil || 'DD/MM/YYYY'}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-100 p-2 text-center">
            <p className="text-[10px] text-gray-500">If found, please return to the reception</p>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div 
          ref={cardRef}
          className={`${baseStyles} bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl overflow-hidden shadow-lg relative`}
        >
          {/* Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12" />
          </div>
          
          {/* Content */}
          <div className={`relative h-full ${isVertical ? 'flex flex-col' : 'flex'} p-4`}>
            {/* Logo */}
            <div className="flex justify-between items-start mb-2">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain brightness-0 invert" />}
              <span className="text-white/80 text-xs">{cardType === 'id' ? 'ID CARD' : 'VISITOR'}</span>
            </div>
            
            {/* Photo and Details */}
            <div className={`flex-1 ${isVertical ? 'flex flex-col items-center' : 'flex gap-4 items-center'}`}>
              <div className={`${isVertical ? 'w-20 h-20 my-3' : 'w-16 h-16'} rounded-lg border-2 border-white/30 overflow-hidden bg-white/20`}>
                {cardData.photo ? (
                  <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white/60" />
                  </div>
                )}
              </div>
              
              <div className={`${isVertical ? 'text-center' : ''}`}>
                <h3 className="font-bold text-white text-lg">{cardData.name || 'Name Here'}</h3>
                <p className="text-white/80 text-sm">{cardData.designation || 'Designation'}</p>
              </div>
            </div>
            
            {/* Bottom Info */}
            <div className="mt-auto bg-white/20 rounded-lg p-2 text-white text-xs">
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

    // Template 3
    return (
      <div 
        ref={cardRef}
        className={`${baseStyles} bg-white rounded-xl overflow-hidden shadow-lg border-l-4 border-l-purple-600`}
      >
        <div className={`h-full ${isVertical ? 'flex flex-col' : 'flex'} p-4`}>
          {/* Left Section */}
          <div className={`${isVertical ? 'text-center' : 'pr-4 border-r'}`}>
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain mb-3" />}
            <div className={`${isVertical ? 'w-20 h-20 mx-auto' : 'w-16 h-16'} rounded-full overflow-hidden border-2 border-purple-200 bg-purple-50`}>
              {cardData.photo ? (
                <img src={cardData.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-purple-300" />
                </div>
              )}
            </div>
          </div>
          
          {/* Right Section */}
          <div className={`${isVertical ? 'mt-4 text-center' : 'pl-4 flex-1'}`}>
            <p className="text-purple-600 text-xs font-medium mb-1">
              {cardType === 'id' ? 'EMPLOYEE' : 'VISITOR'}
            </p>
            <h3 className="font-bold text-gray-900">{cardData.name || 'Name'}</h3>
            <p className="text-sm text-purple-600">{cardData.designation || 'Role'}</p>
            
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              {cardType === 'id' ? (
                <>
                  <p>ID: {cardData.employeeId || 'EMP-0000'}</p>
                  <p>{cardData.department || 'Department'}</p>
                </>
              ) : (
                <p>Valid: {cardData.validUntil || 'DD/MM/YYYY'}</p>
              )}
            </div>
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
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((template) => (
              <Card key={template} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => {
                setCardType('id');
                setSelectedTemplate(template);
                setDialogOpen(true);
              }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Template {template}</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <div className="transform scale-50 origin-top">
                    {(() => {
                      const tempOrientation = orientation;
                      return renderIDCardTemplate(template);
                    })()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="visitor-pass" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((template) => (
              <Card key={template} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => {
                setCardType('visitor');
                setSelectedTemplate(template);
                setDialogOpen(true);
              }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Template {template}</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <div className="transform scale-50 origin-top">
                    {renderIDCardTemplate(template)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {cardType === 'id' ? 'Create ID Card' : 'Create Visitor Pass'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select value={orientation} onValueChange={(v) => setOrientation(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">Vertical (Portrait)</SelectItem>
                    <SelectItem value="horizontal">Horizontal (Landscape)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Template 1 - Corporate Blue</SelectItem>
                    <SelectItem value="2">Template 2 - Modern Green</SelectItem>
                    <SelectItem value="3">Template 3 - Elegant Purple</SelectItem>
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

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input 
                  value={cardData.name}
                  onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label>Designation / Role</Label>
                <Input 
                  value={cardData.designation}
                  onChange={(e) => setCardData({ ...cardData, designation: e.target.value })}
                  placeholder="Enter designation"
                />
              </div>

              {cardType === 'id' ? (
                <>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input 
                      value={cardData.employeeId}
                      onChange={(e) => setCardData({ ...cardData, employeeId: e.target.value })}
                      placeholder="e.g., EMP-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input 
                      value={cardData.department}
                      onChange={(e) => setCardData({ ...cardData, department: e.target.value })}
                      placeholder="Enter department"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input 
                    type="date"
                    value={cardData.validUntil}
                    onChange={(e) => setCardData({ ...cardData, validUntil: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center">
              <h3 className="text-sm font-medium mb-4">Preview</h3>
              <div className="flex justify-center">
                {renderIDCardTemplate(selectedTemplate)}
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
