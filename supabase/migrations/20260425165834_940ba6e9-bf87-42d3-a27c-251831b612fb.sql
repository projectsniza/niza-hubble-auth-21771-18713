
-- The previous RESTRICTIVE policies used FOR ALL which also blocked SELECT
-- when a month was locked, hiding entries from managers/HR after submission.
-- Replace them with separate policies that only restrict write operations.

DROP POLICY IF EXISTS "Block edits when month locked" ON public.timesheets;
DROP POLICY IF EXISTS "Block entry edits when month locked" ON public.timesheet_entries;

-- Block UPDATE on timesheets when month is locked (super admin bypass)
CREATE POLICY "Block timesheet updates when locked"
  ON public.timesheets
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT public.is_timesheet_month_locked(branch_id, week_start_date)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT public.is_timesheet_month_locked(branch_id, week_start_date)
  );

-- Block INSERT on timesheets when month is locked
CREATE POLICY "Block timesheet inserts when locked"
  ON public.timesheets
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT public.is_timesheet_month_locked(branch_id, week_start_date)
  );

-- Block DELETE on timesheets when month is locked
CREATE POLICY "Block timesheet deletes when locked"
  ON public.timesheets
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT public.is_timesheet_month_locked(branch_id, week_start_date)
  );

-- Same split for timesheet_entries
CREATE POLICY "Block entry updates when locked"
  ON public.timesheet_entries
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND public.is_timesheet_month_locked(t.branch_id, t.week_start_date)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND public.is_timesheet_month_locked(t.branch_id, t.week_start_date)
    )
  );

CREATE POLICY "Block entry inserts when locked"
  ON public.timesheet_entries
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND public.is_timesheet_month_locked(t.branch_id, t.week_start_date)
    )
  );

CREATE POLICY "Block entry deletes when locked"
  ON public.timesheet_entries
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND public.is_timesheet_month_locked(t.branch_id, t.week_start_date)
    )
  );
