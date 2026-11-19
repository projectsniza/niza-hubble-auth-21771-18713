import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabasePagination';
import { todayUK } from '@/lib/ukDate';

type MetricKey = 'net_sale' | 'shop_sale' | 'fuel_sale' | 'total_sale' | 'customer_count' | 'fuel_volume' | 'cash_sale';

const METRICS: { key: MetricKey; label: string; money: boolean; unit?: string }[] = [
  { key: 'net_sale', label: 'Shop sale (Net)', money: true },
  { key: 'shop_sale', label: 'Shop sale (Gross)', money: true },
  { key: 'fuel_sale', label: 'Fuel sale', money: true },
  { key: 'total_sale', label: 'Shop (Gross) + Fuel', money: true },
  { key: 'cash_sale', label: 'Cash sale', money: true },
  { key: 'customer_count', label: 'Customers', money: false },
  { key: 'fuel_volume', label: 'Fuel volume', money: false, unit: 'L' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Newest year first = strongest colour; older years fade through distinct hues.
const YEAR_COLORS = ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6'];

interface Row {
  summary_date: string;
  shop_sale: number | null;
  net_sale: number | null;
  fuel_sale: number | null;
  customer_count: number | null;
  fuel_volume: number | null;
  cash_sale: number | null;
}

interface Props {
  /** 'all' or an organisation id (admin filter). */
  organizationId?: string;
  /** 'all' or a branch id (admin filter, or the manager's own branch). */
  branchId?: string;
}

const gbp = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
const num = (v: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(v);

function valueOf(r: Row, key: MetricKey): number {
  if (key === 'total_sale') return Number(r.shop_sale || 0) + Number(r.fuel_sale || 0);
  return Number(r[key] || 0);
}

/** Compare the same figure month by month across this year, last year, the year before, and so on. */
export default function YearlyComparison({ organizationId = 'all', branchId = 'all' }: Props) {
  const thisYear = Number(todayUK().slice(0, 4));
  const todayMD = todayUK().slice(5); // "MM-DD"

  const [yearCount, setYearCount] = useState('3');
  const [metric, setMetric] = useState<MetricKey>('net_sale');
  const [toDate, setToDate] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const years = useMemo(() => Array.from({ length: Number(yearCount) }, (_, i) => thisYear - i), [yearCount, thisYear]);
  const def = METRICS.find((m) => m.key === metric)!;
  const fmt = (v: number) => (def.money ? gbp(v) : num(v) + (def.unit ? ` ${def.unit}` : ''));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const oldest = thisYear - (Number(yearCount) - 1);
        const data = await fetchAllPages<Row>((from, to) => {
          let q = supabase
            .from('daily_summaries')
            .select('summary_date, shop_sale, net_sale, fuel_sale, customer_count, fuel_volume, cash_sale')
            .gte('summary_date', `${oldest}-01-01`)
            .lte('summary_date', `${thisYear}-12-31`)
            .order('summary_date', { ascending: true })
            .range(from, to);
          if (branchId !== 'all') q = q.eq('branch_id', branchId);
          else if (organizationId !== 'all') q = q.eq('organization_id', organizationId);
          return q;
        });
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) toast.error('Could not load the yearly comparison: ' + ((e as { message?: string })?.message || 'unknown error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [yearCount, organizationId, branchId, thisYear]);

  // totals[year][monthIndex]
  const totals = useMemo(() => {
    const t: Record<number, number[]> = {};
    years.forEach((y) => (t[y] = Array(12).fill(0)));
    for (const r of rows) {
      const y = Number(r.summary_date.slice(0, 4));
      if (!t[y]) continue;
      // "Year to date" only counts days up to today's date in each year, so years compare fairly.
      if (toDate && r.summary_date.slice(5) > todayMD) continue;
      const m = Number(r.summary_date.slice(5, 7)) - 1;
      t[y][m] += valueOf(r, metric);
    }
    return t;
  }, [rows, years, metric, toDate, todayMD]);

  const yearTotal = (y: number) => totals[y].reduce((a, b) => a + b, 0);

  const chartData = MONTHS.map((name, i) => {
    const point: Record<string, number | string> = { month: name };
    years.forEach((y) => {
      // Months that have not happened yet in the current year are left empty, not shown as zero.
      const future = y === thisYear && i > Number(todayUK().slice(5, 7)) - 1;
      if (!future) point[String(y)] = Math.round(totals[y][i] * 100) / 100;
    });
    return point;
  });

  const change = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / prev) * 100);
  const ChangeBadge = ({ cur, prev }: { cur: number; prev: number }) => {
    const c = change(cur, prev);
    if (c === null) return <span className="text-muted-foreground">–</span>;
    const up = c > 0.05;
    const down = c < -0.05;
    const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
    return (
      <span className={`inline-flex items-center gap-1 font-medium ${up ? 'text-emerald-600' : down ? 'text-red-600' : 'text-muted-foreground'}`}>
        <Icon className="h-3.5 w-3.5" />
        {c > 0 ? '+' : ''}
        {c.toFixed(1)}%
      </span>
    );
  };

  const hasData = rows.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Compare</div>
            <Select value={yearCount} onValueChange={setYearCount}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['2', '3', '4', '5'].map((n) => (
                  <SelectItem key={n} value={n}>This year + {Number(n) - 1} previous</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Figure</div>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Chart</div>
            <Select value={chartType} onValueChange={(v) => setChartType(v as 'line' | 'bar')}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="bar">Bars</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="ytd" checked={toDate} onCheckedChange={setToDate} />
            <Label htmlFor="ytd" className="text-sm">Same period only (to {todayUK().slice(8)}/{todayUK().slice(5, 7)})</Label>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </CardContent></Card>
      ) : !hasData ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No daily figures found for these years.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {years.map((y, i) => (
              <Card key={y}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                    {y}{y === thisYear ? ' (this year)' : ''}
                  </div>
                  <div className="text-xl font-semibold mt-1">{fmt(yearTotal(y))}</div>
                  {i < years.length - 1 && (
                    <div className="text-xs mt-1 text-muted-foreground">
                      vs {y - 1}: <ChangeBadge cur={yearTotal(y)} prev={yearTotal(y - 1)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{def.label} by month</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => (def.money ? gbp(Number(v)) : num(Number(v)))} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    {years.map((y, i) => (
                      <Line key={y} type="monotone" dataKey={String(y)} stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                        strokeWidth={y === thisYear ? 3 : 2} dot={{ r: 3 }} connectNulls={false} />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => (def.money ? gbp(Number(v)) : num(Number(v)))} width={80} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    {years.map((y, i) => (
                      <Bar key={y} dataKey={String(y)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Month by month</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    {years.map((y) => <TableHead key={y} className="text-right">{y}</TableHead>)}
                    <TableHead className="text-right">{years[0]} vs {years[1]}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MONTHS.map((name, i) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      {years.map((y) => {
                        const future = y === thisYear && i > Number(todayUK().slice(5, 7)) - 1;
                        return <TableCell key={y} className="text-right">{future ? '–' : fmt(totals[y][i])}</TableCell>;
                      })}
                      <TableCell className="text-right">
                        {years[0] === thisYear && i > Number(todayUK().slice(5, 7)) - 1
                          ? '–'
                          : <ChangeBadge cur={totals[years[0]][i]} prev={totals[years[1]][i]} />}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Total</TableCell>
                    {years.map((y) => <TableCell key={y} className="text-right">{fmt(yearTotal(y))}</TableCell>)}
                    <TableCell className="text-right"><ChangeBadge cur={yearTotal(years[0])} prev={yearTotal(years[1])} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Uses the organisation and branch filters above. The date range at the top does not apply here.
                {!toDate && ' This year is a part-year total; switch on "Same period only" for a fair comparison.'}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
