
-- Fix all FK constraints referencing auth.users to use SET NULL (nullable) or CASCADE (not null)
-- This allows deleting users from both the app and Supabase dashboard

-- NULLABLE columns → SET NULL on delete
ALTER TABLE organizations DROP CONSTRAINT organizations_created_by_fkey, ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE branches DROP CONSTRAINT branches_created_by_fkey, ADD CONSTRAINT branches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE teams DROP CONSTRAINT teams_created_by_fkey, ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE teams DROP CONSTRAINT teams_team_leader_id_fkey, ADD CONSTRAINT teams_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE employees DROP CONSTRAINT employees_created_by_fkey, ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE employees DROP CONSTRAINT employees_manager_id_fkey, ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contract_approvals DROP CONSTRAINT contract_approvals_approved_by_fkey, ADD CONSTRAINT contract_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contract_approvals DROP CONSTRAINT contract_approvals_signed_contract_uploaded_by_fkey, ADD CONSTRAINT contract_approvals_signed_contract_uploaded_by_fkey FOREIGN KEY (signed_contract_uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE right_to_work_checks DROP CONSTRAINT right_to_work_checks_checked_by_fkey, ADD CONSTRAINT right_to_work_checks_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE document_types DROP CONSTRAINT document_types_created_by_fkey, ADD CONSTRAINT document_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE folders DROP CONSTRAINT folders_created_by_fkey, ADD CONSTRAINT folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE documents DROP CONSTRAINT documents_uploaded_by_fkey, ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE trainings DROP CONSTRAINT trainings_assigned_to_fkey, ADD CONSTRAINT trainings_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE trainings DROP CONSTRAINT trainings_created_by_fkey, ADD CONSTRAINT trainings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE training_documents DROP CONSTRAINT training_documents_uploaded_by_fkey, ADD CONSTRAINT training_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE training_assignments DROP CONSTRAINT training_assignments_assigned_by_fkey, ADD CONSTRAINT training_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE maintenance_tickets DROP CONSTRAINT maintenance_tickets_assigned_to_fkey, ADD CONSTRAINT maintenance_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE locations DROP CONSTRAINT locations_created_by_fkey, ADD CONSTRAINT locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE salary_structures DROP CONSTRAINT salary_structures_created_by_fkey, ADD CONSTRAINT salary_structures_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE payroll_records DROP CONSTRAINT payroll_records_generated_by_fkey, ADD CONSTRAINT payroll_records_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE payroll_categories DROP CONSTRAINT payroll_categories_created_by_fkey, ADD CONSTRAINT payroll_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE payroll_items DROP CONSTRAINT payroll_items_created_by_fkey, ADD CONSTRAINT payroll_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE leave_types DROP CONSTRAINT leave_types_created_by_fkey, ADD CONSTRAINT leave_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_approved_by_fkey, ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE rotas DROP CONSTRAINT rotas_created_by_fkey, ADD CONSTRAINT rotas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE events DROP CONSTRAINT events_created_by_fkey, ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE performance_criteria DROP CONSTRAINT performance_criteria_created_by_fkey, ADD CONSTRAINT performance_criteria_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE hazard_reports DROP CONSTRAINT hazard_reports_assigned_to_fkey, ADD CONSTRAINT hazard_reports_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE risk_assessments DROP CONSTRAINT risk_assessments_approved_by_fkey, ADD CONSTRAINT risk_assessments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE risk_assessments DROP CONSTRAINT risk_assessments_created_by_fkey, ADD CONSTRAINT risk_assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE risk_assessments DROP CONSTRAINT risk_assessments_responsible_person_id_fkey, ADD CONSTRAINT risk_assessments_responsible_person_id_fkey FOREIGN KEY (responsible_person_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE coshh_assessments DROP CONSTRAINT coshh_assessments_created_by_fkey, ADD CONSTRAINT coshh_assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE coshh_assessments DROP CONSTRAINT coshh_assessments_approved_by_fkey, ADD CONSTRAINT coshh_assessments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE method_statements DROP CONSTRAINT method_statements_created_by_fkey, ADD CONSTRAINT method_statements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE method_statements DROP CONSTRAINT method_statements_approved_by_fkey, ADD CONSTRAINT method_statements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE incidents DROP CONSTRAINT incidents_investigated_by_fkey, ADD CONSTRAINT incidents_investigated_by_fkey FOREIGN KEY (investigated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE incidents DROP CONSTRAINT incidents_closed_by_fkey, ADD CONSTRAINT incidents_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE safety_tasks DROP CONSTRAINT safety_tasks_assigned_by_fkey, ADD CONSTRAINT safety_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE safety_tasks DROP CONSTRAINT safety_tasks_assigned_to_fkey, ADD CONSTRAINT safety_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE safety_tasks DROP CONSTRAINT safety_tasks_verified_by_fkey, ADD CONSTRAINT safety_tasks_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE financial_reports DROP CONSTRAINT financial_reports_created_by_fkey, ADD CONSTRAINT financial_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE reminders DROP CONSTRAINT reminders_created_by_fkey, ADD CONSTRAINT reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE reminders DROP CONSTRAINT reminders_assigned_to_fkey, ADD CONSTRAINT reminders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE reminder_settings DROP CONSTRAINT reminder_settings_created_by_fkey, ADD CONSTRAINT reminder_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE conversations DROP CONSTRAINT conversations_created_by_fkey, ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE messages DROP CONSTRAINT messages_pinned_by_fkey, ADD CONSTRAINT messages_pinned_by_fkey FOREIGN KEY (pinned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE custom_roles DROP CONSTRAINT custom_roles_created_by_fkey, ADD CONSTRAINT custom_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_custom_roles DROP CONSTRAINT user_custom_roles_assigned_by_fkey, ADD CONSTRAINT user_custom_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE employee_contracts DROP CONSTRAINT employee_contracts_created_by_fkey, ADD CONSTRAINT employee_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE timesheets DROP CONSTRAINT timesheets_created_by_fkey, ADD CONSTRAINT timesheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE timesheets DROP CONSTRAINT timesheets_submitted_by_fkey, ADD CONSTRAINT timesheets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE timesheets DROP CONSTRAINT timesheets_approved_by_fkey, ADD CONSTRAINT timesheets_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE document_follow_up_settings DROP CONSTRAINT document_follow_up_settings_created_by_fkey, ADD CONSTRAINT document_follow_up_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- NOT NULL columns → CASCADE on delete (deletes the row when user is deleted)
ALTER TABLE contract_approvals DROP CONSTRAINT contract_approvals_submitted_by_fkey, ADD CONSTRAINT contract_approvals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE training_assignments DROP CONSTRAINT training_assignments_assigned_to_fkey, ADD CONSTRAINT training_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE daily_reports DROP CONSTRAINT daily_reports_submitted_by_fkey, ADD CONSTRAINT daily_reports_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE maintenance_tickets DROP CONSTRAINT maintenance_tickets_reported_by_fkey, ADD CONSTRAINT maintenance_tickets_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE clock_ins DROP CONSTRAINT clock_ins_user_id_fkey, ADD CONSTRAINT clock_ins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE performance_reviews DROP CONSTRAINT performance_reviews_reviewer_id_fkey, ADD CONSTRAINT performance_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE hazard_reports DROP CONSTRAINT hazard_reports_reported_by_fkey, ADD CONSTRAINT hazard_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE incidents DROP CONSTRAINT incidents_reported_by_fkey, ADD CONSTRAINT incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey, ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
