-- Fix the delete_branch_cascade function to handle missing tables
CREATE OR REPLACE FUNCTION public.delete_branch_cascade(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can delete branches';
  END IF;

  -- Set flag to allow deletion of protected folders
  PERFORM set_config('app.allow_protected_folder_delete', 'on', true);

  -- Delete all related records in order of dependencies
  
  -- Delete trainings first
  DELETE FROM trainings WHERE branch_id = p_branch_id;
  
  -- Delete clock_ins (depends on locations)
  DELETE FROM clock_ins WHERE branch_id = p_branch_id;
  
  -- Delete locations
  DELETE FROM locations WHERE branch_id = p_branch_id;
  
  -- Delete documents (depends on folders and employees)
  DELETE FROM documents WHERE folder_id IN (SELECT id FROM folders WHERE branch_id = p_branch_id);
  DELETE FROM documents WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  
  -- Delete folders
  DELETE FROM folders WHERE branch_id = p_branch_id;
  
  -- Delete employee-related records
  DELETE FROM employee_onboarding WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM contract_approvals WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM absence_records WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM gdpr_consent_records WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM onboarding_form_responses WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  
  -- Delete employees
  DELETE FROM employees WHERE branch_id = p_branch_id;
  
  -- Delete teams
  DELETE FROM teams WHERE branch_id = p_branch_id;
  
  -- Delete safety-related records
  DELETE FROM safety_tasks WHERE branch_id = p_branch_id;
  DELETE FROM hazard_reports WHERE branch_id = p_branch_id;
  DELETE FROM incidents WHERE branch_id = p_branch_id;
  DELETE FROM risk_assessments WHERE branch_id = p_branch_id;
  DELETE FROM coshh_assessments WHERE branch_id = p_branch_id;
  DELETE FROM method_statements WHERE branch_id = p_branch_id;
  
  -- Delete maintenance tickets
  DELETE FROM maintenance_tickets WHERE branch_id = p_branch_id;
  
  -- Delete daily reports
  DELETE FROM daily_reports WHERE branch_id = p_branch_id;
  
  -- Delete events
  DELETE FROM events WHERE branch_id = p_branch_id;
  
  -- Delete financial reports
  DELETE FROM financial_reports WHERE branch_id = p_branch_id;
  
  -- Delete mandatory leave
  DELETE FROM mandatory_leave WHERE branch_id = p_branch_id;
  
  -- Delete document requirements and types
  DELETE FROM document_requirements WHERE branch_id = p_branch_id;
  DELETE FROM document_types WHERE branch_id = p_branch_id;
  
  -- Delete onboarding custom pages
  DELETE FROM onboarding_custom_pages WHERE branch_id = p_branch_id;
  
  -- Delete rotas (shifts table doesn't exist yet)
  DELETE FROM rotas WHERE branch_id = p_branch_id;
  
  -- Finally delete the branch
  DELETE FROM branches WHERE id = p_branch_id;
  
  -- Reset the flag
  PERFORM set_config('app.allow_protected_folder_delete', 'off', true);
END;
$$;