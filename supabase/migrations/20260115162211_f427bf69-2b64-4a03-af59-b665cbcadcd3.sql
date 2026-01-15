-- Create document_follow_up_settings table for configuring auto follow-ups
CREATE TABLE public.document_follow_up_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  follow_up_count INTEGER NOT NULL DEFAULT 1 CHECK (follow_up_count >= 1 AND follow_up_count <= 10),
  follow_up_intervals INTEGER[] NOT NULL DEFAULT ARRAY[30], -- Days before expiry for each follow-up
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.document_follow_up_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Super admins can manage document follow-up settings"
ON public.document_follow_up_settings
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR users can view document follow-up settings"
ON public.document_follow_up_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'hr') OR public.has_role(auth.uid(), 'super_admin'));

-- Insert default global settings
INSERT INTO public.document_follow_up_settings (organization_id, follow_up_count, follow_up_intervals)
VALUES (NULL, 3, ARRAY[7, 14, 30]);