import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Template, TemplateFolder, TemplateType } from '@/hooks/useTemplates';
import { CreditCard, Mail, BadgeCheck, Users, Receipt, Gift, FileText } from 'lucide-react';

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Template>) => void;
  template: Template | null;
  folders: TemplateFolder[];
}

const templateTypes: { value: TemplateType; label: string; icon: any }[] = [
  { value: 'visiting_card', label: 'Visiting Card', icon: CreditCard },
  { value: 'email_signature', label: 'Email Signature', icon: Mail },
  { value: 'id_card', label: 'ID Card', icon: BadgeCheck },
  { value: 'visitor_pass', label: 'Visitor Pass', icon: Users },
  { value: 'invoice', label: 'Invoice', icon: Receipt },
  { value: 'gift_card', label: 'Gift Card', icon: Gift },
  { value: 'custom', label: 'Custom', icon: FileText },
];

export function TemplateEditorDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  template, 
  folders 
}: TemplateEditorDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template_type: 'visiting_card' as TemplateType,
    folder_id: '',
    content: {} as Record<string, any>,
  });
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        template_type: template.template_type,
        folder_id: template.folder_id || '',
        content: template.content || {},
      });
    } else {
      setFormData({
        name: '',
        description: '',
        template_type: 'visiting_card',
        folder_id: '',
        content: {},
      });
    }
    setActiveTab('details');
  }, [template, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      folder_id: formData.folder_id || null,
    });
  };

  const updateContent = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      content: { ...prev.content, [key]: value },
    }));
  };

  const renderContentEditor = () => {
    switch (formData.template_type) {
      case 'visiting_card':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Card Width (mm)</Label>
                <Input
                  type="number"
                  value={formData.content.width || 85}
                  onChange={(e) => updateContent('width', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Card Height (mm)</Label>
                <Input
                  type="number"
                  value={formData.content.height || 55}
                  onChange={(e) => updateContent('height', parseInt(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Background Color</Label>
              <Input
                type="color"
                value={formData.content.backgroundColor || '#ffffff'}
                onChange={(e) => updateContent('backgroundColor', e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Include Fields</Label>
              <div className="grid grid-cols-2 gap-2">
                {['Name', 'Job Title', 'Email', 'Phone', 'Company', 'Address', 'Website'].map((field) => (
                  <label key={field} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.content.fields?.includes(field) || false}
                      onChange={(e) => {
                        const fields = formData.content.fields || [];
                        if (e.target.checked) {
                          updateContent('fields', [...fields, field]);
                        } else {
                          updateContent('fields', fields.filter((f: string) => f !== field));
                        }
                      }}
                      className="rounded"
                    />
                    {field}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'email_signature':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signature Layout</Label>
              <Select
                value={formData.content.layout || 'horizontal'}
                onValueChange={(value) => updateContent('layout', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Include Social Links</Label>
              <div className="grid grid-cols-2 gap-2">
                {['LinkedIn', 'Twitter', 'Facebook', 'Instagram', 'Website'].map((social) => (
                  <label key={social} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.content.socialLinks?.includes(social) || false}
                      onChange={(e) => {
                        const socialLinks = formData.content.socialLinks || [];
                        if (e.target.checked) {
                          updateContent('socialLinks', [...socialLinks, social]);
                        } else {
                          updateContent('socialLinks', socialLinks.filter((s: string) => s !== social));
                        }
                      }}
                      className="rounded"
                    />
                    {social}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Banner Text</Label>
              <Input
                value={formData.content.bannerText || ''}
                onChange={(e) => updateContent('bannerText', e.target.value)}
                placeholder="e.g., Think before you print..."
              />
            </div>
          </div>
        );

      case 'id_card':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Card Orientation</Label>
              <Select
                value={formData.content.orientation || 'portrait'}
                onValueChange={(value) => updateContent('orientation', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Include Elements</Label>
              <div className="grid grid-cols-2 gap-2">
                {['Photo', 'QR Code', 'Barcode', 'Employee ID', 'Department', 'Blood Group', 'Emergency Contact'].map((element) => (
                  <label key={element} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.content.elements?.includes(element) || false}
                      onChange={(e) => {
                        const elements = formData.content.elements || [];
                        if (e.target.checked) {
                          updateContent('elements', [...elements, element]);
                        } else {
                          updateContent('elements', elements.filter((el: string) => el !== element));
                        }
                      }}
                      className="rounded"
                    />
                    {element}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'visitor_pass':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pass Type</Label>
              <Select
                value={formData.content.passType || 'daily'}
                onValueChange={(value) => updateContent('passType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Pass</SelectItem>
                  <SelectItem value="temporary">Temporary (Multi-Day)</SelectItem>
                  <SelectItem value="contractor">Contractor Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Include Fields</Label>
              <div className="grid grid-cols-2 gap-2">
                {['Visitor Name', 'Company', 'Host Name', 'Purpose', 'Valid Date', 'Valid Time', 'Photo', 'QR Code'].map((field) => (
                  <label key={field} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.content.visitorFields?.includes(field) || false}
                      onChange={(e) => {
                        const fields = formData.content.visitorFields || [];
                        if (e.target.checked) {
                          updateContent('visitorFields', [...fields, field]);
                        } else {
                          updateContent('visitorFields', fields.filter((f: string) => f !== field));
                        }
                      }}
                      className="rounded"
                    />
                    {field}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'invoice':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Header Text</Label>
              <Textarea
                value={formData.content.headerText || ''}
                onChange={(e) => updateContent('headerText', e.target.value)}
                placeholder="Invoice header content..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer Text</Label>
              <Textarea
                value={formData.content.footerText || ''}
                onChange={(e) => updateContent('footerText', e.target.value)}
                placeholder="Invoice footer content (terms, bank details, etc.)..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                {['Item Description', 'Quantity', 'Unit Price', 'Tax', 'Discount', 'Total'].map((col) => (
                  <label key={col} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.content.columns?.includes(col) || false}
                      onChange={(e) => {
                        const columns = formData.content.columns || [];
                        if (e.target.checked) {
                          updateContent('columns', [...columns, col]);
                        } else {
                          updateContent('columns', columns.filter((c: string) => c !== col));
                        }
                      }}
                      className="rounded"
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Custom Content (JSON)</Label>
              <Textarea
                value={JSON.stringify(formData.content, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setFormData(prev => ({ ...prev, content: parsed }));
                  } catch {}
                }}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create New Template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard Visiting Card"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this template..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Template Type *</Label>
                <Select
                  value={formData.template_type}
                  onValueChange={(value: TemplateType) => setFormData({ ...formData, template_type: value, content: {} })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Folder (Optional)</Label>
                <Select
                  value={formData.folder_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, folder_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Folder</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-4">
              {renderContentEditor()}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {template ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
