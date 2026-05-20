import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface Props {
  branchId: string | null;
}

/**
 * Shows a banner to managers/HR between day 18 and day 22 of the month
 * reminding them to close & lock the current payroll month (21st–20th cycle).
 * Hides automatically once the period is locked.
 */
export function MonthCloseReminder({ branchId }: Props) {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState<boolean | null>(null);

  const today = new Date();
  const day = today.getDate();
  // Payroll period that is currently being closed = month_start of the most recent 21st
  const periodStart = day >= 21
    ? new Date(today.getFullYear(), today.getMonth(), 21)
    : new Date(today.getFullYear(), today.getMonth() - 1, 21);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 20);

  // Show reminder ONLY on the day after close (21st = overdue) and 22nd (final warning).
  // Do NOT show on the 20th itself (closing day).
  const inReminderWindow = day === 21 || day === 22;


  const role = user?.role;
  const eligible = role === 'manager' || role === 'hr';

  useEffect(() => {
    if (!eligible || !branchId || !inReminderWindow) return;
    (async () => {
      const { data } = await supabase
        .from('timesheet_month_locks')
        .select('id')
        .eq('branch_id', branchId)
        .eq('month_start', format(periodStart, 'yyyy-MM-dd'))
        .maybeSingle();
      setIsLocked(!!data);
    })();
  }, [branchId, eligible, inReminderWindow, periodStart.getTime()]);

  if (!eligible || !branchId || !inReminderWindow || isLocked) return null;

  const isFinalWarning = day === 22;
  const isOverdue = day === 21 || day === 22;

  return (
    <Alert className="border-destructive/40 bg-destructive/5">
      <CalendarClock className="h-4 w-4 text-destructive" />
      <AlertTitle>
        {isFinalWarning
          ? `FINAL WARNING: ${format(periodEnd, 'MMMM yyyy')} payroll close is overdue — lock & submit immediately`
          : `${format(periodEnd, 'MMMM yyyy')} payroll close is overdue — lock & submit now`}
      </AlertTitle>

      <AlertDescription className="text-sm">
        Please review and lock the <strong>{format(periodEnd, 'MMMM yyyy')}</strong> schedule (<strong>{format(periodStart, 'dd MMM')} – {format(periodEnd, 'dd MMM yyyy')}</strong>) using the
        “Lock &amp; Submit Month” button. Once locked, store accounts can no longer edit this period.
      </AlertDescription>
    </Alert>
  );
}
