-- Drop existing restrictive policies for users
DROP POLICY IF EXISTS "Users can view their safety tasks" ON public.safety_tasks;
DROP POLICY IF EXISTS "Users can update their safety tasks" ON public.safety_tasks;

-- Drop existing restrictive policies for admins (we'll recreate them as permissive)
DROP POLICY IF EXISTS "Super admins have full access to safety_tasks" ON public.safety_tasks;
DROP POLICY IF EXISTS "HR can manage safety_tasks in their scope" ON public.safety_tasks;
DROP POLICY IF EXISTS "Managers can manage safety_tasks in their branch" ON public.safety_tasks;

-- Recreate all policies as PERMISSIVE (default) so they work correctly
-- Super Admin - full access
CREATE POLICY "Super admins have full access to safety_tasks"
ON public.safety_tasks
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- HR - scope-based access
CREATE POLICY "HR can manage safety_tasks in their scope"
ON public.safety_tasks
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Managers - can view/manage tasks in their branch OR assigned to them
CREATE POLICY "Managers can manage safety_tasks in their branch"
ON public.safety_tasks
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (
    branch_id = (SELECT branch_id FROM get_my_profile_data())
    OR assigned_to = auth.uid()
  )
);

-- Employees - can view tasks assigned to them
CREATE POLICY "Employees can view their safety tasks"
ON public.safety_tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND assigned_to = auth.uid()
);

-- Employees - can update tasks assigned to them (to change status)
CREATE POLICY "Employees can update their safety tasks"
ON public.safety_tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND assigned_to = auth.uid()
);