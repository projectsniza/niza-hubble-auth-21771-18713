import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, BarChart3, Building2, Fuel, Gauge, MapPin, Plus, RefreshCw, Store } from 'lucide-react';
import {
  getFuelOverview, KM_PER_MILE, listSavedLocations, searchFuelStations,
  type FuelOverview, type FuelSearchResult, type FuelType, type SavedLocation,
} from '@/lib/fuelApi';
import { LEVEL_COLOR, levelStats, priceLevel } from '@/lib/fuelLevels';

const REFRESH_MS = 5 * 60 * 1000; // the charts re-read the saved prices every 5 minutes while the tab is open
const FUELS: Array<{ key: FuelType; label: string; short: string }> = [
  { key: 'e10', label: 'E10 Unleaded', short: 'E10' },
  { key: 'e5', label: 'E5 Super', short: 'E5' },
  { key: 'b7', label: 'B7 Diesel', short: 'B7' },
];
const C = { green: '#10b981', deepGreen: '#059669', blue: '#38bdf8', rose: '#f43f5e', amber: '#f59e0b', violet: '#8b5cf6', slate: '#94a3b8' };
const AXIS = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const;
const GRID = 'hsl(var(--border))';
const p1 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v.toFixed(1)}p`);

// ------------------------------------------------------------------------------------------------
// Data
// ------------------------------------------------------------------------------------------------
function useOverview(fuel: FuelType) {
  return useQuery({
    queryKey: ['fuel-overview', fuel],
    queryFn: () => getFuelOverview(fuel),
    refetchInterval: REFRESH_MS,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

function useSavedLocations() {
  return useQuery({ queryKey: ['fuel-saved-locations'], queryFn: listSavedLocations, staleTime: 30_000 });
}

interface SavedResult {
  loc: SavedLocation;
  result?: FuelSearchResult;
  error?: string;
}

/** One search per saved location (for the fuel chosen on the charts), run together. */
function useSavedResults(fuel: FuelType, locations: SavedLocation[]) {
  const signature = locations.map((l) => `${l.id}:${l.latitude}:${l.longitude}:${l.radius_miles}`).join('|');
  return useQuery({
    queryKey: ['fuel-saved-results', fuel, signature],
    enabled: locations.length > 0,
    refetchInterval: REFRESH_MS,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SavedResult[]> =>
      Promise.all(
        locations.map(async (loc) => {
          try {
            const result = await searchFuelStations({
              lat: loc.latitude, lng: loc.longitude, radius_km: loc.radius_miles * KM_PER_MILE, fuel, limit: 50, sort: 'price',
            });
            return { loc, result };
          } catch (e) {
            return { loc, error: (e as Error).message };
          }
        })
      ),
  });
}

// ------------------------------------------------------------------------------------------------
// Small pieces
// ------------------------------------------------------------------------------------------------
function ChartTip({ active, payload, label, rows }: { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }>; label?: string; rows: (d: Record<string, unknown>) => Array<[string, string]> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-foreground">{(d.fullName as string) || label}</div>
      {rows(d).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone: string }) {
  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold leading-tight tabular-nums">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, icon: Icon, children, className = '' }: { title: string; description?: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`overflow-hidden shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading charts">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

function LivePill({ updatedAt, published }: { updatedAt: number; published: string | null | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border bg-background px-3 py-1.5 text-xs shadow-sm">
      <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        LIVE
      </span>
      {published && <span className="text-muted-foreground">Prices published {new Date(published).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
      <span className="text-muted-foreground">Checked {updatedAt ? new Date(updatedAt).toLocaleTimeString('en-GB') : '–'} · refreshes every 5 min</span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// The tab
// ------------------------------------------------------------------------------------------------
export default function FuelCharts({ onGoToSaved }: { onGoToSaved: () => void }) {
  const [fuel, setFuel] = useState<FuelType>('e10');
  const [picked, setPicked] = useState<string | null>(null);

  const overviewQ = useOverview(fuel);
  const savedQ = useSavedLocations();
  const locations = savedQ.data ?? [];
  const resultsQ = useSavedResults(fuel, locations);

  const overview: FuelOverview | undefined = overviewQ.data?.overview;
  const published = overviewQ.data?.cache.source_published_at;
  const ukAvg = overview?.stats.avg ?? null;
  const fuelLabel = FUELS.find((f) => f.key === fuel)!.label;

  // ---------- saved locations ----------
  const saved = useMemo(
    () =>
      (resultsQ.data ?? [])
        .filter((r) => r.result && r.result.stations.length > 0)
        .map((r) => {
          const prices = r.result!.stations.map((s) => s.prices[fuel]);
          const stats = levelStats(prices)!;
          const dearest = Math.max(...(prices.filter((p) => p !== null) as number[]));
          const cheapestStation = r.result!.stations.find((s) => s.prices[fuel] === stats.min)!;
          return { loc: r.loc, result: r.result!, stats, dearest, cheapestStation };
        })
        .filter((r) => Number.isFinite(r.dearest)),
    [resultsQ.data, fuel]
  );

  const compareData = saved.map((s) => ({
    name: s.loc.name.length > 16 ? s.loc.name.slice(0, 15) + '…' : s.loc.name,
    fullName: s.loc.name,
    Cheapest: s.stats.min,
    Average: Math.round(s.stats.avg * 10) / 10,
    Dearest: s.dearest,
    stations: s.stats.count,
    cheapestAt: s.cheapestStation.brand || s.cheapestStation.name || 'station',
  }));

  const selected = saved.find((s) => s.loc.id === picked) ?? saved[0];
  const ladderStats = selected?.stats ?? null;
  const ladder = selected
    ? selected.result.stations
        .filter((s) => s.prices[fuel] !== null)
        .slice(0, 12)
        .map((s) => ({
          label: `${s.brand || s.name || 'Station'} · ${(s.distance_km / KM_PER_MILE).toFixed(1)} mi`,
          fullName: [s.brand || s.name, s.postcode].filter(Boolean).join(', '),
          price: s.prices[fuel] as number,
          level: priceLevel(s.prices[fuel], ladderStats)!,
          distance: `${(s.distance_km / KM_PER_MILE).toFixed(1)} mi`,
        }))
    : [];

  // ---------- price spread across the UK ----------
  const hist = (overview?.histogram ?? []).map((b) => ({ ...b, label: `${b.from}-${b.to}` }));
  const bucketOf = (price: number) => {
    if (!hist.length) return undefined;
    if (price < hist[0].to) return hist[0].label;
    const last = hist[hist.length - 1];
    if (price >= last.from) return last.label;
    return hist.find((b) => price >= b.from && price < b.to)?.label;
  };
  const histColor = (b: { from: number; to: number }) =>
    ukAvg === null ? C.slate : b.to <= ukAvg ? C.green : b.from >= ukAvg ? C.rose : C.amber;

  const noData = !!overview && overview.stats.n === 0;

  return (
    <div className="space-y-6">
      {/* Title, live indicator and fuel switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><BarChart3 className="h-5 w-5 text-primary" /> Live price charts</h2>
          <p className="text-sm text-muted-foreground">Where your saved locations sit against the whole of the UK, from the latest published prices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LivePill updatedAt={overviewQ.dataUpdatedAt} published={published} />
          <div className="inline-flex rounded-lg border bg-background p-1 shadow-sm" role="group" aria-label="Fuel">
            {FUELS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFuel(f.key)}
                aria-pressed={fuel === f.key}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${fuel === f.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {f.short}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => { overviewQ.refetch(); resultsQ.refetch(); }} aria-label="Refresh charts" title="Refresh now">
            <RefreshCw className={`h-4 w-4 ${overviewQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {overviewQ.isLoading ? (
        <Skeleton />
      ) : overviewQ.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">{(overviewQ.error as Error).message}</div>
            <Button size="sm" variant="outline" onClick={() => overviewQ.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : noData ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          There are no prices saved yet, so there is nothing to chart. A Super Admin can load them from "Data &amp; Refresh".
        </CardContent></Card>
      ) : overview ? (
        <>
          {/* UK numbers */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile icon={Gauge} label={`UK average ${overview.fuel.toUpperCase()}`} value={p1(overview.stats.avg)} sub={`median ${p1(overview.stats.median)}`} tone="bg-sky-100 text-sky-700 dark:bg-sky-950/50" />
            <Tile icon={ArrowDownToLine} label="Cheapest in the UK" value={p1(overview.stats.min)} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" />
            <Tile icon={ArrowUpToLine} label="Dearest in the UK" value={p1(overview.stats.max)} tone="bg-rose-100 text-rose-700 dark:bg-rose-950/50" />
            <Tile icon={Store} label="Stations selling it" value={overview.stats.n.toLocaleString('en-GB')} tone="bg-violet-100 text-violet-700 dark:bg-violet-950/50" />
            <Tile
              icon={Fuel}
              label="Diesel vs unleaded"
              value={overview.fuel_averages.b7 !== null && overview.fuel_averages.e10 !== null ? `${(overview.fuel_averages.b7 - overview.fuel_averages.e10 >= 0 ? '+' : '')}${(overview.fuel_averages.b7 - overview.fuel_averages.e10).toFixed(1)}p` : '–'}
              sub={`E10 ${p1(overview.fuel_averages.e10)} · B7 ${p1(overview.fuel_averages.b7)}`}
              tone="bg-amber-100 text-amber-700 dark:bg-amber-950/50"
            />
          </div>

          {/* Your saved locations */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><MapPin className="h-4 w-4" /> Your saved locations</h3>
            {savedQ.isLoading || (locations.length > 0 && resultsQ.isLoading) ? (
              <div className="h-72 animate-pulse rounded-xl bg-muted" />
            ) : locations.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-8">
                  <p className="max-w-xl text-sm text-muted-foreground">Save a postcode, city or point and its prices will be charted here against the UK average.</p>
                  <Button onClick={onGoToSaved} className="gap-2"><Plus className="h-4 w-4" /> Add a saved location</Button>
                </CardContent>
              </Card>
            ) : saved.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                None of your saved locations has a station selling {fuelLabel} nearby. Try another fuel, or widen the radius of a location.
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Cheapest, average and dearest" description={`${fuelLabel}, pence per litre, across each saved location. The dashed line is the UK average.`} icon={BarChart3}>
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareData} margin={{ top: 22, right: 12, left: -8, bottom: 0 }} barGap={4}>
                        <defs>
                          <linearGradient id="gCheap" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor={C.deepGreen} /></linearGradient>
                          <linearGradient id="gAvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient>
                          <linearGradient id="gDear" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#e11d48" /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
                        <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={['dataMin - 6', 'dataMax + 4']} tickFormatter={(v) => `${Math.round(v)}`} width={44} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} content={<ChartTip rows={(d) => [['Cheapest', `${p1(d.Cheapest as number)} (${d.cheapestAt})`], ['Average', p1(d.Average as number)], ['Dearest', p1(d.Dearest as number)], ['Stations', String(d.stations)]]} />} />
                        {ukAvg !== null && <ReferenceLine y={ukAvg} stroke={C.violet} strokeDasharray="6 4" />}
                        <Bar dataKey="Cheapest" fill="url(#gCheap)" radius={[6, 6, 0, 0]} animationDuration={900}><LabelList dataKey="Cheapest" position="top" fontSize={10} formatter={(v: number) => v.toFixed(1)} fill="hsl(var(--foreground))" /></Bar>
                        <Bar dataKey="Average" fill="url(#gAvg)" radius={[6, 6, 0, 0]} animationDuration={1100} />
                        <Bar dataKey="Dearest" fill="url(#gDear)" radius={[6, 6, 0, 0]} animationDuration={1300} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Legend3 />
                </ChartCard>

                <ChartCard title="Price ladder" description="The cheapest stations around one saved location, coloured by how they compare with that area's average." icon={Store}>
                  {saved.length > 1 && (
                    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Saved location">
                      {saved.map((s) => (
                        <button
                          key={s.loc.id}
                          type="button"
                          onClick={() => setPicked(s.loc.id)}
                          aria-pressed={selected?.loc.id === s.loc.id}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selected?.loc.id === s.loc.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                        >
                          {s.loc.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ height: Math.max(220, ladder.length * 30 + 40) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ladder} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} domain={['dataMin - 4', 'dataMax + 2']} tickFormatter={(v) => `${Math.round(v)}`} />
                        <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={150} interval={0} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} content={<ChartTip rows={(d) => [['Price', p1(d.price as number)], ['Distance', String(d.distance)]]} />} />
                        {ladderStats && <ReferenceLine x={ladderStats.avg} stroke={C.violet} strokeDasharray="6 4" label={{ value: `avg ${ladderStats.avg.toFixed(1)}p`, position: 'top', fill: C.violet, fontSize: 10 }} />}
                        <Bar dataKey="price" radius={[0, 6, 6, 0]} animationDuration={900}>
                          {ladder.map((d, i) => <Cell key={i} fill={LEVEL_COLOR[d.level]} />)}
                          <LabelList dataKey="price" position="right" fontSize={11} formatter={(v: number) => `${v.toFixed(1)}p`} fill="hsl(var(--foreground))" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <LevelLegend />
                </ChartCard>
              </div>
            )}
          </div>

          {/* The whole UK */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Building2 className="h-4 w-4" /> The UK today</h3>
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard className="xl:col-span-2" title="How prices are spread across the UK" description={`${overview.stats.n.toLocaleString('en-GB')} stations, grouped in 2p bars. Green is below the UK average, red above${saved.length ? '; the violet markers are your saved locations' : ''}.`} icon={BarChart3}>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hist} margin={{ top: 28, right: 12, left: -8, bottom: 0 }} barCategoryGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={14} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} content={<ChartTip rows={(d) => [['Price band', `${d.from}p to ${d.to}p`], ['Stations', Number(d.count).toLocaleString('en-GB')]]} />} />
                      {ukAvg !== null && bucketOf(ukAvg) && <ReferenceLine x={bucketOf(ukAvg)} stroke={C.violet} strokeWidth={2} label={{ value: `UK avg ${ukAvg.toFixed(1)}p`, position: 'top', fill: C.violet, fontSize: 11 }} />}
                      {saved.slice(0, 5).map((s) => {
                        const x = bucketOf(s.stats.avg);
                        return x ? <ReferenceLine key={s.loc.id} x={x} stroke="#6d28d9" strokeDasharray="3 3" /> : null;
                      })}
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={1000}>
                        {hist.map((b, i) => <Cell key={i} fill={histColor(b)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Brands compared" description={`Average ${fuelLabel} price of the 12 biggest brands (by number of stations).`} icon={Store}>
                <div style={{ height: Math.max(260, overview.brands.length * 30 + 30) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...overview.brands].sort((a, b) => a.avg - b.avg)} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} domain={['dataMin - 3', 'dataMax + 1']} tickFormatter={(v) => `${Math.round(v)}`} />
                      <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={96} interval={0} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} content={<ChartTip rows={(d) => [['Average', p1(d.avg as number)], ['Cheapest', p1(d.min as number)], ['Stations', Number(d.stations).toLocaleString('en-GB')]]} />} />
                      {ukAvg !== null && <ReferenceLine x={ukAvg} stroke={C.violet} strokeDasharray="6 4" />}
                      <Bar dataKey="avg" radius={[0, 6, 6, 0]} animationDuration={900}>
                        {[...overview.brands].sort((a, b) => a.avg - b.avg).map((b, i) => <Cell key={i} fill={ukAvg !== null && b.avg <= ukAvg ? C.green : C.rose} />)}
                        <LabelList dataKey="avg" position="right" fontSize={11} formatter={(v: number) => `${v.toFixed(1)}p`} fill="hsl(var(--foreground))" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="grid gap-4">
                <CityChart title="Cheapest cities" description="Average price, cities with 8 or more stations." data={overview.cities_cheapest} color={C.green} ukAvg={ukAvg} icon={ArrowDownToLine} />
                <CityChart title="Dearest cities" description="Average price, cities with 8 or more stations." data={overview.cities_dearest} color={C.rose} ukAvg={ukAvg} icon={ArrowUpToLine} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function CityChart({ title, description, data, color, ukAvg, icon }: { title: string; description: string; data: FuelOverview['cities_cheapest']; color: string; ukAvg: number | null; icon: React.ElementType }) {
  if (!data.length) return null;
  return (
    <ChartCard title={title} description={description} icon={icon}>
      <div style={{ height: Math.max(180, data.length * 26 + 24) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 2, right: 52, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" hide domain={['dataMin - 3', 'dataMax + 1']} />
            <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={96} interval={0} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} content={<ChartTip rows={(d) => [['Average', p1(d.avg as number)], ['Stations', String(d.stations)]]} />} />
            {ukAvg !== null && <ReferenceLine x={ukAvg} stroke={C.violet} strokeDasharray="6 4" />}
            <Bar dataKey="avg" fill={color} radius={[0, 6, 6, 0]} animationDuration={900}>
              <LabelList dataKey="avg" position="right" fontSize={11} formatter={(v: number) => `${v.toFixed(1)}p`} fill="hsl(var(--foreground))" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{children}</span>;
}
function Legend3() {
  return <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground"><Dot color={C.deepGreen}>Cheapest</Dot><Dot color="#0ea5e9">Average</Dot><Dot color="#e11d48">Dearest</Dot></div>;
}
function LevelLegend() {
  return <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground"><Dot color={LEVEL_COLOR.cheapest}>Cheapest</Dot><Dot color={LEVEL_COLOR.low}>Low</Dot><Dot color={LEVEL_COLOR.average}>Average</Dot><Dot color={LEVEL_COLOR.high}>High</Dot></div>;
}
