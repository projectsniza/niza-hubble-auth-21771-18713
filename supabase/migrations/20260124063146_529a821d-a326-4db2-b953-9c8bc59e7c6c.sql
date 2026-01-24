
-- Add RLS policies for managers to manage teams in their branch

-- Allow managers to SELECT teams in their branch
CREATE POLICY "Managers can view teams in their branch"
ON public.teams
FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Allow managers to INSERT teams in their branch
CREATE POLICY "Managers can create teams in their branch"
ON public.teams
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Allow managers to UPDATE teams in their branch
CREATE POLICY "Managers can update teams in their branch"
ON public.teams
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Allow managers to DELETE teams in their branch
CREATE POLICY "Managers can delete teams in their branch"
ON public.teams
FOR DELETE
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Drop and recreate the manager INSERT policy for events to fix the AND condition
DROP POLICY IF EXISTS "Managers can insert events" ON public.events;

CREATE POLICY "Managers can insert events in their branch"
ON public.events
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
  AND (
    organization_id IS NULL 
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
  )
);

-- Also add HR policies for teams
CREATE POLICY "HR can view teams in scope"
ON public.teams
FOR SELECT
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR branch_id IN (
      SELECT b.id FROM branches b 
      WHERE b.organization_id = (SELECT organization_id FROM get_my_profile_data())
    )
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "HR can manage teams in scope"
ON public.teams
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR branch_id IN (
      SELECT b.id FROM branches b 
      WHERE b.organization_id = (SELECT organization_id FROM get_my_profile_data())
    )
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR branch_id IN (
      SELECT b.id FROM branches b 
      WHERE b.organization_id = (SELECT organization_id FROM get_my_profile_data())
    )
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);
