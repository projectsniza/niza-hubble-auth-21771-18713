-- Create a safe, scoped way for employees to link their auth user to an existing employee record
-- This avoids giving employees broad UPDATE access to the employees table.

CREATE OR REPLACE FUNCTION public.link_my_employee_record()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_employee_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RAISE EXCEPTION 'Profile email not found';
  END IF;

  -- Find a single matching employee record that is not yet linked
  SELECT id INTO v_employee_id
  FROM public.employees
  WHERE email = v_email
    AND user_id IS NULL
    AND status IS DISTINCT FROM 'terminated'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.employees
  SET user_id = v_user_id,
      account_activated = true,
      status = CASE WHEN status = 'onboarding' THEN 'active' ELSE COALESCE(status, 'active') END,
      updated_at = now()
  WHERE id = v_employee_id
    AND user_id IS NULL;

  RETURN v_employee_id;
END;
$$;

-- Allow authenticated users to execute it
GRANT EXECUTE ON FUNCTION public.link_my_employee_record() TO authenticated;