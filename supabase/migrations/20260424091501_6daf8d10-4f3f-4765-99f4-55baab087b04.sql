-- 1. Daily Reports: add report_date for per-day filtering
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS report_date date;

-- Backfill existing reports: use report_month + day 1 OR submitted_at date
UPDATE public.daily_reports
SET report_date = COALESCE(
  CASE WHEN report_month IS NOT NULL THEN (report_month || '-01')::date ELSE NULL END,
  (submitted_at AT TIME ZONE 'UTC')::date,
  CURRENT_DATE
)
WHERE report_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON public.daily_reports(report_date);

-- 2. Temporary Employees table
CREATE TABLE IF NOT EXISTS public.temporary_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text DEFAULT '',
  role text,
  hourly_rate numeric,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temporary_employees_branch ON public.temporary_employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_temporary_employees_dates ON public.temporary_employees(start_date, end_date);

ALTER TABLE public.temporary_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view their branch temp employees"
ON public.temporary_employees FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Managers can insert temp employees in their branch"
ON public.temporary_employees FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Managers can update their branch temp employees"
ON public.temporary_employees FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Managers can delete their branch temp employees"
ON public.temporary_employees FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE TRIGGER trg_temp_employees_updated
  BEFORE UPDATE ON public.temporary_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Temporary Timesheet Entries
CREATE TABLE IF NOT EXISTS public.temporary_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporary_employee_id uuid NOT NULL REFERENCES public.temporary_employees(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  entry_date date NOT NULL,
  day_of_week text NOT NULL,
  shift_start_time time,
  shift_end_time time,
  actual_hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temporary_employee_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_temp_ts_entries_temp_emp ON public.temporary_timesheet_entries(temporary_employee_id);
CREATE INDEX IF NOT EXISTS idx_temp_ts_entries_week ON public.temporary_timesheet_entries(week_start_date);

ALTER TABLE public.temporary_timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View temp ts entries by branch"
ON public.temporary_timesheet_entries FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Insert temp ts entries by branch"
ON public.temporary_timesheet_entries FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Update temp ts entries by branch"
ON public.temporary_timesheet_entries FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Delete temp ts entries by branch"
ON public.temporary_timesheet_entries FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role)
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
);

CREATE TRIGGER trg_temp_ts_entries_updated
  BEFORE UPDATE ON public.temporary_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
