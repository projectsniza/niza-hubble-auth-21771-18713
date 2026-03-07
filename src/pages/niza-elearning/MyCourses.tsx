import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, CheckCircle, Clock, GraduationCap, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

export default function MyCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [user]);

  const fetchProgress = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get employee ID for current user
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!emp) { setLoading(false); return; }

      const { data } = await supabase
        .from('course_progress')
        .select('*, courses(id, title, description, thumbnail_path, estimated_duration_minutes, template_style, certificate_enabled)')
        .eq('employee_id', emp.id)
        .order('updated_at', { ascending: false });

      setProgress(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inProgress = progress.filter(p => p.status === 'in_progress');
  const completed = progress.filter(p => p.status === 'completed');
  const notStarted = progress.filter(p => p.status === 'not_started');

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  const CourseCard = ({ item }: { item: any }) => (
    <Card 
      className="border-primary/20 hover:shadow-lg transition-all cursor-pointer"
      onClick={() => navigate(`/niza-elearning/course/${item.course_id}`)}
    >
      <CardContent className="p-4">
        <div className="w-full h-32 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center mb-3">
          <GraduationCap className="h-10 w-10 text-orange-500/40" />
        </div>
        <h3 className="font-semibold text-sm text-foreground line-clamp-2">{item.courses?.title}</h3>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{item.courses?.estimated_duration_minutes || 0} min</span>
        </div>
        <Progress value={item.progress_percentage || 0} className="h-1.5 mt-3" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{item.progress_percentage || 0}%</span>
          {item.status === 'completed' && (
            <Badge className="bg-green-500/10 text-green-600 text-xs">Completed</Badge>
          )}
          {item.status === 'in_progress' && (
            <Badge className="bg-orange-500/10 text-orange-600 text-xs">In Progress</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Courses</h1>
        <p className="text-muted-foreground mt-1">Track your learning journey</p>
      </div>

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
              <Button variant="outline" className="mt-3" onClick={() => navigate('/niza-elearning/library')}>Browse Courses</Button>
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
              <CheckCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No completed courses yet</p>
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
