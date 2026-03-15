import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, CheckCircle, Clock, GraduationCap, PlayCircle, Zap, Trophy, Star, Shield, Target, Flame, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { XPBar, ProgressRing } from '@/components/elearning/GamificationElements';
import { cn } from '@/lib/utils';

export default function MyCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [user]);

  const fetchProgress = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).single();
      if (!emp) { setLoading(false); return; }

      const [progRes, statsRes] = await Promise.all([
        supabase.from('course_progress')
          .select('*, courses(id, title, description, thumbnail_path, estimated_duration_minutes, template_style, certificate_enabled)')
          .eq('employee_id', emp.id)
          .order('updated_at', { ascending: false }),
        supabase.from('employee_learning_stats').select('*').eq('employee_id', emp.id).maybeSingle(),
      ]);

      setProgress(progRes.data || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inProgress = progress.filter(p => p.status === 'in_progress');
  const completed = progress.filter(p => p.status === 'completed');
  const notStarted = progress.filter(p => p.status === 'not_started');

  const totalXP = completed.length * 25 + inProgress.reduce((acc, p) => {
    const lessonsEst = Math.round((p.progress_percentage || 0) / 10);
    return acc + lessonsEst * 25;
  }, 0);
  const level = Math.floor(totalXP / 100) + 1;

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  const CourseCard = ({ item }: { item: any }) => (
    <Card 
      className="border-primary/10 hover:border-primary/30 hover:shadow-xl transition-all cursor-pointer group overflow-hidden hover:-translate-y-1"
      onClick={() => navigate(`/niza-elearning/course/${item.course_id}`)}
    >
      <CardContent className="p-0">
        <div className="w-full h-36 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative overflow-hidden">
          {item.courses?.thumbnail_path ? (
            <img src={item.courses.thumbnail_path} alt="" className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <GraduationCap className="h-10 w-10 text-primary/30" />
          )}
          <div className="absolute top-3 right-3">
            <ProgressRing percent={item.progress_percentage || 0} size={40} />
          </div>
          {item.status === 'completed' && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-emerald-500/90 text-white border-0 gap-1 shadow-lg">
                <Shield className="h-3 w-3" /> Complete
              </Badge>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-bold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">{item.courses?.title}</h3>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{item.courses?.estimated_duration_minutes || 0} min</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600">{Math.round((item.progress_percentage || 0) * 0.25 * (item.courses?.estimated_duration_minutes || 30) / 100 * 25)} XP</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                item.status === 'completed' 
                  ? "bg-gradient-to-r from-emerald-400 to-green-500" 
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
              )}
              style={{ width: `${item.progress_percentage || 0}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right font-mono">{item.progress_percentage || 0}%</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Gamified Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            My Learning
          </h1>
          <p className="text-muted-foreground mt-1 ml-[52px]">Track progress, earn XP, unlock achievements</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <CardContent className="p-4 text-center">
            <Zap className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalXP}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total XP</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">LVL {level}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Level</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-green-500/5 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{completed.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-violet-500/5 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-400 to-violet-500" />
          <CardContent className="p-4 text-center">
            <Flame className="h-6 w-6 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.star_tier?.replace('_', ' ') || 'Starter'}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tier</p>
          </CardContent>
        </Card>
      </div>

      {/* XP Progress */}
      <Card className="border-primary/20 overflow-hidden">
        <CardContent className="p-4">
          <XPBar current={totalXP % 100} total={100} level={level} />
        </CardContent>
      </Card>

      <Tabs defaultValue="in-progress">
        <TabsList>
          <TabsTrigger value="in-progress" className="gap-1">
            <PlayCircle className="h-4 w-4" /> In Progress ({inProgress.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="h-4 w-4" /> Completed ({completed.length})
          </TabsTrigger>
          <TabsTrigger value="not-started" className="gap-1">
            <BookOpen className="h-4 w-4" /> Not Started ({notStarted.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="in-progress" className="mt-4">
          {inProgress.length === 0 ? (
            <div className="text-center py-12">
              <PlayCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No courses in progress</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={() => navigate('/niza-elearning/library')}>
                <Target className="h-4 w-4" /> Browse Courses
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {inProgress.map(item => <CourseCard key={item.id} item={item} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No completed courses yet</p>
              <p className="text-xs text-muted-foreground mt-1">Complete courses to earn XP and unlock achievements</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {completed.map(item => <CourseCard key={item.id} item={item} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="not-started" className="mt-4">
          {notStarted.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">All assigned courses started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {notStarted.map(item => <CourseCard key={item.id} item={item} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
