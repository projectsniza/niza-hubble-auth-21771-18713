-- First, drop any duplicate policies on events table
DROP POLICY IF EXISTS "HR can manage events in their scope" ON public.events;

-- Ensure all needed policies exist (recreate cleanly)
-- Super admin full access already exists

-- HR delete own events (company-wide or not)
DROP POLICY IF EXISTS "HR can delete own events" ON public.events;
CREATE POLICY "HR can delete own events"
ON public.events
FOR DELETE
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND created_by = auth.uid()
);

-- HR delete events in their scope
DROP POLICY IF EXISTS "HR can delete events in scope" ON public.events;
CREATE POLICY "HR can delete events in scope"
ON public.events
FOR DELETE
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data() get_my_profile_data(organization_id, branch_id, hr_access_level)) = 'full'
    OR organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data() get_my_profile_data(organization_id, branch_id, hr_access_level))
    OR branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data() get_my_profile_data(organization_id, branch_id, hr_access_level))
  )
);

-- Add CASCADE delete for user profiles when auth user is deleted
-- Allow super_admin to delete profiles (which will cascade to user_roles)
DROP POLICY IF EXISTS "Super admins can delete profiles" ON public.profiles;
CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));