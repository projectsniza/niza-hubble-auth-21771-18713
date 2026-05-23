import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Search, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Invoice {
  id: string; supplier: string | null; invoice_date: string | null; invoice_number: string | null;
  net: number | null; vat: number | null; gross: number | null; category: string | null;
  source: string | null; branch_id: string | null;
}
const fmt = (n: number | null | undefined) => `£${(Number(n) || 0).toFixed(2)}`;
const monthOf = (d: string | null) => (d ? d.slice(0, 7) : '—');

export default function SupplierLedger() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: inv }, { data: br }] = await Promise.all([
        supabase.from('niza_invoices').select('id, supplier, invoice_date, invoice_number, net, vat, gross, category, source, branch_id').order('invoice_date', { ascending: false }).limit(2000),
        supabase.from('branches').select('id, name').order('name'),
      ]);
      setInvoices((inv as any) || []);
      setBranches((br as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => invoices.filter(i =>
    (branchId === 'all' || i.branch_id === branchId) &&
    (!q || (i.supplier || '').toLowerCase().includes(q.toLowerCase()))
  ), [invoices, branchId, q]);

  const grouped = useMemo(() => {
    const m = new Map<string, { supplier: string; invoices: Invoice[]; total: number; net: number; vat: number; months: Set<string> }>();
    filtered.forEach(i => {
      const key = i.supplier || '(unknown)';
      const e = m.get(key) || { supplier: key, invoices: [], total: 0, net: 0, vat: 0, months: new Set() };
      e.invoices.push(i);
      e.total += Number(i.gross) || 0;
      e.net += Number(i.net) || 0;
      e.vat += Number(i.vat) || 0;
      if (i.invoice_date) e.months.add(monthOf(i.invoice_date));
      m.set(key, e);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const toggle = (s: string) => {
    const n = new Set(expanded);
    n.has(s) ? n.delete(s) : n.add(s);
    setExpanded(n);
  };

  const exportCsv = () => {
    const rows = [['Supplier', 'Invoices', 'Net', 'VAT', 'Gross', 'Months']];
    grouped.forEach(g => rows.push([g.supplier, String(g.invoices.length), g.net.toFixed(2), g.vat.toFixed(2), g.total.toFixed(2), String(g.months.size)]));
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'supplier-ledger.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-[1500px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Building2 className="h-6 w-6" /></span>
            Supplier Ledger
          </h1>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>

        <Card className="p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Search supplier</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder="Type to filter…" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                {grouped.length} suppliers · {filtered.length} invoices · {fmt(grouped.reduce((s, g) => s + g.total, 0))} gross
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Loading…</TableCell></TableRow>
                : grouped.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices yet.</TableCell></TableRow>
                  : grouped.map(g => (
                    <>
                      <TableRow key={g.supplier} className="cursor-pointer" onClick={() => toggle(g.supplier)}>
                        <TableCell>{expanded.has(g.supplier) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{g.supplier}</TableCell>
                        <TableCell className="text-right">{g.invoices.length}</TableCell>
                        <TableCell className="text-right">{fmt(g.net)}</TableCell>
                        <TableCell className="text-right">{fmt(g.vat)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(g.total)}</TableCell>
                        <TableCell className="text-right">{g.months.size}</TableCell>
                      </TableRow>
                      {expanded.has(g.supplier) && g.invoices.map(i => (
                        <TableRow key={i.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell className="text-xs">{i.invoice_date || '—'} · {i.invoice_number || '—'}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right text-xs">{fmt(i.net)}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(i.vat)}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(i.gross)}</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="text-[10px]">{i.source}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
