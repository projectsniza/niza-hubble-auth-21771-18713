import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Download, Trash2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { DailySalesTotals } from '@/lib/dailySalesParser';
import { normalizeCoopParsedTotals } from '@/lib/coopFuelParser';

interface Row {
  id: string;
  sale_date: string;
  source_filename: string;
  parsed_totals: DailySalesTotals;
  raw_text: string | null;
  branch?: { name: string } | null;
  organization?: { name: string } | null;
  storage_path: string | null;
  notes: string | null;
}

export default function DailySalesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<DailySalesTotals>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('daily_sales_uploads')
      .select('id, sale_date, source_filename, parsed_totals, raw_text, storage_path, notes, branch:branches(name), organization:organizations(name)')
      .order('sale_date', { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data as any) || []).map((r: Row) => ({ ...r, parsed_totals: normalizeCoopParsedTotals(r.parsed_totals, r.raw_text, null, (r as any).branch?.name) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (r: Row) => {
    setEditing(r.id);
    setEdit({ shop: r.parsed_totals?.shop ?? 0, fuel: r.parsed_totals?.fuel ?? 0, lottery: r.parsed_totals?.lottery ?? 0 });
  };

  const saveEdit = async (r: Row) => {
    const next = { ...(r.parsed_totals || {}), ...edit };
    const { error } = await supabase.from('daily_sales_uploads').update({ parsed_totals: next }).eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success('Updated');
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this upload?')) return;
    const { error } = await supabase.from('daily_sales_uploads').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const downloadOriginal = async (path: string | null) => {
    if (!path) return toast.error('No file');
    const { data, error } = await supabase.storage.from('daily-sales').createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Daily Sales Uploads</h1>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Shop</TableHead>
              <TableHead className="text-right">Fuel</TableHead>
              <TableHead className="text-right">Lottery</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No uploads yet</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.sale_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{r.branch?.name || '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={r.source_filename}>{r.source_filename}</TableCell>
                {(['shop','fuel','lottery'] as const).map(k => (
                  <TableCell key={k} className="text-right">
                    {editing === r.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-24 ml-auto"
                        value={(edit as any)[k] ?? 0}
                        onChange={(e) => setEdit(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))}
                      />
                    ) : (
                      `£${Number(r.parsed_totals?.[k] || 0).toFixed(2)}`
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right space-x-1">
                  {editing === r.id ? (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => saveEdit(r)}><Save className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(r)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => downloadOriginal(r.storage_path)} title="Download original"><Download className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
