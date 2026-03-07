
-- E-Learning System Database Tables

-- Course categories
CREATE TABLE public.course_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Courses
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_path TEXT,
  category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL,
  template_style TEXT NOT NULL DEFAULT 'classic' CHECK (template_style IN ('classic', 'step_by_step', 'visual', 'interactive', 'microlearning')),
  estimated_duration_minutes INTEGER DEFAULT 30,
  passing_score INTEGER DEFAULT 70,
  certificate_enabled BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Course modules
CREATE TABLE public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Course lessons
CREATE TABLE public.course_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Course assignments
CREATE TABLE public.course_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assigned_to_employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_to_department TEXT,
  assigned_to_branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  assigned_to_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_to_role TEXT,
  assign_all BOOLEAN DEFAULT false,
  due_date TIMESTAMPTZ,
  is_mandatory BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Course progress (per employee per course)
CREATE TABLE public.course_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
  progress_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_time_minutes INTEGER DEFAULT 0,
  last_lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, employee_id)
);

-- Lesson progress (per employee per lesson)
CREATE TABLE public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_id, employee_id)
);

-- Course assessments (quizzes per course)
CREATE TABLE public.course_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Final Assessment',
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  time_limit_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assessment questions
CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.course_assessments(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'multi_select', 'scenario')),
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assessment attempts (employee quiz results)
CREATE TABLE public.assessment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.course_assessments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  answers JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Certificates
CREATE TABLE public.elearning_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ DEFAULT now(),
  pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Employee learning stats (for star ranking)
CREATE TABLE public.employee_learning_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  courses_completed INTEGER DEFAULT 0,
  total_learning_hours NUMERIC(10,2) DEFAULT 0,
  certificates_earned INTEGER DEFAULT 0,
  average_score NUMERIC(5,2) DEFAULT 0,
  star_tier TEXT DEFAULT 'none' CHECK (star_tier IN ('none', 'rising_star', 'silver_star', 'gold_star', 'platinum_star', 'supernova')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Learning access settings
CREATE TABLE public.learning_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  learning_mode TEXT NOT NULL DEFAULT 'hybrid' CHECK (learning_mode IN ('assigned_only', 'open', 'hybrid')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elearning_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_learning_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can read, admins can write
CREATE POLICY "Authenticated users can read course_categories" ON public.course_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage course_categories" ON public.course_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Authenticated users can read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can read course_modules" ON public.course_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage course_modules" ON public.course_modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can read course_lessons" ON public.course_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage course_lessons" ON public.course_lessons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can read course_assignments" ON public.course_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and managers can manage course_assignments" ON public.course_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated users can read course_progress" ON public.course_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage own course_progress" ON public.course_progress FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read lesson_progress" ON public.lesson_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage own lesson_progress" ON public.lesson_progress FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read course_assessments" ON public.course_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage course_assessments" ON public.course_assessments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can read assessment_questions" ON public.assessment_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage assessment_questions" ON public.assessment_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can read assessment_attempts" ON public.assessment_attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage own assessment_attempts" ON public.assessment_attempts FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read elearning_certificates" ON public.elearning_certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage elearning_certificates" ON public.elearning_certificates FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read employee_learning_stats" ON public.employee_learning_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage employee_learning_stats" ON public.employee_learning_stats FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read learning_settings" ON public.learning_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins can manage learning_settings" ON public.learning_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Create storage bucket for elearning content
INSERT INTO storage.buckets (id, name, public) VALUES ('elearning', 'elearning', false);

-- Storage policies for elearning bucket
CREATE POLICY "Authenticated users can read elearning files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'elearning');
CREATE POLICY "Admins can upload elearning files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'elearning' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr')));
CREATE POLICY "Admins can update elearning files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'elearning' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr')));
CREATE POLICY "Admins can delete elearning files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'elearning' AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr')));

-- Add updated_at triggers
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_course_modules_updated_at BEFORE UPDATE ON public.course_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_course_lessons_updated_at BEFORE UPDATE ON public.course_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_course_progress_updated_at BEFORE UPDATE ON public.course_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_course_assessments_updated_at BEFORE UPDATE ON public.course_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_learning_settings_updated_at BEFORE UPDATE ON public.learning_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
