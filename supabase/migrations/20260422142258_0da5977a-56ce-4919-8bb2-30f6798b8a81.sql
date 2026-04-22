-- Daily store/branch summary entries (one per branch per date)
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  shop_sale numeric(12,2) NOT NULL DEFAULT 0,
  net_sale numeric(12,2) NOT NULL DEFAULT 0,
  customer_count integer NOT NULL DEFAULT 0,
  fuel_volume numeric(12,2) NOT NULL DEFAULT 0,
  fuel_sale numeric(12,2) NOT NULL DEFAULT 0,
  cash_sale numeric(12,2) NOT NULL DEFAULT 0,
  atm_loaded numeric(12,2) NOT NULL DEFAULT 0,
  store_paid_outs numeric(12,2) NOT NULL DEFAULT 0,
  cash_deposit numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_summaries_branch_date_unique UNIQUE (branch_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_branch_date ON public.daily_summaries(branch_id, summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_org_date ON public.daily_summaries(organization_id, summary_date DESC);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- Helper: current user's branch / org from profiles
-- (reuses get_my_profile_data already in DB)

-- SELECT: super_admin sees all; HR full sees all; HR org sees their org;
-- HR branch + manager + employee see their branch
CREATE POLICY "View daily summaries by scope"
ON public.daily_summaries FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'full')
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'organization' AND p.organization_id = daily_summaries.organization_id)
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'branch' AND p.branch_id = daily_summaries.branch_id)
        OR (p.branch_id = daily_summaries.branch_id)
      )
  )
);

-- INSERT/UPDATE/DELETE: super_admin, HR (per scope), and managers in their branch
CREATE POLICY "Insert daily summaries by scope"
ON public.daily_summaries FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'full')
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'organization' AND p.organization_id = daily_summaries.organization_id)
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'branch' AND p.branch_id = daily_summaries.branch_id)
        OR (public.has_role(auth.uid(), 'manager') AND p.branch_id = daily_summaries.branch_id)
      )
  )
);

CREATE POLICY "Update daily summaries by scope"
ON public.daily_summaries FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'full')
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'organization' AND p.organization_id = daily_summaries.organization_id)
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'branch' AND p.branch_id = daily_summaries.branch_id)
        OR (public.has_role(auth.uid(), 'manager') AND p.branch_id = daily_summaries.branch_id)
      )
  )
);

CREATE POLICY "Delete daily summaries by scope"
ON public.daily_summaries FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'full')
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'organization' AND p.organization_id = daily_summaries.organization_id)
        OR (public.has_role(auth.uid(), 'hr') AND COALESCE(p.hr_access_level::text, 'full') = 'branch' AND p.branch_id = daily_summaries.branch_id)
      )
  )
);

CREATE TRIGGER trg_daily_summaries_updated_at
BEFORE UPDATE ON public.daily_summaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();