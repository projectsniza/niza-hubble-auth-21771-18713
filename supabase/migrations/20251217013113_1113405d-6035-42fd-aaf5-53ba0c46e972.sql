-- Fix trainings RLS for employees - they should see trainings assigned to their branch
DROP POLICY IF EXISTS "Employees can view trainings assigned to them" ON public.trainings;

-- Employees can view trainings in their branch (trainings assigned to managers in their branch)
CREATE POLICY "Employees can view trainings in their branch"
ON public.trainings
FOR SELECT
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Also add policy for managers to view trainings in their branch (not just assigned to them)
DROP POLICY IF EXISTS "Managers can view assigned trainings" ON public.trainings;

CREATE POLICY "Managers can view trainings in their branch"
ON public.trainings
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);