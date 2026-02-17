-- Fix drive_offs RLS: add full HR access level support
DROP POLICY IF EXISTS "HR can manage drive offs in their org/branch" ON public.drive_offs;

CREATE POLICY "HR can manage drive offs in their scope"
ON public.drive_offs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'hr'
      AND (
        p.hr_access_level = 'full'
        OR (p.hr_access_level = 'organization' AND p.organization_id = drive_offs.organization_id)
        OR (p.hr_access_level = 'branch' AND p.branch_id = drive_offs.branch_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'hr'
      AND (
        p.hr_access_level = 'full'
        OR (p.hr_access_level = 'organization' AND p.organization_id = drive_offs.organization_id)
        OR (p.hr_access_level = 'branch' AND p.branch_id = drive_offs.branch_id)
      )
  )
);

-- Also fix daily_reports: HR SELECT should see reports in their scope, not just own
DROP POLICY IF EXISTS "Managers and HR can view their own daily reports" ON public.daily_reports;

CREATE POLICY "Users can view daily reports in scope"
ON public.daily_reports
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'manager') AND submitted_by = auth.uid())
  OR (
    has_role(auth.uid(), 'hr') AND (
      (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
      OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
      OR submitted_by = auth.uid()
    )
  )
);

-- Fix daily_reports INSERT to include WITH CHECK
DROP POLICY IF EXISTS "Managers and HR can create daily reports" ON public.daily_reports;

CREATE POLICY "Managers and HR can create daily reports"
ON public.daily_reports
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'hr')
);

-- Check and fix maintenance_tickets RLS for HR
-- First check what exists
DO $$ BEGIN
  -- Drop old restrictive policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_tickets' AND policyname LIKE '%HR%') THEN
    NULL; -- will handle below
  END IF;
END $$;
