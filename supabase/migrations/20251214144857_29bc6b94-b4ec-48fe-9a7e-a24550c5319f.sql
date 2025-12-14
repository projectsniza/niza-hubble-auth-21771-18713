-- Update locations policies to use the function
DROP POLICY IF EXISTS "Employees can view locations in their branch" ON public.locations;
DROP POLICY IF EXISTS "HR can view locations in their scope" ON public.locations;
DROP POLICY IF EXISTS "Managers can view locations in their branch" ON public.locations;

CREATE POLICY "Employees can view locations in their branch" 
ON public.locations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::app_role) AND 
  branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can view locations in their scope" 
ON public.locations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (branch_id = (SELECT branch_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "Managers can view locations in their branch" 
ON public.locations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  branch_id = (SELECT branch_id FROM get_my_profile_data())
);