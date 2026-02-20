
-- STEP 1: Fix all HR profiles with NULL hr_access_level
UPDATE public.profiles SET hr_access_level = 'full'
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'hr')
AND hr_access_level IS NULL;

-- STEP 2: Fix handle_new_user to default hr_access_level to 'full' for HR
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _hr_access_level hr_access_level;
BEGIN
  _role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', '')::app_role,
    'super_admin'::app_role
  );

  -- HR users default to 'full' access if not specified
  IF _role = 'hr' THEN
    _hr_access_level := COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'hr_access_level', '')::hr_access_level,
      'full'::hr_access_level
    );
  ELSE
    _hr_access_level := NULLIF(NEW.raw_user_meta_data ->> 'hr_access_level', '')::hr_access_level;
  END IF;

  INSERT INTO public.profiles (id, email, name, organization_id, branch_id, hr_access_level, custom_role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NULLIF(NEW.raw_user_meta_data ->> 'organization_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data ->> 'branch_id', '')::uuid,
    _hr_access_level,
    NULLIF(NEW.raw_user_meta_data ->> 'custom_role_id', '')::uuid
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$function$;

-- STEP 3: Fix drive_offs HR policy - uses profiles directly with NULL check
DROP POLICY IF EXISTS "HR can manage drive offs in their scope" ON public.drive_offs;
CREATE POLICY "HR can manage drive offs in their scope" ON public.drive_offs
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  )
);

-- STEP 4: Fix daily_reports SELECT - uses profiles directly
DROP POLICY IF EXISTS "Users can view daily reports in scope" ON public.daily_reports;
CREATE POLICY "Users can view daily reports in scope" ON public.daily_reports
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND submitted_by = auth.uid())
  OR (has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
    OR submitted_by = auth.uid()
  ))
);

-- STEP 5: Fix maintenance_tickets SELECT - uses profiles directly
DROP POLICY IF EXISTS "Users can view maintenance tickets in scope" ON public.maintenance_tickets;
CREATE POLICY "Users can view maintenance tickets in scope" ON public.maintenance_tickets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'manager'::app_role) AND (
    reported_by = auth.uid()
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  ))
  OR (has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
    OR reported_by = auth.uid()
  ))
);

-- Also fix maintenance_tickets UPDATE for HR (currently only own tickets)
DROP POLICY IF EXISTS "Managers and HR can update their own maintenance tickets" ON public.maintenance_tickets;
CREATE POLICY "HR and managers can update maintenance tickets" ON public.maintenance_tickets
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) AND reported_by = auth.uid())
  OR (has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  ))
);

-- STEP 6: Add HR policy for clock_ins (currently missing!)
CREATE POLICY "HR can manage clock_ins in scope" ON public.clock_ins
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  )
);

-- STEP 7: Add HR policy for payroll_records (currently missing!)
CREATE POLICY "HR can manage payroll_records in scope" ON public.payroll_records
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR employee_id IN (
      SELECT e.id FROM employees e WHERE
        e.organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
        OR e.branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
    )
  )
);

-- STEP 8: Add HR policy for training_assignments (currently missing INSERT/DELETE for HR)
CREATE POLICY "HR can manage training_assignments" ON public.training_assignments
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role));

-- STEP 9: Fix timesheets HR policy - uses profiles directly with NULL issue
DROP POLICY IF EXISTS "HR can manage timesheets in scope" ON public.timesheets;
CREATE POLICY "HR can manage timesheets in scope" ON public.timesheets
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  )
);

-- STEP 10: Fix timesheet_entries HR policy - uses profiles directly
DROP POLICY IF EXISTS "HR can manage timesheet entries" ON public.timesheet_entries;
CREATE POLICY "HR can manage timesheet entries" ON public.timesheet_entries
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
      AND (
        t.organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
        OR t.branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
      )
    )
  )
);

-- STEP 11: Fix document_submissions HR INSERT policy - checks profiles directly
DROP POLICY IF EXISTS "HR can insert document_submissions" ON public.document_submissions;
CREATE POLICY "HR can insert document_submissions" ON public.document_submissions
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
  )
);

-- Fix document_submissions HR SELECT policy
DROP POLICY IF EXISTS "HR can view document_submissions in scope" ON public.document_submissions;
CREATE POLICY "HR can view document_submissions in scope" ON public.document_submissions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
  )
);

-- Add HR UPDATE/DELETE for document_submissions
CREATE POLICY "HR can update document_submissions in scope" ON public.document_submissions
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data())
  )
);
