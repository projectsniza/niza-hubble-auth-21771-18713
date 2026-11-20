import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Plus, Pencil, Trash2, RefreshCw, AlertTriangle, MapPin, Crosshair, Fuel, ArrowUpDown, ListOrdered,
  CalendarClock, Lock, Compass,
} from 'lucide-react';
import { toast } from 'sonner';
import StationResults, { FUEL_LABEL } from '@/components/niza-fuel/StationResults';
import SavedLocationDialog from '@/components/niza-fuel/SavedLocationDialog';
import {
  listSavedLocations, createSavedLocation, updateSavedLocation, deleteSavedLocation, runSavedLocation,
  type FuelSearchResult, type FuelType, type SavedLocation, type SavedLocationInput,
} from '@/lib/fuelApi';

interface CardState {
  loading: boolean;
  error: string | null;
  result: FuelSearchResult | null;
}

/** Left-edge colour that tells the fuels apart at a glance. */
const FUEL_ACCENT: Record<FuelType, { bar: string; chip: string }> = {
  e10: { bar: 'border-l-emerald-500', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  e5: { bar: 'border-l-violet-500', chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' },
  b7: { bar: 'border-l-amber-500', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
};

function Detail({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border bg-background/70 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

/** The first tab: places saved by this login, each showing its prices without any setting up. */
export default function SavedLocations() {
  const [items, setItems] = useState<SavedLocation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [dialog, setDialog] = useState<{ open: boolean; existing: SavedLocation | null }>({ open: false, existing: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runOne = useCallback(async (s: SavedLocation) => {
    setCards((c) => ({ ...c, [s.id]: { loading: true, error: null, result: c[s.id]?.result ?? null } }));
    try {
      const result = await runSavedLocation(s);
      if (mounted.current) setCards((c) => ({ ...c, [s.id]: { loading: false, error: null, result } }));
    } catch (e) {
      if (mounted.current) setCards((c) => ({ ...c, [s.id]: { loading: false, error: (e as Error).message, result: null } }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await listSavedLocations();
      if (!mounted.current) return;
      setItems(list);
      // All saved searches run at once; they read the saved copy of the prices, so this is quick.
      list.forEach((s) => runOne(s));
    } catch (e) {
      if (mounted.current) {
        setLoadError((e as Error).message);
        setItems([]);
      }
    }
  }, [runOne]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (input: SavedLocationInput) => {
    if (dialog.existing) {
      await updateSavedLocation(dialog.existing.id, input);
      toast.success('Location updated');
    } else {
      await createSavedLocation(input, items?.length ?? 0);
      toast.success('Location saved');
    }
    await load();
  };

  const remove = async (s: SavedLocation) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      await deleteSavedLocation(s.id);
      setItems((list) => (list || []).filter((x) => x.id !== s.id));
      toast.success('Location deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (items === null) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your locations...
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Your own list: only you see these. They stay saved and show current prices every time you open this page.
        </p>
        <Button onClick={() => setDialog({ open: true, existing: null })} className="gap-2">
          <Plus className="h-4 w-4" /> Add location
        </Button>
      </div>

      {loadError && (
        <Card className="border-destructive/40"><CardContent className="flex gap-3 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" /> {loadError}
        </CardContent></Card>
      )}

      {items.length === 0 && !loadError && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
              <MapPin className="h-7 w-7 text-emerald-600" />
            </div>
            <div className="text-lg font-semibold">No saved locations yet</div>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Add a postcode, a city or a latitude and longitude once, and it will show its cheapest stations every time you open Niza Fuel.
              You can also press "Save this search" on the other tabs.
            </p>
            <Button onClick={() => setDialog({ open: true, existing: null })} className="gap-2">
              <Plus className="h-4 w-4" /> Add your first location
            </Button>
          </CardContent>
        </Card>
      )}

      {items.map((s) => {
        const state = cards[s.id];
        const accent = FUEL_ACCENT[s.fuel];
        const published = state?.result?.cache.source_published_at;
        return (
          <Card key={s.id} className={`overflow-hidden border-l-4 shadow-sm ${accent.bar}`}>
            {/* Name and actions */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-gradient-to-r from-muted/40 to-transparent px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold leading-tight">{s.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${accent.chip}`}>{FUEL_LABEL[s.fuel]}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => runOne(s)} title="Reload prices" aria-label="Reload prices" disabled={state?.loading}>
                  <RefreshCw className={`h-4 w-4 ${state?.loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, existing: s })} title="Edit" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(s)} title="Delete" aria-label="Delete" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* All the details, right below the name */}
            <div className="grid gap-2.5 border-b bg-muted/20 px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-6">
              <Detail icon={MapPin} label={s.kind === 'place' ? 'Postcode / city' : 'Point'}>
                {s.place_label || s.query || 'Saved point'}
              </Detail>
              <Detail icon={Compass} label="Coordinates">
                {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
              </Detail>
              <Detail icon={Crosshair} label="Search radius">
                {s.radius_miles} mile{s.radius_miles === 1 ? '' : 's'}
              </Detail>
              <Detail icon={Fuel} label="Fuel">{FUEL_LABEL[s.fuel]}</Detail>
              <Detail icon={ArrowUpDown} label="Sorted by">{s.sort === 'price' ? 'Cheapest first' : 'Nearest first'}</Detail>
              <Detail icon={ListOrdered} label="Showing">
                {state?.result ? `${state.result.count} of top ${s.result_limit}` : `Top ${s.result_limit}`} stations
              </Detail>
              {published && (
                <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Price data published {new Date(published).toLocaleString('en-GB')}
                  </p>
                </div>
              )}
            </div>

            {/* Results */}
            <CardContent className="px-4 py-5 sm:px-6">
              {!state || (state.loading && !state.result) ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading prices...
                </div>
              ) : state.error ? (
                <div className="flex items-start gap-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
                </div>
              ) : state.result ? (
                <StationResults result={state.result} fuel={s.fuel} compact />
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <SavedLocationDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        title={dialog.existing ? 'Edit location' : 'Add location'}
        existing={dialog.existing}
        draft={dialog.existing ? { ...dialog.existing, query: dialog.existing.query ?? '' } : undefined}
        onSave={save}
      />
    </div>
  );
}
