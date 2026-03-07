import { useState, useRef } from 'react';
import { Download, Settings, Plus, Trash2, Save, FolderOpen } from 'lucide-react';
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

interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

interface InvoiceSettings {
  configName: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registrationNumber: string;
  vatNumber: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  paymentTerms: string;
  footerNote: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerAddress: string;
  vatRate: number;
  branchName: string;
}

const defaultSettings: InvoiceSettings = {
  configName: '',
  companyName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  registrationNumber: '',
  vatNumber: '',
  bankName: '',
  accountNumber: '',
  sortCode: '',
  paymentTerms: 'Payment due within 30 days',
  footerNote: 'Thank you for your business',
  invoiceNumber: 'INV-0001',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
  customerName: '',
  customerAddress: '',
  vatRate: 20,
  branchName: '',
};

const defaultItems: InvoiceItem[] = [
  { description: 'Product or Service', quantity: 1, price: 100 },
];

const templateStyles = [
  { id: 1, name: 'Niza Professional', accent: '#0066B3' },
  { id: 2, name: 'Deep Navy', accent: '#004C8C' },
  { id: 3, name: 'Sky Blue', accent: '#00A3E0' },
  { id: 4, name: 'Corporate Slate', accent: '#1B3A5C' },
  { id: 5, name: 'Executive Blue', accent: '#2C5F8A' },
];

const INV_STORAGE_KEY = 'niza_invoice_configs';

function loadSavedConfigs(): { name: string; settings: InvoiceSettings; items: InvoiceItem[]; templateId: number }[] {
  try { return JSON.parse(localStorage.getItem(INV_STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveConfigs(configs: any[]) { localStorage.setItem(INV_STORAGE_KEY, JSON.stringify(configs)); }

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings);
  const [items, setItems] = useState<InvoiceItem[]>(defaultItems);
  const [savedConfigs, setSavedConfigs] = useState(loadSavedConfigs);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const { brandSettings } = useBrandSettings();
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  const logoUrl = brandSettings?.primary_logo_path || nizaLogo;
  const currentStyle = templateStyles.find(t => t.id === selectedTemplate) || templateStyles[0];

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const vatAmount = subtotal * (settings.vatRate / 100);
  const total = subtotal + vatAmount;

  const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSaveConfig = () => {
    let name = settings.configName;
    if (!name) {
      name = prompt('Enter a name for this invoice configuration:');
      if (!name) return;
      setSettings({ ...settings, configName: name });
    }
    const updated = [...savedConfigs.filter(c => c.name !== name), { name, settings: { ...settings, configName: name }, items, templateId: selectedTemplate }];
    saveConfigs(updated);
    setSavedConfigs(updated);
    toast({ title: `Invoice config "${name}" saved successfully` });
  };

  const handleLoadConfig = (saved: any) => {
    setSettings(saved.settings);
    setItems(saved.items);
    setSelectedTemplate(saved.templateId);
    setLoadDialogOpen(false);
    setDialogOpen(true);
    toast({ title: `Loaded "${saved.name}"` });
  };

  const handleDeleteConfig = (name: string) => {
    const updated = savedConfigs.filter(c => c.name !== name);
    saveConfigs(updated);
    setSavedConfigs(updated);
    toast({ title: 'Config deleted' });
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
      pdf.save(`invoice-${settings.invoiceNumber}.pdf`);
    } else {
      const link = document.createElement('a');
      link.download = `invoice-${settings.invoiceNumber}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    }
  };

  const renderInvoicePreview = () => {
    const accent = currentStyle.accent;
    return (
      <div ref={previewRef} className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: '600px', minHeight: '800px', display: 'flex', flexDirection: 'column' }}>
        {/* Header with Niza branding */}
        <div className="relative">
          <div className="h-3" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src={logoUrl} alt="Logo" className="h-14 object-contain" crossOrigin="anonymous" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{settings.companyName || 'Your Company Name'}</h1>
                  {settings.branchName && <p className="text-xs font-medium mt-0.5" style={{ color: accent }}>{settings.branchName}</p>}
                  <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{settings.address || '123 Business Street\nCity, Country'}</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>{settings.phone || '+44 123 456 7890'}</p>
                <p>{settings.email || 'info@company.com'}</p>
                <p>{settings.website || 'www.company.com'}</p>
                {settings.registrationNumber && <p className="mt-2 text-gray-500">Reg: {settings.registrationNumber}</p>}
                {settings.vatNumber && <p className="text-gray-500">VAT: {settings.vatNumber}</p>}
              </div>
            </div>
          </div>
          <div className="h-px mx-6" style={{ backgroundColor: `${accent}30` }} />
        </div>

        {/* Invoice Title */}
        <div className="px-6 py-4 flex justify-between items-center" style={{ backgroundColor: `${accent}08` }}>
          <h2 className="text-2xl font-bold" style={{ color: accent }}>INVOICE</h2>
          <div className="text-right text-sm">
            <p><span className="font-medium text-gray-700">Invoice #:</span> {settings.invoiceNumber}</p>
            <p><span className="font-medium text-gray-700">Date:</span> {settings.invoiceDate}</p>
            <p><span className="font-medium text-gray-700">Due:</span> {settings.dueDate}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
          <p className="font-medium text-gray-900">{settings.customerName || 'Customer Name'}</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{settings.customerAddress || 'Customer Address'}</p>
        </div>

        {/* Items Table */}
        <div className="px-6 py-4 flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `2px solid ${accent}` }}>
                <th className="py-2 text-left font-semibold text-gray-700">Description</th>
                <th className="py-2 text-center font-semibold text-gray-700 w-20">Qty</th>
                <th className="py-2 text-right font-semibold text-gray-700 w-24">Price</th>
                <th className="py-2 text-right font-semibold text-gray-700 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-3 text-gray-800">{item.description || 'Item description'}</td>
                  <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-600">£{item.price.toFixed(2)}</td>
                  <td className="py-3 text-right text-gray-800">£{(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-6">
            <div className="w-56 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span>£{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-600"><span>VAT ({settings.vatRate}%):</span><span>£{vatAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t-2" style={{ borderColor: accent }}>
                <span>Total:</span><span style={{ color: accent }}>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto">
          <div className="bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Payment Details</h4>
                <p className="text-gray-600">Bank: {settings.bankName || 'Bank Name'}</p>
                <p className="text-gray-600">Account: {settings.accountNumber || '12345678'}</p>
                <p className="text-gray-600">Sort Code: {settings.sortCode || '12-34-56'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Payment Terms</h4>
                <p className="text-gray-600">{settings.paymentTerms}</p>
              </div>
            </div>
            {settings.footerNote && (
              <p className="text-center text-gray-500 text-sm mt-4 pt-4 border-t border-gray-200">{settings.footerNote}</p>
            )}
            <div className="flex justify-end mt-2">
              <img src={nizaLogo} alt="Niza" className="h-4 object-contain opacity-30" />
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
          <h1 className="text-3xl font-bold">Invoice Templates</h1>
          <p className="text-muted-foreground mt-1">Create and customize professional invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLoadDialogOpen(true)} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Saved Configs{savedConfigs.length > 0 ? ` (${savedConfigs.length})` : ''}
          </Button>
          <Button onClick={() => { setSettings(defaultSettings); setItems(defaultItems); setDialogOpen(true); }} className="gap-2">
            <Settings className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-5">
        {templateStyles.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all ${selectedTemplate === template.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
            onClick={() => setSelectedTemplate(template.id)}
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
        <CardHeader><CardTitle>Invoice Preview</CardTitle></CardHeader>
        <CardContent className="flex justify-center overflow-x-auto py-6 bg-gray-100">
          <div className="transform scale-[0.7] origin-top">{renderInvoicePreview()}</div>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Configure Invoice</DialogTitle></DialogHeader>
          <div className="grid lg:grid-cols-2 gap-6 py-4">
            <div>
              <Tabs defaultValue="header" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="header">Header</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="footer">Footer</TabsTrigger>
                </TabsList>

                <TabsContent value="header" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Config Name (for saving)</Label>
                    <Input value={settings.configName} onChange={(e) => setSettings({ ...settings, configName: e.target.value })} placeholder="e.g. Main Office Invoice" />
                  </div>
                  <div className="space-y-2">
                    <Label>Template Style</Label>
                    <Select value={selectedTemplate.toString()} onValueChange={(v) => setSelectedTemplate(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{templateStyles.map((t) => (<SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} placeholder="Your Company Ltd" />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch Name</Label>
                      <Input value={settings.branchName} onChange={(e) => setSettings({ ...settings, branchName: e.target.value })} placeholder="Head Office" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder={"123 Business Street\nCity, Postcode"} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Phone</Label><Input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="+44 123 456 7890" /></div>
                    <div className="space-y-2"><Label>Email</Label><Input value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} placeholder="info@company.com" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Website</Label><Input value={settings.website} onChange={(e) => setSettings({ ...settings, website: e.target.value })} placeholder="www.company.com" /></div>
                    <div className="space-y-2"><Label>Registration Number</Label><Input value={settings.registrationNumber} onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })} placeholder="12345678" /></div>
                  </div>
                  <div className="space-y-2"><Label>VAT Number</Label><Input value={settings.vatNumber} onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })} placeholder="GB123456789" /></div>
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Invoice Number</Label><Input value={settings.invoiceNumber} onChange={(e) => setSettings({ ...settings, invoiceNumber: e.target.value })} placeholder="INV-0001" /></div>
                    <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={settings.invoiceDate} onChange={(e) => setSettings({ ...settings, invoiceDate: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={settings.dueDate} onChange={(e) => setSettings({ ...settings, dueDate: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Customer Name</Label><Input value={settings.customerName} onChange={(e) => setSettings({ ...settings, customerName: e.target.value })} placeholder="Customer Name" /></div>
                  <div className="space-y-2"><Label>Customer Address</Label><Textarea value={settings.customerAddress} onChange={(e) => setSettings({ ...settings, customerAddress: e.target.value })} placeholder={"Customer Address\nCity, Postcode"} rows={2} /></div>
                  <div className="space-y-2"><Label>VAT Rate (%)</Label><Input type="number" value={settings.vatRate} onChange={(e) => setSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0 })} placeholder="20" /></div>
                </TabsContent>

                <TabsContent value="items" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1"><Label className="text-xs">Description</Label><Input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Item description" /></div>
                        <div className="w-20 space-y-1"><Label className="text-xs">Qty</Label><Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} /></div>
                        <div className="w-24 space-y-1"><Label className="text-xs">Price (£)</Label><Input type="number" value={item.price} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} /></div>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length <= 1}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" onClick={addItem} className="gap-2 w-full"><Plus className="h-4 w-4" />Add Item</Button>
                  <div className="pt-4 border-t space-y-2 text-sm">
                    <div className="flex justify-between"><span>Subtotal:</span><span>£{subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>VAT ({settings.vatRate}%):</span><span>£{vatAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span>Total:</span><span>£{total.toFixed(2)}</span></div>
                  </div>
                </TabsContent>

                <TabsContent value="footer" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Bank Name</Label><Input value={settings.bankName} onChange={(e) => setSettings({ ...settings, bankName: e.target.value })} placeholder="Your Bank" /></div>
                    <div className="space-y-2"><Label>Account Number</Label><Input value={settings.accountNumber} onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })} placeholder="12345678" /></div>
                    <div className="space-y-2"><Label>Sort Code</Label><Input value={settings.sortCode} onChange={(e) => setSettings({ ...settings, sortCode: e.target.value })} placeholder="12-34-56" /></div>
                  </div>
                  <div className="space-y-2"><Label>Payment Terms</Label><Input value={settings.paymentTerms} onChange={(e) => setSettings({ ...settings, paymentTerms: e.target.value })} placeholder="Payment due within 30 days" /></div>
                  <div className="space-y-2"><Label>Footer Note</Label><Input value={settings.footerNote} onChange={(e) => setSettings({ ...settings, footerNote: e.target.value })} placeholder="Thank you for your business" /></div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="overflow-x-auto bg-gray-100 rounded-lg p-4">
              <div className="transform scale-[0.55] origin-top-left">{renderInvoicePreview()}</div>
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
          <DialogHeader><DialogTitle>Saved Invoice Configs</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {savedConfigs.map((saved) => (
              <div key={saved.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleLoadConfig(saved)}>
                <div>
                  <p className="font-medium text-sm">{saved.name}</p>
                  <p className="text-xs text-muted-foreground">{saved.settings.companyName || 'No company set'}</p>
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
