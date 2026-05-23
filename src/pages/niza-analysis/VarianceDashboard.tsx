import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';

interface DailyReport { id: string; branch_id: string; report_date: string; total_sales: number | null; total_cash: number | null; total_card: number | null }
interface Branch { id: string; name: string }

const fmt = (n: number | null | undefined) => `£${(Number(n) || 0).toFixed(2)}`;

export default function VarianceDashboard() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>('all');
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [threshold, setThreshold] = useState<number>(5);
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: th }] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('niza_alert_settings').select('variance_threshold_gbp').limit(1).maybeSingle(),
      ]);
      setBranches((b as any) || []);
      if (th?.variance_threshold_gbp != null) setThreshold(Number(th.variance_threshold_gbp));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase.from('daily_reports').select('id, branch_id, report_date, total_sales, total_cash, total_card')
        .gte('report_date', from).lte('report_date', to).order('report_date', { ascending: false });
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data } = await q;
      setReports((data as any) || []);
    })();
  }, [branchId, from, to]);

  const rows = useMemo(() => reports.map(r => {
    const sales = Number(r.total_sales) || 0;
    const cashCard = (Number(r.total_cash) || 0) + (Number(r.total_card) || 0);
    const variance = cashCard - sales;
    const flagged = Math.abs(variance) > threshold;
    return { ...r, sales, cashCard, variance, flagged };
  }), [reports, threshold]);

  const stats = useMemo(() => {
    const totalDays = rows.length;
    const flagged = rows.filter(r => r.flagged).length;
    const totalVar = rows.reduce((s, r) => s + r.variance, 0);
    const over = rows.filter(r => r.variance > threshold).length;
    const under = rows.filter(r => r.variance < -threshold).length;
    return { totalDays, flagged, totalVar, over, under };
  }, [rows, threshold]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-[1500px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Activity className="h-6 w-6" /></span>
            Variance Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sales vs Cash+Card per day. Variance flagged when absolute mismatch &gt; £{threshold.toFixed(2)}.</p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div><Label className="text-xs">Threshold (£)</Label><Input type="number" step="0.5" value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={<Activity className="h-4 w-4" />} label="Days analyzed" value={stats.totalDays} />
          <Stat icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Flagged" value={stats.flagged} />
          <Stat icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} label="Over" value={stats.over} />
          <Stat icon={<TrendingDown className="h-4 w-4 text-destructive" />} label="Under" value={stats.under} />
          <Stat icon={<CheckCircle2 className="h-4 w-4 text-primary" />} label="Net variance" value={fmt(stats.totalVar)} />
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Cash + Card</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data in selected range.</TableCell></TableRow>
                : rows.map(r => (
                  <TableRow key={r.id} className={r.flagged ? 'bg-destructive/5' : ''}>
                    <TableCell>{r.report_date}</TableCell>
                    <TableCell>{branches.find(b => b.id === r.branch_id)?.name || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(r.sales)}</TableCell>
                    <TableCell className="text-right">{fmt(r.cashCard)}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.variance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {r.variance >= 0 ? '+' : ''}{fmt(r.variance)}
                    </TableCell>
                    <TableCell>
                      {r.flagged ? <Badge variant="destructive">Flagged</Badge> : <Badge variant="outline">OK</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Card>
  );
}
