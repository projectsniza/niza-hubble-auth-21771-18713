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

  // Show reminder window: from 3 days before close (18th) until 2 days after (22nd)
  const inReminderWindow = (day >= 18 && day <= 31) || (day <= 2);

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

  const daysToClose = day >= 21 ? Math.max(0, 20 - day + 30) : 20 - day;
  const isClosingToday = day === 20;
  const isOverdue = day === 21 || day === 22;

  return (
    <Alert className={
      isOverdue
        ? 'border-destructive/40 bg-destructive/5'
        : isClosingToday
          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
          : 'border-primary/30 bg-primary/5'
    }>
      <CalendarClock className={`h-4 w-4 ${isOverdue ? 'text-destructive' : isClosingToday ? 'text-amber-600' : 'text-primary'}`} />
      <AlertTitle>
        {isOverdue
          ? 'Monthly close overdue — lock & submit now'
          : isClosingToday
            ? 'Today is the last day to close this payroll period'
            : `Reminder: close monthly schedule in ${daysToClose} day${daysToClose === 1 ? '' : 's'}`}
      </AlertTitle>
      <AlertDescription className="text-sm">
        Please review and lock the schedule for <strong>{format(periodStart, 'dd MMM')} – {format(periodEnd, 'dd MMM yyyy')}</strong> using the
        “Lock &amp; Submit Month” button. Once locked, store accounts can no longer edit this period.
      </AlertDescription>
    </Alert>
  );
}
