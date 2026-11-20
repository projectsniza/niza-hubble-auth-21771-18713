import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Navigation, AlertTriangle, Fuel, Crown } from 'lucide-react';
import { KM_PER_MILE, type FuelSearchResult, type FuelType } from '@/lib/fuelApi';
import { LEVEL_LABEL, levelStats, priceLevel, type PriceLevel } from '@/lib/fuelLevels';

export const FUEL_LABEL: Record<FuelType, string> = { e10: 'E10 Unleaded', e5: 'E5 Super', b7: 'B7 Diesel' };
export const pence = (v: number | null) => (v === null ? '–' : `${v.toFixed(1)}p`);

const TAG_STYLE: Record<PriceLevel, { pill: string; dot: string }> = {
  // solid, so the cheapest station always stands out
  cheapest: { pill: 'border-emerald-700 bg-emerald-600 text-white shadow-sm', dot: 'bg-white' },
  low: { pill: 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100', dot: 'bg-emerald-600' },
  average: { pill: 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100', dot: 'bg-amber-500' },
  high: { pill: 'border-rose-400 bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100', dot: 'bg-rose-600' },
};

/** "Cheapest", "Low", "Average" or "High": always the full word, never cut off. */
export function PriceTag({ level }: { level: PriceLevel | null }) {
  if (!level) return <span className="text-muted-foreground">–</span>;
  const s = TAG_STYLE[level];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.pill}`}>
      {level === 'cheapest' ? <Crown className="h-3 w-3" aria-hidden /> : <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />}
      {LEVEL_LABEL[level]}
    </span>
  );
}

interface Props {
  result: FuelSearchResult;
  fuel: FuelType;
  /** Smaller layout for a saved-location card: no summary line, no footnotes. */
  compact?: boolean;
}

/** The summary cards and the station table for one search. */
export default function StationResults({ result, fuel, compact = false }: Props) {
  // Compare each station with the others in THIS list, for the fuel that was searched.
  const stats = useMemo(() => {
    const priced = result.stations.filter((s) => s.prices[fuel] !== null);
    if (priced.length === 0) return null;
    const cheapest = priced.reduce((a, b) => (b.prices[fuel]! < a.prices[fuel]! ? b : a));
    const avg = priced.reduce((sum, s) => sum + s.prices[fuel]!, 0) / priced.length;
    const dearest = Math.max(...priced.map((s) => s.prices[fuel]!));
    return { cheapest, avg, dearest, count: priced.length };
  }, [result, fuel]);

  const levels = useMemo(() => levelStats(result.stations.map((s) => s.prices[fuel])), [result, fuel]);

  return (
    <div className="space-y-4">
      {result.cache.warning && (
        <Card className="border-amber-400/60">
          <CardContent className="flex items-start gap-3 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{result.cache.warning}</span>
          </CardContent>
        </Card>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            <b className="text-foreground">{result.count}</b> station{result.count === 1 ? '' : 's'} within{' '}
            {Math.round(result.radius_km / KM_PER_MILE)} miles of <b className="text-foreground">{result.center.label}</b>
          </span>
          {result.cache.source_published_at && (
            <span>· data published {new Date(result.cache.source_published_at).toLocaleString('en-GB')}</span>
          )}
        </div>
      )}

      {result.count === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          No stations selling {FUEL_LABEL[fuel]} in this area. Try a bigger radius.
        </CardContent></Card>
      ) : (
        <>
          {stats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-transparent dark:border-emerald-900 dark:from-emerald-950/30">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Cheapest {FUEL_LABEL[fuel]}</div>
                  <div className="text-2xl font-semibold text-emerald-600">{pence(stats.cheapest.prices[fuel])}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {stats.cheapest.brand || stats.cheapest.name} · {(stats.cheapest.distance_km / KM_PER_MILE).toFixed(1)} mi
                  </div>
                </CardContent>
              </Card>
              <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-transparent dark:border-sky-900 dark:from-sky-950/30">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Average ({stats.count} stations)</div>
                  <div className="text-2xl font-semibold text-sky-700 dark:text-sky-300">{pence(stats.avg)}</div>
                  <div className="text-xs text-muted-foreground">Low means 1p or more under this</div>
                </CardContent>
              </Card>
              <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-transparent dark:border-rose-900 dark:from-rose-950/30">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Dearest</div>
                  <div className="text-2xl font-semibold text-rose-600">{pence(stats.dearest)}</div>
                  <div className="text-xs text-muted-foreground">
                    {(stats.dearest - stats.cheapest.prices[fuel]!).toFixed(1)}p more than the cheapest
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Fuel className="h-4 w-4" /> Stations</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto px-2 sm:px-6">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => (
                      <TableHead key={f} className={`text-right ${f === fuel ? 'text-primary' : ''}`}>{f.toUpperCase()}</TableHead>
                    ))}
                    <TableHead className="min-w-[120px]">Price level</TableHead>
                    <TableHead className="text-right">Price updated</TableHead>
                    <TableHead className="text-right">Map</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.stations.map((s, i) => {
                    const level = priceLevel(s.prices[fuel], levels);
                    return (
                      <TableRow key={s.id} className={level === 'cheapest' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : undefined}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{s.brand || s.name || 'Fuel station'}</div>
                          <div className="text-xs text-muted-foreground">
                            {[s.name && s.brand && s.name !== s.brand ? s.name : null, s.address, s.city, s.postcode].filter(Boolean).join(', ')}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {(s.distance_km / KM_PER_MILE).toFixed(1)} mi
                          <div className="text-xs text-muted-foreground">{s.distance_km.toFixed(1)} km</div>
                        </TableCell>
                        {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => (
                          <TableCell key={f} className={`whitespace-nowrap text-right tabular-nums ${f === fuel ? 'text-base font-semibold' : 'text-muted-foreground'}`}>
                            {pence(s.prices[f])}
                          </TableCell>
                        ))}
                        <TableCell><PriceTag level={level} /></TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {s.price_updated_at ? new Date(s.price_updated_at).toLocaleDateString('en-GB') : '–'}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Navigation className="h-3.5 w-3.5" /> Directions
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-2 text-xs text-muted-foreground sm:px-0">
                <span className="font-medium text-foreground">Price level, compared with the average of this list:</span>
                <span className="inline-flex items-center gap-1.5"><PriceTag level="cheapest" /> lowest</span>
                <span className="inline-flex items-center gap-1.5"><PriceTag level="low" /> 1p+ under</span>
                <span className="inline-flex items-center gap-1.5"><PriceTag level="average" /> within 1p</span>
                <span className="inline-flex items-center gap-1.5"><PriceTag level="high" /> 1p+ over</span>
              </div>
              {!compact && (
                <p className="mt-3 px-2 text-xs text-muted-foreground sm:px-0">
                  Prices are pence per litre as reported by the stations. A dash means the station does not sell that fuel.
                  "Price updated" is the date of the newest price change for the station.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
