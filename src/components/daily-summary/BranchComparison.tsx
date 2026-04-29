import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, RadarChart, Radar, Cell,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek, addDays, isWithinInterval } from 'date-fns';
import type { DailySummaryRow } from './DailySummaryCharts';

interface Branch { id: string; name: string; }

interface Props {
  rows: DailySummaryRow[];
  branches: Branch[];
}

const fmtGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat('en-GB').format(Math.round(v));

// Distinct, high-contrast palette for multi-branch comparison (color-blind friendly)
const PALETTE = [
  '#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ef4444',
  '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16',
  '#6366f1', '#d946ef',
];

export default function BranchComparison({ rows, branches }: Props) {
  const [view, setView] = useState<'consolidated' | 'weekly'>('consolidated');
  const branchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown';

  // Aggregate per branch
  const perBranch = useMemo(() => {
    const map = new Map<string, any>();
    rows.forEach(r => {
      const cur = map.get(r.branch_id) || {
        branch_id: r.branch_id, name: branchName(r.branch_id),
        shop_sale: 0, net_sale: 0, fuel_sale: 0, fuel_volume: 0,
        customer_count: 0, cash_sale: 0, atm_loaded: 0,
        store_paid_outs: 0, cash_deposit: 0, days: 0,
      };
      cur.shop_sale += Number(r.shop_sale);
      cur.net_sale += Number(r.net_sale);
      cur.fuel_sale += Number(r.fuel_sale);
      cur.fuel_volume += Number(r.fuel_volume);
      cur.customer_count += Number(r.customer_count);
      cur.cash_sale += Number(r.cash_sale);
      cur.atm_loaded += Number(r.atm_loaded);
      cur.store_paid_outs += Number(r.store_paid_outs);
      cur.cash_deposit += Number(r.cash_deposit);
      cur.days += 1;
      map.set(r.branch_id, cur);
    });
    return Array.from(map.values()).map(b => ({
      ...b,
      total_sale: b.shop_sale + b.fuel_sale,
      avg_basket: b.customer_count ? b.shop_sale / b.customer_count : 0,
      avg_daily_sale: b.days ? (b.shop_sale + b.fuel_sale) / b.days : 0,
    })).sort((a, b) => b.total_sale - a.total_sale);
  }, [rows, branches]);

  // ===== UK weekly aggregation (Mon-Sun, weekStartsOn: 1) =====
  const weeklyData = useMemo(() => {
    if (rows.length === 0) return [];
    // Build distinct weeks from data
    const weekMap = new Map<string, { weekStart: Date; weekEnd: Date; perBranch: Record<string, any> }>();
    rows.forEach(r => {
      const d = parseISO(r.summary_date);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const we = endOfWeek(d, { weekStartsOn: 1 });
      const key = format(ws, 'yyyy-MM-dd');
      if (!weekMap.has(key)) {
        weekMap.set(key, { weekStart: ws, weekEnd: we, perBranch: {} });
      }
      const wk = weekMap.get(key)!;
      const cur = wk.perBranch[r.branch_id] || {
        branch_id: r.branch_id,
        name: branchName(r.branch_id),
        shop_sale: 0, fuel_sale: 0, customer_count: 0, fuel_volume: 0, cash_deposit: 0, days: 0,
      };
      cur.shop_sale += Number(r.shop_sale);
      cur.fuel_sale += Number(r.fuel_sale);
      cur.customer_count += Number(r.customer_count);
      cur.fuel_volume += Number(r.fuel_volume);
      cur.cash_deposit += Number(r.cash_deposit);
      cur.days += 1;
      wk.perBranch[r.branch_id] = cur;
    });
    return Array.from(weekMap.entries())
      .map(([key, wk]) => ({
        key,
        weekStart: wk.weekStart,
        weekEnd: wk.weekEnd,
        label: `${format(wk.weekStart, 'dd MMM')} – ${format(wk.weekEnd, 'dd MMM yyyy')}`,
        branches: Object.values(wk.perBranch).map((b: any) => ({
          ...b,
          total_sale: b.shop_sale + b.fuel_sale,
          avg_basket: b.customer_count ? b.shop_sale / b.customer_count : 0,
        })).sort((a: any, b: any) => b.total_sale - a.total_sale),
      }))
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [rows, branches]);

  // Per-day per-branch (for trend lines)
  const trendData = useMemo(() => {
    const dateSet = new Set(rows.map(r => r.summary_date));
    const dates = Array.from(dateSet).sort();
    return dates.map(d => {
      const row: any = { date: format(parseISO(d), 'dd MMM') };
      perBranch.forEach(b => {
        const rec = rows.find(r => r.summary_date === d && r.branch_id === b.branch_id);
        row[b.name] = rec ? Number(rec.shop_sale) + Number(rec.fuel_sale) : 0;
      });
      return row;
    });
  }, [rows, perBranch]);

  // Network totals
  const totals = useMemo(() => perBranch.reduce((acc, b) => ({
    total_sale: acc.total_sale + b.total_sale,
    customers: acc.customers + b.customer_count,
    fuel_volume: acc.fuel_volume + b.fuel_volume,
    cash_deposit: acc.cash_deposit + b.cash_deposit,
  }), { total_sale: 0, customers: 0, fuel_volume: 0, cash_deposit: 0 }), [perBranch]);

  // Radar (normalized 0-100)
  const radarMetrics = ['shop_sale', 'fuel_sale', 'customer_count', 'cash_deposit', 'fuel_volume'] as const;
  const radarLabels: Record<string, string> = {
    shop_sale: 'Shop', fuel_sale: 'Fuel', customer_count: 'Customers',
    cash_deposit: 'Deposit', fuel_volume: 'Volume',
  };
  const maxByMetric: any = {};
  radarMetrics.forEach(m => {
    maxByMetric[m] = Math.max(1, ...perBranch.map(b => b[m] || 0));
  });
  const radarData = radarMetrics.map(m => {
    const row: any = { metric: radarLabels[m] };
    perBranch.forEach(b => {
      row[b.name] = Math.round((b[m] / maxByMetric[m]) * 100);
    });
    return row;
  });

  if (perBranch.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  const top = perBranch[0];
  const bottom = perBranch[perBranch.length - 1];

  // Adaptive sizing helpers — when many branches, increase chart height & rotate labels
  const branchCount = perBranch.length;
  const isWide = branchCount >= 10;
  const chartHeight = isWide ? 'h-[420px]' : 'h-80';
  const xAxisProps = isWide
    ? { angle: -35, textAnchor: 'end' as const, height: 90, interval: 0 }
    : { angle: 0, textAnchor: 'middle' as const, height: 30, interval: 0 };

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="consolidated">Consolidated Comparison</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View (Mon–Sun)</TabsTrigger>
        </TabsList>

        {/* ============ CONSOLIDATED ============ */}
        <TabsContent value="consolidated" className="space-y-6 mt-6">
          {/* Network KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Network Total Sale</div>
              <div className="text-xl font-bold text-primary">{fmtGBP(totals.total_sale)}</div>
              <div className="text-xs text-muted-foreground mt-1">{perBranch.length} branches</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Customers</div>
              <div className="text-xl font-bold">{fmtNum(totals.customers)}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Fuel Volume</div>
              <div className="text-xl font-bold">{fmtNum(totals.fuel_volume)} L</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Cash Deposit</div>
              <div className="text-xl font-bold">{fmtGBP(totals.cash_deposit)}</div>
            </CardContent></Card>
          </div>

          {/* Top / Bottom branch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4">
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Top Performing Branch</div>
                <div className="text-lg font-bold">{top.name}</div>
                <div className="text-sm text-muted-foreground">
                  {fmtGBP(top.total_sale)} total sale · {fmtNum(top.customer_count)} customers
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4">
                <div className="text-xs text-orange-700 dark:text-orange-400 font-medium">Lowest Performing Branch</div>
                <div className="text-lg font-bold">{bottom.name}</div>
                <div className="text-sm text-muted-foreground">
                  {fmtGBP(bottom.total_sale)} total sale · {fmtNum(bottom.customer_count)} customers
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Total sales by branch */}
          <Card>
            <CardHeader><CardTitle>Total Sales by Branch</CardTitle></CardHeader>
            <CardContent className={chartHeight}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perBranch} margin={{ left: 10, right: 10, bottom: isWide ? 40 : 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} {...xAxisProps} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} width={70} />
                  <Tooltip formatter={(v: number) => fmtGBP(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend wrapperStyle={{ paddingTop: 10 }} />
                  <Bar dataKey="shop_sale" name="Shop Sale" stackId="a" fill="#2563eb" />
                  <Bar dataKey="fuel_sale" name="Fuel Sale" stackId="a" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trend by branch + radar — stack vertically when many branches to avoid legend overlap */}
          <div className={`grid grid-cols-1 ${isWide ? '' : 'lg:grid-cols-2'} gap-6`}>
            <Card>
              <CardHeader><CardTitle>Daily Total Sale Trend by Branch</CardTitle></CardHeader>
              <CardContent className={chartHeight}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ left: 10, right: 10, bottom: 30, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} width={70} />
                    <Tooltip formatter={(v: number) => fmtGBP(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Legend wrapperStyle={{ paddingTop: 10, maxHeight: 80, overflow: 'auto' }} />
                    {perBranch.map((b, i) => (
                      <Line key={b.branch_id} type="monotone" dataKey={b.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Branch Performance Radar (normalized)</CardTitle></CardHeader>
              <CardContent className={chartHeight}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 30, left: 30 }}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    {perBranch.map((b, i) => (
                      <Radar key={b.branch_id} name={b.name} dataKey={b.name}
                        stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.15} />
                    ))}
                    <Legend wrapperStyle={{ paddingTop: 10, maxHeight: 80, overflow: 'auto' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Customers + avg basket */}
          <div className={`grid grid-cols-1 ${isWide ? '' : 'lg:grid-cols-2'} gap-6`}>
            <Card>
              <CardHeader><CardTitle>Customer Count by Branch</CardTitle></CardHeader>
              <CardContent className={isWide ? 'h-96' : 'h-72'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perBranch} margin={{ left: 10, right: 10, bottom: isWide ? 40 : 10, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} {...xAxisProps} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} width={50} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="customer_count" name="Customers" radius={[4, 4, 0, 0]}>
                      {perBranch.map((b, i) => <Cell key={b.branch_id} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Average Basket Value by Branch</CardTitle></CardHeader>
              <CardContent className={isWide ? 'h-96' : 'h-72'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perBranch} margin={{ left: 10, right: 10, bottom: isWide ? 40 : 10, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} {...xAxisProps} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} width={70} />
                    <Tooltip formatter={(v: number) => fmtGBP(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="avg_basket" name="Avg Basket" radius={[4, 4, 0, 0]}>
                      {perBranch.map((b, i) => <Cell key={b.branch_id} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Comparison table */}
          <Card>
            <CardHeader><CardTitle>Detailed Comparison</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 sticky left-0 bg-card z-10">Branch</th>
                    <th className="py-2 pr-4 text-right">Days</th>
                    <th className="py-2 pr-4 text-right">Total Sale</th>
                    <th className="py-2 pr-4 text-right">Shop</th>
                    <th className="py-2 pr-4 text-right">Fuel</th>
                    <th className="py-2 pr-4 text-right">Volume (L)</th>
                    <th className="py-2 pr-4 text-right">Customers</th>
                    <th className="py-2 pr-4 text-right">Avg Basket</th>
                    <th className="py-2 pr-4 text-right">Avg/Day</th>
                    <th className="py-2 pr-4 text-right">Cash Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  {perBranch.map(b => (
                    <tr key={b.branch_id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium sticky left-0 bg-card">{b.name}</td>
                      <td className="py-2 pr-4 text-right">{b.days}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{fmtGBP(b.total_sale)}</td>
                      <td className="py-2 pr-4 text-right">{fmtGBP(b.shop_sale)}</td>
                      <td className="py-2 pr-4 text-right">{fmtGBP(b.fuel_sale)}</td>
                      <td className="py-2 pr-4 text-right">{fmtNum(b.fuel_volume)}</td>
                      <td className="py-2 pr-4 text-right">{fmtNum(b.customer_count)}</td>
                      <td className="py-2 pr-4 text-right">{fmtGBP(b.avg_basket)}</td>
                      <td className="py-2 pr-4 text-right">{fmtGBP(b.avg_daily_sale)}</td>
                      <td className="py-2 pr-4 text-right">{fmtGBP(b.cash_deposit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ WEEKLY VIEW ============ */}
        <TabsContent value="weekly" className="space-y-4 mt-6">
          {weeklyData.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No data in selected period.</CardContent></Card>
          ) : weeklyData.map(wk => {
            const totalSale = wk.branches.reduce((s, b: any) => s + b.total_sale, 0);
            const totalCust = wk.branches.reduce((s, b: any) => s + b.customer_count, 0);
            const totalFuel = wk.branches.reduce((s, b: any) => s + b.fuel_volume, 0);
            return (
              <Card key={wk.key} className="overflow-hidden">
                <CardHeader className="bg-muted/30 py-3 px-4 border-b">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">Week of {wk.label}</CardTitle>
                    <div className="flex flex-wrap gap-2 items-center text-xs">
                      <Badge variant="secondary">{wk.branches.length} branches</Badge>
                      <Badge variant="outline">Total: {fmtGBP(totalSale)}</Badge>
                      <Badge variant="outline">{fmtNum(totalCust)} customers</Badge>
                      <Badge variant="outline">{fmtNum(totalFuel)} L fuel</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-muted/20 text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 px-3 text-left sticky left-0 bg-muted/20 z-10">Branch</th>
                        <th className="py-2 px-3 text-right">Days</th>
                        <th className="py-2 px-3 text-right">Shop Sale</th>
                        <th className="py-2 px-3 text-right">Fuel Sale</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-right">Customers</th>
                        <th className="py-2 px-3 text-right">Avg Basket</th>
                        <th className="py-2 px-3 text-right">Volume (L)</th>
                        <th className="py-2 px-3 text-right">Cash Deposit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wk.branches.map((b: any, i: number) => (
                        <tr key={b.branch_id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                          <td className="py-2 px-3 font-medium sticky left-0 bg-inherit z-10">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                              {b.name}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">{b.days}</td>
                          <td className="py-2 px-3 text-right">{fmtGBP(b.shop_sale)}</td>
                          <td className="py-2 px-3 text-right">{fmtGBP(b.fuel_sale)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{fmtGBP(b.total_sale)}</td>
                          <td className="py-2 px-3 text-right">{fmtNum(b.customer_count)}</td>
                          <td className="py-2 px-3 text-right">{fmtGBP(b.avg_basket)}</td>
                          <td className="py-2 px-3 text-right">{fmtNum(b.fuel_volume)}</td>
                          <td className="py-2 px-3 text-right">{fmtGBP(b.cash_deposit)}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="py-2 px-3 sticky left-0 bg-muted/30 z-10">WEEK TOTAL</td>
                        <td />
                        <td className="py-2 px-3 text-right">{fmtGBP(wk.branches.reduce((s, b: any) => s + b.shop_sale, 0))}</td>
                        <td className="py-2 px-3 text-right">{fmtGBP(wk.branches.reduce((s, b: any) => s + b.fuel_sale, 0))}</td>
                        <td className="py-2 px-3 text-right text-primary">{fmtGBP(totalSale)}</td>
                        <td className="py-2 px-3 text-right">{fmtNum(totalCust)}</td>
                        <td />
                        <td className="py-2 px-3 text-right">{fmtNum(totalFuel)}</td>
                        <td className="py-2 px-3 text-right">{fmtGBP(wk.branches.reduce((s, b: any) => s + b.cash_deposit, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
