import { useState, useRef } from 'react';
import { Plus, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useBrandSettings } from '@/hooks/useTemplates';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceSettings {
  // Header
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registrationNumber: string;
  vatNumber: string;
  // Footer
  bankName: string;
  accountNumber: string;
  sortCode: string;
  paymentTerms: string;
  footerNote: string;
}

const defaultSettings: InvoiceSettings = {
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
  footerNote: 'Thank you for your business!',
};

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings);
  const { brandSettings } = useBrandSettings();
  const previewRef = useRef<HTMLDivElement>(null);

  const logoUrl = brandSettings?.primary_logo_path;

  const handleDownload = async (format: 'png' | 'pdf') => {
    if (!previewRef.current) return;
    
    const canvas = await html2canvas(previewRef.current, { scale: 2 });
    
    if (format === 'pdf') {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('invoice-template.pdf');
    } else {
      const link = document.createElement('a');
      link.download = 'invoice-template.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const renderInvoicePreview = () => (
    <div 
      ref={previewRef}
      className="bg-white shadow-lg rounded-lg overflow-hidden"
      style={{ width: '600px' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 mb-3 brightness-0 invert" />
            ) : (
              <div className="h-12 w-32 bg-white/20 rounded mb-3 flex items-center justify-center text-sm">
                Your Logo
              </div>
            )}
            <h1 className="text-xl font-bold">{settings.companyName || 'Your Company Name'}</h1>
            <p className="text-sm text-white/80 whitespace-pre-line">{settings.address || '123 Business Street\nCity, Country'}</p>
          </div>
          <div className="text-right text-sm">
            <p>{settings.phone || '+44 123 456 7890'}</p>
            <p>{settings.email || 'info@company.com'}</p>
            <p>{settings.website || 'www.company.com'}</p>
            {settings.registrationNumber && <p className="mt-2 text-white/70">Reg: {settings.registrationNumber}</p>}
            {settings.vatNumber && <p className="text-white/70">VAT: {settings.vatNumber}</p>}
          </div>
        </div>
      </div>

      {/* Invoice Title */}
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">INVOICE</h2>
        <div className="text-right text-sm text-gray-600">
          <p><span className="font-medium">Invoice #:</span> INV-0001</p>
          <p><span className="font-medium">Date:</span> {new Date().toLocaleDateString()}</p>
          <p><span className="font-medium">Due:</span> {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="px-6 py-4 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-500 mb-2">BILL TO</h3>
        <p className="font-medium text-gray-800">Customer Name</p>
        <p className="text-sm text-gray-600">Customer Address</p>
        <p className="text-sm text-gray-600">City, Country</p>
      </div>

      {/* Items Table */}
      <div className="px-6 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-medium text-gray-600">Description</th>
              <th className="py-2 text-center font-medium text-gray-600">Qty</th>
              <th className="py-2 text-right font-medium text-gray-600">Price</th>
              <th className="py-2 text-right font-medium text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3">Sample Product/Service</td>
              <td className="py-3 text-center">1</td>
              <td className="py-3 text-right">£100.00</td>
              <td className="py-3 text-right">£100.00</td>
            </tr>
            <tr className="border-b">
              <td className="py-3">Another Item</td>
              <td className="py-3 text-center">2</td>
              <td className="py-3 text-right">£50.00</td>
              <td className="py-3 text-right">£100.00</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-48 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span>£200.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">VAT (20%):</span>
              <span>£40.00</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span className="text-blue-600">£240.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 px-6 py-4 mt-4">
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Payment Details</h4>
            <p className="text-gray-600">Bank: {settings.bankName || 'Your Bank Name'}</p>
            <p className="text-gray-600">Account: {settings.accountNumber || '12345678'}</p>
            <p className="text-gray-600">Sort Code: {settings.sortCode || '12-34-56'}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Payment Terms</h4>
            <p className="text-gray-600">{settings.paymentTerms}</p>
          </div>
        </div>
        <p className="text-center text-gray-500 text-sm mt-4 pt-4 border-t border-gray-200">
          {settings.footerNote}
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoice Templates</h1>
          <p className="text-muted-foreground mt-1">Customize your invoice header, body, and footer</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" />
          Configure Invoice
        </Button>
      </div>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center overflow-x-auto py-6">
          <div className="transform scale-[0.8] origin-top">
            {renderInvoicePreview()}
          </div>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Invoice Template</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="header" className="py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="body">Body Settings</TabsTrigger>
              <TabsTrigger value="footer">Footer</TabsTrigger>
            </TabsList>

            <TabsContent value="header" className="space-y-4 mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input 
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    placeholder="Your Company Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="+44 123 456 7890"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea 
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="123 Business Street&#10;City, Postcode&#10;Country"
                  rows={3}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="info@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input 
                    value={settings.website}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    placeholder="www.company.com"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input 
                    value={settings.registrationNumber}
                    onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>VAT Number</Label>
                  <Input 
                    value={settings.vatNumber}
                    onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
                    placeholder="GB123456789"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="body" className="space-y-4 mt-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                  The invoice body structure is pre-designed with standard fields:
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
                  <li>Invoice number, date, and due date</li>
                  <li>Bill to section with customer details</li>
                  <li>Items table with description, quantity, price, and total</li>
                  <li>Subtotal, VAT, and grand total calculations</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  The actual invoice values are filled when generating invoices from the system.
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="footer" className="space-y-4 mt-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input 
                    value={settings.bankName}
                    onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                    placeholder="Your Bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input 
                    value={settings.accountNumber}
                    onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sort Code</Label>
                  <Input 
                    value={settings.sortCode}
                    onChange={(e) => setSettings({ ...settings, sortCode: e.target.value })}
                    placeholder="12-34-56"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input 
                  value={settings.paymentTerms}
                  onChange={(e) => setSettings({ ...settings, paymentTerms: e.target.value })}
                  placeholder="Payment due within 30 days"
                />
              </div>
              <div className="space-y-2">
                <Label>Footer Note</Label>
                <Input 
                  value={settings.footerNote}
                  onChange={(e) => setSettings({ ...settings, footerNote: e.target.value })}
                  placeholder="Thank you for your business!"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-4">Preview</h3>
            <div className="overflow-x-auto">
              <div className="transform scale-[0.5] origin-top-left">
                {renderInvoicePreview()}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDownload('png')} className="gap-2">
              <Download className="h-4 w-4" />
              PNG
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
