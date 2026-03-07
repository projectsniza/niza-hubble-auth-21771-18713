import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Users, Send, Loader2, ClipboardCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

export default function AssignedCourses() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({
    course_id: '', assign_type: 'individual', employee_id: '', department: '', branch_id: '', due_date: '',
  });

  const canAssign = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [assignRes, courseRes, empRes] = await Promise.all([
      supabase.from('course_assignments').select('*, courses(title)').order('created_at', { ascending: false }).limit(100),
      supabase.from('courses').select('id, title').eq('status', 'published'),
      supabase.from('employees').select('id, first_name, last_name, branch_id, department').eq('status', 'active').limit(200),
    ]);
    setAssignments(assignRes.data || []);
    setCourses(courseRes.data || []);
    setEmployees(empRes.data || []);
    setLoading(false);
  };

  const handleAssign = async () => {
    if (!assignForm.course_id) { toast.error('Select a course'); return; }
    setIsSubmitting(true);
    try {
      const payload: any = {
        course_id: assignForm.course_id,
        assigned_by: user?.id,
        due_date: assignForm.due_date || null,
        is_mandatory: true,
      };

      if (assignForm.assign_type === 'individual' && assignForm.employee_id) {
        payload.assigned_to_employee_id = assignForm.employee_id;
      } else if (assignForm.assign_type === 'department') {
        payload.assigned_to_department = assignForm.department;
      } else if (assignForm.assign_type === 'branch') {
        payload.assigned_to_branch_id = assignForm.branch_id;
      } else if (assignForm.assign_type === 'all') {
        payload.assign_all = true;
      }

      const { error } = await supabase.from('course_assignments').insert(payload);
      if (error) throw error;

      if (assignForm.assign_type === 'individual' && assignForm.employee_id) {
        await supabase.from('course_progress').upsert({
          course_id: assignForm.course_id,
          employee_id: assignForm.employee_id,
          status: 'not_started',
        }, { onConflict: 'course_id,employee_id' });
      }

      toast.success('Course assigned successfully');
      setShowAssignDialog(false);
      setAssignForm({ course_id: '', assign_type: 'individual', employee_id: '', department: '', branch_id: '', due_date: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to unassign this course?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('course_assignments').delete().eq('id', id);
      if (error) throw error;
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Course unassigned successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to unassign');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assigned Courses</h1>
          <p className="text-muted-foreground mt-1">Manage course assignments for employees</p>
        </div>
        {canAssign && (
          <Button onClick={() => setShowAssignDialog(true)} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
            <Plus className="h-4 w-4 mr-2" /> Assign Course
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No assignments yet</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <Card key={a.id} className="border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{a.courses?.title || 'Unknown Course'}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    {a.assigned_to_employee_id && (
                      <Badge variant="outline"><Users className="h-3 w-3 mr-1" /> Individual</Badge>
                    )}
                    {a.assigned_to_department && <Badge variant="outline">Dept: {a.assigned_to_department}</Badge>}
                    {a.assigned_to_branch_id && <Badge variant="outline">Branch</Badge>}
                    {a.assign_all && <Badge variant="outline">All Employees</Badge>}
                    {a.due_date && <span>Due: {new Date(a.due_date).toLocaleDateString('en-GB')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={a.is_mandatory ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}>
                    {a.is_mandatory ? 'Mandatory' : 'Optional'}
                  </Badge>
                  {canAssign && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      title="Unassign course"
                    >
                      {deletingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Course</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={assignForm.course_id} onValueChange={(v) => setAssignForm(p => ({ ...p, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={assignForm.assign_type} onValueChange={(v) => setAssignForm(p => ({ ...p, assign_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual Employee</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="branch">Branch</SelectItem>
                  <SelectItem value="all">All Employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignForm.assign_type === 'individual' && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={assignForm.employee_id} onValueChange={(v) => setAssignForm(p => ({ ...p, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {assignForm.assign_type === 'department' && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={assignForm.department} onChange={(e) => setAssignForm(p => ({ ...p, department: e.target.value }))} placeholder="e.g., Sales" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input type="date" value={assignForm.due_date} onChange={(e) => setAssignForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" /> Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
