import { useState, useEffect, useCallback } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Plus,
  X,
  Calendar as CalendarIcon,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  is_completed: boolean;
  priority: string;
  created_at: string;
}

interface RemindersSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function RemindersSidebar({ open, onClose }: RemindersSidebarProps) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

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
    } else {
      setReminders(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && user) {
      fetchReminders();
    }
  }, [open, user, fetchReminders]);

  const addReminder = async () => {
    if (!user || !newTaskTitle.trim()) return;

    const { error } = await supabase.from('reminders').insert({
      title: newTaskTitle.trim(),
      reminder_date: newTaskDate?.toISOString() || new Date().toISOString(),
      created_by: user.id,
      assigned_to: user.id,
      priority: 'medium',
    });

    if (error) {
      toast.error('Failed to add reminder');
    } else {
      toast.success('Reminder added');
      setNewTaskTitle('');
      setNewTaskDate(undefined);
      setShowAddForm(false);
      fetchReminders();
    }
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_completed: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update reminder');
    } else {
      fetchReminders();
    }
  };

  const deleteReminder = async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete reminder');
    } else {
      toast.success('Reminder deleted');
      fetchReminders();
    }
  };

  const updateTitle = async (id: string) => {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }

    const { error } = await supabase
      .from('reminders')
      .update({ title: editingTitle.trim() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update reminder');
    } else {
      fetchReminders();
    }
    setEditingId(null);
  };

  const formatDueDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getDateColor = (dateStr: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-muted-foreground';
    const date = parseISO(dateStr);
    if (isPast(date) && !isToday(date)) return 'text-destructive';
    if (isToday(date)) return 'text-primary';
    return 'text-muted-foreground';
  };

  const activeReminders = reminders.filter((r) => !r.is_completed);
  const completedReminders = reminders.filter((r) => r.is_completed);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">My Reminders</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <NizaLoaderInline />
            </div>
          ) : (
            <>
              {/* Add Task Button */}
              {!showAddForm ? (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-primary hover:text-primary"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-5 w-5" />
                  Add a task
                </Button>
              ) : (
                <div className="p-3 border rounded-lg space-y-3 bg-card">
                  <Input
                    placeholder="New task"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addReminder()}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {newTaskDate ? format(newTaskDate, 'MMM d') : 'Date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newTaskDate}
                          onSelect={setNewTaskDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={addReminder} disabled={!newTaskTitle.trim()}>
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Reminders */}
              <div className="space-y-1 pt-2">
                {activeReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="group flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <button
                      onClick={() => toggleComplete(reminder.id, reminder.is_completed)}
                      className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Circle className="h-5 w-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      {editingId === reminder.id ? (
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => updateTitle(reminder.id)}
                          onKeyDown={(e) => e.key === 'Enter' && updateTitle(reminder.id)}
                          autoFocus
                          className="h-7 text-sm"
                        />
                      ) : (
                        <p
                          className="text-sm cursor-pointer truncate"
                          onClick={() => {
                            setEditingId(reminder.id);
                            setEditingTitle(reminder.title);
                          }}
                        >
                          {reminder.title}
                        </p>
                      )}
                      <p className={cn('text-xs', getDateColor(reminder.reminder_date, false))}>
                        {formatDueDate(reminder.reminder_date)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteReminder(reminder.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}

                {activeReminders.length === 0 && !showAddForm && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No tasks yet. Add one above!
                  </p>
                )}
              </div>

              {/* Completed Section */}
              {completedReminders.length > 0 && (
                <div className="pt-4">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                  >
                    {showCompleted ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Completed ({completedReminders.length})
                  </button>

                  {showCompleted && (
                    <div className="space-y-1 pt-2">
                      {completedReminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className="group flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <button
                            onClick={() => toggleComplete(reminder.id, reminder.is_completed)}
                            className="mt-0.5 text-primary"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-through text-muted-foreground truncate">
                              {reminder.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDueDate(reminder.reminder_date)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteReminder(reminder.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
