-- Fix: allow HR to delete events they created even when event is company-wide (organization_id/branch_id NULL)

-- Ensure RLS is enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop overly restrictive policy (will recreate as DELETE-only for clarity)
DROP POLICY IF EXISTS "HR can manage events in their scope" ON public.events;

-- HR can delete events they created
CREATE POLICY "HR can delete own events"
ON public.events
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND created_by = auth.uid()
);

-- HR can manage events within their scope (UPDATE/INSERT) - keep scope-based behavior
CREATE POLICY "HR can insert events in scope"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND (
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM public.get_my_profile_data())
    OR (visibility = 'company' AND created_by = auth.uid())
  )
);

CREATE POLICY "HR can update events in scope"
ON public.events
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND (
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM public.get_my_profile_data())
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND (
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM public.get_my_profile_data())
    OR created_by = auth.uid()
  )
);

-- HR can delete events in scope too (covers non-null org/branch events)
CREATE POLICY "HR can delete events in scope"
ON public.events
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr'::public.app_role)
  AND (
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM public.get_my_profile_data())
  )
);
