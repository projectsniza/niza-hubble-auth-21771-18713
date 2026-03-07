import { useState, useRef } from 'react';
import { Download, Settings, Plus, Save, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrandSettings } from '@/hooks/useTemplates';
import { captureElementToCanvas } from '@/lib/captureElementToCanvas';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

interface LetterheadConfig {
  name: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registrationNumber: string;
  vatNumber: string;
  branchName: string;
  tagline: string;
  footerText: string;
  footerNote: string;
}

const defaultConfig: LetterheadConfig = {
  name: '',
  companyName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  registrationNumber: '',
  vatNumber: '',
  branchName: '',
  tagline: '',
  footerText: '',
  footerNote: '',
};

const templateStyles = [
  { id: 1, name: 'Niza Classic', accent: '#0066B3' },
  { id: 2, name: 'Deep Navy', accent: '#004C8C' },
  { id: 3, name: 'Sky Blue', accent: '#00A3E0' },
  { id: 4, name: 'Corporate Slate', accent: '#1B3A5C' },
  { id: 5, name: 'Executive Blue', accent: '#2C5F8A' },
];

const STORAGE_KEY = 'niza_letterhead_configs';

function loadSavedConfigs(): { name: string; config: LetterheadConfig; templateId: number; content: string }[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveConfigs(configs: any[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export default function Letterhead() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [config, setConfig] = useState<LetterheadConfig>(defaultConfig);
  const [bodyContent, setBodyContent] = useState('');
  const [savedConfigs, setSavedConfigs] = useState(loadSavedConfigs);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const { brandSettings } = useBrandSettings();
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  const logoUrl = brandSettings?.primary_logo_path || nizaLogo;
  const currentStyle = templateStyles.find(t => t.id === selectedTemplate) || templateStyles[0];

  const handleSaveConfig = () => {
    let name = config.name;
    if (!name) {
      name = prompt('Enter a name for this letterhead configuration:');
      if (!name) return;
      setConfig({ ...config, name });
    }
    const updated = [...savedConfigs.filter(c => c.name !== name), { name, config: { ...config, name }, templateId: selectedTemplate, content: bodyContent }];
    saveConfigs(updated);
    setSavedConfigs(updated);
    toast({ title: `Letterhead "${name}" saved successfully` });
  };

  const handleLoadConfig = (saved: any) => {
    setConfig(saved.config);
    setSelectedTemplate(saved.templateId);
    setBodyContent(saved.content || '');
    setLoadDialogOpen(false);
    setDialogOpen(true);
    toast({ title: `Loaded "${saved.name}"` });
  };

  const handleDeleteConfig = (name: string) => {
    const updated = savedConfigs.filter(c => c.name !== name);
    saveConfigs(updated);
    setSavedConfigs(updated);
    toast({ title: 'Letterhead deleted' });
  };

  const handleDownload = async (format: 'png' | 'pdf') => {
    if (!previewRef.current) return;
    const canvas = await captureElementToCanvas(previewRef.current, { scale: 2, backgroundColor: '#ffffff' });
    if (format === 'pdf') {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`letterhead-${config.name || 'template'}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `letterhead-${config.name || 'template'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    }
  };

  const renderLetterheadPreview = () => {
    const accent = currentStyle.accent;
    return (
      <div ref={previewRef} className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: '600px', minHeight: '850px', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="relative">
          <div className="h-3" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />
          <div className="px-8 py-5 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Logo" className="h-14 object-contain" crossOrigin="anonymous" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{config.companyName || 'Company Name'}</h1>
                {config.tagline && <p className="text-xs italic text-gray-500 mt-0.5">{config.tagline}</p>}
                {config.branchName && <p className="text-xs font-medium mt-1" style={{ color: accent }}>{config.branchName}</p>}
              </div>
            </div>
            <div className="text-right text-xs text-gray-600 space-y-0.5">
              {(config.address || 'Company Address').split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p>{config.phone || '+44 000 000 0000'}</p>
              <p>{config.email || 'info@company.com'}</p>
              {config.website && <p>{config.website}</p>}
            </div>
          </div>
          <div className="h-px mx-8" style={{ backgroundColor: `${accent}30` }} />
        </div>

        {/* Body */}
        <div className="flex-1 px-8 py-6">
          {bodyContent ? (
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{bodyContent}</div>
          ) : (
            <div className="text-sm text-gray-400 italic">Type your letter content here...</div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto">
          <div className="h-px mx-8" style={{ backgroundColor: `${accent}30` }} />
          <div className="px-8 py-4 flex justify-between items-end text-xs text-gray-500">
            <div>
              {config.footerText && <p>{config.footerText}</p>}
              {config.registrationNumber && <p>Reg No: {config.registrationNumber}</p>}
              {config.vatNumber && <p>VAT: {config.vatNumber}</p>}
            </div>
            <div className="text-right">
              {config.footerNote && <p className="italic">{config.footerNote}</p>}
              <div className="flex items-center gap-1 mt-1 justify-end">
                <img src={nizaLogo} alt="Niza" className="h-4 object-contain opacity-40" />
              </div>
            </div>
          </div>
          <div className="h-2" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Letterhead Templates</h1>
          <p className="text-muted-foreground mt-1">Create branded letterheads with dynamic content</p>
        </div>
        <div className="flex gap-2">
          {savedConfigs.length > 0 && (
            <Button variant="outline" onClick={() => setLoadDialogOpen(true)} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Saved ({savedConfigs.length})
            </Button>
          )}
          <Button onClick={() => { setConfig(defaultConfig); setBodyContent(''); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Letterhead
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-5">
        {templateStyles.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all ${selectedTemplate === template.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
            onClick={() => { setSelectedTemplate(template.id); setDialogOpen(true); }}
          >
            <CardContent className="p-4 text-center">
              <div className="w-full h-3 rounded-full mb-3" style={{ backgroundColor: template.accent }} />
              <p className="text-sm font-medium">{template.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Card */}
      <Card>
        <CardHeader><CardTitle>Letterhead Preview</CardTitle></CardHeader>
        <CardContent className="flex justify-center overflow-x-auto py-6 bg-gray-100">
          <div className="transform scale-[0.65] origin-top">{renderLetterheadPreview()}</div>
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Configure Letterhead</DialogTitle></DialogHeader>
          <div className="grid lg:grid-cols-2 gap-6 py-4">
            <div>
              <Tabs defaultValue="header" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="header">Header</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="footer">Footer</TabsTrigger>
                </TabsList>

                <TabsContent value="header" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Letterhead Name</Label>
                    <Input value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} placeholder="e.g. Main Office Letterhead" />
                  </div>
                  <div className="space-y-2">
                    <Label>Template Style</Label>
                    <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {templateStyles.map((t) => (<SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input value={config.companyName} onChange={(e) => setConfig({ ...config, companyName: e.target.value })} placeholder="Your Company Ltd" />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch Name</Label>
                      <Input value={config.branchName} onChange={(e) => setConfig({ ...config, branchName: e.target.value })} placeholder="Head Office" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea value={config.address} onChange={(e) => setConfig({ ...config, address: e.target.value })} placeholder={"123 Business Street\nCity, Postcode"} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tagline</Label>
                    <Input value={config.tagline} onChange={(e) => setConfig({ ...config, tagline: e.target.value })} placeholder="Your trusted business partner" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={config.phone} onChange={(e) => setConfig({ ...config, phone: e.target.value })} placeholder="+44 123 456 7890" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} placeholder="info@company.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={config.website} onChange={(e) => setConfig({ ...config, website: e.target.value })} placeholder="www.company.com" />
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Letter Content</Label>
                    <Textarea
                      value={bodyContent}
                      onChange={(e) => setBodyContent(e.target.value)}
                      placeholder={"Dear Sir/Madam,\n\nI am writing to...\n\nYours faithfully,\nName"}
                      rows={16}
                      className="font-serif"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="footer" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Registration Number</Label>
                      <Input value={config.registrationNumber} onChange={(e) => setConfig({ ...config, registrationNumber: e.target.value })} placeholder="12345678" />
                    </div>
                    <div className="space-y-2">
                      <Label>VAT Number</Label>
                      <Input value={config.vatNumber} onChange={(e) => setConfig({ ...config, vatNumber: e.target.value })} placeholder="GB123456789" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Footer Text</Label>
                    <Input value={config.footerText} onChange={(e) => setConfig({ ...config, footerText: e.target.value })} placeholder="Registered in England & Wales" />
                  </div>
                  <div className="space-y-2">
                    <Label>Footer Note</Label>
                    <Input value={config.footerNote} onChange={(e) => setConfig({ ...config, footerNote: e.target.value })} placeholder="Confidential" />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="overflow-x-auto bg-gray-100 rounded-lg p-4">
              <div className="transform scale-[0.5] origin-top-left">{renderLetterheadPreview()}</div>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleSaveConfig} className="gap-2"><Save className="h-4 w-4" />Save Config</Button>
            <Button variant="outline" onClick={() => handleDownload('png')} className="gap-2"><Download className="h-4 w-4" />PNG</Button>
            <Button onClick={() => handleDownload('pdf')} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Saved Letterheads</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {savedConfigs.map((saved) => (
              <div key={saved.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleLoadConfig(saved)}>
                <div>
                  <p className="font-medium text-sm">{saved.name}</p>
                  <p className="text-xs text-muted-foreground">{saved.config.companyName || 'No company set'}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteConfig(saved.name); }}>Delete</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
