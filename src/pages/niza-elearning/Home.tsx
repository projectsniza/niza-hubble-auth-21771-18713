import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Award, Clock, TrendingUp, Star, GraduationCap, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  certificates: number;
  learningHours: number;
  averageScore: number;
}

const STAR_TIERS = [
  { min: 0, max: 0, name: 'No Tier', key: 'none', color: 'text-muted-foreground', bg: 'bg-muted' },
  { min: 1, max: 10, name: 'Rising Star', key: 'rising_star', color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
  { min: 11, max: 30, name: 'Silver Star', key: 'silver_star', color: 'text-slate-400', bg: 'bg-slate-300/10' },
  { min: 31, max: 50, name: 'Gold Star', key: 'gold_star', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { min: 51, max: 100, name: 'Platinum Star', key: 'platinum_star', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { min: 101, max: Infinity, name: 'Supernova', key: 'supernova', color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

function getStarTier(coursesCompleted: number) {
  return STAR_TIERS.find(t => coursesCompleted >= t.min && coursesCompleted <= t.max) || STAR_TIERS[0];
}

function getStarTierByKey(key: string) {
  return STAR_TIERS.find(t => t.key === key) || STAR_TIERS[0];
}

export default function ELearningHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ totalCourses: 0, completedCourses: 0, inProgressCourses: 0, certificates: 0, learningHours: 0, averageScore: 0 });
  const [recentCourses, setRecentCourses] = useState<any[]>([]);
  const [learningStats, setLearningStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr';

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Always resolve the employee ID for the current user (admins are employees too)
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
      const employeeId = emp?.id || null;

      // If not an admin and no employee record, nothing to show
      if (!isAdmin && !employeeId) {
        setLoading(false);
        return;
      }

      const coursesRes = await supabase.from('courses').select('id', { count: 'exact' }).eq('status', 'published');

      // Always scope progress/certs to the current user's employee record
      let progressQuery = supabase.from('course_progress').select('*, courses(title, thumbnail_path, estimated_duration_minutes, template_style)');
      let certsQuery = supabase.from('elearning_certificates').select('id', { count: 'exact' });

      if (employeeId) {
        progressQuery = progressQuery.eq('employee_id', employeeId);
        certsQuery = certsQuery.eq('employee_id', employeeId);

        // Fetch learning stats from DB for accurate star tier
        const { data: lStats } = await supabase.from('employee_learning_stats').select('*').eq('employee_id', employeeId).maybeSingle();
        setLearningStats(lStats);
      } else {
        // Admin with no employee record — show zero personal stats
        setStats({ totalCourses: coursesRes.count || 0, completedCourses: 0, inProgressCourses: 0, certificates: 0, learningHours: 0, averageScore: 0 });
        setRecentCourses([]);
        setLoading(false);
        return;
      }

      const [progressRes, certsRes] = await Promise.all([progressQuery, certsQuery]);

      const totalCourses = coursesRes.count || 0;
      const progress = progressRes.data || [];
      const completedCourses = progress.filter(p => p.status === 'completed').length;
      const inProgressCourses = progress.filter(p => p.status === 'in_progress').length;
      const totalHours = progress.reduce((acc, p) => acc + (p.total_time_minutes || 0), 0) / 60;

      setStats({
        totalCourses,
        completedCourses,
        inProgressCourses,
        certificates: certsRes.count || 0,
        learningHours: Math.round(totalHours * 10) / 10,
        averageScore: 0,
      });

      setRecentCourses(progress.filter(p => p.status === 'in_progress').slice(0, 4));
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Use DB stats for star tier if available, otherwise calculate from local data
  const tier = learningStats?.star_tier 
    ? getStarTierByKey(learningStats.star_tier) 
    : getStarTier(stats.completedCourses);

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">E-Learning Dashboard</h1>
        <p className="text-muted-foreground mt-1">Track your learning progress and achievements</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalCourses}</p>
                <p className="text-xs text-muted-foreground">Total Courses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.inProgressCourses}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.certificates}</p>
                <p className="text-xs text-muted-foreground">Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.learningHours}h</p>
                <p className="text-xs text-muted-foreground">Learning Hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Star Tier */}
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full ${tier.bg} flex items-center justify-center`}>
              <Star className={`h-8 w-8 ${tier.color}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-xl font-bold ${tier.color}`}>{tier.name}</h3>
              <p className="text-sm text-muted-foreground">{stats.completedCourses} courses completed</p>
              {stats.completedCourses < 101 && (
                <div className="mt-2">
                  <Progress 
                    value={(stats.completedCourses / (tier.max === Infinity ? 101 : tier.max)) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {tier.max === Infinity ? 'Maximum tier reached!' : `${tier.max - stats.completedCourses} more to next tier`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Continue Learning */}
      {recentCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Continue Learning</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/niza-elearning/my-courses')}>
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentCourses.map((progress) => (
              <Card key={progress.id} className="border-primary/20 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/niza-elearning/course/${progress.course_id}`)}>
                <CardContent className="p-4">
                  <div className="w-full h-32 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center mb-3">
                    <GraduationCap className="h-10 w-10 text-orange-500/50" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground truncate">{progress.courses?.title || 'Course'}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{progress.courses?.estimated_duration_minutes || 0} min</p>
                  <Progress value={progress.progress_percentage || 0} className="h-1.5 mt-3" />
                  <p className="text-xs text-muted-foreground mt-1">{progress.progress_percentage || 0}% complete</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/niza-elearning/library')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Browse Courses</h3>
              <p className="text-sm text-muted-foreground">Explore the course library</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/niza-elearning/certificates')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">My Certificates</h3>
              <p className="text-sm text-muted-foreground">View earned certifications</p>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="border-primary/20 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/niza-elearning/builder')}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Create Course</h3>
                <p className="text-sm text-muted-foreground">Build new training content</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
