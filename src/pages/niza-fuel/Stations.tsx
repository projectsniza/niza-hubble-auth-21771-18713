import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, LocateFixed, AlertTriangle, BookmarkPlus, Bookmark, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import StationResults, { FUEL_LABEL } from '@/components/niza-fuel/StationResults';
import SavedLocations from '@/components/niza-fuel/SavedLocations';
import FuelCharts from '@/components/niza-fuel/FuelCharts';
import SavedLocationDialog, { type SavedLocationDraft } from '@/components/niza-fuel/SavedLocationDialog';
import {
  searchFuelStations, createSavedLocation, KM_PER_MILE,
  type FuelSearchResult, type FuelType, type SavedLocationInput,
} from '@/lib/fuelApi';

const RADII_MILES = [1, 2, 5, 10, 20, 30];

type Tab = 'saved' | 'charts' | 'place' | 'coords';

export default function Stations() {
  // "Saved locations" comes first and is what opens by default.
  const [tab, setTab] = useState<Tab>('saved');
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
  const [searchedFuel, setSearchedFuel] = useState<FuelType>('e10');
  const [error, setError] = useState<string | null>(null);
  const [saveDraft, setSaveDraft] = useState<SavedLocationDraft | null>(null);

  const mode: 'place' | 'coords' = tab === 'coords' ? 'coords' : 'place';

  const runSearch = async (override?: { lat: number; lng: number }) => {
    setError(null);
    const params = { radius_km: Number(radiusMiles) * KM_PER_MILE, fuel, limit: Number(limit), sort };
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
      setSearchedFuel(fuel);
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
        setTab('coords');
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

  // "Save this search": keeps the place and the settings used for the search that is on screen.
  const openSave = () => {
    if (!result) return;
    setSaveDraft({
      name: result.center.label.split(',')[0],
      kind: mode,
      query: mode === 'place' ? query.trim() : undefined,
      latitude: result.center.lat,
      longitude: result.center.lng,
      place_label: result.center.label,
      radius_miles: Number(radiusMiles),
      fuel: searchedFuel,
      sort,
      result_limit: Math.min(Number(limit), 50),
    });
  };

  const saveSearch = async (input: SavedLocationInput) => {
    await createSavedLocation(input, 9999);
    toast.success('Saved. It is now on the "Saved locations" tab.');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Nearest Fuel Stations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          UK pump prices for E10, E5 and B7 diesel. Keep your regular places saved, see them as live charts, or search by postcode, city, or latitude and longitude.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="saved" className="gap-2"><Bookmark className="h-4 w-4" /> Saved locations</TabsTrigger>
          <TabsTrigger value="charts" className="gap-2"><BarChart3 className="h-4 w-4" /> Charts</TabsTrigger>
          <TabsTrigger value="place">Postcode or city</TabsTrigger>
          <TabsTrigger value="coords">Latitude / longitude</TabsTrigger>
        </TabsList>

        <TabsContent value="saved" className="space-y-4">
          <SavedLocations />
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <FuelCharts onGoToSaved={() => setTab('saved')} />
        </TabsContent>

        {(['place', 'coords'] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    runSearch();
                  }}
                >
                  {t === 'place' ? (
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
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Finding stations...
              </CardContent></Card>
            )}

            {result && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={openSave} className="gap-2">
                    <BookmarkPlus className="h-4 w-4" /> Save this search
                  </Button>
                </div>
                <StationResults result={result} fuel={searchedFuel} />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Source: FuelCosts.co.uk, UK Fuel Price Data. Originally from the UK Government Fuel Finder, Open Government Licence v3.0.
      </p>

      <SavedLocationDialog
        open={saveDraft !== null}
        onOpenChange={(open) => !open && setSaveDraft(null)}
        title="Save this search"
        draft={saveDraft ?? undefined}
        onSave={saveSearch}
      />
    </div>
  );
}
