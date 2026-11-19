import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, AlertTriangle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import StationResults, { FUEL_LABEL } from '@/components/niza-fuel/StationResults';
import SavedLocationDialog from '@/components/niza-fuel/SavedLocationDialog';
import {
  listSavedLocations, createSavedLocation, updateSavedLocation, deleteSavedLocation, runSavedLocation,
  type FuelSearchResult, type SavedLocation, type SavedLocationInput,
} from '@/lib/fuelApi';

interface CardState {
  loading: boolean;
  error: string | null;
  result: FuelSearchResult | null;
}

const describe = (s: SavedLocation) =>
  `${s.place_label || s.query || ''} · ${s.radius_miles} mi · ${s.fuel.toUpperCase()} · ${s.sort === 'price' ? 'cheapest first' : 'nearest first'}`;

/** The first tab: places saved for good, each showing its prices without any setting up. */
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
      <Card><CardContent className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your locations...
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Locations you save here stay for good and show their current prices as soon as you open this page.
        </p>
        <Button onClick={() => setDialog({ open: true, existing: null })} className="gap-2">
          <Plus className="h-4 w-4" /> Add location
        </Button>
      </div>

      {loadError && (
        <Card className="border-destructive/40"><CardContent className="p-4 text-sm flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /> {loadError}
        </CardContent></Card>
      )}

      {items.length === 0 && !loadError && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="font-semibold">No saved locations yet</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add a postcode, a city or a latitude and longitude once, and it will show its cheapest stations every time you open Niza Fuel.
              You can also press "Save this search" on the other two tabs.
            </p>
            <Button onClick={() => setDialog({ open: true, existing: null })} className="gap-2">
              <Plus className="h-4 w-4" /> Add your first location
            </Button>
          </CardContent>
        </Card>
      )}

      {items.map((s) => {
        const state = cards[s.id];
        return (
          <Card key={s.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {s.name}
                    <Badge variant="outline">{FUEL_LABEL[s.fuel]}</Badge>
                  </CardTitle>
                  <CardDescription>{describe(s)}</CardDescription>
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
            </CardHeader>
            <CardContent>
              {!state || (state.loading && !state.result) ? (
                <div className="py-6 flex items-center justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading prices...
                </div>
              ) : state.error ? (
                <div className="flex items-start gap-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {state.error}
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
