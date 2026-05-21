import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { NIZA_CATEGORIES } from '@/lib/nizaCategories';

interface Alert {
  id: string;
  raw_label: string;
  sample_amount: number | null;
  sale_date: string | null;
  source_filename: string | null;
  status: string;
  mapped_to_code: string | null;
  created_at: string;
  branch_id: string | null;
  branch?: { name: string } | null;
}

export default function CategoryAlerts() {
  const [items, setItems] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all' | 'resolved'>('open');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customCode, setCustomCode] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('niza_category_alerts')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });
    if (filter === 'open') q = q.eq('status', 'open');
    if (filter === 'resolved') q = q.eq('status', 'resolved');
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const resolve = async (a: Alert) => {
    const code = (mapping[a.id] === '__custom__' ? customCode[a.id] : mapping[a.id])?.trim().toUpperCase();
    if (!code) return toast.error('Pick or enter a category code first');
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('niza_category_alerts')
      .update({
        status: 'resolved',
        mapped_to_code: code,
        resolved_at: new Date().toISOString(),
        resolved_by: userData.user?.id ?? null,
      })
      .eq('id', a.id);
    if (error) return toast.error(error.message);

    // Record mapping in branch categories so future uploads recognise it.
    if (a.branch_id) {
      await supabase.from('niza_branch_categories').upsert({
        branch_id: a.branch_id,
        category_code: code,
        raw_label: a.raw_label,
        display_name: a.raw_label,
        last_seen_at: new Date().toISOString(),
      } as any, { onConflict: 'branch_id,category_code' });
    }
    toast.success(`Mapped "${a.raw_label}" → ${code}`);
    load();
  };

  const ignore = async (a: Alert) => {
    const { error } = await supabase
      .from('niza_category_alerts')
      .update({ status: 'ignored', resolved_at: new Date().toISOString() })
      .eq('id', a.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Category Alerts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Unknown departments detected in till uploads. Map each to a standard code so future uploads are not blocked.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
            No {filter === 'open' ? 'open' : ''} alerts.
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <Card key={a.id} className="p-4 border-border/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{a.raw_label}</span>
                      <Badge variant={a.status === 'open' ? 'destructive' : 'secondary'}>{a.status}</Badge>
                      {a.mapped_to_code && <Badge variant="outline">→ {a.mapped_to_code}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.branch?.name || 'Unknown branch'} · {a.sale_date || '—'} · sample £{Number(a.sample_amount || 0).toFixed(2)}
                      {a.source_filename ? ` · ${a.source_filename}` : ''}
                    </div>
                  </div>
                  {a.status === 'open' && (
                    <div className="flex items-end gap-2">
                      <div>
                        <Label className="text-xs">Map to</Label>
                        <Select
                          value={mapping[a.id] || ''}
                          onValueChange={(v) => setMapping({ ...mapping, [a.id]: v })}
                        >
                          <SelectTrigger className="w-48"><SelectValue placeholder="Pick code" /></SelectTrigger>
                          <SelectContent>
                            {NIZA_CATEGORIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.code} — {c.label}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">Custom code…</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {mapping[a.id] === '__custom__' && (
                        <Input
                          className="w-24"
                          placeholder="CODE"
                          value={customCode[a.id] || ''}
                          onChange={(e) => setCustomCode({ ...customCode, [a.id]: e.target.value })}
                        />
                      )}
                      <Button onClick={() => resolve(a)}>Map</Button>
                      <Button variant="ghost" onClick={() => ignore(a)}>Ignore</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
