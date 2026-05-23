import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Library, Plus, Trash2, Search, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

interface Mapping {
  id: string; branch_id: string | null; till_category: string; xero_account_code: string;
  xero_account_name: string | null; tax_rate: string | null; notes: string | null;
}

const blank = { till_category: '', xero_account_code: '', xero_account_name: '', tax_rate: '20%', notes: '' };

export default function CategoryMappings() {
  const [rows, setRows] = useState<Mapping[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(blank);

  const load = async () => {
    const [{ data }, { data: b }] = await Promise.all([
      supabase.from('niza_category_mappings').select('*').order('till_category'),
      supabase.from('branches').select('id, name').order('name'),
    ]);
    setRows((data as any) || []);
    setBranches((b as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r =>
    (branchId === 'all' || r.branch_id === branchId || (branchId === 'global' && !r.branch_id)) &&
    (!q || r.till_category.toLowerCase().includes(q.toLowerCase()) || r.xero_account_code.toLowerCase().includes(q.toLowerCase()))
  ), [rows, branchId, q]);

  const save = async () => {
    if (!editing.till_category || !editing.xero_account_code) return toast.error('Till category and Xero code required');
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      ...editing,
      branch_id: editing.branch_id === 'global' ? null : editing.branch_id,
      created_by: u.user?.id,
    };
    delete (payload as any).created_at;
    delete (payload as any).updated_at;
    const { error } = editing.id
      ? await supabase.from('niza_category_mappings').update(payload).eq('id', editing.id)
      : await supabase.from('niza_category_mappings').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Saved');
    setOpen(false); setEditing(blank); load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this mapping?')) return;
    await supabase.from('niza_category_mappings').delete().eq('id', id);
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-[1500px] mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Library className="h-6 w-6" /></span>
            Category Mapping Library
          </h1>
          <Button onClick={() => { setEditing(blank); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New mapping</Button>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder="Till category or Xero code…" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Scope</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="global">Global (no branch)</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end text-sm text-muted-foreground">
              {filtered.length} of {rows.length} mappings
            </div>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Till Category</TableHead>
                <TableHead>Xero Account</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No mappings.</TableCell></TableRow>
                : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.till_category}</TableCell>
                    <TableCell><span className="font-mono">{r.xero_account_code}</span> {r.xero_account_name && <span className="text-xs text-muted-foreground">· {r.xero_account_name}</span>}</TableCell>
                    <TableCell>{r.tax_rate || '—'}</TableCell>
                    <TableCell>{branches.find(b => b.id === r.branch_id)?.name || (r.branch_id ? '—' : 'Global')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.notes || ''}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...r, branch_id: r.branch_id || 'global' }); setOpen(true); }}><Edit3 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Edit mapping' : 'New mapping'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Till category</Label><Input value={editing.till_category} onChange={e => setEditing({ ...editing, till_category: e.target.value })} placeholder="e.g. BAKERY" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Xero account code</Label><Input value={editing.xero_account_code} onChange={e => setEditing({ ...editing, xero_account_code: e.target.value })} placeholder="200" /></div>
                <div><Label>Account name</Label><Input value={editing.xero_account_name || ''} onChange={e => setEditing({ ...editing, xero_account_name: e.target.value })} placeholder="Sales – Bakery" /></div>
                <div><Label>Tax rate</Label><Input value={editing.tax_rate || ''} onChange={e => setEditing({ ...editing, tax_rate: e.target.value })} placeholder="20%" /></div>
                <div>
                  <Label>Branch</Label>
                  <Select value={editing.branch_id || 'global'} onValueChange={v => setEditing({ ...editing, branch_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (all branches)</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notes</Label><Input value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
