import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Users, Award, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

export default function LearningAnalytics() {
  const [stats, setStats] = useState({ totalCourses: 0, totalAssignments: 0, totalCompleted: 0, totalCertificates: 0, averageCompletion: 0 });
  const [employeeStats, setEmployeeStats] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [coursesRes, progressRes, certsRes, assignRes] = await Promise.all([
        supabase.from('courses').select('id, title', { count: 'exact' }).eq('status', 'published'),
        supabase.from('course_progress').select('*, employees(first_name, last_name), courses(title)'),
        supabase.from('elearning_certificates').select('id', { count: 'exact' }),
        supabase.from('course_assignments').select('id', { count: 'exact' }),
      ]);

      const progress = progressRes.data || [];
      const completed = progress.filter(p => p.status === 'completed');
      const avgCompletion = progress.length > 0 ? Math.round(progress.reduce((acc, p) => acc + (p.progress_percentage || 0), 0) / progress.length) : 0;

      setStats({
        totalCourses: coursesRes.count || 0,
        totalAssignments: assignRes.count || 0,
        totalCompleted: completed.length,
        totalCertificates: certsRes.count || 0,
        averageCompletion: avgCompletion,
      });

      // Group by employee
      const empMap = new Map<string, any>();
      progress.forEach(p => {
        const empId = p.employee_id;
        if (!empMap.has(empId)) {
          empMap.set(empId, {
            name: `${p.employees?.first_name || ''} ${p.employees?.last_name || ''}`.trim(),
            assigned: 0, completed: 0, hours: 0, avgProgress: 0, totalProgress: 0,
          });
        }
        const emp = empMap.get(empId)!;
        emp.assigned++;
        if (p.status === 'completed') emp.completed++;
        emp.hours += (p.total_time_minutes || 0) / 60;
        emp.totalProgress += p.progress_percentage || 0;
        emp.avgProgress = Math.round(emp.totalProgress / emp.assigned);
      });
      setEmployeeStats(Array.from(empMap.values()));

      // Group by course
      const courseMap = new Map<string, any>();
      progress.forEach(p => {
        const cId = p.course_id;
        if (!courseMap.has(cId)) {
          courseMap.set(cId, { title: p.courses?.title || 'Unknown', enrolled: 0, completed: 0 });
        }
        const c = courseMap.get(cId)!;
        c.enrolled++;
        if (p.status === 'completed') c.completed++;
      });
      setCourseStats(Array.from(courseMap.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Learning Analytics</h1>
        <p className="text-muted-foreground mt-1">Overview of training performance across your organization</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Assignments', value: stats.totalAssignments, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Completed', value: stats.totalCompleted, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Certificates', value: stats.totalCertificates, icon: Award, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Avg. Completion', value: `${stats.averageCompletion}%`, icon: BarChart3, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        ].map((s, i) => (
          <Card key={i} className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course Popularity */}
      <Card className="border-primary/20">
        <CardHeader><CardTitle className="text-lg">Course Popularity</CardTitle></CardHeader>
        <CardContent>
          {courseStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No course data yet</p>
          ) : (
            <div className="space-y-4">
              {courseStats.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{c.completed}/{c.enrolled} completed</span>
                  </div>
                  <Progress value={c.enrolled > 0 ? (c.completed / c.enrolled) * 100 : 0} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Progress Table */}
      <Card className="border-primary/20">
        <CardHeader><CardTitle className="text-lg">Employee Learning Progress</CardTitle></CardHeader>
        <CardContent>
          {employeeStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No employee data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-muted-foreground font-medium">Employee</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Assigned</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Completed</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Hours</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((e, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 font-medium text-foreground">{e.name || 'Unknown'}</td>
                      <td className="py-3 text-center">{e.assigned}</td>
                      <td className="py-3 text-center">{e.completed}</td>
                      <td className="py-3 text-center">{Math.round(e.hours * 10) / 10}h</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={e.avgProgress} className="h-2 w-20" />
                          <span className="text-xs">{e.avgProgress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
