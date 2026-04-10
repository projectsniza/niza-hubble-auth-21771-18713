import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Certification {
  id: string;
  employee_id: string;
  certification_name: string;
  gold_coins: number;
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
  const [coins, setCoins] = useState('1');
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
    setCertifications(data || []);
  };

  const totalCoins = certifications.reduce((sum, c) => sum + c.gold_coins, 0);

  const handleAdd = async () => {
    if (!certName.trim()) { toast.error('Enter certification name'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('employee_certifications').insert({
        employee_id: employeeId,
        certification_name: certName.trim(),
        gold_coins: parseInt(coins) || 1,
        notes: notes.trim() || null,
        awarded_by: user?.id,
      });
      if (error) throw error;
      toast.success('Certification added');
      setShowDialog(false);
      setCertName(''); setCoins('1'); setNotes('');
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
      {/* Coin Badge - clickable to show details */}
      <GoldCoinBadge totalCoins={totalCoins} certifications={certifications} canManage={canManage} onAdd={() => setShowDialog(true)} onDelete={handleDelete} />

      {/* Add Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Add Certification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Certification Name *</Label>
              <Input value={certName} onChange={e => setCertName(e.target.value)} placeholder="e.g., First Aid Level 3" />
            </div>
            <div>
              <Label>Gold Coins (Points)</Label>
              <Input type="number" min="1" value={coins} onChange={e => setCoins(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Assign weight based on certification importance</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Award className="h-4 w-4" />
              {submitting ? 'Adding...' : 'Add Certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Standalone coin badge that can be used anywhere
interface GoldCoinBadgeProps {
  totalCoins: number;
  certifications: Certification[];
  canManage?: boolean;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
}

export function GoldCoinBadge({ totalCoins, certifications, canManage, onAdd, onDelete }: GoldCoinBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (totalCoins === 0 && !canManage) return null;

  return (
    <>
      <button
        onClick={() => setShowDetails(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40 border border-amber-300/50 hover:shadow-md transition-all cursor-pointer"
        title="Gold Coins"
      >
        <span className="text-amber-600 text-sm">🪙</span>
        <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{totalCoins}</span>
      </button>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🪙</span>
              Gold Coins — {totalCoins} Total
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No certifications yet</p>
            ) : (
              certifications.map(c => (
                <Card key={c.id} className="border-amber-200/50">
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.certification_name}</p>
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                        🪙 {c.gold_coins}
                      </Badge>
                      {canManage && onDelete && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(c.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
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

// Hook to fetch certifications for use in employee list
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
      (data || []).forEach(c => {
        if (!map[c.employee_id]) map[c.employee_id] = { total: 0, certs: [] };
        map[c.employee_id].total += c.gold_coins;
        map[c.employee_id].certs.push(c);
      });
      setCertMap(map);
    };
    fetchAll();
  }, [employeeIds.join(',')]);

  return certMap;
}
