import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, Eye, Save, CreditCard, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  emptyCoopTotals, normalizeCoopParsedTotals, buildBranchSummaryWorkbook, type CoopXeroRow,
} from '@/lib/coopFuelParser';
import OutputReviewPanel from '@/components/niza-analysis/OutputReviewPanel';
import { useAuth } from '@/contexts/AuthContext';


interface Row {
  id: string;
  sale_date: string;
  parsed_totals: any;
  original_totals?: any;
  raw_text?: string | null;
  branch?: { id: string; name: string; vending_split_mode?: string | null } | null;
}

type FisDay = { visa_mc: number; amex: number; fuel_card: number; other: number; total: number; brands: Record<string, number> };
type LitreDay = { diesel: number; unleaded: number; super: number; total: number };


const num = (v: any) => Number(v || 0);

export default function LivePreview() {
  const today = new Date();
  const { user } = useAuth();
  const [from, setFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [cardByKey, setCardByKey] = useState<Record<string, FisDay>>({});
  const [litresByKey, setLitresByKey] = useState<Record<string, LitreDay>>({});
  const [reviewStatus, setReviewStatus] = useState<string>('pending');
  const [auditRefresh, setAuditRefresh] = useState(0);

  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id,name').order('name').then(({ data }) => setBranches((data as any) || []));
  }, []);


  const load = async () => {
    setLoading(true);
    let q = supabase.from('daily_sales_uploads')
      .select('id, branch_id, sale_date, source_format, parsed_totals, raw_text, branch:branches(id, name, vending_split_mode)')
      .gte('sale_date', from).lte('sale_date', to)
      .order('sale_date');
    if (branchId !== 'all') q = q.eq('branch_id', branchId);

    // FIS card statements and weekly Cash Reconciliations are stored on the
    // week's Monday, so widen the window a little to catch weeks that start
    // before the selected range.
    let cq = supabase.from('daily_sales_uploads')
      .select('branch_id, sale_date, source_format, parsed_totals')
      .in('source_format', ['fiscard', 'cashrec'])
      .gte('sale_date', format(new Date(new Date(from).getTime() - 8 * 864e5), 'yyyy-MM-dd'))
      .lte('sale_date', to);
    if (branchId !== 'all') cq = cq.eq('branch_id', branchId);

    const [{ data, error }, { data: cardData }] = await Promise.all([q, cq]);
    setLoading(false);
    if (error) return toast.error(error.message);

    const cards: Record<string, FisDay> = {};
    const litres: Record<string, LitreDay> = {};
    for (const c of (cardData as any[]) || []) {
      const fmt = (c.source_format || '').toLowerCase();
      if (fmt === 'fiscard') {
        const byDate = c.parsed_totals?.by_date || {};
        for (const [d, v] of Object.entries<any>(byDate)) {
          cards[`${c.branch_id}|${d}`] = {
            visa_mc: num(v.visa_mc), amex: num(v.amex), fuel_card: num(v.fuel_card),
            other: num(v.other), total: num(v.total), brands: v.brands || {},
          };
        }
      } else {
        const byDate = c.parsed_totals?.litres_by_date || {};
        for (const [d, v] of Object.entries<any>(byDate)) {
          litres[`${c.branch_id}|${d}`] = {
            diesel: num(v.diesel), unleaded: num(v.unleaded),
            super: num(v.super), total: num(v.total),
          };
        }
      }
    }
    setCardByKey(cards);
    setLitresByKey(litres);

    const daily = ((data as any[]) || []).filter(r => !['cashrec', 'fiscard'].includes((r.source_format || '').toLowerCase()));
    const loadedEdits: Record<string, Record<string, number>> = {};

    setRows(daily.map((r: any) => {
      if (r.parsed_totals?.manual_overrides) loadedEdits[r.id] = { ...r.parsed_totals.manual_overrides };
      return {
        ...r,
        original_totals: r.parsed_totals,
        parsed_totals: normalizeCoopParsedTotals(
          r.parsed_totals,
          r.raw_text,
          (r.branch?.vending_split_mode === 'houndsmills' ? 'houndsmills' : 'culverstone'),
          r.branch?.name,
        ),

      };
    }));
    setEdits(loadedEdits);
  };

  const coopRows = useMemo<(CoopXeroRow & { row_id: string })[]>(() => {
    let seq = 3651;
    return rows
      .filter(r => r.branch && r.parsed_totals?.format === 'coop_fuel')
      .map(r => {
        const key = `${(r as any).branch_id}|${r.sale_date}`;
        const fis = cardByKey[key];
        const lit = litresByKey[key];
        return {
          row_id: r.id,
          sale_date: r.sale_date,
          invoice_number: `INV-${seq++}`,
          branch_name: r.branch!.name,
          contact_name: `${r.branch!.name} Stores-Customers`,
          reference: `${r.branch!.name}-${format(new Date(r.sale_date), 'MMM yy')}`,
          totals: {
            ...emptyCoopTotals(),
            ...(r.parsed_totals?.breakdown || {}),
            ...(fis ? { visa_mc: fis.visa_mc, amex: fis.amex, fuel_card: fis.fuel_card, card_brands: fis.brands } : {}),
            ...(lit ? {
              fuel_litres_diesel: lit.diesel,
              fuel_litres_unleaded: lit.unleaded,
              fuel_litres_super: lit.super,
            } : {}),
            ...(edits[r.id] || {}),
          },
        };
      });
  }, [rows, cardByKey, litresByKey, edits]);


  const cell = (rowId: string, key: string, fallback: any) =>
    edits[rowId]?.[key] !== undefined ? edits[rowId][key] : num(fallback);

  const setCell = (rowId: string, key: string, value: string) => {
    setEdits(prev => {
      const next = { ...prev, [rowId]: { ...(prev[rowId] || {}) } };
      if (value === '') delete next[rowId][key];
      else next[rowId][key] = Number(value);
      return next;
    });
  };

  const saveEdits = async () => {
    const ids = Object.keys(edits).filter(id => Object.keys(edits[id] || {}).length > 0);
    if (ids.length === 0) return toast.info('No edits to save');
    setSaving(true);
    try {
      const auditRows: any[] = [];
      for (const id of ids) {
        const row = rows.find(r => r.id === id);
        const base = row?.original_totals || {};
        const previous = (base as any)?.manual_overrides || {};
        const breakdown = row?.parsed_totals?.breakdown || {};
        for (const [key, value] of Object.entries(edits[id])) {
          const before = previous[key] !== undefined ? Number(previous[key]) : num((breakdown as any)[key]);
          if (Number(before) === Number(value)) continue;
          auditRows.push({
            upload_id: id,
            branch_id: (row as any)?.branch_id || null,
            sale_date: row?.sale_date || null,
            field_key: key,
            old_value: before,
            new_value: Number(value),
            changed_by: user?.id || null,
            changed_by_name: user?.name || null,
            changed_by_email: user?.email || null,
          });
        }
        const { error } = await supabase.from('daily_sales_uploads')
          .update({ parsed_totals: { ...base, manual_overrides: edits[id] } as any })
          .eq('id', id);
        if (error) throw error;
      }
      if (auditRows.length) {
        await (supabase as any).from('niza_output_edit_audit').insert(auditRows);
      }
      setAuditRefresh(k => k + 1);
      toast.success(`Saved ${auditRows.length} change(s) across ${ids.length} day(s)`);
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (coopRows.length === 0) return toast.error('No Co-op rows in range');
    if (reviewStatus !== 'approved') {
      return toast.error('Output must be approved by the Accounts Assistant before download');
    }
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

  const saleCols = ['Fuel Litres','Diesel L','Unleaded L','Super L','Fuel','Tobacco','Drinks','Alcohol','Grocery Std','Grocery Zero','Domestic 5%','Newspapers','Newspapers 20%','Vending','Car Wash','Nat Lottery','Scratchcards','Paypoint','Payzone','Lotto Payouts'];
  const saleKeys = ['fuel_litres','fuel_litres_diesel','fuel_litres_unleaded','fuel_litres_super','FU','TO','DR','AL','GS','GZ','DO','NP','NP20','VM','CW','national_lottery','instant_lottery','paypoint','payzone','lottery_payouts'];
  const cashCols = ['Shop','Carwash','Vending','Payzone','Fuel','Lotto Sales','Lotto Prize','Credit Card Sales','Cash Need to Deposit','Vouchers','Drive Off','Customer Accounts','Misc. Expence','Total Banking','Closing Cash Bal.','Actual Short/Excess (Day Rep.)','Net Differences'];


  const editInput = (rowId: string, key: string, fallback: any) => (
    <Input
      type="number"
      step="0.01"
      className="h-7 w-24 text-right text-xs px-1"
      value={String(cell(rowId, key, fallback) ?? '')}
      onChange={e => setCell(rowId, key, e.target.value)}
    />
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Eye className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Live Preview</h1>
          <p className="text-sm text-muted-foreground">Every output tab computed live — edit any cell before you export the workbook.</p>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
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
          <Button variant="secondary" onClick={saveEdits} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save Edits'}
          </Button>
          <Button variant="outline" onClick={download} disabled={coopRows.length === 0 || reviewStatus !== 'approved'}>
            <Download className="h-4 w-4 mr-2" /> Download XLSX
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <CreditCard className="h-3 w-3" /> C.CARD uses the weekly FIS statement when one has been uploaded for that week; otherwise till card tenders are shown.
        </p>
      </Card>

      <OutputReviewPanel
        branchId={branchId === 'all' ? null : branchId}
        from={from}
        to={to}
        refreshKey={auditRefresh}
        onStatusChange={setReviewStatus}
      />

      <Tabs defaultValue="sale">
        <TabsList>
          <TabsTrigger value="sale">SALE</TabsTrigger>
          <TabsTrigger value="cash">CASH SUM1</TabsTrigger>
          <TabsTrigger value="ccard">C.CARD</TabsTrigger>
          <TabsTrigger value="input">MY INPUT</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground mb-3">
              The exact daily/period input received from the store — shown next to the output so you can verify before approving.
            </p>
            <div className="space-y-3 max-h-[32rem] overflow-y-auto">
              {rows.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Load a range to see the source input.</div>}
              {rows.map(r => (
                <div key={`in-${r.id}`} className="rounded-lg border">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-xs font-medium">
                    <span className="flex items-center gap-2"><FileText className="h-3 w-3" /> {r.sale_date} · {r.branch?.name}</span>
                    <span className="text-muted-foreground">
                      {Object.keys(edits[r.id] || {}).length > 0 ? `${Object.keys(edits[r.id]).length} field(s) modified` : 'unmodified'}
                    </span>
                  </div>
                  <pre className="p-3 text-[11px] whitespace-pre-wrap max-h-56 overflow-y-auto">
{r.raw_text || JSON.stringify(r.original_totals, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>


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
                      <td className="p-2 whitespace-nowrap">{r.sale_date}</td>
                      <td className="p-2 whitespace-nowrap">{r.branch_name}</td>
                      {saleKeys.map(k => (
                        <td key={k} className="text-right p-1">{editInput(r.row_id, k, t[k])}</td>
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
                  const shop = num(t.TO)+num(t.DR)+num(t.AL)+num(t.GS)+num(t.GZ)+num(t.DO)+num(t.NP)+num(t.NP20);
                  const cardBrands: Record<string, number> = t.card_brands || {};
                  const brandSum = Object.values(cardBrands).reduce((a, b) => a + num(b), 0);
                  const cardTotal = brandSum || (num(t.visa_mc)+num(t.amex)+num(t.fuel_card));
                  const lottoSales = num(t.national_lottery)+num(t.instant_lottery);
                  const lottoPrize = -Math.abs(num(t.lottery_payouts));
                  // Drive off keeps the sign printed on the day report.
                  const driveOff = num(t.fuel_drive_off_raw) || num(t.fuel_drive_off);
                  const misc = Math.abs(num(t.petty_cash));
                  const cashToDeposit = shop + num(t.CW) + num(t.VM) + num(t.payzone) + num(t.FU)
                    + lottoSales + lottoPrize - cardTotal;
                  const totalBanking = num(t.cash_lifts);
                  const closingBal = cashToDeposit - num(t.coupon) - driveOff - num(t.customer_account) - misc - totalBanking;
                  const dayReport = num(t.cash_in_drawer) ? -num(t.cash_in_drawer) : 0;
                  return (
                    <tr key={`${r.sale_date}-${r.branch_name}`} className="border-b hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{r.sale_date}</td>
                      <td className="p-2 whitespace-nowrap">{r.branch_name}</td>
                      <td className="text-right p-2">{shop.toFixed(2)}</td>
                      <td className="text-right p-2">{num(t.CW).toFixed(2)}</td>
                      <td className="text-right p-2">{num(t.VM).toFixed(2)}</td>
                      <td className="text-right p-2">{num(t.payzone).toFixed(2)}</td>
                      <td className="text-right p-2">{num(t.FU).toFixed(2)}</td>
                      <td className="text-right p-2">{lottoSales.toFixed(2)}</td>
                      <td className="text-right p-2">{lottoPrize.toFixed(2)}</td>
                      <td className="text-right p-2">{cardTotal.toFixed(2)}</td>
                      <td className="text-right p-2 font-semibold">{cashToDeposit.toFixed(2)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'coupon', t.coupon)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'fuel_drive_off_raw', t.fuel_drive_off_raw || t.fuel_drive_off)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'customer_account', t.customer_account)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'petty_cash', t.petty_cash)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'cash_lifts', t.cash_lifts)}</td>
                      <td className="text-right p-2 font-semibold">{closingBal.toFixed(2)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'cash_in_drawer', t.cash_in_drawer)}</td>
                      <td className={`text-right p-2 font-semibold ${Math.abs(closingBal - dayReport) > 0.005 ? 'text-destructive' : 'text-emerald-600'}`}>{(closingBal - dayReport).toFixed(2)}</td>
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
          <Card className="p-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Branch</th>
                  <th className="text-right p-2">Visa/MC</th>
                  <th className="text-right p-2">Amex</th>
                  <th className="text-right p-2">Fuel Card</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-left p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {coopRows.map(r => {
                  const t: any = r.totals;
                  const total = num(t.visa_mc)+num(t.amex)+num(t.fuel_card);
                  const hasFis = !!cardByKey[`${(rows.find(x => x.id === r.row_id) as any)?.branch_id}|${r.sale_date}`];
                  return (
                    <tr key={`cc-${r.sale_date}-${r.branch_name}`} className="border-b hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap">{r.sale_date}</td>
                      <td className="p-2 whitespace-nowrap">{r.branch_name}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'visa_mc', t.visa_mc)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'amex', t.amex)}</td>
                      <td className="text-right p-1">{editInput(r.row_id, 'fuel_card', t.fuel_card)}</td>
                      <td className="text-right p-2 font-semibold">{total.toFixed(2)}</td>
                      <td className="p-2 text-muted-foreground">{hasFis ? 'FIS statement' : 'Till tenders'}</td>
                    </tr>
                  );
                })}
                {coopRows.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Load a range to preview.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
