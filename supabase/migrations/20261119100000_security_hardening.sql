-- =====================================================================
-- Security hardening (Niza HR audit, part 1)
-- Safe to run more than once. No data is deleted.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Users cannot change their own role or scope fields on profiles.
--    ("Users can update their own profile" allows any column.)
--    Super admins, and server functions acting for HR, are not affected.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.id = auth.uid()
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
       OR NEW.hr_access_level IS DISTINCT FROM OLD.hr_access_level
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'You cannot change your own role, organisation, branch or access level'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_self_update ON public.profiles;
CREATE TRIGGER guard_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- A user may create their own missing profile row (app self-repair), but never with scope fields.
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  id = auth.uid()
  AND custom_role_id IS NULL
  AND (hr_access_level IS NULL OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
);

-- ---------------------------------------------------------------------
-- 2. Secret settings (timesheet passcodes) readable by super admins only.
--    Passcodes are checked on the server by the resend-2fa function.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view message settings" ON public.message_settings;
CREATE POLICY "Authenticated users can view message settings"
ON public.message_settings FOR SELECT
TO authenticated
USING (
  setting_key NOT ILIKE '%passcode%'
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- ---------------------------------------------------------------------
-- 3. Payroll month locks: only Super Admin / HR (in scope) may lock or unlock.
--    Store managers may still lock their own store's month.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create timesheet locks" ON public.timesheet_month_locks;
CREATE POLICY "Authenticated users can create timesheet locks"
ON public.timesheet_month_locks FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.hr_scope_for_branch(organization_id, branch_id)
  OR public.is_my_store_branch(branch_id)
);

DROP POLICY IF EXISTS "Only super admins can update timesheet locks" ON public.timesheet_month_locks;
CREATE POLICY "Only super admins can update timesheet locks"
ON public.timesheet_month_locks FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.hr_scope_for_branch(organization_id, branch_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.hr_scope_for_branch(organization_id, branch_id)
);

DROP POLICY IF EXISTS "Only super admins can delete timesheet locks" ON public.timesheet_month_locks;
CREATE POLICY "Only super admins can delete timesheet locks"
ON public.timesheet_month_locks FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.hr_scope_for_branch(organization_id, branch_id)
);

-- ---------------------------------------------------------------------
-- 4. Employees' own leave: new requests are always pending; an employee can
--    only edit or cancel a request while it is still pending.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can manage their leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can view their leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can create pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can update pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can delete pending leave requests" ON public.leave_requests;

CREATE POLICY "Employees can view their leave requests" ON public.leave_requests
FOR SELECT TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

CREATE POLICY "Employees can create pending leave requests" ON public.leave_requests
FOR INSERT TO authenticated
WITH CHECK (
  employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
  AND status = 'pending'
  AND approved_by IS NULL
);

CREATE POLICY "Employees can update pending leave requests" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
  employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
  AND status IN ('pending', 'cancelled')
  AND approved_by IS NULL
);

CREATE POLICY "Employees can delete pending leave requests" ON public.leave_requests
FOR DELETE TO authenticated
USING (
  employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
  AND status = 'pending'
);

-- ---------------------------------------------------------------------
-- 5. Clock-ins: employees insert their own and close their own open clock-in.
--    Times are set by the server clock. HR (scope) and store managers can edit.
--    Only one open clock-in per person.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_clock_in(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.hr_scope_for_branch(NULL, _branch_id)
      OR public.is_my_store_branch(_branch_id)
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_clock_in(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can manage their own clock-ins" ON public.clock_ins;
DROP POLICY IF EXISTS "Users can view their own clock-ins" ON public.clock_ins;
DROP POLICY IF EXISTS "Users can clock in" ON public.clock_ins;
DROP POLICY IF EXISTS "Users can clock out" ON public.clock_ins;
DROP POLICY IF EXISTS "Store managers can manage clock_ins" ON public.clock_ins;

CREATE POLICY "Users can view their own clock-ins" ON public.clock_ins
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can clock in" ON public.clock_ins
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can clock out" ON public.clock_ins
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND clock_out_time IS NULL)
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Store managers can manage clock_ins" ON public.clock_ins
FOR ALL TO authenticated
USING (public.is_my_store_branch(branch_id))
WITH CHECK (public.is_my_store_branch(branch_id));

ALTER TABLE public.clock_ins ADD COLUMN IF NOT EXISTS edited_by uuid;
ALTER TABLE public.clock_ins ADD COLUMN IF NOT EXISTS edit_reason text;
ALTER TABLE public.clock_ins ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_clock_in_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- server / service role
  END IF;
  _is_admin := public.can_manage_clock_in(NEW.branch_id)
               OR (TG_OP = 'UPDATE' AND public.can_manage_clock_in(OLD.branch_id));

  IF TG_OP = 'INSERT' THEN
    IF NOT _is_admin THEN
      -- Self clock-in uses the server time.
      NEW.clock_in_time := now();
      NEW.clock_out_time := NULL;
    END IF;
    IF NEW.clock_out_time IS NULL AND EXISTS (
      SELECT 1 FROM public.clock_ins c
      WHERE c.user_id = NEW.user_id AND c.clock_out_time IS NULL
    ) THEN
      RAISE EXCEPTION 'This person is already clocked in. Clock out first.' USING ERRCODE = '23505';
    END IF;
    IF _is_admin AND NEW.user_id <> auth.uid() THEN
      NEW.edited_by := auth.uid();
      NEW.edited_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT _is_admin THEN
    -- An employee may only close their own open clock-in, at server time.
    IF OLD.user_id <> auth.uid() OR OLD.clock_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'You can only clock out of your own open clock-in' USING ERRCODE = '42501';
    END IF;
    NEW.user_id := OLD.user_id;
    NEW.branch_id := OLD.branch_id;
    NEW.location_id := OLD.location_id;
    NEW.clock_in_time := OLD.clock_in_time;
    NEW.clock_in_latitude := OLD.clock_in_latitude;
    NEW.clock_in_longitude := OLD.clock_in_longitude;
    NEW.clock_in_method := OLD.clock_in_method;
    NEW.clock_out_time := now();
  ELSIF NEW.clock_in_time IS DISTINCT FROM OLD.clock_in_time
     OR NEW.clock_out_time IS DISTINCT FROM OLD.clock_out_time
     OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    NEW.edited_by := auth.uid();
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_clock_in_write ON public.clock_ins;
CREATE TRIGGER guard_clock_in_write
BEFORE INSERT OR UPDATE ON public.clock_ins
FOR EACH ROW EXECUTE FUNCTION public.guard_clock_in_write();
