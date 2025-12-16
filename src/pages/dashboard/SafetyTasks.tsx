import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, Clock, AlertTriangle, CheckCheck, Play, Square } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface SafetyTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  organization_id: string;
  branch_id: string;
  created_at: string | null;
  branch?: { name: string } | null;
  assigner?: { name: string } | null;
  [key: string]: any; // Allow additional properties from DB
}

export default function SafetyTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchTasks();

    // Real-time subscription
    const channel = supabase
      .channel('safety-tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'safety_tasks' },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('safety_tasks')
        .select(`
          *,
          branch:branches(name)
        `)
        .order('created_at', { ascending: false });

      // Filter based on role
      if (user.role === 'employee') {
        // Employees see tasks assigned to them
        query = query.eq('assigned_to', user.id);
      } else if (user.role === 'manager') {
        // Managers see tasks assigned to them or tasks in their branch
        if (user.branchId) {
          query = query.or(`assigned_to.eq.${user.id},branch_id.eq.${user.branchId}`);
        } else {
          query = query.eq('assigned_to', user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch assigner profiles
      if (data && data.length > 0) {
        const assignerIds = [...new Set(data.map(t => t.assigned_by).filter(Boolean))];
        if (assignerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', assignerIds);
          
          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          const tasksWithAssigners = data.map(task => ({
            ...task,
            assigner: task.assigned_by ? profileMap.get(task.assigned_by) || null : null
          }));
          setTasks(tasksWithAssigners);
        } else {
          setTasks(data);
        }
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('safety_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      toast({ title: "Success", description: `Task ${newStatus === 'in_progress' ? 'started' : newStatus === 'completed' ? 'completed' : 'updated'}` });
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'assigned');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && isPast(new Date(t.due_date)));

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge className="bg-destructive text-destructive-foreground">High</Badge>;
      case 'medium': return <Badge className="bg-amber-500 text-white">Medium</Badge>;
      case 'low': return <Badge className="bg-green-500 text-white">Low</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-500 text-white">In Progress</Badge>;
      case 'assigned': return <Badge className="bg-amber-500 text-white">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Safety Tasks</h1>
        <p className="text-muted-foreground">View and manage your assigned safety tasks</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingTasks.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Play className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">{inProgressTasks.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold">{overdueTasks.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCheck className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{completedTasks.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <Label className="text-sm font-semibold mb-2 block">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold mb-2 block">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="assigned">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No tasks found</h3>
              <p className="text-muted-foreground">No safety tasks assigned to you</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{task.task_type?.replace('_', ' ') || 'General'}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority || 'medium')}</TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <span className={cn(
                        isPast(new Date(task.due_date)) && task.status !== 'completed' && 'text-destructive font-medium'
                      )}>
                        {format(new Date(task.due_date), 'dd/MM/yyyy')}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status || 'assigned')}</TableCell>
                  <TableCell>{task.assigner?.name || 'Admin'}</TableCell>
                  <TableCell>
                    {task.status === 'assigned' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                        className="gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Start
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusUpdate(task.id, 'completed')}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCheck className="h-3 w-3" />
                        Complete
                      </Button>
                    )}
                    {task.status === 'completed' && (
                      <span className="text-sm text-muted-foreground">
                        {task.completed_at ? format(new Date(task.completed_at), 'dd/MM/yyyy') : 'Done'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}