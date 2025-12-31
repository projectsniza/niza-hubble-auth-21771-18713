-- 1. Add VAT number column to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS vat_number TEXT;

-- 2. Add salary_type column to contract_approvals (stored in contract_content, but we'll also add a dedicated column for clarity)
-- This is already handled via contract_content JSON, but let's ensure proper structure

-- 3. Create reminders table for task notifications
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  reminder_date TIMESTAMPTZ NOT NULL,
  reminder_type TEXT DEFAULT 'task',
  priority TEXT DEFAULT 'medium',
  is_completed BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminders
CREATE POLICY "Super admins have full access to reminders"
ON public.reminders FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view reminders assigned to them"
ON public.reminders FOR SELECT
USING (assigned_to = auth.uid());

CREATE POLICY "Users can update their own reminders"
ON public.reminders FOR UPDATE
USING (assigned_to = auth.uid());

CREATE POLICY "HR can manage reminders in their scope"
ON public.reminders FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage reminders in their branch"
ON public.reminders FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- 4. Create reminder_settings table for super admin to configure reminder intervals
CREATE TABLE public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage reminder settings
CREATE POLICY "Super admins have full access to reminder_settings"
ON public.reminder_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- All authenticated users can view reminder settings
CREATE POLICY "Authenticated users can view reminder_settings"
ON public.reminder_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default reminder intervals
INSERT INTO public.reminder_settings (setting_key, setting_value, description)
VALUES (
  'reminder_intervals',
  '[{"label": "1 day before", "minutes": 1440}, {"label": "1 hour before", "minutes": 60}, {"label": "30 minutes before", "minutes": 30}, {"label": "At time of reminder", "minutes": 0}]'::jsonb,
  'Default reminder intervals before the due time'
);

-- Create indexes for better performance
CREATE INDEX idx_reminders_assigned_to ON public.reminders(assigned_to);
CREATE INDEX idx_reminders_reminder_date ON public.reminders(reminder_date);
CREATE INDEX idx_reminders_is_completed ON public.reminders(is_completed);

-- Add trigger for updated_at
CREATE TRIGGER update_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminder_settings_updated_at
BEFORE UPDATE ON public.reminder_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();