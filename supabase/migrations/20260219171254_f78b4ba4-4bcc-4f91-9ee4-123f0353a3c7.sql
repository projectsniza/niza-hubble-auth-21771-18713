
-- Fix: treat HR users with NULL hr_access_level as having 'full' access
-- This single change fixes ALL RLS policies that check hr_access_level
CREATE OR REPLACE FUNCTION public.get_my_profile_data()
 RETURNS TABLE(organization_id uuid, branch_id uuid, hr_access_level text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT organization_id, branch_id, COALESCE(hr_access_level::text, 'full') as hr_access_level
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;
