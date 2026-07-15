import React, { useEffect, useMemo, useState } from 'react';
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
import { buildCoopXeroCsv, buildBranchSummaryWorkbook, emptyCoopTotals, normalizeCoopParsedTotals, type CoopXeroRow } from '@/lib/coopFuelParser';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface UploadRow {
  id: string;
  sale_date: string;
  parsed_totals: any;
  raw_text?: string | null;
  branch?: { id: string; name: string; import_format: string | null } | null;
}

interface XeroExportProps { embedded?: boolean }

export default function XeroExport({ embedded = false }: XeroExportProps) {
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
      .select('id, sale_date, parsed_totals, raw_text, branch:branches(id, name, import_format)')
      .gte('sale_date', f).lte('sale_date', t)
      .order('sale_date');
    if (branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRows(((data as any) || []).map((r: UploadRow) => ({
      ...r,
      parsed_totals: normalizeCoopParsedTotals(r.parsed_totals, r.raw_text),
    })));
    setLoading(false);
  };

  // Build the rows used for both Xero CSV and Daily Summary CSV.
  const coopRows = useMemo<CoopXeroRow[]>(() => {
    let seq = 3651;
    return rows
      .filter(r => r.branch && (
        r.branch.import_format === 'coop_fuel' ||
        r.branch.import_format === 'charfield_shift' ||
        r.parsed_totals?.format === 'coop_fuel' ||
        r.parsed_totals?.format === 'charfield_shift'
      ))

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
      .filter(r => !(
        r.branch?.import_format === 'coop_fuel' ||
        r.branch?.import_format === 'charfield_shift' ||
        r.parsed_totals?.format === 'coop_fuel' ||
        r.parsed_totals?.format === 'charfield_shift'
      ))
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

  const fetchConfiguredCodes = async (branchIds: string[]) => {
    if (branchIds.length === 0) return new Map<string, Set<string>>();
    const { data } = await supabase
      .from('niza_branch_categories')
      .select('branch_id, category_code')
      .in('branch_id', branchIds);
    const map = new Map<string, Set<string>>();
    (data || []).forEach((r: any) => {
      if (!map.has(r.branch_id)) map.set(r.branch_id, new Set());
      map.get(r.branch_id)!.add(r.category_code);
    });
    return map;
  };

  const fetchInvoices = async (branchIds: string[], from: string, to: string) => {
    if (branchIds.length === 0) return new Map<string, any[]>();
    const { data } = await supabase
      .from('niza_invoices')
      .select('branch_id, invoice_date, supplier, invoice_number, category, net, vat, gross, source')
      .in('branch_id', branchIds)
      .gte('invoice_date', from)
      .lte('invoice_date', to);
    const map = new Map<string, any[]>();
    (data || []).forEach((r: any) => {
      if (!map.has(r.branch_id)) map.set(r.branch_id, []);
      map.get(r.branch_id)!.push(r);
    });
    return map;
  };

  const downloadXero = async () => {
    if (rows.length === 0) return toast.error('No rows to export');
    const branchIds = Array.from(new Set(rows.map(r => r.branch?.id).filter(Boolean) as string[]));
    const codesByBranch = await fetchConfiguredCodes(branchIds);
    const allCodes = new Set<string>();
    codesByBranch.forEach(s => s.forEach(c => allCodes.add(c)));

    const parts: string[] = [];
    if (coopRows.length) parts.push(buildCoopXeroCsv(coopRows, allCodes));
    if (legacyRows.length) parts.push(buildXeroCsv(legacyRows));
    const csv = parts.join('\n\n');
    const tag = single ? single : `${from}_to_${to}`;
    downloadCsv(csv, `xero_sales_${tag}.csv`);
  };

  const downloadSummary = async () => {
    if (coopRows.length === 0) return toast.error('No Co-op Fuel rows in range');
    const tag = single ? single : `${from}_to_${to}`;
    const branchIds = Array.from(new Set(rows.map(r => r.branch?.id).filter(Boolean) as string[]));
    const [codesByBranch, invoicesByBranch] = await Promise.all([
      fetchConfiguredCodes(branchIds),
      fetchInvoices(branchIds, single || from, single || to),
    ]);
    // Group rows by branch (id + name) so each gets its own workbook.
    const byBranch = new Map<string, { name: string; id?: string; list: CoopXeroRow[] }>();
    for (const r of coopRows) {
      const name = r.branch_name || 'branch';
      // Find branch id from rows source
      const src = rows.find(x => x.branch?.name === name);
      const id = src?.branch?.id;
      const key = id || name;
      if (!byBranch.has(key)) byBranch.set(key, { name, id, list: [] });
      byBranch.get(key)!.list.push(r);
    }
    const safe = (s: string) => s.replace(/[^a-z0-9_-]+/gi, '_');
    for (const [, entry] of byBranch) {
      const period = single ? single : `${from}_to_${to}`;
      const blob = await buildBranchSummaryWorkbook(entry.list, {
        branch_name: entry.name,
        period_label: period,
        invoices: entry.id ? (invoicesByBranch.get(entry.id) || []) : [],
        configuredCodes: entry.id ? (codesByBranch.get(entry.id) || new Set()) : new Set(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe(entry.name)}_cash_summary_${safe(tag)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const setMonth = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    setFrom(format(startOfMonth(d), 'yyyy-MM-dd'));
    setTo(format(endOfMonth(d), 'yyyy-MM-dd'));
    setSingle('');
  };

  const totals = useMemo(() => {
    let fuel = 0, shop = 0, lottery = 0;
    for (const r of rows) {
      const b = r.parsed_totals?.breakdown;
      if (b) {
        fuel += Number(b.FU || 0);
        shop += ['TO','DR','GS','GZ','DO','AL','NP','VM'].reduce((a, k) => a + Number(b[k] || 0), 0);
        lottery += Number(b.national_lottery || 0);
      } else {
        fuel += Number(r.parsed_totals?.fuel || 0);
        shop += Number(r.parsed_totals?.shop || 0);
        lottery += Number(r.parsed_totals?.lottery || 0);
      }
    }
    return { fuel, shop, lottery };
  }, [rows]);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    embedded
      ? <div className="p-6">{children}</div>
      : <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
          <div className="p-6 md:p-10 max-w-6xl mx-auto">{children}</div>
        </div>;

  return (
    <Wrapper>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            Xero Export
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Build Xero-ready CSVs and the daily cash summary.</p>
        </div>
      )}

      {/* Filters */}
      <Card className="p-5 mb-5 border-border/60 shadow-sm">
        <Tabs defaultValue="range">
          <TabsList className="mb-3">
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Days loaded', value: rows.length, sub: `${coopRows.length} Co-op · ${legacyRows.length} other`, accent: 'from-primary/15 to-primary/0' },
          { label: 'Fuel', value: `£${totals.fuel.toFixed(2)}`, sub: 'Total in range', accent: 'from-sky-500/15 to-sky-500/0' },
          { label: 'Shop', value: `£${totals.shop.toFixed(2)}`, sub: 'Total in range', accent: 'from-emerald-500/15 to-emerald-500/0' },
          { label: 'Lottery', value: `£${totals.lottery.toFixed(2)}`, sub: 'Total in range', accent: 'from-violet-500/15 to-violet-500/0' },
        ].map((s) => (
          <Card key={s.label} className={`relative overflow-hidden p-4 border-border/60`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} pointer-events-none`} />
            <div className="relative">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold mt-1">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Results + Downloads */}
      <Card className="p-5 border-border/60 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <div className="font-semibold">Preview</div>
            <p className="text-xs text-muted-foreground">One row per uploaded day. Download in Xero or summary format.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadSummary} variant="outline" disabled={coopRows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Branch Cash Summary (Excel)
            </Button>
            <Button onClick={downloadXero} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Xero Sales CSV
            </Button>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
            No data loaded yet. Pick a range and click <span className="font-medium">Load</span>.
          </div>
        ) : (
          <div className="text-sm divide-y rounded-lg border max-h-96 overflow-y-auto">
            {rows.map((r) => {
              const b = r.parsed_totals?.breakdown;
              return (
                <div key={r.id} className="flex justify-between items-center px-3 py-2 hover:bg-muted/40">
                  <span className="font-medium">{r.sale_date} <span className="text-muted-foreground font-normal">{r.branch?.name ? `· ${r.branch.name}` : ''}</span></span>
                  <span className="text-muted-foreground text-xs md:text-sm">
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
    </Wrapper>
  );
}
