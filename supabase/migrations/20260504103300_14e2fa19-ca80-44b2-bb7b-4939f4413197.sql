-- Function to transfer an employee to a different branch (and optionally organization)
-- Moves their personal folder under the new branch and resets timesheets, holiday balances and leave requests.
CREATE OR REPLACE FUNCTION public.transfer_employee(
  p_employee_id uuid,
  p_new_branch_id uuid,
  p_reset_data boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_new_org_id uuid;
  v_old_branch_id uuid;
  v_old_org_id uuid;
  v_emp_first text;
  v_emp_last text;
  v_new_branch_folder_id uuid;
  v_new_org_name text;
  v_new_branch_name text;
BEGIN
  IF NOT (public.has_role(v_caller, 'super_admin'::app_role) OR public.has_role(v_caller, 'hr'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized to transfer employees';
  END IF;

  SELECT organization_id, name INTO v_new_org_id, v_new_branch_name
  FROM public.branches WHERE id = p_new_branch_id;
  IF v_new_org_id IS NULL THEN
    RAISE EXCEPTION 'Target branch not found';
  END IF;

  SELECT first_name, last_name, branch_id, organization_id
    INTO v_emp_first, v_emp_last, v_old_branch_id, v_old_org_id
  FROM public.employees WHERE id = p_employee_id;
  IF v_emp_first IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF v_old_branch_id = p_new_branch_id THEN
    RAISE EXCEPTION 'Employee is already in this branch';
  END IF;

  -- Update employee scope
  UPDATE public.employees
  SET branch_id = p_new_branch_id,
      organization_id = v_new_org_id,
      updated_at = now()
  WHERE id = p_employee_id;

  -- Move employee folder under the new branch folder
  SELECT id INTO v_new_branch_folder_id
  FROM public.folders
  WHERE branch_id = p_new_branch_id AND folder_type = 'branch'
  LIMIT 1;

  SELECT name INTO v_new_org_name FROM public.organizations WHERE id = v_new_org_id;

  IF v_new_branch_folder_id IS NOT NULL THEN
    UPDATE public.folders
    SET parent_id = v_new_branch_folder_id,
        organization_id = v_new_org_id,
        branch_id = p_new_branch_id,
        path = 'Company Documents/' || v_new_org_name || '/' || v_new_branch_name || '/' || (v_emp_first || ' ' || v_emp_last),
        updated_at = now()
    WHERE employee_id = p_employee_id AND folder_type = 'employee';
  END IF;

  -- Move documents linked to this employee to the new org/branch context
  UPDATE public.documents
  SET organization_id = v_new_org_id,
      branch_id = p_new_branch_id,
      updated_at = now()
  WHERE employee_id = p_employee_id;

  IF p_reset_data THEN
    -- Reset timesheets and entries
    DELETE FROM public.timesheet_entries
    WHERE timesheet_id IN (SELECT id FROM public.timesheets WHERE employee_id = p_employee_id);
    DELETE FROM public.timesheets WHERE employee_id = p_employee_id;

    -- Reset holiday balances
    DELETE FROM public.holiday_balances WHERE employee_id = p_employee_id;

    -- Reset leave/absence history so it starts fresh in the new branch
    DELETE FROM public.leave_requests WHERE employee_id = p_employee_id;
    DELETE FROM public.absence_records WHERE employee_id = p_employee_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_employee(uuid, uuid, boolean) TO authenticated;