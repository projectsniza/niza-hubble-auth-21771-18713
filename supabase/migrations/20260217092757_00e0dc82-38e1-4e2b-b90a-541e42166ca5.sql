-- Fix maintenance_tickets: HR should see tickets in their scope
DROP POLICY IF EXISTS "Managers and HR can view their own maintenance tickets" ON public.maintenance_tickets;

CREATE POLICY "Users can view maintenance tickets in scope"
ON public.maintenance_tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'manager') AND (reported_by = auth.uid() OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())))
  OR (
    has_role(auth.uid(), 'hr') AND (
      (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
      OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
      OR reported_by = auth.uid()
    )
  )
);

-- Fix maintenance INSERT to not require reported_by check in with_check (it's set in code)
DROP POLICY IF EXISTS "Managers and HR can create maintenance tickets" ON public.maintenance_tickets;

CREATE POLICY "Managers and HR can create maintenance tickets"
ON public.maintenance_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'manager') AND reported_by = auth.uid())
  OR (has_role(auth.uid(), 'hr') AND reported_by = auth.uid())
);