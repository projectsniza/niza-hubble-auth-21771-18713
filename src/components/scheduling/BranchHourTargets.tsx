import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Save, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BranchRow {
  id: string;
  name: string;
  organization_id: string;
  organization_name?: string;
}

interface TargetRow {
  id?: string;
  branch_id: string;
  organization_id: string;
  target_hours: number | null;
  low_threshold_hours: number | null;
  high_threshold_hours: number | null;
}

export function BranchHourTargets() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetRow>>({});
  const [drafts, setDrafts] = useState<Record<string, { target: string; low: string; high: string }>>({});
  const [search, setSearch] = useState('');
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'super_admin') fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchesRes, targetsRes] = await Promise.all([
        supabase.from('branches').select('id, name, organization_id, organization:organizations(name)').order('name'),
        supabase.from('branch_weekly_hour_targets').select('*'),
      ]);

      const flat: BranchRow[] = (branchesRes.data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        organization_id: b.organization_id,
        organization_name: b.organization?.name,
      }));
      setBranches(flat);

      const map: Record<string, TargetRow> = {};
      const initialDrafts: Record<string, { target: string; low: string; high: string }> = {};
      (targetsRes.data || []).forEach((t: any) => {
        map[t.branch_id] = t;
        initialDrafts[t.branch_id] = {
          target: t.target_hours != null ? String(t.target_hours) : '',
          low: t.low_threshold_hours != null ? String(t.low_threshold_hours) : '',
          high: t.high_threshold_hours != null ? String(t.high_threshold_hours) : '',
        };
      });
      setTargets(map);
      setDrafts(initialDrafts);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.organization_name || '').toLowerCase().includes(q)
    );
  }, [branches, search]);

  const setField = (branchId: string, key: 'target' | 'low' | 'high', value: string) => {
    setDrafts(prev => ({
      ...prev,
      [branchId]: {
        target: prev[branchId]?.target ?? '',
        low: prev[branchId]?.low ?? '',
        high: prev[branchId]?.high ?? '',
        [key]: value,
      },
    }));
  };

  const saveBranch = async (branch: BranchRow) => {
    const draft = drafts[branch.id] || { target: '', low: '', high: '' };
    const target = draft.target === '' ? 0 : Number(draft.target);
    const low = draft.low === '' ? 0 : Number(draft.low);
    const high = draft.high === '' ? 0 : Number(draft.high);

    if ([target, low, high].some(n => Number.isNaN(n) || n < 0)) {
      toast.error('All values must be numbers ≥ 0');
      return;
    }
    if (high && low && high < low) {
      toast.error('High threshold must be greater than low threshold');
      return;
    }

    setSavingBranchId(branch.id);
    try {
      const existing = targets[branch.id];
      const payload = {
        branch_id: branch.id,
        organization_id: branch.organization_id,
        target_hours: target,
        low_threshold_hours: low,
        high_threshold_hours: high,
        created_by: user?.id,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('branch_weekly_hour_targets')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branch_weekly_hour_targets')
          .insert(payload);
        if (error) throw error;
      }
      toast.success(`Targets saved for ${branch.name}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save targets');
    } finally {
      setSavingBranchId(null);
    }
  };

  if (user?.role !== 'super_admin') return null;

  const configuredCount = Object.keys(targets).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Weekly Hour Targets
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Set the ideal weekly scheduled hours and warning thresholds for each branch. Includes both permanent and temporary staff.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {configuredCount} configured
          </Badge>
          <Badge variant="outline">
            {branches.length - configuredCount} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search branch or organization…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>How it works:</strong> Branches will see a <span className="text-emerald-700 font-semibold">green</span> indicator when scheduled hours are within range,{' '}
            <span className="text-amber-700 font-semibold">amber LOW</span> when below the low threshold, and{' '}
            <span className="text-rose-700 font-semibold">red HIGH</span> when above the high threshold.
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No branches found.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(branch => {
              const draft = drafts[branch.id] || { target: '', low: '', high: '' };
              const isConfigured = !!targets[branch.id];
              const isSaving = savingBranchId === branch.id;
              return (
                <div
                  key={branch.id}
                  className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-semibold text-sm">{branch.name}</div>
                      <div className="text-xs text-muted-foreground">{branch.organization_name}</div>
                      {isConfigured ? (
                        <Badge variant="secondary" className="mt-1 text-[10px] bg-emerald-100 text-emerald-700 border-0">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="mt-1 text-[10px]">Not set</Badge>
                      )}
                    </div>

                    <div className="w-28">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Target hrs</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        placeholder="e.g. 320"
                        value={draft.target}
                        onChange={(e) => setField(branch.id, 'target', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="w-28">
                      <Label className="text-[10px] uppercase tracking-wide text-amber-700">Low ≤</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        placeholder="e.g. 280"
                        value={draft.low}
                        onChange={(e) => setField(branch.id, 'low', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="w-28">
                      <Label className="text-[10px] uppercase tracking-wide text-rose-700">High ≥</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.5"
                        placeholder="e.g. 360"
                        value={draft.high}
                        onChange={(e) => setField(branch.id, 'high', e.target.value)}
                        className="h-9"
                      />
                    </div>

                    <Button
                      size="sm"
                      onClick={() => saveBranch(branch)}
                      disabled={isSaving}
                      className="gap-1 h-9"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
