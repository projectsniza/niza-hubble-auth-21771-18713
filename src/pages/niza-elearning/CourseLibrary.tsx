import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, Clock, GraduationCap, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

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
}

const TEMPLATE_LABELS: Record<string, string> = {
  classic: 'Classic',
  step_by_step: 'Step-by-Step',
  visual: 'Visual',
  interactive: 'Interactive',
  microlearning: 'Microlearning',
};

const TEMPLATE_COLORS: Record<string, string> = {
  classic: 'bg-blue-500/10 text-blue-600',
  step_by_step: 'bg-green-500/10 text-green-600',
  visual: 'bg-purple-500/10 text-purple-600',
  interactive: 'bg-orange-500/10 text-orange-600',
  microlearning: 'bg-pink-500/10 text-pink-600',
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
      supabase.from('courses').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(100),
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
        <h1 className="text-3xl font-bold text-foreground">Course Library</h1>
        <p className="text-muted-foreground mt-1">Browse all available training courses</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTemplate} onValueChange={setFilterTemplate}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            {Object.entries(TEMPLATE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
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
              className="border-primary/20 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer group"
              onClick={() => navigate(`/niza-elearning/course/${course.id}`)}
            >
              <CardContent className="p-0">
                <div className="w-full h-40 rounded-t-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center relative overflow-hidden">
                  <GraduationCap className="h-12 w-12 text-orange-500/40 group-hover:scale-110 transition-transform" />
                  <Badge className={`absolute top-3 right-3 ${TEMPLATE_COLORS[course.template_style] || ''}`}>
                    {TEMPLATE_LABELS[course.template_style] || course.template_style}
                  </Badge>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-orange-600 transition-colors line-clamp-2">{course.title}</h3>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {course.estimated_duration_minutes} min
                    </span>
                    {course.certificate_enabled && (
                      <Badge variant="outline" className="text-xs">Certificate</Badge>
                    )}
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
