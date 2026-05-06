import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { buildXeroCsv, DailySalesTotals } from '@/lib/dailySalesParser';
import { format } from 'date-fns';

export default function XeroExport() {
  const [from, setFrom] = useState<string>(format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [rows, setRows] = useState<{ sale_date: string; totals: DailySalesTotals; branch_name?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id,name').order('name').then(({ data }) => setBranches((data as any) || []));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let q = supabase.from('daily_sales_uploads')
      .select('sale_date, parsed_totals, branch:branches(name)')
      .gte('sale_date', from).lte('sale_date', to)
      .order('sale_date');
    if (branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows(((data as any) || []).map((r: any) => ({
      sale_date: r.sale_date,
      totals: r.parsed_totals || { shop: 0, fuel: 0, lottery: 0 },
      branch_name: r.branch?.name,
    })));
    setLoading(false);
  };

  const download = () => {
    if (rows.length === 0) return toast.error('No rows to export');
    const csv = buildXeroCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xero_daily_sales_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6 text-primary" /> Xero Export
      </h1>
      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
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
        <Button onClick={fetchData} disabled={loading}>{loading ? 'Loading...' : 'Load'}</Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{rows.length} day(s) loaded</p>
          <Button onClick={download} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download Xero CSV
          </Button>
        </div>
        {rows.length > 0 && (
          <div className="text-sm space-y-1 max-h-96 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span>{r.sale_date} {r.branch_name ? `· ${r.branch_name}` : ''}</span>
                <span className="text-muted-foreground">
                  Shop £{r.totals.shop?.toFixed(2)} · Fuel £{r.totals.fuel?.toFixed(2)} · Lottery £{r.totals.lottery?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
