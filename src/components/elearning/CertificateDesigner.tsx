import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, Trash2, Eye, Palette, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CertificatePreview from './CertificatePreview';

interface CertificateDesignerProps {
  designs: any[];
  onRefresh: () => void;
}

const BORDER_STYLES = [
  { value: 'classic', label: 'Classic Double Border' },
  { value: 'modern', label: 'Modern Bars' },
  { value: 'elegant', label: 'Elegant Gradient' },
  { value: 'gold', label: 'Gold Shimmer' },
  { value: 'minimal', label: 'Minimal' },
];

const FONT_OPTIONS = [
  { value: 'serif', label: 'Serif (Georgia)' },
  { value: 'sans-serif', label: 'Sans-Serif (Arial)' },
];

const defaultDesign = {
  name: 'New Design',
  border_style: 'classic',
  border_color: '#0066B3',
  accent_color: '#00A3E0',
  background_color: '#FFFFFF',
  text_color: '#1a1a1a',
  font_family: 'serif',
  show_logo: true,
  show_signature: true,
  signature_name: 'Training Director',
  signature_title: 'Niza Group',
  custom_footer_text: 'This certificate verifies the successful completion of the above-mentioned course.',
  is_default: false,
};

export default function CertificateDesigner({ designs, onRefresh }: CertificateDesignerProps) {
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { id, created_at, updated_at, created_by, organization_id, ...data } = editing;

      if (id) {
        await supabase.from('certificate_designs').update(data).eq('id', id);
        toast.success('Design updated');
      } else {
        await supabase.from('certificate_designs').insert(data);
        toast.success('Design created');
      }
      setEditing(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to save design');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this certificate design?')) return;
    await supabase.from('certificate_designs').delete().eq('id', id);
    toast.success('Design deleted');
    onRefresh();
  };

  const handleSetDefault = async (id: string) => {
    // Remove default from all, then set this one
    await supabase.from('certificate_designs').update({ is_default: false }).neq('id', 'none');
    await supabase.from('certificate_designs').update({ is_default: true }).eq('id', id);
    toast.success('Default design updated');
    onRefresh();
  };

  const sampleCert = {
    certificate_number: 'CERT-2026-SAMPLE',
    employee_name: 'John Smith',
    course_title: 'Workplace Health & Safety in Retail',
    issued_at: new Date().toISOString(),
    verification_token: '00000000-0000-0000-0000-000000000000',
    courses: { title: 'Workplace Health & Safety in Retail' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Certificate Designs</h2>
        <Button onClick={() => setEditing({ ...defaultDesign })} className="gap-2">
          <Plus className="h-4 w-4" /> New Design
        </Button>
      </div>

      {/* Design List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {designs.map(design => (
          <Card key={design.id} className={`border-primary/20 ${design.is_default ? 'ring-2 ring-primary' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">{design.name}</h3>
                {design.is_default && (
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                )}
              </div>

              {/* Color preview swatches */}
              <div className="flex gap-2 mb-3">
                <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: design.border_color }} title="Border" />
                <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: design.accent_color }} title="Accent" />
                <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: design.background_color }} title="Background" />
                <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: design.text_color }} title="Text" />
              </div>

              <p className="text-xs text-muted-foreground mb-1">
                Style: {BORDER_STYLES.find(b => b.value === design.border_style)?.label}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Font: {design.font_family === 'serif' ? 'Serif' : 'Sans-Serif'}
              </p>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing({ ...design })}>
                  <Palette className="h-3 w-3 mr-1" /> Edit
                </Button>
                {!design.is_default && (
                  <Button variant="outline" size="sm" onClick={() => handleSetDefault(design.id)}>
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                {!design.is_default && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(design.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Design' : 'Create New Design'}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Design Name</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Border Style</Label>
                  <Select value={editing.border_style} onValueChange={v => setEditing({ ...editing, border_style: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BORDER_STYLES.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Font</Label>
                  <Select value={editing.font_family} onValueChange={v => setEditing({ ...editing, font_family: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Border Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editing.border_color} onChange={e => setEditing({ ...editing, border_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={editing.border_color} onChange={e => setEditing({ ...editing, border_color: e.target.value })} className="flex-1 font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editing.accent_color} onChange={e => setEditing({ ...editing, accent_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={editing.accent_color} onChange={e => setEditing({ ...editing, accent_color: e.target.value })} className="flex-1 font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label>Background</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editing.background_color} onChange={e => setEditing({ ...editing, background_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={editing.background_color} onChange={e => setEditing({ ...editing, background_color: e.target.value })} className="flex-1 font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editing.text_color} onChange={e => setEditing({ ...editing, text_color: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={editing.text_color} onChange={e => setEditing({ ...editing, text_color: e.target.value })} className="flex-1 font-mono text-xs" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Show Logo</Label>
                  <Switch checked={editing.show_logo} onCheckedChange={v => setEditing({ ...editing, show_logo: v })} />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <Label>Show Signature</Label>
                  <Switch checked={editing.show_signature} onCheckedChange={v => setEditing({ ...editing, show_signature: v })} />
                </div>
              </div>

              {editing.show_signature && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Signature Name</Label>
                    <Input value={editing.signature_name || ''} onChange={e => setEditing({ ...editing, signature_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Signature Title</Label>
                    <Input value={editing.signature_title || ''} onChange={e => setEditing({ ...editing, signature_title: e.target.value })} />
                  </div>
                </div>
              )}

              <div>
                <Label>Footer Text</Label>
                <Textarea
                  value={editing.custom_footer_text || ''}
                  onChange={e => setEditing({ ...editing, custom_footer_text: e.target.value })}
                  rows={2}
                />
              </div>

              {/* Live Preview */}
              <div>
                <Label className="mb-2 block">Live Preview</Label>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <CertificatePreview
                    certificate={sampleCert}
                    design={editing}
                    onClose={() => {}}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Design'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
