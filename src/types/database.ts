// Database types for the HR system
export type UserRole = 'super_admin' | 'hr' | 'manager' | 'employee';
export type HRAccessLevel = 'full' | 'organization' | 'branch';
export type EmployeeStatus = 'pending' | 'onboarding' | 'active' | 'inactive' | 'terminated';
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;
export type ContractStatus = 'pending' | 'approved' | 'rejected';
export type DocumentFollowUpStatus = 'overdue' | 'upcoming' | 'ok';

export interface Organization {
  id: string;
  name: string;
  vat_number?: string | null;
  registration_number?: string | null;
  created_by: string | null;
  auto_create_folder: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  reminder_date: string;
  reminder_type: string;
  priority: string;
  is_completed: boolean;
  is_dismissed: boolean;
  created_by?: string | null;
  assigned_to?: string | null;
  organization_id?: string | null;
  branch_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderSettings {
  id: string;
  setting_key: string;
  setting_value: any;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius: number;
  qr_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface Team {
  id: string;
  name: string;
  branch_id: string;
  team_leader_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface Employee {
  id: string;
  user_id: string | null;
  organization_id: string;
  branch_id: string;
  team_id: string | null;
  manager_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  date_of_birth: string | null;
  join_date: string | null;
  national_insurance_number: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: EmployeeStatus;
  account_activated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  organization?: Organization;
  branch?: Branch;
  team?: Team;
  onboarding?: EmployeeOnboarding;
  contract_approval?: ContractApproval;
}

export interface EmployeeOnboarding {
  id: string;
  employee_id: string;
  current_step: OnboardingStep;
  basic_details_completed: boolean;
  contract_uploaded: boolean;
  contract_submitted_for_approval: boolean;
  contract_approved: boolean;
  contract_signed: boolean;
  right_to_work_completed: boolean;
  documents_uploaded: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractApproval {
  id: string;
  employee_id: string;
  contract_file_path: string | null;
  contract_file_name: string | null;
  submitted_by: string;
  submitted_at: string;
  status: ContractStatus;
  approved_by: string | null;
  approved_at: string | null;
  admin_signature: string | null;
  rejection_reason: string | null;
  signed_contract_path: string | null;
  signed_contract_uploaded_at: string | null;
  signed_contract_uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  submitter?: Profile;
}

export interface RightToWorkCheck {
  id: string;
  employee_id: string;
  share_code: string | null;
  gov_portal_link: string | null;
  check_date: string | null;
  expiry_date: string | null;
  status: 'pending' | 'valid' | 'expired' | 'invalid';
  document_path: string | null;
  document_name: string | null;
  notes: string | null;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
  employee_id: string | null;
  folder_type: 'company' | 'organization' | 'branch' | 'employee' | 'general';
  path: string;
  access_level: 'admin' | 'hr' | 'staff' | 'public';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  children?: Folder[];
}

export interface Document {
  id: string;
  folder_id: string | null;
  employee_id: string | null;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  expiry_date: string | null;
  follow_up_date: string | null;
  document_type_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  uploader?: Profile;
}

export interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  required_for: 'all' | 'organization' | 'branch';
  organization_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  organization_id: string | null;
  branch_id: string | null;
  hr_access_level: HRAccessLevel | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Location {
  id: string;
  branch_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  qr_enabled: boolean;
  qr_code: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface ClockIn {
  id: string;
  user_id: string;
  location_id: string | null;
  branch_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_method: 'gps' | 'qr' | 'manual';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Training {
  id: string;
  title: string;
  description: string | null;
  training_date: string | null;
  deadline: string | null;
  tags: string[] | null;
  document_path: string | null;
  document_name: string | null;
  organization_id: string | null;
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingAssignment {
  id: string;
  training_id: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  training?: Training;
}

export interface MaintenanceTicket {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  organization_id: string;
  branch_id: string;
  images: any[];
  reported_by: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  reporter?: Profile;
}

export interface SalaryStructure {
  id: string;
  employee_id: string;
  basic_salary: number;
  hra: number;
  travel_allowance: number;
  other_allowances: number;
  salary_advance: number;
  late_fine: number;
  unpaid_leave_days: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  month: string;
  basic_salary: number | null;
  total_allowances: number | null;
  total_deductions: number | null;
  net_salary: number | null;
  salary_slip_path: string | null;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  days_allowed: number;
  is_paid: boolean;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  leave_type?: LeaveType;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: 'announcement' | 'urgent' | 'company_event' | 'employee_event' | 'birthday' | 'training';
  event_date: string | null;
  visibility: 'company' | 'organization' | 'branch';
  organization_id: string | null;
  branch_id: string | null;
  is_pinned: boolean;
  attachments: any[];
  views_count: number;
  attending_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HazardReport {
  id: string;
  title: string;
  description: string | null;
  organization_id: string;
  branch_id: string;
  location_details: string | null;
  images: any[];
  status: 'reported' | 'investigating' | 'actions_assigned' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  reported_by: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyTask {
  id: string;
  title: string;
  description: string | null;
  task_type: 'risk_assessment' | 'coshh_followup' | 'method_statement_review' | 'hazard_corrective' | 'accident_investigation' | 'near_miss_prevention' | 'general';
  organization_id: string;
  branch_id: string;
  related_hazard_id: string | null;
  related_risk_assessment_id: string | null;
  related_incident_id: string | null;
  assigned_to: string;
  assigned_by: string | null;
  due_date: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'verified';
  completed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// Risk Management Types
export interface RiskAssessment {
  id: string;
  title: string;
  description: string | null;
  hazard_description: string | null;
  control_measures: string | null;
  risk_level: 'low' | 'medium' | 'high';
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  organization_id: string;
  branch_id: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_date: string | null;
  attachments: FileInfo[] | null;
  created_at: string;
  updated_at: string;
}

export interface CoshhAssessment {
  id: string;
  chemical_name: string;
  storage_requirements: string | null;
  exposure_limits: string | null;
  ppe_requirements: string[] | null;
  sds_file_path: string | null;
  sds_expiry_date: string | null;
  status: 'draft' | 'approved' | 'expired';
  is_discontinued: boolean;
  organization_id: string;
  branch_id: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MethodStatement {
  id: string;
  title: string;
  description: string | null;
  procedure: string | null;
  ppe_requirements: string[] | null;
  emergency_procedures: string | null;
  status: 'draft' | 'approved' | 'archived';
  organization_id: string;
  branch_id: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  attachments: FileInfo[] | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  incident_type: 'accident' | 'near_miss' | 'first_aid' | 'riddor';
  incident_date: string;
  location_details: string | null;
  victim_name: string | null;
  victim_employee_id: string | null;
  injury_type: string | null;
  witness_statements: string | null;
  root_cause: string | null;
  corrective_actions: string | null;
  status: 'reported' | 'investigating' | 'closed';
  organization_id: string;
  branch_id: string;
  reported_by: string;
  investigated_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  images: FileInfo[] | null;
  medical_documents: FileInfo[] | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  id: string;
  title: string;
  report_type: string | null;
  organization_id: string;
  branch_id: string;
  submitted_by: string;
  submitted_at: string | null;
  files: FileInfo[] | null;
  created_at: string;
  updated_at: string;
}

export interface FileInfo {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

// Shared filter types
export interface OrgOption {
  id: string;
  name: string;
}

export interface BranchOption {
  id: string;
  name: string;
  organization_id: string;
}
