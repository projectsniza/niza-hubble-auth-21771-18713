import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Flag, ShieldCheck, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { isSuperAdmin } from '@/lib/roles';

export interface ReviewRecord {
  id: string;
  branch_id: string | null;
  period_from: string;
  period_to: string;
  status: string;
  notes: string | null;
  reviewed_by_name: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  flagged_by_name: string | null;
  flagged_by_email: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
}

export interface AuditRecord {
  id: string;
  sale_date: string | null;
  field_key: string;
  old_value: number | null;
  new_value: number | null;
  changed_by_name: string | null;
  changed_by_email: string | null;
  changed_at: string;
}

interface Props {
  branchId: string | null;      // null when "all branches"
  from: string;
  to: string;
  onStatusChange?: (status: string) => void;
  refreshKey?: number;
}

const stamp = (iso?: string | null) => (iso ? format(new Date(iso), 'dd MMM yyyy HH:mm') : '—');

export default function OutputReviewPanel({ branchId, from, to, onStatusChange, refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const client = supabase as any;
    let rq = client.from('niza_output_reviews').select('*')
      .eq('period_from', from).eq('period_to', to).limit(1);
    rq = branchId ? rq.eq('branch_id', branchId) : rq.is('branch_id', null);
    const [{ data: rev }, { data: aud }] = await Promise.all([
      rq,
      (branchId
        ? client.from('niza_output_edit_audit').select('*').eq('branch_id', branchId)
        : client.from('niza_output_edit_audit').select('*'))
        .gte('sale_date', from).lte('sale_date', to)
        .order('changed_at', { ascending: false }).limit(200),
    ]);
    const found = (rev || [])[0] || null;
    setReview(found);
    setNote(found?.notes || '');
    setAudit((aud || []) as AuditRecord[]);
    onStatusChange?.(found?.status || 'pending');
  }, [branchId, from, to, onStatusChange]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const upsert = async (patch: Record<string, unknown>, status: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const client = supabase as any;
      const payload = {
        branch_id: branchId,
        period_from: from,
        period_to: to,
        status,
        notes: note || null,
        ...patch,
      };
      const { error } = await client
        .from('niza_output_reviews')
        .upsert(payload, { onConflict: 'branch_id,period_from,period_to' });
      if (error) throw error;
      toast.success(
        status === 'approved' ? 'Output approved' :
        status === 'flagged' ? 'Flagged for top management review' : 'Review updated',
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save review');
    } finally {
      setBusy(false);
    }
  };

  const approve = () => upsert({
    reviewed_by: user!.id,
    reviewed_by_name: user!.name,
    reviewed_by_email: user!.email,
    reviewed_at: new Date().toISOString(),
    flagged_at: null, flag_reason: null,
  }, 'approved');

  const flag = () => {
    if (!note.trim()) return toast.error('Add a note describing the unresolved problem before flagging');
    upsert({
      flagged_by: user!.id,
      flagged_by_name: user!.name,
      flagged_by_email: user!.email,
      flagged_at: new Date().toISOString(),
      flag_reason: note.trim(),
    }, 'flagged');
  };

  const resolve = () => upsert({
    resolved_by: user!.id,
    resolved_by_name: user!.name,
    resolved_at: new Date().toISOString(),
    reviewed_by: user!.id,
    reviewed_by_name: user!.name,
    reviewed_by_email: user!.email,
    reviewed_at: new Date().toISOString(),
  }, 'approved');

  const status = review?.status || 'pending';

  return (
    <Card className="p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold text-sm">Accounts Assistant Review</div>
            <p className="text-xs text-muted-foreground">
              Approve the reviewed data, or flag it to top management if the problem can't be resolved.
            </p>
          </div>
        </div>
        <Badge variant={status === 'approved' ? 'default' : status === 'flagged' ? 'destructive' : 'secondary'}>
          {status === 'approved' ? 'Approved' : status === 'flagged' ? 'Flagged to Top Management' : 'Pending review'}
        </Badge>
      </div>

      <Textarea
        rows={2}
        placeholder="Review notes / reason for flagging (visible to top management)"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="text-sm mb-3"
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={approve} disabled={busy || !user}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Approve Output
        </Button>
        <Button size="sm" variant="destructive" onClick={flag} disabled={busy || !user}>
          <Flag className="h-4 w-4 mr-2" /> Flag to Top Management
        </Button>
        {status === 'flagged' && isSuperAdmin(user) && (
          <Button size="sm" variant="secondary" onClick={resolve} disabled={busy}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Resolve &amp; Approve (Management)
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 mt-4 text-xs">
        <div className="rounded-lg border p-2">
          <div className="text-muted-foreground">Approved by</div>
          <div className="font-medium">{review?.reviewed_by_name || '—'}</div>
          <div className="text-muted-foreground">{review?.reviewed_by_email || ''}</div>
          <div className="text-muted-foreground">{stamp(review?.reviewed_at)}</div>
        </div>
        <div className="rounded-lg border p-2">
          <div className="text-muted-foreground">Flagged by</div>
          <div className="font-medium">{review?.flagged_by_name || '—'}</div>
          <div className="text-muted-foreground">{review?.flagged_by_email || ''}</div>
          <div className="text-muted-foreground">{stamp(review?.flagged_at)}</div>
        </div>
        <div className="rounded-lg border p-2">
          <div className="text-muted-foreground">Management resolution</div>
          <div className="font-medium">{review?.resolved_by_name || '—'}</div>
          <div className="text-muted-foreground">{stamp(review?.resolved_at)}</div>
        </div>
      </div>

      {review?.flag_reason && status === 'flagged' && (
        <p className="text-xs text-destructive mt-2">Reason: {review.flag_reason}</p>
      )}

      <div className="mt-4">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <History className="h-4 w-4" /> Modification history ({audit.length})
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border divide-y text-xs">
          {audit.length === 0 && <div className="p-3 text-muted-foreground">No manual modifications recorded for this period.</div>}
          {audit.map(a => (
            <div key={a.id} className="p-2 flex flex-wrap justify-between gap-2">
              <span>
                <span className="font-medium">{a.sale_date}</span> · {a.field_key}:{' '}
                <span className="text-muted-foreground">{a.old_value ?? '—'}</span> → <span className="font-medium">{a.new_value ?? '—'}</span>
              </span>
              <span className="text-muted-foreground">
                {a.changed_by_name || 'Unknown'} ({a.changed_by_email || 'n/a'}) · {stamp(a.changed_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
