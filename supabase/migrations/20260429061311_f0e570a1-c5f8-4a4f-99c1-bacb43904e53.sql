-- =========================
-- 1) VENDORS
-- =========================
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid,
  branch_id uuid NOT NULL,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_branch ON public.vendors(branch_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON public.vendors(organization_id);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage vendors"
ON public.vendors FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR view vendors in scope"
ON public.vendors FOR SELECT
USING (
  has_role(auth.uid(), 'hr'::app_role)
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers view their branch vendors"
ON public.vendors FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND branch_id IN (SELECT p.branch_id FROM profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Managers insert vendors in their branch"
ON public.vendors FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND branch_id IN (SELECT p.branch_id FROM profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Managers update vendors in their branch"
ON public.vendors FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND branch_id IN (SELECT p.branch_id FROM profiles p WHERE p.id = auth.uid())
);

CREATE TRIGGER trg_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 2) DAILY REPORTS: vendor tagging
-- =========================
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS vendor_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_daily_reports_vendor_ids ON public.daily_reports USING GIN (vendor_ids);

-- =========================
-- 4) LEAVE: re-approval workflow + manager update access
-- =========================
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS requires_reapproval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid,
  ADD COLUMN IF NOT EXISTS modification_reason text;

-- Allow managers to cancel/reschedule/reapply approved leave in their branch
CREATE POLICY "Managers can update leave_requests in their branch"
ON public.leave_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- =========================
-- 5) MAINTENANCE: store can update status + closure attachments
-- =========================
ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS closure_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closure_notes text;

CREATE POLICY "Managers can update maintenance in their branch"
ON public.maintenance_tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND branch_id IN (SELECT p.branch_id FROM profiles p WHERE p.id = auth.uid())
);

-- =========================
-- 6) PAYMENT APPROVAL REQUESTS
-- =========================
CREATE TABLE IF NOT EXISTS public.payment_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_account_id uuid NOT NULL,
  customer_id uuid,
  branch_id uuid NOT NULL,
  organization_id uuid,
  requested_by uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('record_payment','mark_fully_paid')),
  requested_amount numeric NOT NULL DEFAULT 0,
  approved_amount numeric,
  payment_method text,
  payment_date date,
  evidence_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_par_monthly ON public.payment_approval_requests(monthly_account_id);
CREATE INDEX IF NOT EXISTS idx_par_branch ON public.payment_approval_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_par_status ON public.payment_approval_requests(status);

ALTER TABLE public.payment_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage payment requests"
ON public.payment_approval_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR view payment requests in scope"
ON public.payment_approval_requests FOR SELECT
USING (
  has_role(auth.uid(), 'hr'::app_role)
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers view their branch payment requests"
ON public.payment_approval_requests FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND branch_id IN (SELECT p.branch_id FROM profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Managers create payment requests in their branch"
ON public.payment_approval_requests FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND branch_id IN (SELECT p.branch_id FROM profiles p WHERE p.id = auth.uid())
  AND requested_by = auth.uid()
);

CREATE POLICY "Managers can cancel their pending requests"
ON public.payment_approval_requests FOR DELETE
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND requested_by = auth.uid()
  AND status = 'pending'
);

CREATE TRIGGER trg_payment_approval_requests_updated_at
BEFORE UPDATE ON public.payment_approval_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket policies for payment evidence (reuse documents bucket)
-- (no bucket creation needed; using existing 'documents' private bucket)