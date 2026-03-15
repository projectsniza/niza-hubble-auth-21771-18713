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
import { Separator } from '@/components/ui/separator';
import { Plus, Edit, Trash2, GraduationCap, BookOpen, ChevronDown, ChevronUp, Loader2, Eye, Archive, Send, Zap, Trophy, Target, Shield, Star, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import LessonContentEditor from '@/components/elearning/LessonContentEditor';
import ImageUploadBlock from '@/components/elearning/ImageUploadBlock';
import { DifficultyBadge } from '@/components/elearning/GamificationElements';
import { cn } from '@/lib/utils';

const TEMPLATE_OPTIONS = [
  { value: 'classic', label: 'Classic Learning', desc: 'Corporate training with clean layout', icon: BookOpen },
  { value: 'step_by_step', label: 'Step-by-Step', desc: 'Procedural training with progress tracking', icon: Target },
  { value: 'visual', label: 'Visual Learning', desc: 'Image-heavy with infographics', icon: Eye },
  { value: 'interactive', label: 'Interactive', desc: 'Quizzes and scenario-based learning', icon: Zap },
  { value: 'microlearning', label: 'Microlearning', desc: 'Short card-based quick lessons', icon: Star },
];

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Entry-level, no prior knowledge needed' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some existing knowledge required' },
  { value: 'advanced', label: 'Advanced', desc: 'Requires strong foundations' },
  { value: 'expert', label: 'Expert', desc: 'For specialists and experienced staff' },
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
  thumbnail_path: string | null;
  difficulty_level?: string | null;
  xp_reward?: number | null;
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

  const [courseForm, setCourseForm] = useState({
    title: '', description: '', template_style: 'classic', estimated_duration_minutes: 30,
    passing_score: 80, certificate_enabled: true, category_id: '',
    thumbnail_path: '', difficulty_level: 'beginner', xp_reward: 0,
  });

  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
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
      const xp = courseForm.xp_reward || courseForm.estimated_duration_minutes;
      const { error } = await supabase.from('courses').insert({
        title: courseForm.title,
        description: courseForm.description || null,
        template_style: courseForm.template_style,
        estimated_duration_minutes: courseForm.estimated_duration_minutes,
        passing_score: courseForm.passing_score,
        certificate_enabled: courseForm.certificate_enabled,
        category_id: courseForm.category_id || null,
        thumbnail_path: courseForm.thumbnail_path || null,
        created_by: user?.id,
        status: 'draft',
      });
      if (error) throw error;
      toast.success('Course created');
      setShowCourseDialog(false);
      resetCourseForm();
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
        thumbnail_path: courseForm.thumbnail_path || null,
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

  const resetCourseForm = () => {
    setCourseForm({ title: '', description: '', template_style: 'classic', estimated_duration_minutes: 30, passing_score: 80, certificate_enabled: true, category_id: '', thumbnail_path: '', difficulty_level: 'beginner', xp_reward: 0 });
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
      thumbnail_path: course.thumbnail_path || '',
      difficulty_level: course.difficulty_level || 'beginner',
      xp_reward: course.xp_reward || 0,
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
    if (status === 'published') return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">Published</Badge>;
    if (status === 'archived') return <Badge className="bg-muted text-muted-foreground">Archived</Badge>;
    return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30">Draft</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            Course Builder
          </h1>
          <p className="text-muted-foreground mt-1 ml-[52px]">Create gamified training courses with XP rewards</p>
        </div>
        <Button onClick={() => { setSelectedCourse(null); resetCourseForm(); setShowCourseDialog(true); }} className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> New Course
        </Button>
      </div>

      {/* Courses List */}
      <div className="space-y-3">
        {courses.length === 0 ? (
          <div className="text-center py-16">
            <GraduationCap className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No courses yet</h3>
            <p className="text-sm text-muted-foreground">Create your first gamified training course</p>
          </div>
        ) : (
          courses.map(course => (
            <Card key={course.id} className="border-primary/10 hover:border-primary/20 transition-colors overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleCourseExpand(course.id)}>
                    {expandedCourse === course.id ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    {course.thumbnail_path ? (
                      <img src={course.thumbnail_path} alt="" className="w-12 h-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary/50" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-foreground">{course.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {getStatusBadge(course.status)}
                        <span className="text-xs text-muted-foreground">{course.estimated_duration_minutes} min</span>
                        <Badge variant="outline" className="text-xs">{TEMPLATE_OPTIONS.find(t => t.value === course.template_style)?.label}</Badge>
                        <DifficultyBadge level={(course.difficulty_level as any) || 'beginner'} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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

                {expandedCourse === course.id && (
                  <div className="mt-4 ml-8 space-y-3">
                    <Button variant="outline" size="sm" onClick={() => { setModuleForm({ title: '', description: '' }); setShowModuleDialog(true); }} className="gap-1">
                      <Plus className="h-3 w-3" /> Add Module
                    </Button>
                    {modules.map(mod => (
                      <div key={mod.id} className="border rounded-lg p-3 bg-card/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}>
                            {expandedModule === mod.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <h4 className="font-medium text-sm">{mod.title}</h4>
                            <Badge variant="outline" className="text-xs">{mod.lessons?.length || 0} lessons</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteTarget({ type: 'module', id: mod.id, name: mod.title }); setShowDeleteDialog(true); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        {expandedModule === mod.id && (
                          <div className="mt-2 ml-6 space-y-2">
                            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => { setSelectedModule(mod); setSelectedLesson(null); setLessonForm({ title: '', content: [], estimated_duration_minutes: 5 }); setShowLessonDialog(true); }}>
                              <Plus className="h-3 w-3" /> Add Lesson
                            </Button>
                            {mod.lessons?.map(lesson => (
                              <div key={lesson.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/30 transition-colors">
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              {selectedCourse ? 'Edit Course' : 'Create New Course'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Thumbnail */}
            <div className="space-y-2">
              <Label className="text-sm font-bold">Course Thumbnail</Label>
              <ImageUploadBlock
                currentUrl={courseForm.thumbnail_path}
                onUpload={(url) => setCourseForm(p => ({ ...p, thumbnail_path: url }))}
                placeholder="Upload a course thumbnail image"
                folder="course-thumbnails"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Course Title *</Label>
              <Input value={courseForm.title} onChange={(e) => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., CPD: Workplace Safety Training" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={courseForm.description} onChange={(e) => setCourseForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Course description..." />
            </div>

            <Separator />

            {/* Template Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Course Template *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATE_OPTIONS.map(t => {
                  const Icon = t.icon;
                  return (
                    <div 
                      key={t.value}
                      onClick={() => setCourseForm(p => ({ ...p, template_style: t.value }))}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-all",
                        courseForm.template_style === t.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{t.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Gamification Settings */}
            <div className="space-y-4">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Gamification Settings
              </Label>

              <div className="space-y-2">
                <Label className="text-xs">Difficulty Level</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIFFICULTY_OPTIONS.map(d => (
                    <div 
                      key={d.value}
                      onClick={() => setCourseForm(p => ({ ...p, difficulty_level: d.value }))}
                      className={cn(
                        "p-2 rounded-lg border-2 cursor-pointer transition-all text-center",
                        courseForm.difficulty_level === d.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <span className="text-xs font-bold">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">XP Reward (0 = auto)</Label>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <Input type="number" value={courseForm.xp_reward || ''} onChange={(e) => setCourseForm(p => ({ ...p, xp_reward: parseInt(e.target.value) || 0 }))} placeholder="Auto-calculated" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Leave 0 to auto-calculate from lessons</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Passing Score (%)</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <Input type="number" value={courseForm.passing_score || ''} onChange={(e) => setCourseForm(p => ({ ...p, passing_score: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={courseForm.estimated_duration_minutes || ''} onChange={(e) => setCourseForm(p => ({ ...p, estimated_duration_minutes: parseInt(e.target.value) || 0 }))} />
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
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-emerald-500/5 to-green-500/5 border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-500" />
                <Label>CPD Certificate on Completion</Label>
              </div>
              <Switch checked={courseForm.certificate_enabled} onCheckedChange={(v) => setCourseForm(p => ({ ...p, certificate_enabled: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourseDialog(false)}>Cancel</Button>
            <Button onClick={selectedCourse ? handleUpdateCourse : handleCreateCourse} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedCourse ? 'Update' : 'Create'} Course
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
