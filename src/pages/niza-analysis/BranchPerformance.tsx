import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, Fuel, ShoppingBag, Trophy } from 'lucide-react';

interface Report {
  id: string; branch_id: string; report_date: string; total_sales: number | null;
  fuel_sales: number | null; shop_sales: number | null;
}
const fmt = (n: number) => `£${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function BranchPerformance() {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'ytd'>('month');

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('daily_reports').select('id, branch_id, report_date, total_sales, fuel_sales, shop_sales').order('report_date', { ascending: false }).limit(5000),
      ]);
      setBranches((b as any) || []);
      setReports((r as any) || []);
    })();
  }, []);

  const start = useMemo(() => {
    const d = new Date();
    if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    else d.setMonth(0, 1);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const perBranch = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; fuel: number; shop: number; days: number }>();
    branches.forEach(b => m.set(b.id, { id: b.id, name: b.name, total: 0, fuel: 0, shop: 0, days: 0 }));
    reports.filter(r => r.report_date >= start).forEach(r => {
      const e = m.get(r.branch_id); if (!e) return;
      e.total += Number(r.total_sales) || 0;
      e.fuel += Number(r.fuel_sales) || 0;
      e.shop += Number(r.shop_sales) || 0;
      e.days += 1;
    });
    return Array.from(m.values()).filter(e => e.days > 0).sort((a, b) => b.total - a.total);
  }, [reports, branches, start]);

  const totals = useMemo(() => perBranch.reduce((acc, b) => ({
    total: acc.total + b.total, fuel: acc.fuel + b.fuel, shop: acc.shop + b.shop,
  }), { total: 0, fuel: 0, shop: 0 }), [perBranch]);

  const max = Math.max(...perBranch.map(b => b.total), 1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-[1500px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><BarChart3 className="h-6 w-6" /></span>
              Branch Performance KPIs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Sales, fuel vs shop split, days of activity per branch.</p>
          </div>
          <div className="w-48">
            <Label className="text-xs">Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Total sales" value={fmt(totals.total)} />
          <Stat icon={<Fuel className="h-4 w-4 text-amber-500" />} label="Fuel" value={fmt(totals.fuel)} />
          <Stat icon={<ShoppingBag className="h-4 w-4 text-emerald-500" />} label="Shop" value={fmt(totals.shop)} />
          <Stat icon={<Trophy className="h-4 w-4 text-purple-500" />} label="Branches reporting" value={perBranch.length} />
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Fuel</TableHead>
                <TableHead className="text-right">Shop</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-40">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perBranch.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data.</TableCell></TableRow>
                : perBranch.map((b, i) => (
                  <TableRow key={b.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-right">{b.days}</TableCell>
                    <TableCell className="text-right">{fmt(b.fuel)}</TableCell>
                    <TableCell className="text-right">{fmt(b.shop)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(b.total)}</TableCell>
                    <TableCell>
                      <div className="h-2 w-full rounded bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(b.total / max) * 100}%` }} />
                      </div>
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
