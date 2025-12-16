-- Allow protected folder deletion only within controlled server-side operations
CREATE OR REPLACE FUNCTION public.prevent_system_folder_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _allow boolean;
BEGIN
  -- When running trusted maintenance operations (e.g., org/branch cascade delete)
  -- we temporarily allow deleting protected folders.
  _allow := COALESCE(current_setting('app.allow_protected_folder_delete', true), 'off') = 'on';

  IF OLD.is_deletable = false AND NOT _allow THEN
    RAISE EXCEPTION 'Cannot delete protected system folder';
  END IF;

  RETURN OLD;
END;
$$;

-- Recreate trigger on folders to enforce protection
DROP TRIGGER IF EXISTS prevent_system_folder_deletion_trigger ON public.folders;
CREATE TRIGGER prevent_system_folder_deletion_trigger
BEFORE DELETE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_system_folder_deletion();

-- Cascade delete helpers (run with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.delete_branch_cascade(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow protected folder deletion for this transaction
  PERFORM set_config('app.allow_protected_folder_delete', 'on', true);

  -- Delete clock-ins first (covers both branch_id and location_id references)
  DELETE FROM public.clock_ins WHERE branch_id = p_branch_id;

  -- Then locations
  DELETE FROM public.locations WHERE branch_id = p_branch_id;

  -- Then folders (including protected branch/employee folders)
  DELETE FROM public.folders WHERE branch_id = p_branch_id;

  -- Finally branch
  DELETE FROM public.branches WHERE id = p_branch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_organization_cascade(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _branch_id uuid;
BEGIN
  -- Allow protected folder deletion for this transaction
  PERFORM set_config('app.allow_protected_folder_delete', 'on', true);

  -- Delete each branch with full cascade
  FOR _branch_id IN
    SELECT id FROM public.branches WHERE organization_id = p_organization_id
  LOOP
    PERFORM public.delete_branch_cascade(_branch_id);
  END LOOP;

  -- Any org-scoped folders not tied to a branch (org folder, etc.)
  DELETE FROM public.folders WHERE organization_id = p_organization_id;

  -- Finally organization
  DELETE FROM public.organizations WHERE id = p_organization_id;
END;
$$;

-- Lock down who can execute these functions (Super Admin only)
REVOKE ALL ON FUNCTION public.delete_branch_cascade(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_organization_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_branch_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) TO authenticated;

-- Enforce role check inside the functions
CREATE OR REPLACE FUNCTION public.delete_branch_cascade(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  PERFORM set_config('app.allow_protected_folder_delete', 'on', true);

  DELETE FROM public.clock_ins WHERE branch_id = p_branch_id;
  DELETE FROM public.locations WHERE branch_id = p_branch_id;
  DELETE FROM public.folders WHERE branch_id = p_branch_id;
  DELETE FROM public.branches WHERE id = p_branch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_organization_cascade(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _branch_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  PERFORM set_config('app.allow_protected_folder_delete', 'on', true);

  FOR _branch_id IN
    SELECT id FROM public.branches WHERE organization_id = p_organization_id
  LOOP
    PERFORM public.delete_branch_cascade(_branch_id);
  END LOOP;

  DELETE FROM public.folders WHERE organization_id = p_organization_id;
  DELETE FROM public.organizations WHERE id = p_organization_id;
END;
$$;