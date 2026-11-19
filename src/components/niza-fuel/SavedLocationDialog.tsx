import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { searchFuelStations, type FuelType, type SavedLocation, type SavedLocationInput } from '@/lib/fuelApi';

const RADII = [1, 2, 5, 10, 20, 30];
const FUEL_LABEL: Record<FuelType, string> = { e10: 'E10 Unleaded', e5: 'E5 Super', b7: 'B7 Diesel' };

/** What the form starts with. Anything missing gets a sensible default. */
export interface SavedLocationDraft {
  name?: string;
  kind?: 'place' | 'coords';
  query?: string;
  latitude?: number;
  longitude?: number;
  place_label?: string | null;
  radius_miles?: number;
  fuel?: FuelType;
  sort?: 'price' | 'distance';
  result_limit?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The saved location being edited (so an unchanged place is not looked up again). */
  existing?: SavedLocation | null;
  draft?: SavedLocationDraft;
  onSave: (input: SavedLocationInput) => Promise<void>;
}

export default function SavedLocationDialog({ open, onOpenChange, title, existing, draft, onSave }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'place' | 'coords'>('place');
  const [query, setQuery] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('5');
  const [fuel, setFuel] = useState<FuelType>('e10');
  const [sort, setSort] = useState<'price' | 'distance'>('price');
  const [limit, setLimit] = useState('10');
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Fill the form each time the dialog opens (only on open, so typing is never overwritten).
  useEffect(() => {
    if (!open) return;
    const d = draftRef.current || {};
    setName(d.name ?? '');
    setKind(d.kind ?? 'place');
    setQuery(d.query ?? '');
    setLat(d.latitude !== undefined ? String(d.latitude) : '');
    setLng(d.longitude !== undefined ? String(d.longitude) : '');
    setRadius(String(d.radius_miles ?? 5));
    setFuel(d.fuel ?? 'e10');
    setSort(d.sort ?? 'price');
    setLimit(String(d.result_limit ?? 10));
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      toast.error('Give this location a name');
      return;
    }

    setSaving(true);
    try {
      let latitude: number;
      let longitude: number;
      let placeLabel: string | null = null;
      let savedQuery: string | null = null;

      if (kind === 'place') {
        const q = query.trim();
        if (!q) throw new Error('Enter a postcode or a city');
        savedQuery = q;
        if (existing && existing.kind === 'place' && existing.query === q) {
          // Same place as before: keep the coordinates we already have.
          latitude = existing.latitude;
          longitude = existing.longitude;
          placeLabel = existing.place_label;
        } else {
          // Look the place up once now, so showing it later is instant.
          const found = await searchFuelStations({ query: q, radius_km: 1, fuel: 'e10', limit: 1, sort: 'distance' });
          latitude = found.center.lat;
          longitude = found.center.lng;
          placeLabel = found.center.label;
        }
      } else {
        latitude = Number(lat);
        longitude = Number(lng);
        if (lat.trim() === '' || lng.trim() === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error('Enter both latitude and longitude as numbers, for example 53.8008 and -1.5491');
        }
        if (latitude < 49 || latitude > 61 || longitude < -9 || longitude > 2.5) {
          throw new Error('That point is outside the UK');
        }
        placeLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      await onSave({
        name: name.trim(),
        kind,
        query: savedQuery,
        latitude,
        longitude,
        place_label: placeLabel,
        radius_miles: Number(radius),
        fuel,
        sort,
        result_limit: Number(limit),
      });
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Saved locations stay here for good and show their prices as soon as you open this page.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leeds shop, Head office" autoFocus />
          </div>

          <Tabs value={kind} onValueChange={(v) => setKind(v as 'place' | 'coords')}>
            <TabsList>
              <TabsTrigger value="place">Postcode or city</TabsTrigger>
              <TabsTrigger value="coords">Latitude / longitude</TabsTrigger>
            </TabsList>
          </Tabs>

          {kind === 'place' ? (
            <div className="space-y-1">
              <Label htmlFor="loc-query">Postcode or city</Label>
              <Input id="loc-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. LS1 4AP or Leeds" />
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label htmlFor="loc-lat">Latitude</Label>
                <Input id="loc-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="53.8008" />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="loc-lng">Longitude</Label>
                <Input id="loc-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-1.5491" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Radius</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADII.map((m) => <SelectItem key={m} value={String(m)}>{m} mile{m > 1 ? 's' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fuel</Label>
              <Select value={fuel} onValueChange={(v) => setFuel(v as FuelType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => <SelectItem key={f} value={f}>{FUEL_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sort by</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as 'price' | 'distance')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Cheapest first</SelectItem>
                  <SelectItem value="distance">Nearest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Show</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['5', '10', '20', '50'].map((n) => <SelectItem key={n} value={n}>{n} stations</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
