-- Add onboarding form settings table
CREATE TABLE IF NOT EXISTS public.onboarding_form_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  form_type TEXT NOT NULL CHECK (form_type IN ('application_form', 'starter_checklist', 'bank_details', 'custom_pages')),
  enabled BOOLEAN DEFAULT true,
  form_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, form_type)
);

-- Add onboarding form responses table
CREATE TABLE IF NOT EXISTS public.onboarding_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,
  form_data JSONB DEFAULT '{}'::jsonb,
  signature TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, form_type)
);

-- Add contract signature columns
ALTER TABLE public.contract_approvals 
ADD COLUMN IF NOT EXISTS employer_signature TEXT,
ADD COLUMN IF NOT EXISTS employer_signature_type TEXT CHECK (employer_signature_type IN ('typed', 'drawn', 'uploaded')),
ADD COLUMN IF NOT EXISTS employer_signed_date DATE,
ADD COLUMN IF NOT EXISTS contract_content JSONB DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE public.onboarding_form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_form_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for onboarding_form_settings
CREATE POLICY "Super admins have full access to onboarding_form_settings" 
ON public.onboarding_form_settings 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can view onboarding_form_settings" 
ON public.onboarding_form_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for onboarding_form_responses
CREATE POLICY "Super admins have full access to onboarding_form_responses" 
ON public.onboarding_form_responses 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage onboarding_form_responses" 
ON public.onboarding_form_responses 
FOR ALL 
USING (has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Create update trigger for onboarding_form_settings
CREATE TRIGGER update_onboarding_form_settings_updated_at
BEFORE UPDATE ON public.onboarding_form_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create update trigger for onboarding_form_responses
CREATE TRIGGER update_onboarding_form_responses_updated_at
BEFORE UPDATE ON public.onboarding_form_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();