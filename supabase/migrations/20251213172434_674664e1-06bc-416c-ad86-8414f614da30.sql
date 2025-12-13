-- Add RLS policy for employees to view their own profile
CREATE POLICY "Employees can view their own profile"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
);

-- Add RLS policy for managers to view profiles (for team members)
CREATE POLICY "Managers can view profiles in their branch"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Add RLS policy for HR to view profiles in their scope
CREATE POLICY "HR can view profiles in their scope"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
    OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);