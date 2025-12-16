-- Drop and recreate the policy to include company-wide mandatory leaves
DROP POLICY IF EXISTS "Users can view mandatory_leave in their scope" ON public.mandatory_leave;

CREATE POLICY "Users can view mandatory_leave in their scope"
ON public.mandatory_leave
FOR SELECT
USING (
  (has_role(auth.uid(), 'manager'::app_role) AND (
    branch_id IS NULL OR 
    branch_id = (SELECT branch_id FROM get_my_profile_data())
  ))
  OR 
  (has_role(auth.uid(), 'employee'::app_role) AND (
    branch_id IS NULL OR 
    branch_id = (SELECT branch_id FROM get_my_profile_data())
  ))
);