import { useState, useRef } from 'react';
import { Plus, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface BusinessCardData {
  name: string;
  designation: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  organization: string;
  branch: string;
}

const defaultData: BusinessCardData = {
  name: '',
  designation: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  organization: '',
  branch: '',
};

export default function BusinessCards() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [cardData, setCardData] = useState<BusinessCardData>(defaultData);
  const { brandSettings } = useBrandSettings();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!cardRef.current) return;
    
    const canvas = await html2canvas(cardRef.current, { scale: 3 });
    
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
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
      link.click();
    }
  };

  const logoUrl = brandSettings?.primary_logo_path;

  const renderBusinessCard = (template: number) => {
    // Standard business card size ratio: 3.5 x 2 inches
    const cardStyles = 'w-[350px] h-[200px] rounded-lg shadow-lg overflow-hidden';

    if (template === 1) {
      return (
        <div ref={cardRef} className={`${cardStyles} bg-white relative`}>
          {/* Accent */}
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-600 to-blue-800" />
          
          <div className="h-full flex flex-col justify-between p-5 pl-6">
            {/* Top */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{cardData.name || 'Your Name'}</h2>
                <p className="text-sm text-blue-600 font-medium">{cardData.designation || 'Designation'}</p>
              </div>
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain" />}
            </div>
            
            {/* Bottom */}
            <div className="space-y-1 text-xs text-gray-600">
              {cardData.email && <p>✉️ {cardData.email}</p>}
              {cardData.phone && <p>📞 {cardData.phone}</p>}
              {cardData.website && <p>🌐 {cardData.website}</p>}
              <p className="text-gray-400 pt-1">
                {cardData.organization || 'Organization'} {cardData.branch && `• ${cardData.branch}`}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (template === 2) {
      return (
        <div ref={cardRef} className={`${cardStyles} bg-gradient-to-br from-gray-900 to-gray-800 text-white relative`}>
          {/* Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
          
          <div className="h-full flex flex-col justify-between p-5 relative z-10">
            {/* Logo */}
            <div className="flex justify-between items-start">
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain brightness-0 invert" />}
              <div className="text-right">
                <p className="text-xs text-gray-400">{cardData.organization || 'COMPANY'}</p>
                {cardData.branch && <p className="text-xs text-gray-500">{cardData.branch}</p>}
              </div>
            </div>
            
            {/* Center */}
            <div>
              <h2 className="text-2xl font-light">{cardData.name || 'Your Name'}</h2>
              <p className="text-blue-400 text-sm">{cardData.designation || 'Designation'}</p>
            </div>
            
            {/* Bottom */}
            <div className="flex gap-6 text-xs text-gray-400">
              {cardData.phone && <span>{cardData.phone}</span>}
              {cardData.email && <span>{cardData.email}</span>}
            </div>
          </div>
        </div>
      );
    }

    // Template 3 - Green Modern
    return (
      <div ref={cardRef} className={`${cardStyles} bg-white relative`}>
        {/* Corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-bl-full" />
        
        <div className="h-full flex flex-col justify-between p-5 relative z-10">
          {/* Top */}
          <div className="flex justify-between">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 object-contain" />}
          </div>
          
          {/* Middle */}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{cardData.name || 'Your Name'}</h2>
            <p className="text-green-600 text-sm font-medium">{cardData.designation || 'Designation'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {cardData.organization || 'Organization'} {cardData.branch && `| ${cardData.branch}`}
            </p>
          </div>
          
          {/* Bottom */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {cardData.phone && <span className="flex items-center gap-1">📱 {cardData.phone}</span>}
            {cardData.email && <span className="flex items-center gap-1">📧 {cardData.email}</span>}
            {cardData.website && <span className="flex items-center gap-1">🌍 {cardData.website}</span>}
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
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((template) => (
          <Card 
            key={template} 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => {
              setSelectedTemplate(template);
              setDialogOpen(true);
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {template === 1 && 'Corporate Blue'}
                {template === 2 && 'Dark Elegant'}
                {template === 3 && 'Modern Green'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <div className="transform scale-[0.6] origin-top">
                {renderBusinessCard(template)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Business Card</DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Corporate Blue</SelectItem>
                    <SelectItem value="2">Dark Elegant</SelectItem>
                    <SelectItem value="3">Modern Green</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={cardData.phone}
                  onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                  placeholder="+44 123 456 7890"
                />
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
            <div className="flex flex-col items-center">
              <h3 className="text-sm font-medium mb-4">Preview</h3>
              <div className="flex justify-center">
                {renderBusinessCard(selectedTemplate)}
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
