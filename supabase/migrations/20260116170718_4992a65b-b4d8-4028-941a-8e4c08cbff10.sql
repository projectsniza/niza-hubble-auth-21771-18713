-- Create shared_templates table for templates shared from Super Admin to Store Logins
CREATE TABLE public.shared_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'general',
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  content JSONB,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  is_global BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store_templates table for Store Login's own templates
CREATE TABLE public.store_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'general',
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  content JSONB,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.shared_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_templates
-- Super Admin can do everything
CREATE POLICY "Super admins can manage shared templates"
ON public.shared_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Store Logins (managers) can view templates shared with their branch or globally
CREATE POLICY "Managers can view shared templates for their branch"
ON public.shared_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND is_active = true AND (
    is_global = true OR
    branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- HR can view shared templates for their organization
CREATE POLICY "HR can view shared templates"
ON public.shared_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr') AND is_active = true AND (
    is_global = true OR
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for store_templates
-- Super Admin can view all store templates
CREATE POLICY "Super admins can view all store templates"
ON public.store_templates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Store Logins (managers) can manage their own branch templates
CREATE POLICY "Managers can manage their branch templates"
ON public.store_templates
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager') AND
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

-- HR can view store templates for their organization
CREATE POLICY "HR can view store templates"
ON public.store_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr') AND
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Create updated_at trigger for both tables
CREATE TRIGGER update_shared_templates_updated_at
BEFORE UPDATE ON public.shared_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_templates_updated_at
BEFORE UPDATE ON public.store_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();