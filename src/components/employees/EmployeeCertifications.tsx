import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Plus, Trash2, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TIERS, TIER_ORDER, TierKey, resolveTier } from '@/lib/certificationTiers';
import { cn } from '@/lib/utils';

interface Certification {
  id: string;
  employee_id: string;
  certification_name: string;
  gold_coins: number;
  coin_tier: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  employeeId: string;
  canManage?: boolean;
  autoOpen?: boolean;
  onClose?: () => void;
}

export function EmployeeCertifications({ employeeId, canManage = false, autoOpen = false, onClose }: Props) {
  const { user } = useAuth();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [showDialog, setShowDialog] = useState(autoOpen);
  const [certName, setCertName] = useState('');
  const [tier, setTier] = useState<TierKey>('gold');
  const [points, setPoints] = useState<string>(String(TIERS.gold.defaultPoints));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCertifications();
  }, [employeeId]);

  const fetchCertifications = async () => {
    const { data } = await supabase
      .from('employee_certifications')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    setCertifications((data || []) as Certification[]);
  };

  const totalCoins = certifications.reduce((sum, c) => sum + (c.gold_coins || 0), 0);
  const tierBreakdown = TIER_ORDER.map((k) => ({
    key: k,
    meta: TIERS[k],
    count: certifications.filter((c) => (c.coin_tier || 'gold') === k).length,
  })).filter((t) => t.count > 0);

  const handleTierChange = (t: TierKey) => {
    setTier(t);
    setPoints(String(TIERS[t].defaultPoints));
  };

  const handleAdd = async () => {
    if (!certName.trim()) { toast.error('Enter certification name'); return; }
    setSubmitting(true);
    try {
      const parsed = parseInt(points, 10);
      const { error } = await supabase.from('employee_certifications').insert({
        employee_id: employeeId,
        certification_name: certName.trim(),
        gold_coins: Number.isFinite(parsed) && parsed > 0 ? parsed : TIERS[tier].defaultPoints,
        coin_tier: tier,
        notes: notes.trim() || null,
        awarded_by: user?.id,
      });
      if (error) throw error;
      toast.success('Certification added');
      setShowDialog(false);
      setCertName(''); setTier('gold'); setPoints(String(TIERS.gold.defaultPoints)); setNotes('');
      fetchCertifications();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('employee_certifications').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Certification removed');
    fetchCertifications();
  };

  return (
    <div>
      <CertificationsBadge
        totalCoins={totalCoins}
        certifications={certifications}
        canManage={canManage}
        onAdd={() => setShowDialog(true)}
        onDelete={handleDelete}
      />

      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o && onClose) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Add Certification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Certification Name *</Label>
              <Input value={certName} onChange={(e) => setCertName(e.target.value)} placeholder="e.g., First Aid Level 3" />
            </div>
            <div>
              <Label>Tier</Label>
              <div className="grid grid-cols-5 gap-2 mt-1">
                {TIER_ORDER.map((k) => {
                  const t = TIERS[k];
                  const Icon = t.icon;
                  const active = tier === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleTierChange(k)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition',
                        active ? `${t.bg} ${t.border} ring-2 ring-primary/40` : 'border-border hover:bg-accent'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', t.fg)} />
                      <span className="text-[10px] font-medium">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground">{t.defaultPoints}pt</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Override the default tier weight if needed</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting} className="gap-2">
              <Award className="h-4 w-4" />
              {submitting ? 'Adding...' : 'Add Certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BadgeProps {
  totalCoins: number;
  certifications: Certification[];
  canManage?: boolean;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

/** Hover-first coin badge showing tiered breakdown and certification list. */
export function CertificationsBadge({ totalCoins, certifications, canManage, onAdd, onDelete, compact }: BadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (totalCoins === 0 && !canManage) return null;

  const tierCounts = TIER_ORDER.map((k) => ({
    key: k,
    meta: TIERS[k],
    count: certifications.filter((c) => (c.coin_tier || 'gold') === k).length,
  })).filter((t) => t.count > 0);

  const trigger = (
    <button
      type="button"
      onClick={() => setShowDetails(true)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 hover:shadow-sm transition-all cursor-pointer',
        compact ? 'text-xs' : 'text-sm'
      )}
      title="View certifications"
    >
      {tierCounts.slice(0, 3).map((t) => {
        const Icon = t.meta.icon;
        return <Icon key={t.key} className={cn('h-3.5 w-3.5', t.meta.fg)} />;
      })}
      {tierCounts.length === 0 && <Award className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className="font-semibold text-foreground">{totalCoins}</span>
    </button>
  );

  return (
    <>
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent align="start" className="w-72 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Certifications</p>
            <span className="text-xs text-muted-foreground">{totalCoins} pts total</span>
          </div>
          {tierCounts.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tierCounts.map((t) => {
                const Icon = t.meta.icon;
                return (
                  <Badge key={t.key} variant="outline" className={cn('gap-1', t.meta.bg, t.meta.border)}>
                    <Icon className={cn('h-3 w-3', t.meta.fg)} />
                    <span className="text-[10px]">{t.meta.label} × {t.count}</span>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {certifications.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No certifications yet</p>
            ) : (
              certifications.map((c) => {
                const t = resolveTier(c.coin_tier);
                const Icon = t.icon;
                return (
                  <div key={c.id} className="flex items-center gap-2 py-1">
                    <Icon className={cn('h-4 w-4 shrink-0', t.fg)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.certification_name}</p>
                      {c.notes && <p className="text-[10px] text-muted-foreground truncate">{c.notes}</p>}
                    </div>
                    <span className={cn('text-[10px] font-semibold', t.fg)}>{c.gold_coins}</span>
                  </div>
                );
              })
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Certifications — {totalCoins} points
            </DialogTitle>
          </DialogHeader>
          {tierCounts.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {tierCounts.map((t) => {
                const Icon = t.meta.icon;
                return (
                  <Badge key={t.key} variant="outline" className={cn('gap-1.5', t.meta.bg, t.meta.border)}>
                    <Icon className={cn('h-3.5 w-3.5', t.meta.fg)} />
                    <span>{t.meta.label} × {t.count}</span>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No certifications yet</p>
            ) : (
              certifications.map((c) => {
                const t = resolveTier(c.coin_tier);
                const Icon = t.icon;
                return (
                  <Card key={c.id} className={cn('border', t.border)}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center', t.bg)}>
                          <Icon className={cn('h-4 w-4', t.fg)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.certification_name}</p>
                          {c.notes && <p className="text-xs text-muted-foreground truncate">{c.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('gap-1', t.bg, t.border)}>
                          <span className={cn('text-xs font-semibold', t.fg)}>{t.label}</span>
                          <span className="text-xs">· {c.gold_coins}</span>
                        </Badge>
                        {canManage && onDelete && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(c.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
          {canManage && onAdd && (
            <Button variant="outline" onClick={() => { setShowDetails(false); onAdd(); }} className="gap-2 w-full">
              <Plus className="h-4 w-4" />
              Add Certification
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Back-compat alias for existing imports
export const GoldCoinBadge = CertificationsBadge;

/** Hook to fetch certifications for a list of employees. */
export function useEmployeeCertifications(employeeIds: string[]) {
  const [certMap, setCertMap] = useState<Record<string, { total: number; certs: Certification[] }>>({});

  useEffect(() => {
    if (employeeIds.length === 0) return;
    const fetchAll = async () => {
      const { data } = await supabase
        .from('employee_certifications')
        .select('*')
        .in('employee_id', employeeIds)
        .order('created_at', { ascending: false });

      const map: Record<string, { total: number; certs: Certification[] }> = {};
      ((data || []) as Certification[]).forEach((c) => {
        if (!map[c.employee_id]) map[c.employee_id] = { total: 0, certs: [] };
        map[c.employee_id].total += c.gold_coins || 0;
        map[c.employee_id].certs.push(c);
      });
      setCertMap(map);
    };
    fetchAll();
  }, [employeeIds.join(',')]);

  return certMap;
}
