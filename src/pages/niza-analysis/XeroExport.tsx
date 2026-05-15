import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { buildXeroCsv, DailySalesTotals } from '@/lib/dailySalesParser';
import { buildCoopXeroCsv, buildDailySummaryCsv, emptyCoopTotals, type CoopXeroRow } from '@/lib/coopFuelParser';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface UploadRow {
  id: string;
  sale_date: string;
  parsed_totals: any;
  branch?: { id: string; name: string; import_format: string | null } | null;
}

export default function XeroExport() {
  const today = new Date();
  const [from, setFrom] = useState<string>(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [single, setSingle] = useState<string>('');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id,name').order('name').then(({ data }) => setBranches((data as any) || []));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const f = single || from;
    const t = single || to;
    let q = supabase.from('daily_sales_uploads')
      .select('id, sale_date, parsed_totals, branch:branches(id, name, import_format)')
      .gte('sale_date', f).lte('sale_date', t)
      .order('sale_date');
    if (branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows((data as any) || []);
    setLoading(false);
  };

  // Build the rows used for both Xero CSV and Daily Summary CSV.
  const coopRows = useMemo<CoopXeroRow[]>(() => {
    let seq = 3651;
    return rows
      .filter(r => r.branch && (r.branch.import_format === 'coop_fuel' || r.parsed_totals?.format === 'coop_fuel'))
      .map(r => {
        const breakdown = r.parsed_totals?.breakdown || emptyCoopTotals();
        const branchName = r.branch?.name || '';
        const refMonth = format(new Date(r.sale_date), 'MMM yy');
        return {
          sale_date: r.sale_date,
          invoice_number: `INV-${seq++}`,
          branch_name: branchName,
          contact_name: `${branchName} Stores-Customers`,
          reference: `${branchName}-${refMonth}`,
          totals: { ...emptyCoopTotals(), ...breakdown },
        };
      });
  }, [rows]);

  const legacyRows = useMemo(() => {
    return rows
      .filter(r => !(r.branch?.import_format === 'coop_fuel' || r.parsed_totals?.format === 'coop_fuel'))
      .map(r => ({
        sale_date: r.sale_date,
        totals: (r.parsed_totals || { shop: 0, fuel: 0, lottery: 0 }) as DailySalesTotals,
        branch_name: r.branch?.name,
      }));
  }, [rows]);

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadXero = () => {
    if (rows.length === 0) return toast.error('No rows to export');
    const parts: string[] = [];
    if (coopRows.length) parts.push(buildCoopXeroCsv(coopRows));
    if (legacyRows.length) parts.push(buildXeroCsv(legacyRows));
    const csv = parts.join('\n\n');
    const tag = single ? single : `${from}_to_${to}`;
    downloadCsv(csv, `xero_sales_${tag}.csv`);
  };

  const downloadSummary = () => {
    if (coopRows.length === 0) return toast.error('No Co-op Fuel rows in range');
    const tag = single ? single : `${from}_to_${to}`;
    downloadCsv(buildDailySummaryCsv(coopRows), `daily_summary_${tag}.csv`);
  };

  const setMonth = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    setFrom(format(startOfMonth(d), 'yyyy-MM-dd'));
    setTo(format(endOfMonth(d), 'yyyy-MM-dd'));
    setSingle('');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FileSpreadsheet className="h-6 w-6 text-primary" /> Xero Export
      </h1>

      <Card className="p-4 mb-4">
        <Tabs defaultValue="range">
          <TabsList>
            <TabsTrigger value="range" onClick={() => setSingle('')}>Date range / Month</TabsTrigger>
            <TabsTrigger value="day">Single day</TabsTrigger>
          </TabsList>
          <TabsContent value="range" className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setSingle(''); }} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setSingle(''); }} />
            </div>
            <div className="flex gap-1 md:col-span-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setMonth(0)}>This month</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setMonth(-1)}>Last month</Button>
            </div>
          </TabsContent>
          <TabsContent value="day" className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Day</Label>
              <Input type="date" value={single} onChange={(e) => setSingle(e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mt-4">
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
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} day(s) loaded · {coopRows.length} Co-op Fuel · {legacyRows.length} other
          </p>
          <div className="flex gap-2">
            <Button onClick={downloadSummary} variant="outline" disabled={coopRows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Daily Summary CSV
            </Button>
            <Button onClick={downloadXero} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Xero Sales CSV
            </Button>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="text-sm space-y-1 max-h-96 overflow-y-auto">
            {rows.map((r) => {
              const b = r.parsed_totals?.breakdown;
              return (
                <div key={r.id} className="flex justify-between border-b py-1">
                  <span>{r.sale_date} {r.branch?.name ? `· ${r.branch.name}` : ''}</span>
                  <span className="text-muted-foreground">
                    {b
                      ? `Fuel £${Number(b.FU || 0).toFixed(2)} · Shop £${(['TO','DR','GS','GZ','DO','AL','NP','VM'].reduce((a, k) => a + (b[k] || 0), 0)).toFixed(2)} · Lottery £${Number(b.national_lottery || 0).toFixed(2)}`
                      : `Shop £${Number(r.parsed_totals?.shop || 0).toFixed(2)} · Fuel £${Number(r.parsed_totals?.fuel || 0).toFixed(2)} · Lottery £${Number(r.parsed_totals?.lottery || 0).toFixed(2)}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
