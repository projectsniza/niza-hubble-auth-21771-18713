-- Create tables for dynamic onboarding configuration

-- Custom onboarding pages configuration
CREATE TABLE public.onboarding_custom_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  page_order INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  logo_path TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Custom page fields (form builder)
CREATE TABLE public.onboarding_page_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.onboarding_custom_pages(id) ON DELETE CASCADE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, date, dropdown, checkbox, file, textarea
  field_options JSONB, -- For dropdown options, validation rules, etc.
  is_required BOOLEAN NOT NULL DEFAULT false,
  field_order INTEGER NOT NULL DEFAULT 1,
  placeholder TEXT,
  default_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contract templates configuration
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'full_time', -- full_time, part_time, intern, contractor
  template_file_path TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  merge_fields JSONB DEFAULT '[]'::jsonb, -- Available merge fields
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contract branding settings
CREATE TABLE public.contract_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  logo_path TEXT,
  header_template TEXT,
  footer_template TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Document requirements configuration (dynamic documents)
CREATE TABLE public.document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false, -- For Right to Work
  enabled BOOLEAN NOT NULL DEFAULT true,
  doc_order INTEGER NOT NULL DEFAULT 1,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default Right to Work document requirement (locked)
INSERT INTO public.document_requirements (name, description, is_mandatory, is_locked, enabled, doc_order)
VALUES ('Right to Work', 'Mandatory right to work documentation', true, true, true, 1);

-- Add force_password_change column to profiles for first login
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Enable RLS on all new tables
ALTER TABLE public.onboarding_custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_page_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_custom_pages
CREATE POLICY "Super admins have full access to onboarding_custom_pages"
ON public.onboarding_custom_pages FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can view onboarding_custom_pages"
ON public.onboarding_custom_pages FOR SELECT
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for onboarding_page_fields
CREATE POLICY "Super admins have full access to onboarding_page_fields"
ON public.onboarding_page_fields FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can view onboarding_page_fields"
ON public.onboarding_page_fields FOR SELECT
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for contract_templates
CREATE POLICY "Super admins have full access to contract_templates"
ON public.contract_templates FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can view contract_templates"
ON public.contract_templates FOR SELECT
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for contract_branding
CREATE POLICY "Super admins have full access to contract_branding"
ON public.contract_branding FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can view contract_branding"
ON public.contract_branding FOR SELECT
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for document_requirements
CREATE POLICY "Super admins have full access to document_requirements"
ON public.document_requirements FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can view document_requirements"
ON public.document_requirements FOR SELECT
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add updated_at triggers
CREATE TRIGGER update_onboarding_custom_pages_updated_at
BEFORE UPDATE ON public.onboarding_custom_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_page_fields_updated_at
BEFORE UPDATE ON public.onboarding_page_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_branding_updated_at
BEFORE UPDATE ON public.contract_branding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_requirements_updated_at
BEFORE UPDATE ON public.document_requirements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();