import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, LocateFixed, MapPin, Navigation, AlertTriangle, Fuel } from 'lucide-react';
import { toast } from 'sonner';
import {
  searchFuelStations, KM_PER_MILE,
  type FuelSearchResult, type FuelType,
} from '@/lib/fuelApi';

const FUEL_LABEL: Record<FuelType, string> = { e10: 'E10 Unleaded', e5: 'E5 Super', b7: 'B7 Diesel' };
const RADII_MILES = [1, 2, 5, 10, 20, 30];

const pence = (v: number | null) => (v === null ? '–' : `${v.toFixed(1)}p`);

export default function Stations() {
  const [mode, setMode] = useState<'place' | 'coords'>('place');
  const [query, setQuery] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('5');
  const [fuel, setFuel] = useState<FuelType>('e10');
  const [sort, setSort] = useState<'distance' | 'price'>('price');
  const [limit, setLimit] = useState('20');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<FuelSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (override?: { lat: number; lng: number }) => {
    setError(null);
    const params = {
      radius_km: Number(radiusMiles) * KM_PER_MILE,
      fuel,
      limit: Number(limit),
      sort,
    };
    let body;
    if (override) {
      body = { ...params, lat: override.lat, lng: override.lng };
    } else if (mode === 'place') {
      if (!query.trim()) {
        setError('Enter a postcode or a city.');
        return;
      }
      body = { ...params, query: query.trim() };
    } else {
      const la = Number(lat);
      const lo = Number(lng);
      if (lat.trim() === '' || lng.trim() === '' || !Number.isFinite(la) || !Number.isFinite(lo)) {
        setError('Enter both latitude and longitude as numbers, for example 53.8008 and -1.5491.');
        return;
      }
      body = { ...params, lat: la, lng: lo };
    }
    setLoading(true);
    try {
      setResult(await searchFuelStations(body));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('This browser cannot share your location');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMode('coords');
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        runSearch({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === 1 ? 'Location permission was refused' : 'Could not get your location');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const stats = useMemo(() => {
    if (!result) return null;
    const f = fuel;
    const priced = result.stations.filter((s) => s.prices[f] !== null);
    if (priced.length === 0) return null;
    const cheapest = priced.reduce((a, b) => (b.prices[f]! < a.prices[f]! ? b : a));
    const avg = priced.reduce((sum, s) => sum + s.prices[f]!, 0) / priced.length;
    const dearest = Math.max(...priced.map((s) => s.prices[f]!));
    return { cheapest, avg, dearest, count: priced.length };
  }, [result, fuel]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Nearest Fuel Stations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          UK pump prices for E10, E5 and B7 diesel. Search by postcode, city, or latitude and longitude.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'place' | 'coords')}>
            <TabsList>
              <TabsTrigger value="place">Postcode or city</TabsTrigger>
              <TabsTrigger value="coords">Latitude / longitude</TabsTrigger>
            </TabsList>
          </Tabs>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            {mode === 'place' ? (
              <div className="space-y-1 grow min-w-[220px] max-w-sm">
                <Label htmlFor="q">Postcode or city</Label>
                <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. LS1 4AP or Leeds" />
              </div>
            ) : (
              <>
                <div className="space-y-1 w-40">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="53.8008" />
                </div>
                <div className="space-y-1 w-40">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input id="lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-1.5491" />
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label>Radius</Label>
              <Select value={radiusMiles} onValueChange={setRadiusMiles}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADII_MILES.map((m) => <SelectItem key={m} value={String(m)}>{m} mile{m > 1 ? 's' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fuel</Label>
              <Select value={fuel} onValueChange={(v) => setFuel(v as FuelType)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => <SelectItem key={f} value={f}>{FUEL_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sort by</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as 'distance' | 'price')}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Cheapest first</SelectItem>
                  <SelectItem value="distance">Nearest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Show</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['10', '20', '50', '100'].map((n) => <SelectItem key={n} value={n}>{n} stations</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
            <Button type="button" variant="outline" onClick={useMyLocation} disabled={loading || locating} className="gap-2">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Use my location
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {loading && !result && (
        <Card><CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Finding stations... (the first search of the day also downloads today's prices, so it can take a little longer)
        </CardContent></Card>
      )}

      {result && (
        <>
          {result.cache.warning && (
            <Card className="border-amber-400/60">
              <CardContent className="p-3 flex items-start gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{result.cache.warning}</span>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>
              <b className="text-foreground">{result.count}</b> station{result.count === 1 ? '' : 's'} within{' '}
              {Math.round(result.radius_km / KM_PER_MILE)} miles of <b className="text-foreground">{result.center.label}</b>
            </span>
            {result.cache.last_fetched_at && (
              <span>· prices downloaded {new Date(result.cache.last_fetched_at).toLocaleString('en-GB')}</span>
            )}
          </div>

          {result.count === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground mt-3">
                    Prices are pence per litre as reported by the stations. A dash means the station does not sell that fuel.
                    "Price updated" is the date of the newest price change for the station.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Source: FuelCosts.co.uk, UK Fuel Price Data. Originally from the UK Government Fuel Finder, Open Government Licence v3.0.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
