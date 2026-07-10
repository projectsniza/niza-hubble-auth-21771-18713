import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, Clock, BellOff, CheckCircle2 } from 'lucide-react';
import { addHours, addMinutes, format, parseISO, setHours, setMinutes, startOfTomorrow } from 'date-fns';
import { toast } from 'sonner';

interface DueReminder {
  id: string;
  title: string;
  description: string | null;
  reminder_date: string;
}

export default function ReminderDuePopup() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<DueReminder | null>(null);
  const queueRef = useRef<DueReminder[]>([]);
  const shownRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('reminders')
      .select('id,title,description,reminder_date,is_completed,is_dismissed,snoozed_until')
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .eq('is_completed', false)
      .eq('is_dismissed', false)
      .lte('reminder_date', nowIso)
      .order('reminder_date', { ascending: true })
      .limit(20);
    if (error) return;
    const due = (data || []).filter((r: any) => {
      if (shownRef.current.has(r.id)) return false;
      if (r.snoozed_until && new Date(r.snoozed_until) > new Date()) return false;
      return true;
    }) as DueReminder[];
    if (due.length === 0) return;
    queueRef.current.push(...due);
    due.forEach((r) => shownRef.current.add(r.id));
    if (!current && queueRef.current.length > 0) {
      setCurrent(queueRef.current.shift() || null);
    }
  }, [user, current]);

  useEffect(() => {
    if (!user) return;
    check();
    const t = window.setInterval(check, 30_000);
    return () => window.clearInterval(t);
  }, [user, check]);

  const advance = () => {
    setCurrent(queueRef.current.shift() || null);
  };

  const acknowledge = async () => {
    if (!current) return;
    const { error } = await supabase
      .from('reminders')
      .update({ is_dismissed: true, acknowledged_at: new Date().toISOString() })
      .eq('id', current.id);
    if (error) toast.error('Failed to acknowledge'); else toast.success('Acknowledged');
    advance();
  };

  const complete = async () => {
    if (!current) return;
    const { error } = await supabase
      .from('reminders')
      .update({ is_completed: true })
      .eq('id', current.id);
    if (error) toast.error('Failed to complete'); else toast.success('Marked complete');
    advance();
  };

  const snooze = async (until: Date) => {
    if (!current) return;
    // Remove from shown so it can pop again after snooze
    shownRef.current.delete(current.id);
    const { error } = await supabase
      .from('reminders')
      .update({ snoozed_until: until.toISOString(), reminder_date: until.toISOString() })
      .eq('id', current.id);
    if (error) toast.error('Failed to snooze'); else toast.success(`Snoozed until ${format(until, 'MMM d, HH:mm')}`);
    advance();
  };

  if (!current) return null;
  const now = new Date();
  const due = parseISO(current.reminder_date);

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && acknowledge()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </span>
            Reminder due
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <h3 className="text-xl font-semibold text-foreground">{current.title}</h3>
          {current.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{current.description}</p>
          )}
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Scheduled for {format(due, 'PPpp')}
          </p>
        </div>
        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Clock className="h-4 w-4" /> Snooze
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => snooze(addMinutes(now, 5))}>5 minutes</button>
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => snooze(addMinutes(now, 15))}>15 minutes</button>
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => snooze(addHours(now, 1))}>1 hour</button>
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => snooze(addHours(now, 3))}>3 hours</button>
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => snooze(setMinutes(setHours(startOfTomorrow(), 9), 0))}>Tomorrow 9 AM</button>
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={acknowledge} className="gap-2">
            <BellOff className="h-4 w-4" /> Acknowledge
          </Button>
          <Button onClick={complete} className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Mark complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
