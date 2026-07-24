import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  emptyCoopTotals, normalizeCoopParsedTotals, buildBranchSummaryWorkbook, type CoopXeroRow,
} from '@/lib/coopFuelParser';

interface Row {
  id: string;
  sale_date: string;
  parsed_totals: any;
  raw_text?: string | null;
  branch?: { id: string; name: string; vending_split_mode?: string | null } | null;
}

export default function LivePreview() {
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id,name').order('name').then(({ data }) => setBranches((data as any) || []));
  }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('daily_sales_uploads')
      .select('id, sale_date, parsed_totals, raw_text, branch:branches(id, name, vending_split_mode)')
      .gte('sale_date', from).lte('sale_date', to)
      .order('sale_date');
    if (branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows(((data as any) || []).map((r: Row) => ({
      ...r,
      parsed_totals: normalizeCoopParsedTotals(
        r.parsed_totals,
        r.raw_text,
        (r.branch?.vending_split_mode === 'houndsmills' ? 'houndsmills' : 'culverstone'),
      ),
    })));
  };

  const coopRows = useMemo<CoopXeroRow[]>(() => {
    let seq = 3651;
    return rows
      .filter(r => r.branch && r.parsed_totals?.format === 'coop_fuel')
      .map(r => ({
        sale_date: r.sale_date,
        invoice_number: `INV-${seq++}`,
        branch_name: r.branch!.name,
        contact_name: `${r.branch!.name} Stores-Customers`,
        reference: `${r.branch!.name}-${format(new Date(r.sale_date), 'MMM yy')}`,
        totals: { ...emptyCoopTotals(), ...(r.parsed_totals?.breakdown || {}) },
      }));
  }, [rows]);

  const download = async () => {
    if (coopRows.length === 0) return toast.error('No Co-op rows in range');
    const blob = await buildBranchSummaryWorkbook(coopRows, {
      branch_name: branchId === 'all' ? 'All Branches' : (branches.find(b => b.id === branchId)?.name || 'Branch'),
      period_label: `${from}_to_${to}`,
      invoices: [],
      configuredCodes: new Set(),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live_preview_${from}_to_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saleCols = ['Fuel','Tobacco','Drinks','Grocery Std','Grocery Zero','Domestic 5%','Alcohol','Newspapers','Vending','Car Wash','Nat Lottery','Scratchcards','Paypoint','Payzone','Lotto Payouts','Drive Off'];
  const saleKeys: (keyof any)[] = ['FU','TO','DR','GS','GZ','DO','AL','NP','VM','CW','national_lottery','instant_lottery','paypoint','payzone','lottery_payouts','fuel_drive_off'];
  const cashCols = ['Shop','Carwash','Vending','Payzone','Fuel','Nat Lottery','Lotto Prize','Card Total','Cash Total','Cust. Account'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Eye className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Live Preview</h1>
          <p className="text-sm text-muted-foreground">Every output tab computed live before you export the workbook.</p>
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
          <Button variant="outline" onClick={download} disabled={coopRows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download XLSX
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="sale">
        <TabsList>
          <TabsTrigger value="sale">SALE</TabsTrigger>
          <TabsTrigger value="cash">CASH SUM1</TabsTrigger>
          <TabsTrigger value="ccard">C.CARD</TabsTrigger>
        </TabsList>

        <TabsContent value="sale">
          <Card className="p-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Branch</th>
                  {saleCols.map(c => <th key={c} className="text-right p-2">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {coopRows.map(r => {
                  const t: any = r.totals;
                  return (
                    <tr key={`${r.sale_date}-${r.branch_name}`} className="border-b hover:bg-muted/30">
                      <td className="p-2">{r.sale_date}</td>
                      <td className="p-2">{r.branch_name}</td>
                      {saleKeys.map(k => (
                        <td key={String(k)} className="text-right p-2">{Number(t[k] || 0).toFixed(2)}</td>
                      ))}
                    </tr>
                  );
                })}
                {coopRows.length === 0 && (
                  <tr><td colSpan={saleCols.length + 2} className="text-center py-8 text-muted-foreground">Load a range to preview.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card className="p-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Branch</th>
                  {cashCols.map(c => <th key={c} className="text-right p-2">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {coopRows.map(r => {
                  const t: any = r.totals;
                  const shop = (t.TO||0)+(t.DR||0)+(t.GS||0)+(t.GZ||0)+(t.DO||0)+(t.AL||0)+(t.NP||0);
                  const cardTotal = (t.visa_mc||0)+(t.amex||0)+(t.fuel_card||0);
                  return (
                    <tr key={`${r.sale_date}-${r.branch_name}`} className="border-b hover:bg-muted/30">
                      <td className="p-2">{r.sale_date}</td>
                      <td className="p-2">{r.branch_name}</td>
                      <td className="text-right p-2">{shop.toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.CW||0).toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.VM||0).toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.payzone||0).toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.FU||0).toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.national_lottery||0).toFixed(2)}</td>
                      <td className="text-right p-2">{Math.abs(Number(t.lottery_payouts||0)).toFixed(2)}</td>
                      <td className="text-right p-2">{cardTotal.toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.cash_tender||0).toFixed(2)}</td>
                      <td className="text-right p-2">{Number(t.customer_account||0).toFixed(2)}</td>
                    </tr>
                  );
                })}
                {coopRows.length === 0 && (
                  <tr><td colSpan={cashCols.length + 2} className="text-center py-8 text-muted-foreground">Load a range to preview.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="ccard">
          <Card className="p-6 text-center text-sm text-muted-foreground">
            C.CARD tab is intentionally empty in the export (client request).
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
