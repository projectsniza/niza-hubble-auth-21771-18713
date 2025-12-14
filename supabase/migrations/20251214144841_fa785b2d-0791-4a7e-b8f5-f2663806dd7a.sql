-- Update organizations policies to use the function
DROP POLICY IF EXISTS "Employees can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "HR can view organizations based on access level" ON public.organizations;
DROP POLICY IF EXISTS "Managers can view their organization" ON public.organizations;

CREATE POLICY "Employees can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::app_role) AND 
  id = (SELECT organization_id FROM get_my_profile_data())
);

CREATE POLICY "HR can view organizations based on access level" 
ON public.organizations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (id = (SELECT organization_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "Managers can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  id = (SELECT organization_id FROM get_my_profile_data())
);

-- Update branches policies to use the function
DROP POLICY IF EXISTS "Employees can view their branch" ON public.branches;
DROP POLICY IF EXISTS "HR can view branches based on access level" ON public.branches;
DROP POLICY IF EXISTS "Managers can view their branch" ON public.branches;

CREATE POLICY "Employees can view their branch" 
ON public.branches 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::app_role) AND 
  id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can view branches based on access level" 
ON public.branches 
FOR SELECT 
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (organization_id = (SELECT organization_id FROM get_my_profile_data())) OR 
    (id = (SELECT branch_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "Managers can view their branch" 
ON public.branches 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  id = (SELECT branch_id FROM get_my_profile_data())
);