import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFuelStatus, refreshFuelPrices, type FuelSync } from '@/lib/fuelApi';

const when = (v: string | null) => (v ? new Date(v).toLocaleString('en-GB') : 'Never');

export default function DataStatus() {
  const [sync, setSync] = useState<FuelSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getFuelStatus();
      setSync(r.sync);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await refreshFuelPrices();
      setSync(r.sync);
      toast.success(`Prices refreshed: ${r.result.rows ?? 0} stations`);
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Data & Refresh
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prices are downloaded once a day (on the first search after 24 hours) and saved, so searches are instant. The first search of the day takes a few seconds longer.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40"><CardContent className="p-4 text-sm flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /> {error}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price cache</CardTitle>
          <CardDescription>What is saved right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</div>
          ) : (
            <dl className="grid grid-cols-[170px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {sync?.status === 'ok' && <Badge className="bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Up to date</Badge>}
                {sync?.status === 'running' && <Badge variant="secondary">Refreshing…</Badge>}
                {sync?.status === 'error' && <Badge variant="destructive">Last refresh failed</Badge>}
                {(!sync || sync.status === 'never') && <Badge variant="outline">Not downloaded yet</Badge>}
              </dd>
              <dt className="text-muted-foreground">Last downloaded</dt>
              <dd>{when(sync?.last_fetched_at ?? null)}</dd>
              <dt className="text-muted-foreground">Last attempt</dt>
              <dd>{when(sync?.last_attempt_at ?? null)}</dd>
              <dt className="text-muted-foreground">Stations saved</dt>
              <dd>{sync?.row_count?.toLocaleString('en-GB') ?? 0}</dd>
              <dt className="text-muted-foreground">Rows skipped</dt>
              <dd>
                {sync?.skipped_count?.toLocaleString('en-GB') ?? 0}
                <span className="text-muted-foreground"> (closed, no price, or no valid location)</span>
              </dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="break-all">
                FuelCosts.co.uk daily export (Hugging Face: jamesb7/fuel-prices-uk), from the UK Government Fuel Finder.
                <div className="text-xs text-muted-foreground">{sync?.source_url}</div>
              </dd>
              {sync?.error && (
                <>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="text-destructive break-words">{sync.error}</dd>
                </>
              )}
            </dl>
          )}
          <Button onClick={refresh} disabled={refreshing || loading} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh prices now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
