import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, ChevronRight, CheckCircle, BookOpen, Clock, Award, 
  PlayCircle, Zap, Target, Trophy, Shield, Star, Flame, TrendingUp 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { XPBar, PointsPopup, DifficultyBadge, MilestoneTracker } from '@/components/elearning/GamificationElements';
import ClassicTemplate from '@/components/elearning/templates/ClassicTemplate';
import StepByStepTemplate from '@/components/elearning/templates/StepByStepTemplate';
import VisualTemplate from '@/components/elearning/templates/VisualTemplate';
import InteractiveTemplate from '@/components/elearning/templates/InteractiveTemplate';
import MicrolearningTemplate from '@/components/elearning/templates/MicrolearningTemplate';
import { cn } from '@/lib/utils';

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
  const [showXPPopup, setShowXPPopup] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allLessons = modules.flatMap(m => (m.lessons || []).map((l: any) => ({ ...l, moduleName: m.title })));
  const currentLesson = allLessons[currentLessonIndex];
  const totalLessons = allLessons.length;
  const completedCount = Object.values(lessonProgress).filter(Boolean).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const xpPerLesson = 25;
  const totalXP = completedCount * xpPerLesson;
  const maxXP = totalLessons * xpPerLesson;
  const level = Math.floor(totalXP / 100) + 1;

  useEffect(() => {
    if (courseId && user) fetchCourseData();
  }, [courseId, user]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user!.id).single();
      if (emp) setEmployeeId(emp.id);

      const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
      setCourse(courseData);

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

      if (emp) {
        const { data: prog } = await supabase.from('course_progress').select('*').eq('course_id', courseId).eq('employee_id', emp.id).maybeSingle();
        setProgress(prog);

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
      toast.success('Course started! Good luck!');
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

      // Show XP popup
      setEarnedXP(xpPerLesson);
      setShowXPPopup(true);
      setTimeout(() => setShowXPPopup(false), 2000);

      const newCompleted = Object.values(newLessonProgress).filter(Boolean).length;
      const newPercent = totalLessons > 0 ? Math.round((newCompleted / totalLessons) * 100) : 0;

      await supabase.from('course_progress').update({
        progress_percentage: newPercent,
        last_lesson_id: currentLesson.id,
        status: newPercent >= 100 ? 'completed' : 'in_progress',
        ...(newPercent >= 100 ? { completed_at: new Date().toISOString() } : {}),
      }).eq('course_id', courseId).eq('employee_id', employeeId);

      if (newPercent >= 100) {
        toast.success('Course completed! Achievement unlocked!');

        const { count: totalCoursesCompleted } = await supabase
          .from('course_progress')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employeeId)
          .eq('status', 'completed');

        const coursesCount = (totalCoursesCompleted || 0);
        const tierName = coursesCount >= 101 ? 'supernova'
          : coursesCount >= 51 ? 'platinum_star'
          : coursesCount >= 31 ? 'gold_star'
          : coursesCount >= 11 ? 'silver_star'
          : coursesCount >= 1 ? 'rising_star'
          : 'none';

        const { data: empData } = await supabase
          .from('employees')
          .select('first_name, last_name')
          .eq('id', employeeId)
          .maybeSingle();
        const empName = empData ? `${empData.first_name} ${empData.last_name}` : 'Employee';

        if (course?.certificate_enabled) {
          const verificationToken = crypto.randomUUID();
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

        const { count: certsCount } = await supabase
          .from('elearning_certificates')
          .select('id', { count: 'exact', head: true })
          .eq('employee_id', employeeId);

        const { data: allProgress } = await supabase
          .from('course_progress')
          .select('total_time_minutes')
          .eq('employee_id', employeeId);
        const totalLearningHours = (allProgress || []).reduce((acc, p) => acc + (p.total_time_minutes || 0), 0) / 60;

        await supabase.from('employee_learning_stats').upsert({
          employee_id: employeeId,
          courses_completed: coursesCount,
          certificates_earned: certsCount || 0,
          total_learning_hours: Math.round(totalLearningHours * 100) / 100,
          star_tier: tierName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id' });

        setTimeout(() => {
          navigate('/niza-elearning/certificates');
        }, 2000);
      } else if (currentLessonIndex < totalLessons - 1) {
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

        {/* Hero */}
        <div className="w-full h-56 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.15),transparent_70%)]" />
          {course.thumbnail_path ? (
            <img src={course.thumbnail_path} alt="" className="w-full h-full object-cover absolute inset-0" />
          ) : (
            <BookOpen className="h-16 w-16 text-primary/40" />
          )}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <DifficultyBadge level={course.difficulty_level || 'beginner'} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground">{course.title}</h1>
        {course.description && <p className="text-muted-foreground text-lg">{course.description}</p>}

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <Badge className="gap-1 bg-primary/10 text-primary border border-primary/20">
            <Clock className="h-3 w-3" /> {course.estimated_duration_minutes} min
          </Badge>
          <Badge variant="outline" className="gap-1"><Target className="h-3 w-3" /> {modules.length} modules</Badge>
          <Badge variant="outline" className="gap-1"><BookOpen className="h-3 w-3" /> {totalLessons} lessons</Badge>
          <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 gap-1">
            <Zap className="h-3 w-3" /> {totalLessons * xpPerLesson} XP total
          </Badge>
          {course.certificate_enabled && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 gap-1">
              <Award className="h-3 w-3" /> Certificate
            </Badge>
          )}
        </div>

        {/* Rewards preview */}
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <CardContent className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Rewards
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                <Zap className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{totalLessons * xpPerLesson}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total XP</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                <Star className="h-6 w-6 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{modules.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Milestones</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                <Shield className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">1</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Badge</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
                <Award className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{course.certificate_enabled ? 'Yes' : 'No'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Certificate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Structure */}
        <Card className="border-primary/20 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
          <CardContent className="p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Course Structure
            </h3>
            {modules.map((m, i) => (
              <div key={m.id} className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">{i + 1}</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground">{m.title}</p>
                  <Badge variant="outline" className="text-[10px]">{m.lessons?.length || 0} lessons</Badge>
                </div>
                <ul className="ml-11 space-y-1">
                  {m.lessons?.map((l: any) => (
                    <li key={l.id} className="text-sm text-muted-foreground flex items-center gap-2 py-1">
                      <BookOpen className="h-3 w-3" /> {l.title}
                      <span className="text-xs text-muted-foreground/60">{l.estimated_duration_minutes}min</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {employeeId ? (
          <Button size="lg" onClick={startCourse} className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
            <PlayCircle className="h-5 w-5" /> Begin Course
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground italic">Link your employee profile to start this course.</p>
        )}
      </div>
    );
  }

  // Course in progress
  const TemplateComponent = {
    classic: ClassicTemplate,
    step_by_step: StepByStepTemplate,
    visual: VisualTemplate,
    interactive: InteractiveTemplate,
    microlearning: MicrolearningTemplate,
  }[course.template_style] || ClassicTemplate;

  const milestones = modules.map((m, i) => ({
    at: modules.slice(0, i + 1).reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0),
    label: `M${i + 1}`,
    icon: i === modules.length - 1 ? Trophy : Star,
  }));

  return (
    <div className="flex flex-col h-full">
      <PointsPopup points={earnedXP} show={showXPPopup} />

      {/* Gamified Top Bar */}
      <div className="border-b p-3 bg-card">
        <div className="flex items-center justify-between mb-2">
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
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-bold text-amber-600">{totalXP} XP</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              <Star className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold text-primary">LVL {level}</span>
            </div>
          </div>
        </div>
        <XPBar current={totalXP} total={maxXP} level={level} />
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

      {/* Gamified Navigation */}
      <div className="border-t p-3 bg-card">
        {/* Milestones */}
        <div className="mb-3 hidden sm:block">
          <MilestoneTracker current={completedCount} milestones={milestones} />
        </div>
        
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={currentLessonIndex === 0} onClick={() => setCurrentLessonIndex(currentLessonIndex - 1)} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <div className="flex gap-2">
            {!lessonProgress[currentLesson?.id] && (
              <Button onClick={completeLesson} className="bg-gradient-to-r from-emerald-500 to-green-600 text-white gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all">
                <CheckCircle className="h-4 w-4" /> Complete +{xpPerLesson} XP
              </Button>
            )}
            {lessonProgress[currentLesson?.id] && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 gap-1 py-2 px-3">
                <Shield className="h-4 w-4" /> Completed
              </Badge>
            )}
          </div>
          <Button variant="outline" disabled={currentLessonIndex >= totalLessons - 1} onClick={() => setCurrentLessonIndex(currentLessonIndex + 1)} className="gap-1">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
