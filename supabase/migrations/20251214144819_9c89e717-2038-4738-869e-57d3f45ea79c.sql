-- Drop problematic duplicate/recursive policies on profiles
DROP POLICY IF EXISTS "HR can view profiles in their scope" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view profiles in their branch" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Recreate with SECURITY DEFINER function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_my_profile_data()
RETURNS TABLE (organization_id uuid, branch_id uuid, hr_access_level text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id, branch_id, hr_access_level::text
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- Recreate policies using the function instead of subqueries to profiles
CREATE POLICY "HR can view profiles in their scope" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (organization_id = (SELECT organization_id FROM get_my_profile_data())) OR 
    (branch_id = (SELECT branch_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "Managers can view profiles in their branch" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Super admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));