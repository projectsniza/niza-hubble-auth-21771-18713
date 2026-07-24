import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, Files } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface Row {
  id: string;
  sale_date: string;
  source_filename: string | null;
  source_format: string | null;
  storage_path: string | null;
  branch?: { id: string; name: string } | null;
  created_at: string;
}

const label = (f: string | null) => {
  const s = (f || '').toLowerCase();
  if (s === 'coop_fuel') return 'X-Read + Dept VAT (combined)';
  if (s === 'xread' || s === 'charfield_shift') return 'X-Read (Till)';
  if (s === 'deptvat') return 'Department VAT';
  if (s === 'cashrec') return 'Cash Reconciliation';
  return f || '—';
};

export default function UploadedFiles() {
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id,name').order('name').then(({ data }) => setBranches((data as any) || []));
  }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('daily_sales_uploads')
      .select('id, sale_date, source_filename, source_format, storage_path, created_at, branch:branches(id, name)')
      .gte('sale_date', from).lte('sale_date', to)
      .order('sale_date', { ascending: false });
    if (branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any) || []);
  };

  const download = async (path: string | null, filename: string | null) => {
    if (!path) return toast.error('No file attached');
    const { data, error } = await supabase.storage.from('daily-sales').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return toast.error(error?.message || 'Cannot get file');
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = filename || 'file';
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Files className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Uploaded Files</h1>
          <p className="text-sm text-muted-foreground">X-Read, Department VAT, and Cash Reconciliation files uploaded by each store.</p>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div>
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Load'}</Button>
        </div>
      </Card>

      <Card className="p-3">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No uploads in range.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="text-left p-2">Sale date</th>
                <th className="text-left p-2">Branch</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Filename</th>
                <th className="text-left p-2">Uploaded</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">{r.sale_date}</td>
                  <td className="p-2">{r.branch?.name || '—'}</td>
                  <td className="p-2"><span className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5"><FileText className="h-3 w-3" />{label(r.source_format)}</span></td>
                  <td className="p-2 max-w-[280px] truncate" title={r.source_filename || ''}>{r.source_filename || '—'}</td>
                  <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => download(r.storage_path, r.source_filename)} disabled={!r.storage_path}>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
