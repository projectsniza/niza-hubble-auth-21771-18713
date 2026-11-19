-- =====================================================================
-- Scope fixes and store operations (Niza HR audit, part 4)
-- Safe to run more than once. No data is deleted.
-- =====================================================================

-- 1. Payroll items: HR only sees / edits items for employees in its scope
--    (it used to be every HR user, whatever their organisation or branch).
DROP POLICY IF EXISTS "Super admins and HR can manage all payroll items" ON public.payroll_items;
DROP POLICY IF EXISTS "Super admins can manage all payroll items" ON public.payroll_items;
DROP POLICY IF EXISTS "HR can manage payroll items in scope" ON public.payroll_items;

CREATE POLICY "Super admins can manage all payroll items" ON public.payroll_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "HR can manage payroll items in scope" ON public.payroll_items
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id))
);

-- 2. Daily reports: a store account sees the whole store's reports, not only its own uploads.
--    HR follows the effective custom-role scope.
DROP POLICY IF EXISTS "Users can view daily reports in scope" ON public.daily_reports;
CREATE POLICY "Users can view daily reports in scope" ON public.daily_reports
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_my_store_branch(branch_id)
  OR submitted_by = auth.uid()
  OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND public.hr_scope_for_branch(organization_id, branch_id))
);

-- 3. Maintenance tickets: assignment and reopening.
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS assigned_to_name text;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS reopened_at timestamptz;

DROP POLICY IF EXISTS "Users can view maintenance tickets in scope" ON public.maintenance_tickets;
CREATE POLICY "Users can view maintenance tickets in scope" ON public.maintenance_tickets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.is_my_store_branch(branch_id)
  OR reported_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND public.hr_scope_for_branch(organization_id, branch_id))
);

-- 4. Daily sales upload as ONE all-or-nothing step: the old rows for that store/day/format are
--    replaced only if the new row is saved (it used to delete first, then insert, so a failed
--    insert lost the previous upload).
CREATE OR REPLACE FUNCTION public.replace_daily_sales_upload(
  p_branch_id uuid,
  p_sale_date date,
  p_formats text[],
  p_row jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _org uuid;
  _id uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.branches WHERE id = p_branch_id;
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.hr_scope_for_branch(_org, p_branch_id)
    OR public.is_my_store_branch(p_branch_id)
  ) THEN
    RAISE EXCEPTION 'You cannot upload sales for this store' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.daily_sales_uploads
   WHERE branch_id = p_branch_id AND sale_date = p_sale_date AND source_format = ANY (p_formats);

  INSERT INTO public.daily_sales_uploads (organization_id, branch_id, sale_date, source_filename, source_format,
                                          storage_path, raw_text, parsed_totals, notes, uploaded_by)
  VALUES (_org, p_branch_id, p_sale_date,
          p_row ->> 'source_filename', COALESCE(p_row ->> 'source_format', 'csv'),
          p_row ->> 'storage_path', p_row ->> 'raw_text',
          COALESCE(p_row -> 'parsed_totals', '{}'::jsonb), p_row ->> 'notes', auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_daily_sales_upload(uuid, date, text[], jsonb) TO authenticated;

-- 5. Payroll adjustments for one employee-month saved as ONE step
--    (it used to delete the old items, then insert; a failed insert lost them).
CREATE OR REPLACE FUNCTION public.replace_payroll_items(
  p_employee_id uuid,
  p_month date,
  p_items jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _emp public.employees;
BEGIN
  SELECT * INTO _emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND public.is_in_my_hr_scope(_emp.organization_id, _emp.branch_id))
  ) THEN
    RAISE EXCEPTION 'You cannot change payroll for this employee' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.payroll_items WHERE employee_id = p_employee_id AND month = p_month;

  INSERT INTO public.payroll_items (employee_id, month, category_id, amount, notes, created_by)
  SELECT p_employee_id, p_month, (i ->> 'category_id')::uuid, (i ->> 'amount')::numeric, i ->> 'notes', auth.uid()
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS i;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_payroll_items(uuid, date, jsonb) TO authenticated;
