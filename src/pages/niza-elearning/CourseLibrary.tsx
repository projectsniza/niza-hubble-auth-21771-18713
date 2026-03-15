import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, Clock, GraduationCap, Filter, Zap, Target, Star, Shield, Award, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { DifficultyBadge, ProgressRing } from '@/components/elearning/GamificationElements';
import { cn } from '@/lib/utils';

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_path: string | null;
  template_style: string;
  estimated_duration_minutes: number;
  category_id: string | null;
  status: string;
  certificate_enabled: boolean;
  difficulty_level?: string;
  xp_reward?: number;
}

const TEMPLATE_LABELS: Record<string, string> = {
  classic: 'Classic',
  step_by_step: 'Step-by-Step',
  visual: 'Visual',
  interactive: 'Interactive',
  microlearning: 'Microlearning',
};

const TEMPLATE_COLORS: Record<string, string> = {
  classic: 'from-blue-500/20 to-indigo-500/20',
  step_by_step: 'from-emerald-500/20 to-green-500/20',
  visual: 'from-purple-500/20 to-violet-500/20',
  interactive: 'from-orange-500/20 to-amber-500/20',
  microlearning: 'from-pink-500/20 to-rose-500/20',
};

const TEMPLATE_BADGE_COLORS: Record<string, string> = {
  classic: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  step_by_step: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  visual: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  interactive: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  microlearning: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
};

export default function CourseLibrary() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [coursesRes, catsRes] = await Promise.all([
      supabase.from('courses').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      supabase.from('course_categories').select('*').order('name'),
    ]);
    setCourses(coursesRes.data || []);
    setCategories(catsRes.data || []);
    setLoading(false);
  };

  const filtered = courses.filter(c => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== 'all' && c.category_id !== filterCategory) return false;
    if (filterTemplate !== 'all' && c.template_style !== filterTemplate) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          Course Library
        </h1>
        <p className="text-muted-foreground mt-1 ml-[52px]">Browse courses, earn XP, and level up your skills</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..." className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTemplate} onValueChange={setFilterTemplate}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            {Object.entries(TEMPLATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No courses found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(course => (
            <Card 
              key={course.id} 
              className="border-primary/10 hover:border-primary/30 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer group overflow-hidden"
              onClick={() => navigate(`/niza-elearning/course/${course.id}`)}
            >
              <CardContent className="p-0">
                <div className={cn(
                  "w-full h-44 flex items-center justify-center relative overflow-hidden bg-gradient-to-br",
                  TEMPLATE_COLORS[course.template_style] || 'from-primary/20 to-accent/20'
                )}>
                  {course.thumbnail_path ? (
                    <img src={course.thumbnail_path} alt="" className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <GraduationCap className="h-14 w-14 text-primary/30 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge className={cn("border text-[10px]", TEMPLATE_BADGE_COLORS[course.template_style] || '')}>
                      {TEMPLATE_LABELS[course.template_style] || course.template_style}
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50">
                      <Zap className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600">{(course.xp_reward || course.estimated_duration_minutes) || 0} XP</span>
                    </div>
                  </div>
                  {course.certificate_enabled && (
                    <div className="absolute bottom-3 right-3">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white">
                        <Award className="h-3 w-3" />
                        <span className="text-[10px] font-bold">CPD</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-sm">{course.title}</h3>
                  {course.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{course.estimated_duration_minutes} min</span>
                    </div>
                    <DifficultyBadge level={(course.difficulty_level as any) || 'beginner'} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
