
-- Helper function: returns true if branch+payroll-month containing the given week is locked.
CREATE OR REPLACE FUNCTION public.is_timesheet_month_locked(_branch_id uuid, _week_start date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Payroll period starts on the 21st. Find the payroll month_start for the given week_start.
  WITH derived AS (
    SELECT
      CASE
        WHEN EXTRACT(DAY FROM _week_start)::int >= 21
          THEN make_date(EXTRACT(YEAR FROM _week_start)::int, EXTRACT(MONTH FROM _week_start)::int, 21)
        ELSE (make_date(EXTRACT(YEAR FROM _week_start)::int, EXTRACT(MONTH FROM _week_start)::int, 21) - INTERVAL '1 month')::date
      END AS payroll_start
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.timesheet_month_locks l, derived d
    WHERE l.branch_id = _branch_id
      AND l.month_start = d.payroll_start
  );
$$;

-- Block UPDATE/INSERT/DELETE on timesheets when locked, except for super admins
DROP POLICY IF EXISTS "Block edits when month locked" ON public.timesheets;
CREATE POLICY "Block edits when month locked"
  ON public.timesheets
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT public.is_timesheet_month_locked(branch_id, week_start_date)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT public.is_timesheet_month_locked(branch_id, week_start_date)
  );

-- Block edits to timesheet_entries when their parent timesheet's month is locked
DROP POLICY IF EXISTS "Block entry edits when month locked" ON public.timesheet_entries;
CREATE POLICY "Block entry edits when month locked"
  ON public.timesheet_entries
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT EXISTS (
      SELECT 1
      FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND public.is_timesheet_month_locked(t.branch_id, t.week_start_date)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT EXISTS (
      SELECT 1
      FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND public.is_timesheet_month_locked(t.branch_id, t.week_start_date)
    )
  );
