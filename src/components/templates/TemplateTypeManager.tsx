import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Settings, Pencil, Check, X } from 'lucide-react';
import { useTemplateTypes, createTemplateType, deleteTemplateType, updateTemplateType } from '@/hooks/useTemplateTypes';
import { toast } from 'sonner';

interface Props {
  triggerLabel?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export default function TemplateTypeManager({ triggerLabel = 'Configure Types', variant = 'outline' }: Props) {
  const [open, setOpen] = useState(false);
  const { types, refetch } = useTemplateTypes(true);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    try {
      await createTemplateType(newLabel);
      setNewLabel('');
      await refetch();
      toast.success('Type added');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add type');
    }
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    try { await updateTemplateType(id, { is_active }); await refetch(); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleSaveLabel = async (id: string) => {
    try { await updateTemplateType(id, { label: editLabel.trim() }); setEditingId(null); await refetch(); toast.success('Updated'); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template type? Existing templates will keep their type tag.')) return;
    try { await deleteTemplateType(id); await refetch(); toast.success('Deleted'); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          <Settings className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Template Types</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New type name (e.g. Poster)" />
            <Button onClick={handleAdd} disabled={!newLabel.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {types.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-md border">
                {editingId === t.id ? (
                  <>
                    <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="flex-1" />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveLabel(t.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.value}</p>
                    </div>
                    <Switch checked={t.is_active} onCheckedChange={(v) => handleToggle(t.id, v)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(t.id); setEditLabel(t.label); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
