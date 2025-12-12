-- Create financial_reports table for P&L reports
CREATE TABLE public.financial_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quarter TEXT NOT NULL,
  store_name TEXT NOT NULL,
  revenue JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_of_sales JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_costs JSONB NOT NULL DEFAULT '{}'::jsonb,
  other_income JSONB NOT NULL DEFAULT '{}'::jsonb,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "Super admins have full access to financial_reports"
ON public.financial_reports
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- HR can manage financial reports in their scope
CREATE POLICY "HR can manage financial_reports in their scope"
ON public.financial_reports
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
    OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

-- Managers can view financial reports for their branch
CREATE POLICY "Managers can view financial_reports in their branch"
ON public.financial_reports
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Add trigger for updated_at
CREATE TRIGGER update_financial_reports_updated_at
BEFORE UPDATE ON public.financial_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();