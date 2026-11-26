-- Documents: an HR login scoped to a store (branch) could not reach its own folders.
--
-- The folder tree is  Employee Documents > [Organisation] > [Branch] > [Employee].
-- An organisation folder has an organisation but no branch. For HR scoped to specific branches the
-- organisation itself is not "in scope", so the organisation folder was hidden and there was no way
-- to click down to the branch and employee folders that ARE in scope.
--
-- Fix: HR may SEE (only see, to navigate) an organisation folder when at least one branch of that
-- organisation is in their scope. Inside it they still only see their own branch folders, and the
-- documents rules are unchanged (this does not give access to any document).

CREATE OR REPLACE FUNCTION public.hr_can_see_org_folder(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.organization_id = _organization_id
      AND public.is_in_my_hr_scope(b.organization_id, b.id)
  )
$$;

REVOKE ALL ON FUNCTION public.hr_can_see_org_folder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_can_see_org_folder(uuid) TO authenticated;

DROP POLICY IF EXISTS "HR can see the organisation folders above their branches" ON public.folders;
CREATE POLICY "HR can see the organisation folders above their branches" ON public.folders
FOR SELECT
USING (
  public.has_role(auth.uid(), 'hr')
  AND employee_id IS NULL
  AND branch_id IS NULL
  AND organization_id IS NOT NULL
  AND public.hr_can_see_org_folder(organization_id)
);
