import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, CheckSquare, Calendar, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { format, isToday, isTomorrow, isPast, parseISO, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  is_completed: boolean;
  priority: string;
  created_at: string;
  assigned_to: string | null;
}

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!user?.id) return;
    
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
      setReminders(data || []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const addReminder = async () => {
    if (!newTask.trim() || !user?.id) return;

    setIsAdding(true);
    const { error } = await supabase
      .from('reminders')
      .insert({
        title: newTask.trim(),
        reminder_date: newDate || new Date().toISOString().split('T')[0],
        created_by: user.id,
        assigned_to: user.id,
        is_completed: false,
        priority: 'medium',
      });

    if (error) {
      console.error('Insert error:', error);
      toast.error('Failed to add task');
    } else {
      toast.success('Task added');
      setNewTask('');
      setNewDate('');
      fetchReminders();
    }
    setIsAdding(false);
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setReminders(prev => prev.map(r => 
      r.id === id ? { ...r, is_completed: !currentStatus } : r
    ));

    const { error } = await supabase
      .from('reminders')
      .update({ is_completed: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update task');
      fetchReminders(); // Revert on error
    }
  };

  const deleteReminder = async (id: string) => {
    // Optimistic update
    setReminders(prev => prev.filter(r => r.id !== id));

    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete task');
      fetchReminders(); // Revert on error
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
      toast.error('Failed to update task');
    } else {
      fetchReminders();
    }
    setEditingId(null);
  };

  const formatDueDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEE, MMM d');
  };

  const getDateStyles = (dateStr: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-muted-foreground';
    const date = parseISO(dateStr);
    if (isPast(date) && !isToday(date)) return 'text-destructive';
    if (isToday(date)) return 'text-primary font-medium';
    return 'text-muted-foreground';
  };

  const activeReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckSquare className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">My Tasks</h1>
      </div>

      {/* Add Task Input - Google Tasks style */}
      <Card className="mb-4 border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Circle className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Add a task"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isAdding && addReminder()}
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto text-base placeholder:text-muted-foreground/60"
                disabled={isAdding}
              />
              {newTask.trim() && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-36 h-8 text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={addReminder} 
                    disabled={isAdding || !newTask.trim()}
                  >
                    {isAdding ? <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent rounded-full" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        {/* Active Tasks */}
        {activeReminders.length === 0 && completedReminders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No tasks yet</p>
            <p className="text-sm">Add a task above to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activeReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group"
              >
                <Checkbox
                  checked={reminder.is_completed}
                  onCheckedChange={() => toggleComplete(reminder.id, reminder.is_completed)}
                  className="mt-0.5 h-5 w-5 rounded-full border-2"
                />
                <div className="flex-1 min-w-0">
                  {editingId === reminder.id ? (
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => updateTitle(reminder.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateTitle(reminder.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="h-7 px-1 border-0 shadow-none focus-visible:ring-1"
                    />
                  ) : (
                    <p
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        setEditingId(reminder.id);
                        setEditingTitle(reminder.title);
                      }}
                    >
                      {reminder.title}
                    </p>
                  )}
                  <div className={cn("flex items-center gap-1 text-xs mt-1", getDateStyles(reminder.reminder_date, false))}>
                    <Calendar className="h-3 w-3" />
                    {formatDueDate(reminder.reminder_date)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReminder(reminder.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Completed Section */}
        {completedReminders.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 px-3"
            >
              {showCompleted ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Completed ({completedReminders.length})
            </button>
            
            {showCompleted && (
              <div className="space-y-1">
                {completedReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group opacity-60"
                  >
                    <Checkbox
                      checked={reminder.is_completed}
                      onCheckedChange={() => toggleComplete(reminder.id, reminder.is_completed)}
                      className="mt-0.5 h-5 w-5 rounded-full border-2"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="line-through text-muted-foreground">
                        {reminder.title}
                      </p>
                      <div className="flex items-center gap-1 text-xs mt-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDueDate(reminder.reminder_date)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => deleteReminder(reminder.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
