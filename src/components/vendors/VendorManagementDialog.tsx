import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Edit2, Save, X, Store, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Vendor {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  branch_id: string;
  organization_id: string | null;
}

interface VendorManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  organizationId: string | null;
  branchName?: string;
  onChanged?: () => void;
}

export default function VendorManagementDialog({
  open,
  onOpenChange,
  branchId,
  organizationId,
  branchName,
  onChanged,
}: VendorManagementDialogProps) {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
  });

  const resetForm = () => {
    setForm({ name: '', contact_email: '', contact_phone: '', notes: '' });
    setEditingId(null);
  };

  const fetchVendors = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('branch_id', branchId)
      .order('name');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setVendors((data as any) || []);
    }
    setLoading(false);
  }, [branchId, toast]);

  useEffect(() => {
    if (open) {
      fetchVendors();
      resetForm();
    }
  }, [open, fetchVendors]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Vendor name is required', variant: 'destructive' });
      return;
    }
    if (!branchId) {
      toast({ title: 'Branch required', description: 'Select a branch first', variant: 'destructive' });
      return;
    }

    const payload = {
      name: form.name.trim(),
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
      branch_id: branchId,
      organization_id: organizationId,
    };

    let error;
    if (editingId) {
      const res = await supabase.from('vendors').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await supabase.from('vendors').insert({ ...payload, created_by: user?.id });
      error = res.error;
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'Vendor updated' : 'Vendor added' });
    resetForm();
    fetchVendors();
    onChanged?.();
  };

  const handleEdit = (v: Vendor) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      contact_email: v.contact_email || '',
      contact_phone: v.contact_phone || '',
      notes: v.notes || '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor? Existing invoice tags will remain.')) return;
    const { error } = await supabase.from('vendors').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Vendor deleted' });
    fetchVendors();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Manage Vendors
          </DialogTitle>
          <DialogDescription>
            {branchName ? `Vendors for ${branchName}` : 'Manage vendors for this branch'}
          </DialogDescription>
        </DialogHeader>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vendor Name *</Label>
              <Input
                placeholder="e.g. ABC Wholesale Ltd"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input
                type="email"
                placeholder="vendor@example.co.uk"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input
                placeholder="+44..."
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Notes</Label>
              <Input
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {editingId && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
            <Button size="sm" onClick={handleSave}>
              {editingId ? <><Save className="h-4 w-4 mr-1" /> Update</> : <><Plus className="h-4 w-4 mr-1" /> Add Vendor</>}
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Existing Vendors ({vendors.length})
          </h4>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No vendors added yet.</p>
          ) : (
            <div className="space-y-2">
              {vendors.map((v) => (
                <Card key={v.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{v.name}</span>
                      {!v.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      {v.contact_email && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{v.contact_email}</span>
                      )}
                      {v.contact_phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.contact_phone}</span>
                      )}
                    </div>
                    {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
