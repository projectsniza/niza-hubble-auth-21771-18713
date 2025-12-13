-- Add RLS policies for locations table so employees, managers, and HR can view locations in their branch

-- Employees can view locations in their branch
CREATE POLICY "Employees can view locations in their branch"
ON public.locations
FOR SELECT
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Managers can view and manage locations in their branch
CREATE POLICY "Managers can view locations in their branch"
ON public.locations
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);

-- HR can view locations in their scope
CREATE POLICY "HR can view locations in their scope"
ON public.locations
FOR SELECT
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);