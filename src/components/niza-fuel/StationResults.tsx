import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Navigation, AlertTriangle, Fuel } from 'lucide-react';
import { KM_PER_MILE, type FuelSearchResult, type FuelType } from '@/lib/fuelApi';

export const FUEL_LABEL: Record<FuelType, string> = { e10: 'E10 Unleaded', e5: 'E5 Super', b7: 'B7 Diesel' };
export const pence = (v: number | null) => (v === null ? '–' : `${v.toFixed(1)}p`);

interface Props {
  result: FuelSearchResult;
  fuel: FuelType;
  /** Smaller layout for a saved-location card: no summary line, no footnotes. */
  compact?: boolean;
}

/** The summary cards and the station table for one search. */
export default function StationResults({ result, fuel, compact = false }: Props) {
  const stats = useMemo(() => {
    const priced = result.stations.filter((s) => s.prices[fuel] !== null);
    if (priced.length === 0) return null;
    const cheapest = priced.reduce((a, b) => (b.prices[fuel]! < a.prices[fuel]! ? b : a));
    const avg = priced.reduce((sum, s) => sum + s.prices[fuel]!, 0) / priced.length;
    const dearest = Math.max(...priced.map((s) => s.prices[fuel]!));
    return { cheapest, avg, dearest, count: priced.length };
  }, [result, fuel]);

  return (
    <div className="space-y-4">
      {result.cache.warning && (
        <Card className="border-amber-400/60">
          <CardContent className="p-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
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
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Cheapest {FUEL_LABEL[fuel]}</div>
                  <div className="text-2xl font-semibold text-emerald-600">{pence(stats.cheapest.prices[fuel])}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {stats.cheapest.brand || stats.cheapest.name} · {(stats.cheapest.distance_km / KM_PER_MILE).toFixed(1)} mi
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Average ({stats.count} stations)</div>
                  <div className="text-2xl font-semibold">{pence(stats.avg)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Dearest</div>
                  <div className="text-2xl font-semibold text-red-600">{pence(stats.dearest)}</div>
                  <div className="text-xs text-muted-foreground">
                    {(stats.dearest - stats.cheapest.prices[fuel]!).toFixed(1)}p more than the cheapest
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Fuel className="h-4 w-4" /> Stations</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => (
                      <TableHead key={f} className={`text-right ${f === fuel ? 'text-primary' : ''}`}>{f.toUpperCase()}</TableHead>
                    ))}
                    <TableHead className="text-right">Price updated</TableHead>
                    <TableHead className="text-right">Map</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.stations.map((s, i) => {
                    const isCheapest = stats && s.prices[fuel] !== null && s.prices[fuel] === stats.cheapest.prices[fuel];
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{s.brand || s.name || 'Fuel station'}</div>
                          <div className="text-xs text-muted-foreground">
                            {[s.name && s.brand && s.name !== s.brand ? s.name : null, s.address, s.city, s.postcode].filter(Boolean).join(', ')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {(s.distance_km / KM_PER_MILE).toFixed(1)} mi
                          <div className="text-xs text-muted-foreground">{s.distance_km.toFixed(1)} km</div>
                        </TableCell>
                        {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => (
                          <TableCell key={f} className={`text-right whitespace-nowrap ${f === fuel ? 'font-semibold' : 'text-muted-foreground'}`}>
                            {pence(s.prices[f])}
                            {f === fuel && isCheapest && <Badge className="ml-2 bg-emerald-600">Cheapest</Badge>}
                          </TableCell>
                        ))}
                        <TableCell className="text-right whitespace-nowrap text-xs text-muted-foreground">
                          {s.price_updated_at ? new Date(s.price_updated_at).toLocaleDateString('en-GB') : '–'}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
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
              {!compact && (
                <p className="text-xs text-muted-foreground mt-3">
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
