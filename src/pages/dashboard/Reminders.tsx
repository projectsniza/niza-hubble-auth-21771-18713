import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, CheckSquare, Clock, Calendar, Loader2 } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';

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

    const { error } = await supabase
      .from('reminders')
      .insert({
        title: newTask,
        reminder_date: newDate || new Date().toISOString().split('T')[0],
        created_by: user.id,
        is_completed: false,
        priority: 'medium',
      });

    if (error) {
      toast.error('Failed to add reminder');
    } else {
      toast.success('Reminder added');
      setNewTask('');
      setNewDate('');
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
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

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
      .update({ title: editingTitle })
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
    if (isToday(date)) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  const activeReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <CheckSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Reminders</h1>
          <p className="text-muted-foreground">Keep track of your tasks and deadlines</p>
        </div>
      </div>

      {/* Add New Reminder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Reminder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="What do you need to remember?"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addReminder()}
              className="flex-1"
            />
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full sm:w-40"
            />
            <Button onClick={addReminder} disabled={!newTask.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminders List */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Active ({activeReminders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Completed ({completedReminders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {activeReminders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active reminders</p>
                  <p className="text-sm">Add a reminder to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card/80 transition-colors border border-border/50"
                    >
                      <Checkbox
                        checked={reminder.is_completed}
                        onCheckedChange={() => toggleComplete(reminder.id, reminder.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        {editingId === reminder.id ? (
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => updateTitle(reminder.id)}
                            onKeyDown={(e) => e.key === 'Enter' && updateTitle(reminder.id)}
                            autoFocus
                            className="h-8"
                          />
                        ) : (
                          <p
                            className="font-medium truncate cursor-pointer hover:text-primary"
                            onClick={() => {
                              setEditingId(reminder.id);
                              setEditingTitle(reminder.title);
                            }}
                          >
                            {reminder.title}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={getDateColor(reminder.reminder_date, false)}>
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDueDate(reminder.reminder_date)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteReminder(reminder.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {completedReminders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No completed reminders</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {completedReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card/80 transition-colors border border-border/50 opacity-60"
                    >
                      <Checkbox
                        checked={reminder.is_completed}
                        onCheckedChange={() => toggleComplete(reminder.id, reminder.is_completed)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate line-through">
                          {reminder.title}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDueDate(reminder.reminder_date)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteReminder(reminder.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
