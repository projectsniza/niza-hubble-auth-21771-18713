import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { getFuelStatus, refreshFuelPrices, syncFuelPrices, type FuelSync } from '@/lib/fuelApi';

const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('en-GB') : 'Never');

export default function DataStatus() {
  const { user } = useAuth();
  const [sync, setSync] = useState<FuelSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'check' | 'force' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSync((await getFuelStatus()).sync);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const check = async () => {
    setBusy('check');
    try {
      const r = await syncFuelPrices();
      setSync(r.sync);
      if (r.result.changed) toast.success(`New prices loaded: ${r.result.rows ?? 0} stations`);
      else toast.info('Already up to date: nothing new has been published anything new.');
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const force = async () => {
    setBusy('force');
    try {
      const r = await refreshFuelPrices();
      setSync(r.sync);
      toast.success(`Prices loaded: ${r.result.rows ?? 0} stations`);
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    } finally {
      setBusy(null);
    }
  };

  // Refreshing the data is for the Super Admin; everyone else goes back to the prices page.
  if (user && user.role !== 'super_admin') return <Navigate to="/niza-fuel" replace />;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Data & Refresh
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Searches always answer straight away from the saved copy. The app checks for new prices and updates its saved copy
          only when something new has been published. No old data is kept.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40"><CardContent className="p-4 text-sm flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /> {error}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved prices</CardTitle>
          <CardDescription>What is saved right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</div>
          ) : (
            <dl className="grid grid-cols-[190px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                {sync?.status === 'ok' && <Badge className="bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Up to date</Badge>}
                {sync?.status === 'running' && <Badge variant="secondary">Updating…</Badge>}
                {sync?.status === 'error' && <Badge variant="destructive">Last update failed</Badge>}
                {(!sync || sync.status === 'never') && <Badge variant="outline">Not loaded yet</Badge>}
              </dd>
              <dt className="text-muted-foreground">Prices published</dt>
              <dd>{when(sync?.source_published_at)}</dd>
              <dt className="text-muted-foreground">Loaded into the app</dt>
              <dd>{when(sync?.last_fetched_at)}</dd>
              <dt className="text-muted-foreground">Last checked for new data</dt>
              <dd>{when(sync?.last_checked_at)}</dd>
              <dt className="text-muted-foreground">Stations saved</dt>
              <dd>{sync?.row_count?.toLocaleString('en-GB') ?? 0}</dd>
              <dt className="text-muted-foreground">Rows skipped</dt>
              <dd>
                {sync?.skipped_count?.toLocaleString('en-GB') ?? 0}
                <span className="text-muted-foreground"> (closed, no price, or no valid location)</span>
              </dd>
              {sync?.error && (
                <>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="text-destructive break-words">{sync.error}</dd>
                </>
              )}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={check} disabled={busy !== null || loading} className="gap-2">
              {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Check for new data
            </Button>
            <Button onClick={force} disabled={busy !== null || loading} variant="outline" className="gap-2">
              {busy === 'force' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
              Update again anyway
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it stays up to date</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            New prices are published about once a day. Each check only asks "has anything new been published?" and updates nothing
            unless the answer is yes. When there are new prices, they replace the saved copy: stations that are gone are deleted and no history is kept.
          </p>
          <p>
            A check starts in the background whenever someone searches and the last check was over an hour ago, so a search never waits for it.
            For checks even when nobody is using the app, an hourly schedule can be switched on in Supabase (Cron).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
