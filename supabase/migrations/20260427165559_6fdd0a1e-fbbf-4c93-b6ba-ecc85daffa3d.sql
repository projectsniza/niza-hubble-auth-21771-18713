CREATE TABLE IF NOT EXISTS public.branch_weekly_hour_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_hours numeric NOT NULL DEFAULT 0,
  low_threshold_hours numeric NOT NULL DEFAULT 0,
  high_threshold_hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_weekly_hour_targets_branch ON public.branch_weekly_hour_targets(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_weekly_hour_targets_org ON public.branch_weekly_hour_targets(organization_id);

ALTER TABLE public.branch_weekly_hour_targets ENABLE ROW LEVEL SECURITY;

-- View: super admin (all), HR (full or scoped to their org), manager (their branch only)
CREATE POLICY "View weekly hour targets"
ON public.branch_weekly_hour_targets FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  )
);

-- Insert / Update / Delete: super admin only
CREATE POLICY "Super admins can insert weekly hour targets"
ON public.branch_weekly_hour_targets FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update weekly hour targets"
ON public.branch_weekly_hour_targets FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete weekly hour targets"
ON public.branch_weekly_hour_targets FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_branch_weekly_hour_targets_updated
  BEFORE UPDATE ON public.branch_weekly_hour_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();