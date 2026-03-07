import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, GraduationCap, BookOpen, ChevronDown, ChevronUp, Loader2, Eye, Archive, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import LessonContentEditor from '@/components/elearning/LessonContentEditor';

const TEMPLATE_OPTIONS = [
  { value: 'classic', label: 'Classic Learning', desc: 'Corporate training with clean layout' },
  { value: 'step_by_step', label: 'Step-by-Step', desc: 'Procedural training with progress tracking' },
  { value: 'visual', label: 'Visual Learning', desc: 'Image-heavy with infographics' },
  { value: 'interactive', label: 'Interactive', desc: 'Quizzes and scenario-based learning' },
  { value: 'microlearning', label: 'Microlearning', desc: 'Short card-based quick lessons' },
];

interface Course {
  id: string;
  title: string;
  description: string | null;
  template_style: string;
  estimated_duration_minutes: number;
  passing_score: number;
  certificate_enabled: boolean;
  status: string;
  category_id: string | null;
  created_at: string;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content: any[];
  sort_order: number;
  estimated_duration_minutes: number;
}

export default function CourseBuilder() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Course form
  const [courseForm, setCourseForm] = useState({
    title: '', description: '', template_style: 'classic', estimated_duration_minutes: 30,
    passing_score: 70, certificate_enabled: true, category_id: '',
  });

  // Module form
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });

  // Lesson form
  const [lessonForm, setLessonForm] = useState({ title: '', content: [] as any[], estimated_duration_minutes: 5 });

  useEffect(() => {
    fetchCourses();
    fetchCategories();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(100);
    setCourses(data || []);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('course_categories').select('*').order('name');
    setCategories(data || []);
  };

  const fetchModules = async (courseId: string) => {
    const { data: mods } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('sort_order');
    if (mods) {
      // Fetch lessons for each module
      const moduleIds = mods.map(m => m.id);
      const { data: lessons } = await supabase.from('course_lessons').select('*').in('module_id', moduleIds).order('sort_order');
      const modulesWithLessons = mods.map(m => ({
        ...m,
        lessons: (lessons || []).filter(l => l.module_id === m.id).map(l => ({ ...l, content: Array.isArray(l.content) ? l.content : [] })),
      }));
      setModules(modulesWithLessons);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseForm.title) { toast.error('Course title is required'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('courses').insert({
        title: courseForm.title,
        description: courseForm.description || null,
        template_style: courseForm.template_style,
        estimated_duration_minutes: courseForm.estimated_duration_minutes,
        passing_score: courseForm.passing_score,
        certificate_enabled: courseForm.certificate_enabled,
        category_id: courseForm.category_id || null,
        created_by: user?.id,
        status: 'draft',
      });
      if (error) throw error;
      toast.success('Course created');
      setShowCourseDialog(false);
      setCourseForm({ title: '', description: '', template_style: 'classic', estimated_duration_minutes: 30, passing_score: 70, certificate_enabled: true, category_id: '' });
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourse || !courseForm.title) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('courses').update({
        title: courseForm.title,
        description: courseForm.description || null,
        template_style: courseForm.template_style,
        estimated_duration_minutes: courseForm.estimated_duration_minutes,
        passing_score: courseForm.passing_score,
        certificate_enabled: courseForm.certificate_enabled,
        category_id: courseForm.category_id || null,
      }).eq('id', selectedCourse.id);
      if (error) throw error;
      toast.success('Course updated');
      setShowCourseDialog(false);
      setSelectedCourse(null);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishCourse = async (courseId: string, status: string) => {
    const newStatus = status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('courses').update({ status: newStatus }).eq('id', courseId);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === 'published' ? 'Course published!' : 'Course unpublished');
    fetchCourses();
  };

  const handleCreateModule = async () => {
    if (!moduleForm.title || !expandedCourse) return;
    setIsSubmitting(true);
    try {
      const maxOrder = modules.length > 0 ? Math.max(...modules.map(m => m.sort_order)) + 1 : 0;
      const { error } = await supabase.from('course_modules').insert({
        course_id: expandedCourse,
        title: moduleForm.title,
        description: moduleForm.description || null,
        sort_order: maxOrder,
      });
      if (error) throw error;
      toast.success('Module added');
      setShowModuleDialog(false);
      setModuleForm({ title: '', description: '' });
      fetchModules(expandedCourse);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!lessonForm.title || !selectedModule) return;
    setIsSubmitting(true);
    try {
      if (selectedLesson) {
        const { error } = await supabase.from('course_lessons').update({
          title: lessonForm.title,
          content: lessonForm.content as any,
          estimated_duration_minutes: lessonForm.estimated_duration_minutes,
        }).eq('id', selectedLesson.id);
        if (error) throw error;
        toast.success('Lesson updated');
      } else {
        const existingLessons = selectedModule.lessons || [];
        const maxOrder = existingLessons.length > 0 ? Math.max(...existingLessons.map(l => l.sort_order)) + 1 : 0;
        const { error } = await supabase.from('course_lessons').insert({
          module_id: selectedModule.id,
          title: lessonForm.title,
          content: lessonForm.content as any,
          sort_order: maxOrder,
          estimated_duration_minutes: lessonForm.estimated_duration_minutes,
        });
        if (error) throw error;
        toast.success('Lesson added');
      }
      setShowLessonDialog(false);
      setSelectedLesson(null);
      setLessonForm({ title: '', content: [], estimated_duration_minutes: 5 });
      if (expandedCourse) fetchModules(expandedCourse);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const table = deleteTarget.type === 'course' ? 'courses' : deleteTarget.type === 'module' ? 'course_modules' : 'course_lessons';
      const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`${deleteTarget.type} deleted`);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      if (deleteTarget.type === 'course') fetchCourses();
      else if (expandedCourse) fetchModules(expandedCourse);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEditCourse = (course: Course) => {
    setSelectedCourse(course);
    setCourseForm({
      title: course.title,
      description: course.description || '',
      template_style: course.template_style,
      estimated_duration_minutes: course.estimated_duration_minutes,
      passing_score: course.passing_score,
      certificate_enabled: course.certificate_enabled,
      category_id: course.category_id || '',
    });
    setShowCourseDialog(true);
  };

  const openEditLesson = (lesson: Lesson, mod: Module) => {
    setSelectedModule(mod);
    setSelectedLesson(lesson);
    setLessonForm({
      title: lesson.title,
      content: Array.isArray(lesson.content) ? lesson.content : [],
      estimated_duration_minutes: lesson.estimated_duration_minutes,
    });
    setShowLessonDialog(true);
  };

  const toggleCourseExpand = (courseId: string) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
      setModules([]);
    } else {
      setExpandedCourse(courseId);
      fetchModules(courseId);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'published') return <Badge className="bg-green-500/10 text-green-600">Published</Badge>;
    if (status === 'archived') return <Badge className="bg-muted text-muted-foreground">Archived</Badge>;
    return <Badge className="bg-yellow-500/10 text-yellow-600">Draft</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Course Builder</h1>
          <p className="text-muted-foreground mt-1">Create and manage training courses</p>
        </div>
        <Button onClick={() => { setSelectedCourse(null); setCourseForm({ title: '', description: '', template_style: 'classic', estimated_duration_minutes: 30, passing_score: 70, certificate_enabled: true, category_id: '' }); setShowCourseDialog(true); }} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
          <Plus className="h-4 w-4 mr-2" /> New Course
        </Button>
      </div>

      {/* Courses List */}
      <div className="space-y-3">
        {courses.length === 0 ? (
          <div className="text-center py-16">
            <GraduationCap className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No courses yet</h3>
            <p className="text-sm text-muted-foreground">Create your first training course</p>
          </div>
        ) : (
          courses.map(course => (
            <Card key={course.id} className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleCourseExpand(course.id)}>
                    {expandedCourse === course.id ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <h3 className="font-semibold text-foreground">{course.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(course.status)}
                        <span className="text-xs text-muted-foreground">{course.estimated_duration_minutes} min</span>
                        <Badge variant="outline" className="text-xs">{TEMPLATE_OPTIONS.find(t => t.value === course.template_style)?.label}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handlePublishCourse(course.id, course.status)} title={course.status === 'published' ? 'Unpublish' : 'Publish'}>
                      {course.status === 'published' ? <Archive className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditCourse(course)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget({ type: 'course', id: course.id, name: course.title }); setShowDeleteDialog(true); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: Modules & Lessons */}
                {expandedCourse === course.id && (
                  <div className="mt-4 ml-8 space-y-3">
                    <Button variant="outline" size="sm" onClick={() => { setModuleForm({ title: '', description: '' }); setShowModuleDialog(true); }}>
                      <Plus className="h-3 w-3 mr-1" /> Add Module
                    </Button>
                    {modules.map(mod => (
                      <div key={mod.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}>
                            {expandedModule === mod.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <h4 className="font-medium text-sm">{mod.title}</h4>
                            <Badge variant="outline" className="text-xs">{mod.lessons?.length || 0} lessons</Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteTarget({ type: 'module', id: mod.id, name: mod.title }); setShowDeleteDialog(true); }}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {expandedModule === mod.id && (
                          <div className="mt-2 ml-6 space-y-2">
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedModule(mod); setSelectedLesson(null); setLessonForm({ title: '', content: [], estimated_duration_minutes: 5 }); setShowLessonDialog(true); }}>
                              <Plus className="h-3 w-3 mr-1" /> Add Lesson
                            </Button>
                            {mod.lessons?.map(lesson => (
                              <div key={lesson.id} className="flex items-center justify-between p-2 border rounded hover:bg-card/50">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">{lesson.title}</span>
                                  <span className="text-xs text-muted-foreground">{lesson.estimated_duration_minutes}min</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLesson(lesson, mod)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteTarget({ type: 'lesson', id: lesson.id, name: lesson.title }); setShowDeleteDialog(true); }}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Course Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCourse ? 'Edit Course' : 'Create New Course'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course Title *</Label>
              <Input value={courseForm.title} onChange={(e) => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Workplace Safety Training" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={courseForm.description} onChange={(e) => setCourseForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Course description..." />
            </div>
            <div className="space-y-2">
              <Label>Course Template *</Label>
              <Select value={courseForm.template_style} onValueChange={(v) => setCourseForm(p => ({ ...p, template_style: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{t.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={courseForm.estimated_duration_minutes || ''} onChange={(e) => setCourseForm(p => ({ ...p, estimated_duration_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Passing Score (%)</Label>
                <Input type="number" value={courseForm.passing_score || ''} onChange={(e) => setCourseForm(p => ({ ...p, passing_score: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={courseForm.category_id || 'none'} onValueChange={(v) => setCourseForm(p => ({ ...p, category_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label>Certificate on Completion</Label>
              <Switch checked={courseForm.certificate_enabled} onCheckedChange={(v) => setCourseForm(p => ({ ...p, certificate_enabled: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourseDialog(false)}>Cancel</Button>
            <Button onClick={selectedCourse ? handleUpdateCourse : handleCreateCourse} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedCourse ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Module</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Module Title *</Label>
              <Input value={moduleForm.title} onChange={(e) => setModuleForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Introduction" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={moduleForm.description} onChange={(e) => setModuleForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuleDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateModule} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Lesson Dialog */}
      <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedLesson ? 'Edit Lesson' : 'Add Lesson'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lesson Title *</Label>
              <Input value={lessonForm.title} onChange={(e) => setLessonForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Understanding Risks" />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={lessonForm.estimated_duration_minutes || ''} onChange={(e) => setLessonForm(p => ({ ...p, estimated_duration_minutes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Lesson Content</Label>
              <LessonContentEditor content={lessonForm.content} onChange={(c) => setLessonForm(p => ({ ...p, content: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLessonDialog(false); setSelectedLesson(null); }}>Cancel</Button>
            <Button onClick={handleSaveLesson} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {selectedLesson ? 'Update' : 'Add'} Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
