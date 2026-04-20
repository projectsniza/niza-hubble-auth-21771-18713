import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Lock, Unlock, Shield, AlertTriangle, Eye, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TimesheetMonthLockProps {
  branchId: string | null;
  organizationId?: string | null;
  monthStart: Date;
}

interface LockRecord {
  id: string;
  branch_id: string;
  month_start: string;
  locked_by: string;
  lock_message: string | null;
  locked_at: string;
  locker_name?: string;
}

export function TimesheetMonthLock({ branchId, organizationId, monthStart }: TimesheetMonthLockProps) {
  const { user } = useAuth();
  const [lockRecord, setLockRecord] = useState<LockRecord | null>(null);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<'form' | 'preview'>('form');

  const isSuperAdmin = user?.role === 'super_admin';
  const canLock = user?.role === 'manager' || isSuperAdmin || user?.role === 'hr';
  const canUnlock = isSuperAdmin;

  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndDate = new Date(monthStart);
  monthEndDate.setMonth(monthEndDate.getMonth() + 1);
  monthEndDate.setDate(monthEndDate.getDate() - 1);
  const periodLabel = `${format(monthStart, 'dd MMM yyyy')} – ${format(monthEndDate, 'dd MMM yyyy')}`;

  useEffect(() => {
    if (!branchId) return;
    fetchLock();
  }, [branchId, monthStartStr]);

  const fetchLock = async () => {
    if (!branchId) return;
    const { data } = await supabase
      .from('timesheet_month_locks')
      .select('*')
      .eq('branch_id', branchId)
      .eq('month_start', monthStartStr)
      .maybeSingle();

    if (data) {
      // Fetch locker name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', data.locked_by)
        .single();
      setLockRecord({ ...data, locker_name: profile?.name || 'Unknown' });
    } else {
      setLockRecord(null);
    }
  };

  const handleLock = async () => {
    if (!branchId || !user?.id) return;
    if (!lockMessage.trim()) {
      toast.error('Please enter a confirmation message before locking');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('timesheet_month_locks').insert({
        branch_id: branchId,
        organization_id: organizationId || null,
        month_start: monthStartStr,
        locked_by: user.id,
        lock_message: lockMessage.trim(),
      });
      if (error) throw error;
      toast.success('Monthly schedule locked and submitted');
      setShowLockDialog(false);
      setLockMessage('');
      setStep('form');
      fetchLock();
    } catch (err: any) {
      toast.error(err.message || 'Failed to lock');
    } finally {
      setSubmitting(false);
    }
  };

  const openLockDialog = () => {
    setStep('form');
    setLockMessage('');
    setShowLockDialog(true);
  };

  const goToPreview = () => {
    if (!lockMessage.trim()) {
      toast.error('Please enter a message before previewing');
      return;
    }
    setStep('preview');
  };

  const handleUnlock = async () => {
    if (!lockRecord || !isSuperAdmin) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('timesheet_month_locks').delete().eq('id', lockRecord.id);
      if (error) throw error;
      toast.success('Monthly schedule unlocked');
      setLockRecord(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlock');
    } finally {
      setSubmitting(false);
    }
  };

  if (!branchId) return null;

  return (
    <>
      {lockRecord ? (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600" />
              <div>
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Locked & Submitted
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                  by {lockRecord.locker_name} on {format(new Date(lockRecord.locked_at), 'dd MMM yyyy HH:mm')}
                </span>
                {lockRecord.lock_message && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic">
                    "{lockRecord.lock_message}"
                  </p>
                )}
              </div>
            </div>
            {canUnlock && (
              <Button size="sm" variant="outline" onClick={handleUnlock} disabled={submitting} className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-100">
                <Unlock className="h-3 w-3" />
                Unlock
              </Button>
            )}
          </CardContent>
        </Card>
      ) : canLock ? (
        <Button size="sm" variant="outline" onClick={() => setShowLockDialog(true)} className="gap-2">
          <Shield className="h-4 w-4" />
          Lock & Submit Month
        </Button>
      ) : null}

      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Lock Monthly Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                Once locked, only a Super Admin can modify or unlock this period. Store accounts will not be able to edit.
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Message (visible to all)</label>
              <Textarea
                value={lockMessage}
                onChange={(e) => setLockMessage(e.target.value)}
                placeholder="e.g., April schedule verified and submitted for payroll"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)}>Cancel</Button>
            <Button onClick={handleLock} disabled={submitting} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Lock className="h-4 w-4" />
              {submitting ? 'Locking...' : 'Lock & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
