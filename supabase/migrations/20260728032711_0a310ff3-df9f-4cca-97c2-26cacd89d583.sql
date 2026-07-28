CREATE OR REPLACE FUNCTION public.get_my_custom_role_branch_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(cr.branch_ids, ARRAY[]::uuid[])
  FROM public.profiles p
  JOIN public.custom_roles cr ON cr.id = p.custom_role_id
  WHERE p.id = auth.uid()
    AND cr.is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_in_my_hr_scope(_organization_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(auth.uid(), 'hr'::app_role)
    AND (
      (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
      OR (
        cardinality(public.get_my_custom_role_branch_ids()) > 0
        AND _branch_id = ANY(public.get_my_custom_role_branch_ids())
      )
      OR _organization_id = (SELECT organization_id FROM public.get_my_profile_data())
      OR _branch_id = (SELECT branch_id FROM public.get_my_profile_data())
    )
$$;

DROP POLICY IF EXISTS "HR can manage employees in their scope" ON public.employees;
CREATE POLICY "HR can manage employees in their scope" ON public.employees
FOR ALL
TO public
USING (public.is_in_my_hr_scope(organization_id, branch_id))
WITH CHECK (public.is_in_my_hr_scope(organization_id, branch_id));

DROP POLICY IF EXISTS "HR can view profiles in their scope" ON public.profiles;
CREATE POLICY "HR can view profiles in their scope" ON public.profiles
FOR SELECT
TO public
USING (public.is_in_my_hr_scope(organization_id, branch_id));

DROP POLICY IF EXISTS "HR can manage clock_ins in scope" ON public.clock_ins;
CREATE POLICY "HR can manage clock_ins in scope" ON public.clock_ins
FOR ALL
TO authenticated
USING (public.is_in_my_hr_scope((SELECT b.organization_id FROM public.branches b WHERE b.id = clock_ins.branch_id), branch_id))
WITH CHECK (public.is_in_my_hr_scope((SELECT b.organization_id FROM public.branches b WHERE b.id = clock_ins.branch_id), branch_id));

DROP POLICY IF EXISTS "HR can manage employee_onboarding in their scope" ON public.employee_onboarding;
CREATE POLICY "HR can manage employee_onboarding in their scope" ON public.employee_onboarding
FOR ALL
TO public
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));

DROP POLICY IF EXISTS "HR can manage leave_requests in their scope" ON public.leave_requests;
CREATE POLICY "HR can manage leave_requests in their scope" ON public.leave_requests
FOR ALL
TO public
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));

DROP POLICY IF EXISTS "HR can manage payroll_records in scope" ON public.payroll_records;
CREATE POLICY "HR can manage payroll_records in scope" ON public.payroll_records
FOR ALL
TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));

DROP POLICY IF EXISTS "HR can delete events in scope" ON public.events;
CREATE POLICY "HR can delete events in scope" ON public.events
FOR DELETE
TO public
USING (public.is_in_my_hr_scope(organization_id, branch_id));

DROP POLICY IF EXISTS "HR can insert events in scope" ON public.events;
CREATE POLICY "HR can insert events in scope" ON public.events
FOR INSERT
TO authenticated
WITH CHECK (public.is_in_my_hr_scope(organization_id, branch_id) OR (visibility = 'company' AND created_by = auth.uid()));

DROP POLICY IF EXISTS "HR can update events in scope" ON public.events;
CREATE POLICY "HR can update events in scope" ON public.events
FOR UPDATE
TO authenticated
USING (public.is_in_my_hr_scope(organization_id, branch_id) OR created_by = auth.uid())
WITH CHECK (public.is_in_my_hr_scope(organization_id, branch_id) OR created_by = auth.uid());