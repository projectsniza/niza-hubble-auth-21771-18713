
-- Timesheet month locks
CREATE TABLE public.timesheet_month_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  month_start DATE NOT NULL,
  locked_by UUID NOT NULL,
  lock_message TEXT,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, month_start)
);

ALTER TABLE public.timesheet_month_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view timesheet locks"
  ON public.timesheet_month_locks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create timesheet locks"
  ON public.timesheet_month_locks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Only super admins can update timesheet locks"
  ON public.timesheet_month_locks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Only super admins can delete timesheet locks"
  ON public.timesheet_month_locks FOR DELETE TO authenticated USING (true);

-- Employee certifications (manual gold coins)
CREATE TABLE public.employee_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  certification_name TEXT NOT NULL,
  gold_coins INTEGER NOT NULL DEFAULT 1,
  awarded_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view certifications"
  ON public.employee_certifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create certifications"
  ON public.employee_certifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update certifications"
  ON public.employee_certifications FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete certifications"
  ON public.employee_certifications FOR DELETE TO authenticated USING (true);

-- Customer partial payments
CREATE TABLE public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_account_id UUID NOT NULL REFERENCES public.customer_monthly_accounts(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
  ON public.customer_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON public.customer_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payments"
  ON public.customer_payments FOR DELETE TO authenticated USING (true);

-- Add amount_paid tracking to monthly accounts
ALTER TABLE public.customer_monthly_accounts ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;
