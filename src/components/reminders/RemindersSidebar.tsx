import { useState, useEffect, useCallback } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO, addMinutes, addHours, startOfTomorrow, setHours, setMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  BellOff,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  is_completed: boolean;
  is_dismissed: boolean | null;
  acknowledged_at: string | null;
  snoozed_until: string | null;
  priority: string;
  created_at: string;
}

interface RemindersSidebarProps {
  open: boolean;
  onClose: () => void;
}

interface EditorState {
  id: string | null;
  title: string;
  description: string;
  date: Date | undefined;
  time: string; // HH:mm
}

const emptyEditor = (): EditorState => ({
  id: null,
  title: '',
  description: '',
  date: undefined,
  time: '09:00',
});

function combineDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return setMinutes(setHours(date, h || 0), m || 0);
}

export default function RemindersSidebar({ open, onClose }: RemindersSidebarProps) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .order('reminder_date', { ascending: true });

    if (error) {
      console.error('Error fetching reminders:', error);
      toast.error('Failed to load reminders');
    } else {
      setReminders((data || []) as Reminder[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && user) fetchReminders();
  }, [open, user, fetchReminders]);

  const saveReminder = async () => {
    if (!user || !editor) return;
    const title = editor.title.trim();
    if (!title) {
      toast.error('Enter a title');
      return;
    }
    const when = editor.date
      ? combineDateTime(editor.date, editor.time).toISOString()
      : new Date().toISOString();

    if (editor.id) {
      const { error } = await supabase
        .from('reminders')
        .update({
          title,
          description: editor.description.trim() || null,
          reminder_date: when,
        })
        .eq('id', editor.id);
      if (error) {
        toast.error(error.message || 'Failed to update');
        return;
      }
      toast.success('Reminder updated');
    } else {
      const { error } = await supabase.from('reminders').insert({
        title,
        description: editor.description.trim() || null,
        reminder_date: when,
        created_by: user.id,
        assigned_to: user.id,
        priority: 'medium',
      });
      if (error) {
        toast.error(error.message || 'Failed to add');
        return;
      }
      toast.success('Reminder added');
    }
    setEditor(null);
    fetchReminders();
  };

  const toggleComplete = async (r: Reminder) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_completed: !r.is_completed })
      .eq('id', r.id);
    if (error) toast.error('Failed to update');
    else fetchReminders();
  };

  const acknowledge = async (r: Reminder) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_dismissed: true, acknowledged_at: new Date().toISOString(), snoozed_until: null })
      .eq('id', r.id);
    if (error) toast.error('Failed to acknowledge');
    else {
      toast.success('Marked as acknowledged');
      fetchReminders();
    }
  };

  const reopen = async (r: Reminder) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_dismissed: false, acknowledged_at: null })
      .eq('id', r.id);
    if (error) toast.error('Failed to reopen');
    else fetchReminders();
  };

  const snooze = async (r: Reminder, until: Date) => {
    const { error } = await supabase
      .from('reminders')
      .update({ snoozed_until: until.toISOString(), is_dismissed: false })
      .eq('id', r.id);
    if (error) toast.error('Failed to snooze');
    else {
      toast.success(`Snoozed until ${format(until, 'MMM d, HH:mm')}`);
      fetchReminders();
    }
  };

  const deleteReminder = async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Reminder removed');
      fetchReminders();
    }
  };

  const openEditor = (r?: Reminder) => {
    if (r) {
      const d = parseISO(r.reminder_date);
      setEditor({
        id: r.id,
        title: r.title,
        description: r.description || '',
        date: d,
        time: format(d, 'HH:mm'),
      });
    } else {
      setEditor(emptyEditor());
    }
  };

  const formatDue = (r: Reminder) => {
    const d = parseISO(r.reminder_date);
    const day = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d');
    return `${day} · ${format(d, 'HH:mm')}`;
  };

  const dueClass = (r: Reminder) => {
    if (r.is_completed) return 'text-muted-foreground';
    const d = parseISO(r.reminder_date);
    if (isPast(d) && !isToday(d)) return 'text-destructive';
    if (isToday(d)) return 'text-primary';
    return 'text-muted-foreground';
  };

  const now = new Date();
  const active = reminders.filter(
    (r) => !r.is_completed && !r.is_dismissed
  );
  const snoozed = active.filter((r) => r.snoozed_until && parseISO(r.snoozed_until) > now);
  const upcoming = active.filter((r) => !(r.snoozed_until && parseISO(r.snoozed_until) > now));
  const acknowledged = reminders.filter((r) => r.is_dismissed && !r.is_completed);
  const completed = reminders.filter((r) => r.is_completed);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-y-0 right-0 w-[22rem] bg-background border-l shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">My Reminders</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-primary hover:text-primary"
              onClick={() => openEditor()}
            >
              <Plus className="h-5 w-5" /> Add a task
            </Button>

            {loading ? (
              <div className="flex items-center justify-center py-8"><NizaLoaderInline /></div>
            ) : (
              <>
                <Section title="Upcoming" items={upcoming} emptyLabel="No open tasks">
                  {upcoming.map((r) => (
                    <ReminderRow key={r.id} r={r} dueClass={dueClass(r)} dueLabel={formatDue(r)}
                      onToggle={() => toggleComplete(r)}
                      onEdit={() => openEditor(r)}
                      onAcknowledge={() => acknowledge(r)}
                      onSnooze={(u) => snooze(r, u)}
                      onDelete={() => deleteReminder(r.id)}
                    />
                  ))}
                </Section>

                {snoozed.length > 0 && (
                  <Section title={`Snoozed (${snoozed.length})`} items={snoozed}>
                    {snoozed.map((r) => (
                      <ReminderRow key={r.id} r={r} dueClass="text-amber-600 dark:text-amber-400"
                        dueLabel={`Snoozed until ${format(parseISO(r.snoozed_until!), 'MMM d HH:mm')}`}
                        onToggle={() => toggleComplete(r)}
                        onEdit={() => openEditor(r)}
                        onAcknowledge={() => acknowledge(r)}
                        onSnooze={(u) => snooze(r, u)}
                        onDelete={() => deleteReminder(r.id)}
                      />
                    ))}
                  </Section>
                )}

                {acknowledged.length > 0 && (
                  <Collapsible label={`Acknowledged (${acknowledged.length})`} open={showAcknowledged} onToggle={() => setShowAcknowledged(!showAcknowledged)}>
                    {acknowledged.map((r) => (
                      <div key={r.id} className="group flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50">
                        <BellOff className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">Acknowledged {r.acknowledged_at ? format(parseISO(r.acknowledged_at), 'MMM d HH:mm') : ''}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => reopen(r)} title="Reopen">
                          <Circle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteReminder(r.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </Collapsible>
                )}

                {completed.length > 0 && (
                  <Collapsible label={`Completed (${completed.length})`} open={showCompleted} onToggle={() => setShowCompleted(!showCompleted)}>
                    {completed.map((r) => (
                      <div key={r.id} className="group flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50">
                        <button onClick={() => toggleComplete(r)} className="mt-0.5 text-primary">
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-through text-muted-foreground truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDue(r)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteReminder(r.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </Collapsible>
                )}

                {upcoming.length === 0 && snoozed.length === 0 && acknowledged.length === 0 && completed.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No tasks yet.</p>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editor?.id ? 'Edit reminder' : 'New reminder'}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  placeholder="What do you need to remember?"
                  autoFocus
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editor.description}
                  rows={3}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder="Optional details"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                        <CalendarIcon className="h-4 w-4" />
                        {editor.date ? format(editor.date, 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editor.date}
                        onSelect={(d) => setEditor({ ...editor, date: d || undefined })}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="time"
                      value={editor.time}
                      onChange={(e) => setEditor({ ...editor, time: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button onClick={saveReminder}>{editor?.id ? 'Save changes' : 'Add reminder'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, items, emptyLabel, children }: { title: string; items: unknown[]; emptyLabel?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {items.length === 0 && emptyLabel ? (
        <p className="text-xs text-muted-foreground py-2">{emptyLabel}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

function Collapsible({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <button onClick={onToggle} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {label}
      </button>
      {open && <div className="space-y-1 pt-1">{children}</div>}
    </div>
  );
}

function ReminderRow({
  r, dueLabel, dueClass, onToggle, onEdit, onAcknowledge, onSnooze, onDelete,
}: {
  r: Reminder;
  dueLabel: string;
  dueClass: string;
  onToggle: () => void;
  onEdit: () => void;
  onAcknowledge: () => void;
  onSnooze: (until: Date) => void;
  onDelete: () => void;
}) {
  const now = new Date();
  return (
    <div className="group flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
      <button onClick={onToggle} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors" title="Mark complete">
        <Circle className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm cursor-pointer truncate" onClick={onEdit}>{r.title}</p>
        {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
        <p className={cn('text-xs', dueClass)}>{dueLabel}</p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Snooze">
              <Clock className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => onSnooze(addMinutes(now, 15))}>15 minutes</button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => onSnooze(addHours(now, 1))}>1 hour</button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => onSnooze(addHours(now, 3))}>3 hours</button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded" onClick={() => onSnooze(setMinutes(setHours(startOfTomorrow(), 9), 0))}>Tomorrow 9 AM</button>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAcknowledge} title="Acknowledge">
          <BellOff className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}
