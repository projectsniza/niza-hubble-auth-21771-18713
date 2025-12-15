-- Drop existing SELECT-only policies and replace with full access policies for HR and Managers

DROP POLICY IF EXISTS "HR can view locations in their scope" ON public.locations;
DROP POLICY IF EXISTS "Managers can view locations in their branch" ON public.locations;

-- HR can manage locations in their scope (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "HR can manage locations in their scope" 
ON public.locations 
FOR ALL 
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    branch_id IN (
      SELECT id FROM branches WHERE organization_id = (SELECT organization_id FROM get_my_profile_data())
    ) OR
    branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Managers can manage locations in their branch
CREATE POLICY "Managers can manage locations in their branch" 
ON public.locations 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  branch_id = (SELECT branch_id FROM get_my_profile_data())
);