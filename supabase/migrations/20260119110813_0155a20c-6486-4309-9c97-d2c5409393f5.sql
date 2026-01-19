-- Create departments table for admin-configured departments
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create policies for departments
CREATE POLICY "Super admins can manage departments"
ON public.departments
FOR ALL
USING (true);

-- Add emergency_contact_relationship to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default departments
INSERT INTO public.departments (name, organization_id, is_active)
SELECT 'Retail', id, true FROM public.organizations LIMIT 1;
INSERT INTO public.departments (name, organization_id, is_active)
SELECT 'Management', id, true FROM public.organizations LIMIT 1;
INSERT INTO public.departments (name, organization_id, is_active)
SELECT 'Administration', id, true FROM public.organizations LIMIT 1;
INSERT INTO public.departments (name, organization_id, is_active)
SELECT 'Finance', id, true FROM public.organizations LIMIT 1;
INSERT INTO public.departments (name, organization_id, is_active)
SELECT 'Operations', id, true FROM public.organizations LIMIT 1;