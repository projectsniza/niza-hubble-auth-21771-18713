-- Store the manually-entered "Total Instant Lottery Sales as per Day Report" (till report) per branch per day
CREATE TABLE public.lottery_daily_till_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  report_date date NOT NULL,
  till_report_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (branch_id, report_date)
);

ALTER TABLE public.lottery_daily_till_reports ENABLE ROW LEVEL SECURITY;

-- View: super_admin and HR see all; managers see their branch only
CREATE POLICY "View till reports by scope"
ON public.lottery_daily_till_reports
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.branch_id = lottery_daily_till_reports.branch_id
  )
);

-- Insert: super_admin/HR or manager of that branch
CREATE POLICY "Insert till reports by scope"
ON public.lottery_daily_till_reports
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.branch_id = lottery_daily_till_reports.branch_id
  )
);

-- Update: same scope
CREATE POLICY "Update till reports by scope"
ON public.lottery_daily_till_reports
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.branch_id = lottery_daily_till_reports.branch_id
  )
);

-- Delete: super_admin/HR only
CREATE POLICY "Delete till reports by admin"
ON public.lottery_daily_till_reports
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
);

CREATE TRIGGER update_lottery_till_reports_updated_at
BEFORE UPDATE ON public.lottery_daily_till_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lottery_till_reports_branch_date
ON public.lottery_daily_till_reports(branch_id, report_date);