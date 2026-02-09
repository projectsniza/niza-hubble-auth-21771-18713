
-- Create a function to clean up all FK references before deleting a user from auth
CREATE OR REPLACE FUNCTION public.cleanup_user_references(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Hard-delete messaging records
  DELETE FROM message_read_receipts WHERE user_id = p_user_id;
  DELETE FROM conversation_participants WHERE user_id = p_user_id;
  DELETE FROM messages WHERE pinned_by = p_user_id;
  DELETE FROM messages WHERE sender_id = p_user_id;
  DELETE FROM clock_ins WHERE user_id = p_user_id;

  -- Unlink employees
  UPDATE employees SET user_id = NULL, account_activated = false WHERE user_id = p_user_id;

  -- Nullify all nullable FK columns
  UPDATE organizations SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE branches SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE teams SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE teams SET team_leader_id = NULL WHERE team_leader_id = p_user_id;
  UPDATE employees SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE employees SET manager_id = NULL WHERE manager_id = p_user_id;
  UPDATE contract_approvals SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE contract_approvals SET signed_contract_uploaded_by = NULL WHERE signed_contract_uploaded_by = p_user_id;
  UPDATE right_to_work_checks SET checked_by = NULL WHERE checked_by = p_user_id;
  UPDATE document_types SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE folders SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE documents SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE trainings SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE trainings SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE training_documents SET uploaded_by = NULL WHERE uploaded_by = p_user_id;
  UPDATE training_assignments SET assigned_by = NULL WHERE assigned_by = p_user_id;
  UPDATE training_assignments SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE maintenance_tickets SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE maintenance_tickets SET reported_by = NULL WHERE reported_by = p_user_id;
  UPDATE locations SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE salary_structures SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE payroll_records SET generated_by = NULL WHERE generated_by = p_user_id;
  UPDATE payroll_categories SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE payroll_items SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE leave_types SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE leave_requests SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE rotas SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE events SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE performance_criteria SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE performance_reviews SET reviewer_id = NULL WHERE reviewer_id = p_user_id;
  UPDATE hazard_reports SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE hazard_reports SET reported_by = NULL WHERE reported_by = p_user_id;
  UPDATE risk_assessments SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE risk_assessments SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE risk_assessments SET responsible_person_id = NULL WHERE responsible_person_id = p_user_id;
  UPDATE coshh_assessments SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE coshh_assessments SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE method_statements SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE method_statements SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE incidents SET reported_by = NULL WHERE reported_by = p_user_id;
  UPDATE incidents SET investigated_by = NULL WHERE investigated_by = p_user_id;
  UPDATE incidents SET closed_by = NULL WHERE closed_by = p_user_id;
  UPDATE safety_tasks SET assigned_by = NULL WHERE assigned_by = p_user_id;
  UPDATE safety_tasks SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE safety_tasks SET verified_by = NULL WHERE verified_by = p_user_id;
  UPDATE financial_reports SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE reminders SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE reminders SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE reminder_settings SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE conversations SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE custom_roles SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE user_custom_roles SET assigned_by = NULL WHERE assigned_by = p_user_id;
  UPDATE employee_contracts SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE timesheets SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE timesheets SET submitted_by = NULL WHERE submitted_by = p_user_id;
  UPDATE timesheets SET approved_by = NULL WHERE approved_by = p_user_id;
  UPDATE document_follow_up_settings SET created_by = NULL WHERE created_by = p_user_id;

  -- Delete rows where the FK column is NOT NULL (can't nullify)
  DELETE FROM daily_reports WHERE submitted_by = p_user_id;
  DELETE FROM contract_approvals WHERE submitted_by = p_user_id;
END;
$$;
