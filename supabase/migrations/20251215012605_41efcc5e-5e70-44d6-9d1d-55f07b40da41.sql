-- Template Types Enum
CREATE TYPE public.template_type AS ENUM (
  'visiting_card',
  'email_signature', 
  'id_card',
  'visitor_pass',
  'invoice',
  'gift_card',
  'custom'
);

-- Template Folders Table
CREATE TABLE public.template_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  parent_id UUID REFERENCES public.template_folders(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Templates Table
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type template_type NOT NULL DEFAULT 'custom',
  folder_id UUID REFERENCES public.template_folders(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  content JSONB DEFAULT '{}'::jsonb,
  thumbnail_path TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Brand Settings Table
CREATE TABLE public.brand_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  primary_logo_path TEXT,
  secondary_logo_path TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#10B981',
  accent_color TEXT DEFAULT '#8B5CF6',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  fonts JSONB DEFAULT '{"heading": "Inter", "body": "Inter"}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Gift Cards Table
CREATE TABLE public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'birthday',
  valid_date DATE,
  discount TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  design_template JSONB DEFAULT '{}'::jsonb,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.template_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_folders
CREATE POLICY "Super admins have full access to template_folders"
ON public.template_folders FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage template_folders in their scope"
ON public.template_folders FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "Managers can view template_folders"
ON public.template_folders FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for templates
CREATE POLICY "Super admins have full access to templates"
ON public.templates FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage templates in their scope"
ON public.templates FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "Managers can view templates"
ON public.templates FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for brand_settings
CREATE POLICY "Super admins have full access to brand_settings"
ON public.brand_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage brand_settings in their scope"
ON public.brand_settings FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "Managers can view brand_settings"
ON public.brand_settings FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for gift_cards
CREATE POLICY "Super admins have full access to gift_cards"
ON public.gift_cards FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage gift_cards in their scope"
ON public.gift_cards FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "Managers can view gift_cards"
ON public.gift_cards FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Create storage bucket for template assets
INSERT INTO storage.buckets (id, name, public) VALUES ('template-assets', 'template-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for template-assets
CREATE POLICY "Authenticated users can view template assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'template-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage template assets"
ON storage.objects FOR ALL
USING (bucket_id = 'template-assets' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage template assets"
ON storage.objects FOR ALL
USING (bucket_id = 'template-assets' AND has_role(auth.uid(), 'hr'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_template_folders_updated_at
  BEFORE UPDATE ON public.template_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brand_settings_updated_at
  BEFORE UPDATE ON public.brand_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gift_cards_updated_at
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();