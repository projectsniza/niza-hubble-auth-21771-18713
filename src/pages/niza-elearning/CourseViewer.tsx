import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, CheckCircle, BookOpen, Clock, Award, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import ClassicTemplate from '@/components/elearning/templates/ClassicTemplate';
import StepByStepTemplate from '@/components/elearning/templates/StepByStepTemplate';
import VisualTemplate from '@/components/elearning/templates/VisualTemplate';
import InteractiveTemplate from '@/components/elearning/templates/InteractiveTemplate';
import MicrolearningTemplate from '@/components/elearning/templates/MicrolearningTemplate';

export default function CourseViewer() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [lessonProgress, setLessonProgress] = useState<Record<string, boolean>>({});
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const allLessons = modules.flatMap(m => (m.lessons || []).map((l: any) => ({ ...l, moduleName: m.title })));
  const currentLesson = allLessons[currentLessonIndex];
  const totalLessons = allLessons.length;
  const completedCount = Object.values(lessonProgress).filter(Boolean).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  useEffect(() => {
    if (courseId && user) fetchCourseData();
  }, [courseId, user]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      // Get employee
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user!.id).single();
      if (emp) setEmployeeId(emp.id);

      // Get course
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
      setCourse(courseData);

      // Get modules + lessons
      const { data: mods } = await supabase.from('course_modules').select('*').eq('course_id', courseId).order('sort_order');
      let lessons: any[] = [];
      if (mods) {
        const modIds = mods.map(m => m.id);
        const { data: lessonsData } = await supabase.from('course_lessons').select('*').in('module_id', modIds).order('sort_order');
        lessons = lessonsData || [];
        const modsWithLessons = mods.map(m => ({
          ...m,
          lessons: lessons.filter(l => l.module_id === m.id).map(l => ({ ...l, content: Array.isArray(l.content) ? l.content : [] })),
        }));
        setModules(modsWithLessons);
      }

      // Get progress
      if (emp) {
        const { data: prog } = await supabase.from('course_progress').select('*').eq('course_id', courseId).eq('employee_id', emp.id).maybeSingle();
        setProgress(prog);

        // Get lesson progress for all lessons in this course
        const allLessonIds = lessons.map(l => l.id);
        
        let lpData: any[] = [];
        if (allLessonIds.length > 0) {
          const { data } = await supabase.from('lesson_progress').select('lesson_id, completed').eq('employee_id', emp.id).in('lesson_id', allLessonIds);
          lpData = data || [];
        }
        const lpMap: Record<string, boolean> = {};
        lpData.forEach(l => { lpMap[l.lesson_id] = l.completed || false; });
        setLessonProgress(lpMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startCourse = async () => {
    if (!employeeId || !courseId) return;
    try {
      const { error } = await supabase.from('course_progress').upsert({
        course_id: courseId,
        employee_id: employeeId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        progress_percentage: 0,
      }, { onConflict: 'course_id,employee_id' });
      if (error) throw error;
      setProgress({ status: 'in_progress', progress_percentage: 0 });
      toast.success('Course started!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const completeLesson = async () => {
    if (!employeeId || !currentLesson) return;
    try {
      await supabase.from('lesson_progress').upsert({
        lesson_id: currentLesson.id,
        employee_id: employeeId,
        completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'lesson_id,employee_id' });

      const newLessonProgress = { ...lessonProgress, [currentLesson.id]: true };
      setLessonProgress(newLessonProgress);

      const newCompleted = Object.values(newLessonProgress).filter(Boolean).length;
      const newPercent = totalLessons > 0 ? Math.round((newCompleted / totalLessons) * 100) : 0;

      await supabase.from('course_progress').update({
        progress_percentage: newPercent,
        last_lesson_id: currentLesson.id,
        status: newPercent >= 100 ? 'completed' : 'in_progress',
        ...(newPercent >= 100 ? { completed_at: new Date().toISOString() } : {}),
      }).eq('course_id', courseId).eq('employee_id', employeeId);

      if (newPercent >= 100) {
        toast.success('🎉 Course completed!');

        // Count total completed courses for this employee
        const { count: totalCoursesCompleted } = await supabase
          .from('course_progress')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employeeId)
          .eq('status', 'completed');

        const coursesCount = (totalCoursesCompleted || 0);

        // Determine star tier
        const tierName = coursesCount >= 101 ? 'supernova'
          : coursesCount >= 51 ? 'platinum_star'
          : coursesCount >= 31 ? 'gold_star'
          : coursesCount >= 11 ? 'silver_star'
          : coursesCount >= 1 ? 'rising_star'
          : 'none';

        // Get employee name for certificate
        const { data: empData } = await supabase
          .from('employees')
          .select('first_name, last_name')
          .eq('id', employeeId)
          .maybeSingle();
        const empName = empData ? `${empData.first_name} ${empData.last_name}` : 'Employee';

        // Generate certificate if enabled
        if (course?.certificate_enabled) {
          const verificationToken = crypto.randomUUID();
          // Get default design
          const { data: defaultDesign } = await supabase
            .from('certificate_designs')
            .select('id')
            .eq('is_default', true)
            .maybeSingle();

          await supabase.from('elearning_certificates').insert({
            course_id: courseId!,
            employee_id: employeeId,
            certificate_number: `CERT-${Date.now()}`,
            course_title: course.title,
            employee_name: empName,
            verification_token: verificationToken,
            issued_at: new Date().toISOString(),
            design_id: defaultDesign?.id || null,
          });
        }

        // Count certificates
        const { count: certsCount } = await supabase
          .from('elearning_certificates')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employeeId);

        // Calculate total learning hours from all course progress
        const { data: allProgress } = await supabase
          .from('course_progress')
          .select('total_time_minutes')
          .eq('employee_id', employeeId);
        const totalLearningHours = (allProgress || []).reduce((acc, p) => acc + (p.total_time_minutes || 0), 0) / 60;

        // Update learning stats
        await supabase.from('employee_learning_stats').upsert({
          employee_id: employeeId,
          courses_completed: coursesCount,
          certificates_earned: certsCount || 0,
          total_learning_hours: Math.round(totalLearningHours * 100) / 100,
          star_tier: tierName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id' });

        // Navigate to certificates or my-courses after a short delay
        setTimeout(() => {
          navigate('/niza-elearning/certificates');
        }, 2000);
      } else if (currentLessonIndex < totalLessons - 1) {
        // Brief delay so user sees the completed state before advancing
        setTimeout(() => setCurrentLessonIndex(currentLessonIndex + 1), 800);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;
  if (!course) return <div className="p-8 text-center text-muted-foreground">Course not found</div>;

  // Course overview (not started)
  if (!progress || progress.status === 'not_started') {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="w-full h-48 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
          <BookOpen className="h-16 w-16 text-orange-500/50" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">{course.title}</h1>
        {course.description && <p className="text-muted-foreground">{course.description}</p>}
        <div className="flex flex-wrap gap-3">
          <Badge className="gap-1"><Clock className="h-3 w-3" /> {course.estimated_duration_minutes} min</Badge>
          <Badge variant="outline">{modules.length} modules</Badge>
          <Badge variant="outline">{totalLessons} lessons</Badge>
          {course.certificate_enabled && <Badge className="bg-amber-500/10 text-amber-600"><Award className="h-3 w-3 mr-1" /> Certificate</Badge>}
        </div>
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">Course Structure</h3>
            {modules.map((m, i) => (
              <div key={m.id} className="mb-3">
                <p className="font-medium text-sm">Module {i + 1}: {m.title}</p>
                <ul className="ml-4 mt-1 space-y-1">
                  {m.lessons?.map((l: any) => (
                    <li key={l.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-3 w-3" /> {l.title} <span className="text-xs">({l.estimated_duration_minutes}min)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
        {employeeId && (
          <Button size="lg" onClick={startCourse} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
            <PlayCircle className="h-5 w-5 mr-2" /> Start Course
          </Button>
        )}
      </div>
    );
  }

  // Course in progress - render with template
  const TemplateComponent = {
    classic: ClassicTemplate,
    step_by_step: StepByStepTemplate,
    visual: VisualTemplate,
    interactive: InteractiveTemplate,
    microlearning: MicrolearningTemplate,
  }[course.template_style] || ClassicTemplate;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="border-b p-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold text-sm">{course.title}</h2>
            <p className="text-xs text-muted-foreground">Lesson {currentLessonIndex + 1} of {totalLessons}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progressPercent} className="w-32 h-2" />
          <span className="text-xs text-muted-foreground">{progressPercent}%</span>
        </div>
      </div>

      {/* Lesson content */}
      <div className="flex-1 overflow-y-auto">
        {currentLesson ? (
          <TemplateComponent
            lesson={currentLesson}
            lessonIndex={currentLessonIndex}
            totalLessons={totalLessons}
            isCompleted={lessonProgress[currentLesson.id] || false}
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground">No lessons available</div>
        )}
      </div>

      {/* Navigation */}
      <div className="border-t p-3 flex items-center justify-between bg-card">
        <Button variant="outline" disabled={currentLessonIndex === 0} onClick={() => setCurrentLessonIndex(currentLessonIndex - 1)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <div className="flex gap-2">
          {!lessonProgress[currentLesson?.id] && (
            <Button onClick={completeLesson} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <CheckCircle className="h-4 w-4 mr-1" /> Complete Lesson
            </Button>
          )}
        </div>
        <Button variant="outline" disabled={currentLessonIndex >= totalLessons - 1} onClick={() => setCurrentLessonIndex(currentLessonIndex + 1)}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
