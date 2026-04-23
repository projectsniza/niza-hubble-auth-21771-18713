import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp, Users, Fuel, PoundSterling, Banknote, ShoppingBag } from 'lucide-react';

export interface DailySummaryRow {
  id: string;
  branch_id: string;
  summary_date: string;
  shop_sale: number;
  net_sale: number;
  customer_count: number;
  fuel_volume: number;
  fuel_sale: number;
  cash_sale: number;
  atm_loaded: number;
  store_paid_outs: number;
  cash_deposit: number;
  notes?: string | null;
}

const fmtGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat('en-GB').format(Math.round(v));

// High-contrast, accessible data-viz palette (color-blind friendly, distinct hues)
export const VIZ_COLORS = {
  shop:      '#2563eb', // blue-600
  fuel:      '#f97316', // orange-500
  net:       '#10b981', // emerald-500
  customers: '#8b5cf6', // violet-500
  cash:      '#14b8a6', // teal-500
  atm:       '#f59e0b', // amber-500
  paidOut:   '#ef4444', // red-500
  deposit:   '#0ea5e9', // sky-500
  volume:    '#84cc16', // lime-500
};
const COLORS = [VIZ_COLORS.shop, VIZ_COLORS.fuel, VIZ_COLORS.net, VIZ_COLORS.customers, VIZ_COLORS.cash, VIZ_COLORS.atm, VIZ_COLORS.paidOut, VIZ_COLORS.deposit];

interface KPIProps { label: string; value: string; icon: React.ElementType; tone: string; sub?: string; }
function KPI({ label, value, icon: Icon, tone, sub }: KPIProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-semibold truncate">{value}</div>
          {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DailySummaryCharts({ rows }: { rows: DailySummaryRow[] }) {
  const data = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.summary_date.localeCompare(b.summary_date))
      .map(r => ({
        ...r,
        date: format(parseISO(r.summary_date), 'dd MMM'),
        total_sale: Number(r.shop_sale) + Number(r.fuel_sale),
      }));
  }, [rows]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      shop_sale: acc.shop_sale + Number(r.shop_sale),
      net_sale: acc.net_sale + Number(r.net_sale),
      customer_count: acc.customer_count + Number(r.customer_count),
      fuel_volume: acc.fuel_volume + Number(r.fuel_volume),
      fuel_sale: acc.fuel_sale + Number(r.fuel_sale),
      cash_sale: acc.cash_sale + Number(r.cash_sale),
      atm_loaded: acc.atm_loaded + Number(r.atm_loaded),
      store_paid_outs: acc.store_paid_outs + Number(r.store_paid_outs),
      cash_deposit: acc.cash_deposit + Number(r.cash_deposit),
    }), {
      shop_sale: 0, net_sale: 0, customer_count: 0, fuel_volume: 0,
      fuel_sale: 0, cash_sale: 0, atm_loaded: 0, store_paid_outs: 0, cash_deposit: 0,
    });
  }, [rows]);

  const avgBasket = totals.customer_count > 0 ? totals.shop_sale / totals.customer_count : 0;
  const totalSale = totals.shop_sale + totals.fuel_sale;

  const composition = [
    { name: 'Shop Sale', value: totals.shop_sale },
    { name: 'Fuel Sale', value: totals.fuel_sale },
  ];

  const cashFlow = [
    { name: 'Cash Sale', value: totals.cash_sale },
    { name: 'ATM Loaded', value: totals.atm_loaded },
    { name: 'Paid Outs', value: totals.store_paid_outs },
    { name: 'Cash Deposit', value: totals.cash_deposit },
  ];

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Total Sale" value={fmtGBP(totalSale)} icon={TrendingUp} tone="bg-primary/10 text-primary" sub={`${rows.length} day(s)`} />
        <KPI label="Shop Sale" value={fmtGBP(totals.shop_sale)} icon={ShoppingBag} tone="bg-emerald-500/10 text-emerald-600" />
        <KPI label="Fuel Sale" value={fmtGBP(totals.fuel_sale)} icon={Fuel} tone="bg-orange-500/10 text-orange-600" sub={`${fmtNum(totals.fuel_volume)} L`} />
        <KPI label="Customers" value={fmtNum(totals.customer_count)} icon={Users} tone="bg-blue-500/10 text-blue-600" sub={`Avg basket ${fmtGBP(avgBasket)}`} />
        <KPI label="Cash Sale" value={fmtGBP(totals.cash_sale)} icon={Banknote} tone="bg-purple-500/10 text-purple-600" />
        <KPI label="Cash Deposit" value={fmtGBP(totals.cash_deposit)} icon={PoundSterling} tone="bg-teal-500/10 text-teal-600" />
      </div>

      {/* Sales trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Sales Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="shop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fuel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(v: number) => fmtGBP(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Area type="monotone" dataKey="shop_sale" name="Shop Sale" stroke="hsl(var(--primary))" fill="url(#shop)" />
                <Area type="monotone" dataKey="fuel_sale" name="Fuel Sale" stroke="hsl(var(--accent))" fill="url(#fuel)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Customers vs Net Sale</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="customer_count" name="Customers" fill="hsl(var(--primary))" />
                <Line yAxisId="right" type="monotone" dataKey="net_sale" name="Net Sale" stroke="hsl(var(--accent))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Sale Composition</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={composition} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                  {composition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtGBP(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fuel Volume (L)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => `${fmtNum(v)} L`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="fuel_volume" name="Fuel Volume" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cash Flow Breakdown</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                <Tooltip formatter={(v: number) => fmtGBP(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Daily Records</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4 text-right">Shop</th>
                <th className="py-2 pr-4 text-right">Fuel</th>
                <th className="py-2 pr-4 text-right">Net</th>
                <th className="py-2 pr-4 text-right">Customers</th>
                <th className="py-2 pr-4 text-right">Cash</th>
                <th className="py-2 pr-4 text-right">ATM</th>
                <th className="py-2 pr-4 text-right">Paid Outs</th>
                <th className="py-2 pr-4 text-right">Deposit</th>
              </tr>
            </thead>
            <tbody>
              {data.slice().reverse().map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{format(parseISO(r.summary_date), 'PP')}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.shop_sale)}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.fuel_sale)}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.net_sale)}</td>
                  <td className="py-2 pr-4 text-right">{fmtNum(r.customer_count)}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.cash_sale)}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.atm_loaded)}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.store_paid_outs)}</td>
                  <td className="py-2 pr-4 text-right">{fmtGBP(r.cash_deposit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
