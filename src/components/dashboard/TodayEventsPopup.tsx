import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Cake, Megaphone, Briefcase, GraduationCap, Users, Bell, ExternalLink } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  event_date: string | null;
  branch_id: string | null;
  organization_id: string | null;
  visibility: string | null;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  announcement: Megaphone,
  company_event: Briefcase,
  training: GraduationCap,
  birthday: Cake,
  employee_event: Users,
  urgent: Bell,
};

export default function TodayEventsPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const dismissKey = `today-events-shown-${today}-${user.id}`;
    if (sessionStorage.getItem(dismissKey)) return;

    (async () => {
      let query = supabase
        .from('events')
        .select('*')
        .not('event_date', 'is', null)
        .order('event_date', { ascending: true })
        .limit(50);

      if (user.role === 'hr' || user.role === 'manager') {
        query = query.or(
          `visibility.eq.company,and(visibility.eq.organization,organization_id.eq.${user.organizationId}),and(visibility.eq.branch,branch_id.eq.${user.branchId})`
        );
      } else if (user.role === 'employee') {
        query = query.or(
          `visibility.eq.company,and(visibility.eq.branch,branch_id.eq.${user.branchId})`
        );
      }

      const { data, error } = await query;
      if (error || !data) return;

      const now = new Date();
      const todays = (data as EventRow[]).filter((e) =>
        e.event_date ? isSameDay(parseISO(e.event_date), now) : false
      );
      if (todays.length === 0) return;
      setEvents(todays);
      setOpen(true);
      sessionStorage.setItem(dismissKey, '1');
    })();
  }, [user]);

  if (!open || events.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </span>
            Today's Events
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
          {events.map((e) => {
            const Icon = ICONS[e.event_type || 'announcement'] || Bell;
            return (
              <div key={e.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground">{e.title}</h4>
                    {e.event_type && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {e.event_type.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
                  {e.event_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(e.event_date), 'PPpp')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Dismiss for today</Button>
          <Button onClick={() => { setOpen(false); navigate('/dashboard/events'); }} className="gap-2">
            <ExternalLink className="h-4 w-4" /> View all events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
