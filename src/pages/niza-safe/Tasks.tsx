import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, CheckCircle2, Plus, Clock, AlertTriangle, CheckCheck, Paperclip, X, FileText, Download, Eye, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { isAdminOrHR } from '@/lib/roles';

interface TaskAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

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
  attachments?: any;
  completion_attachments?: any;
  assignee?: { name: string; email: string };
  assigner?: { name: string; email: string };
  branch?: { name: string } | null;
}

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<SafetyTask[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<SafetyTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<SafetyTask | null>(null);
  const [activeTab, setActiveTab] = useState('assigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createFiles, setCreateFiles] = useState<File[]>([]);

  // Page-level filter
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [filterBranches, setFilterBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const canFilter = isAdminOrHR(user);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'general',
    priority: 'medium',
    due_date: new Date(),
    assigned_to: '',
    branch_id: '',
  });

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
      fetchBranches();
    }
    if (canFilter) fetchFilterOrganizations();
    if (user?.role === 'manager') {
      setViewMode('branch');
      if (user.organizationId) setFilterOrg(user.organizationId);
      if (user.branchId) setFilterBranch(user.branchId);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [user, viewMode, filterOrg, filterBranch]);

  useEffect(() => {
    if (filterOrg) fetchFilterBranchList(filterOrg);
  }, [filterOrg]);

  const fetchFilterOrganizations = async () => {
    if (user?.role === 'hr' && user.organizationId) {
      const { data } = await supabase.from('organizations').select('id, name').eq('id', user.organizationId);
      setOrganizations(data || []);
    } else {
      const { data } = await supabase.from('organizations').select('id, name').order('name');
      setOrganizations(data || []);
    }
  };

  const fetchFilterBranchList = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('id, name, organization_id').eq('organization_id', orgId).order('name');
    setFilterBranches(data || []);
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('safety_tasks').select('*, branch:branches(name)').order('created_at', { ascending: false }).limit(100);

      // Apply scope filter
      if (user?.role === 'manager' && user?.branchId) {
        query = query.eq('branch_id', user.branchId);
      } else if (viewMode === 'branch' && filterBranch) {
        query = query.eq('branch_id', filterBranch);
      } else if (viewMode === 'organization' && filterOrg) {
        query = query.eq('organization_id', filterOrg);
      } else if (user?.role === 'hr') {
        if (user.hrAccessLevel === 'branch' && user.branchId) {
          query = query.eq('branch_id', user.branchId);
        } else if (user.organizationId) {
          query = query.eq('organization_id', user.organizationId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks((data || []) as SafetyTask[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, branch_id')
      .order('name');
    setEmployees(data || []);
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (employee && employee.branch_id) {
      setFormData({ 
        ...formData, 
        assigned_to: employeeId,
        branch_id: employee.branch_id 
      });
    } else {
      setFormData({ ...formData, assigned_to: employeeId });
    }
  };

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('id, name').order('name');
    setBranches(data || []);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setCreateFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setCreateFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadFile = async (attachment: TaskAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(attachment.path);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!formData.branch_id) {
        toast({ title: "Error", description: "Please select a branch", variant: "destructive" });
        return;
      }

      // Get organization_id from selected branch
      const { data: branchData } = await supabase
        .from('branches')
        .select('organization_id')
        .eq('id', formData.branch_id)
        .single();

      if (!branchData?.organization_id) {
        toast({ title: "Error", description: "Branch organization not found", variant: "destructive" });
        return;
      }

      // Upload attachments if any
      const uploadedAttachments: TaskAttachment[] = [];
      for (const file of createFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `safety-tasks/${authUser?.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedAttachments.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type
        });
      }

      const { error } = await supabase.from('safety_tasks').insert({
        title: formData.title,
        description: formData.description,
        task_type: formData.task_type,
        priority: formData.priority,
        due_date: formData.due_date.toISOString(),
        assigned_to: formData.assigned_to || null,
        assigned_by: authUser?.id,
        organization_id: branchData.organization_id,
        branch_id: formData.branch_id,
        status: 'assigned',
        attachments: uploadedAttachments.length > 0 ? JSON.stringify(uploadedAttachments) : null,
      } as any);

      if (error) throw error;

      toast({ title: "Success", description: "Task created successfully" });
      setShowCreateDialog(false);
      setCreateFiles([]);
      setFormData({
        title: '',
        description: '',
        task_type: 'general',
        priority: 'medium',
        due_date: new Date(),
        assigned_to: '',
        branch_id: '',
      });
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

      toast({ title: "Success", description: "Task updated" });
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      // Delete associated files from storage
      const attachments = taskToDelete.attachments 
        ? (typeof taskToDelete.attachments === 'string' ? JSON.parse(taskToDelete.attachments) : taskToDelete.attachments)
        : [];
      const completionAttachments = taskToDelete.completion_attachments 
        ? (typeof taskToDelete.completion_attachments === 'string' ? JSON.parse(taskToDelete.completion_attachments) : taskToDelete.completion_attachments)
        : [];
      
      const allAttachments = [...(Array.isArray(attachments) ? attachments : []), ...(Array.isArray(completionAttachments) ? completionAttachments : [])];
      
      for (const att of allAttachments) {
        if (att.path) {
          await supabase.storage.from('documents').remove([att.path]);
        }
      }

      const { error } = await supabase
        .from('safety_tasks')
        .delete()
        .eq('id', taskToDelete.id);

      if (error) throw error;

      toast({ title: "Success", description: "Task deleted successfully" });
      setShowDeleteDialog(false);
      setTaskToDelete(null);
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const myTasks = tasks.filter(t => t.assigned_to === user?.id);
  const allTasks = tasks;

  const overdueTasks = myTasks.filter(t => t.status !== 'completed' && t.due_date && isPast(new Date(t.due_date)));
  const upcomingTasks = myTasks.filter(t => 
    t.status !== 'completed' && t.due_date && 
    isWithinInterval(new Date(t.due_date), { start: new Date(), end: addDays(new Date(), 7) })
  );
  const pendingTasks = myTasks.filter(t => t.status !== 'completed');

  const filteredTasks = allTasks.filter(task => {
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
      case 'assigned': return <Badge className="bg-amber-500 text-white">Assigned</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Tasks</h1>
          <p className="text-muted-foreground">Manage and track safety-related tasks</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        )}
      </div>

      {canFilter && user?.role !== 'manager' && (
        <OrgBranchFilter
          organizations={organizations}
          branches={filterBranches}
          viewMode={viewMode}
          selectedOrg={filterOrg}
          selectedBranch={filterBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setFilterOrg}
          onBranchChange={setFilterBranch}
          className="mb-6"
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              <p className="text-2xl font-bold">{myTasks.filter(t => t.status === 'completed').length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* No tabs - show all tasks directly */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <Label className="text-sm font-semibold mb-2 block">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title..."
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
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mb-6 inline-block p-8 rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
              <CheckCircle2 className="w-24 h-24 text-primary mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No tasks found</h2>
            <p className="text-muted-foreground">
              {activeTab === 'assigned' ? 'No tasks assigned to you' : 'No tasks in the system'}
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
              <TableHead>Attachments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => {
              const attachments = task.attachments ? (typeof task.attachments === 'string' ? JSON.parse(task.attachments) : task.attachments) : [];
              const completionAttachments = task.completion_attachments ? (typeof task.completion_attachments === 'string' ? JSON.parse(task.completion_attachments) : task.completion_attachments) : [];
              const totalAttachments = (Array.isArray(attachments) ? attachments.length : 0) + (Array.isArray(completionAttachments) ? completionAttachments.length : 0);
              
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{task.task_type?.replace('_', ' ')}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <span className={cn(
                        isPast(new Date(task.due_date)) && task.status !== 'completed' && 'text-destructive font-medium'
                      )}>
                        {format(new Date(task.due_date), 'PPP')}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {totalAttachments > 0 ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setSelectedTask(task); setShowViewDialog(true); }}
                        className="gap-1"
                      >
                        <Paperclip className="h-3 w-3" />
                        {totalAttachments}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setSelectedTask(task); setShowViewDialog(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {task.status !== 'completed' && (
                        <Select 
                          value={task.status} 
                          onValueChange={(v) => handleStatusUpdate(task.id, v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setTaskToDelete(task); setShowDeleteDialog(true); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    )}

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Safety Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the task"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select value={formData.task_type} onValueChange={(v) => setFormData({ ...formData, task_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                    <SelectItem value="coshh">COSHH Follow-up</SelectItem>
                    <SelectItem value="hazard">Hazard Corrective</SelectItem>
                    <SelectItem value="incident">Incident Investigation</SelectItem>
                    <SelectItem value="method_statement">Method Statement Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    {format(formData.due_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => date && setFormData({ ...formData, due_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={handleEmployeeSelect}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {branches.length > 0 && (
              <div className="space-y-2">
                <Label>Branch/Site</Label>
                <Select value={formData.branch_id} onValueChange={(v) => setFormData({ ...formData, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* File Attachments */}
            <div className="space-y-2">
              <Label>Attachments (optional)</Label>
              <div className="flex items-center gap-4">
                <label htmlFor="task-files" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm">Choose Files</span>
                  </div>
                  <input
                    id="task-files"
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {createFiles.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {createFiles.length} file(s) selected
                  </span>
                )}
              </div>
              {createFiles.length > 0 && (
                <div className="space-y-1 mt-2">
                  {createFiles.map((file, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2 justify-between bg-muted p-2 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {file.name}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(idx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setCreateFiles([]); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.title}>Create Task</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground text-xs">Title</Label>
                <p className="font-medium">{selectedTask.title}</p>
              </div>
              {selectedTask.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p className="capitalize">{selectedTask.task_type?.replace('_', ' ') || 'General'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Priority</Label>
                  <div className="mt-1">{getPriorityBadge(selectedTask.priority || 'medium')}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Due Date</Label>
                  <p>{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'PPP') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedTask.status || 'assigned')}</div>
                </div>
              </div>

              {/* Task Attachments (from admin) */}
              {(() => {
                const attachments = selectedTask.attachments 
                  ? (typeof selectedTask.attachments === 'string' ? JSON.parse(selectedTask.attachments) : selectedTask.attachments)
                  : [];
                return Array.isArray(attachments) && attachments.length > 0 ? (
                  <div>
                    <Label className="text-muted-foreground text-xs">Task Attachments</Label>
                    <div className="space-y-1 mt-2">
                      {attachments.map((att: TaskAttachment, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            {att.name}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(att)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Completion Attachments (from employee) */}
              {(() => {
                const completionAttachments = selectedTask.completion_attachments 
                  ? (typeof selectedTask.completion_attachments === 'string' ? JSON.parse(selectedTask.completion_attachments) : selectedTask.completion_attachments)
                  : [];
                return Array.isArray(completionAttachments) && completionAttachments.length > 0 ? (
                  <div>
                    <Label className="text-muted-foreground text-xs">Completion Evidence (from Employee)</Label>
                    <div className="space-y-1 mt-2">
                      {completionAttachments.map((att: TaskAttachment, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4 text-green-600" />
                            {att.name}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(att)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone and will also remove all associated attachments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setTaskToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
