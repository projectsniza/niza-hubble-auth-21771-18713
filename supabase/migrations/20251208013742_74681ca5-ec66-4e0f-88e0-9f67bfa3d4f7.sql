-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS public.safety_tasks CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.method_statements CASCADE;
DROP TABLE IF EXISTS public.coshh_assessments CASCADE;
DROP TABLE IF EXISTS public.risk_assessments CASCADE;
DROP TABLE IF EXISTS public.hazard_reports CASCADE;
DROP TABLE IF EXISTS public.performance_reviews CASCADE;
DROP TABLE IF EXISTS public.performance_criteria CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.rota_shifts CASCADE;
DROP TABLE IF EXISTS public.rotas CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.leave_types CASCADE;
DROP TABLE IF EXISTS public.payroll_records CASCADE;
DROP TABLE IF EXISTS public.salary_structures CASCADE;
DROP TABLE IF EXISTS public.clock_ins CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.maintenance_tickets CASCADE;
DROP TABLE IF EXISTS public.daily_reports CASCADE;
DROP TABLE IF EXISTS public.training_assignments CASCADE;
DROP TABLE IF EXISTS public.trainings CASCADE;
DROP TABLE IF EXISTS public.document_follow_ups CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.document_types CASCADE;
DROP TABLE IF EXISTS public.right_to_work_checks CASCADE;
DROP TABLE IF EXISTS public.contract_approvals CASCADE;
DROP TABLE IF EXISTS public.employee_onboarding CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- Update app_role enum to include employee
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  auto_create_folder BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geofence_radius INTEGER DEFAULT 100,
  qr_enabled BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  team_leader_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create employees table (separate from auth users for employee data)
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  team_id UUID REFERENCES public.teams(id),
  manager_id UUID REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  job_title TEXT,
  department TEXT,
  date_of_birth DATE,
  join_date DATE,
  national_insurance_number TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'onboarding', 'active', 'inactive', 'terminated')),
  account_activated BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Employee onboarding workflow
CREATE TABLE public.employee_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 6),
  basic_details_completed BOOLEAN DEFAULT false,
  contract_uploaded BOOLEAN DEFAULT false,
  contract_submitted_for_approval BOOLEAN DEFAULT false,
  contract_approved BOOLEAN DEFAULT false,
  contract_signed BOOLEAN DEFAULT false,
  right_to_work_completed BOOLEAN DEFAULT false,
  documents_uploaded BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contract approvals
CREATE TABLE public.contract_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_file_path TEXT,
  contract_file_name TEXT,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  admin_signature TEXT,
  rejection_reason TEXT,
  signed_contract_path TEXT,
  signed_contract_uploaded_at TIMESTAMPTZ,
  signed_contract_uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Right to work checks
CREATE TABLE public.right_to_work_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  share_code TEXT,
  gov_portal_link TEXT,
  check_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'expired', 'invalid')),
  document_path TEXT,
  document_name TEXT,
  notes TEXT,
  checked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document types (mandatory documents configurable by admin)
CREATE TABLE public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  required_for TEXT DEFAULT 'all' CHECK (required_for IN ('all', 'organization', 'branch')),
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Folders structure
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  employee_id UUID REFERENCES public.employees(id),
  folder_type TEXT DEFAULT 'general' CHECK (folder_type IN ('company', 'organization', 'branch', 'employee', 'general')),
  path TEXT NOT NULL,
  access_level TEXT DEFAULT 'admin' CHECK (access_level IN ('admin', 'hr', 'staff', 'public')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  expiry_date DATE,
  follow_up_date DATE,
  document_type_id UUID REFERENCES public.document_types(id),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trainings
CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  training_date DATE,
  deadline DATE,
  tags TEXT[],
  document_path TEXT,
  document_name TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Training assignments
CREATE TABLE public.training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Daily reports
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  report_type TEXT DEFAULT 'report' CHECK (report_type IN ('report', 'invoice')),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  files JSONB DEFAULT '[]',
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Maintenance tickets
CREATE TABLE public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  images JSONB DEFAULT '[]',
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Locations (for geofencing)
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius INTEGER DEFAULT 100,
  qr_enabled BOOLEAN DEFAULT false,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clock-ins
CREATE TABLE public.clock_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  location_id UUID REFERENCES public.locations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  clock_in_time TIMESTAMPTZ NOT NULL,
  clock_out_time TIMESTAMPTZ,
  clock_in_latitude DECIMAL(10, 8),
  clock_in_longitude DECIMAL(11, 8),
  clock_out_latitude DECIMAL(10, 8),
  clock_out_longitude DECIMAL(11, 8),
  clock_in_method TEXT DEFAULT 'gps' CHECK (clock_in_method IN ('gps', 'qr', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Salary structures
CREATE TABLE public.salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  basic_salary DECIMAL(10, 2) DEFAULT 0,
  hra DECIMAL(10, 2) DEFAULT 0,
  travel_allowance DECIMAL(10, 2) DEFAULT 0,
  other_allowances DECIMAL(10, 2) DEFAULT 0,
  salary_advance DECIMAL(10, 2) DEFAULT 0,
  late_fine DECIMAL(10, 2) DEFAULT 0,
  unpaid_leave_days INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payroll records
CREATE TABLE public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  basic_salary DECIMAL(10, 2),
  total_allowances DECIMAL(10, 2),
  total_deductions DECIMAL(10, 2),
  net_salary DECIMAL(10, 2),
  salary_slip_path TEXT,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, month)
);

-- Leave types
CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  days_allowed INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Leave requests
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rotas
CREATE TABLE public.rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rota shifts
CREATE TABLE public.rota_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'announcement' CHECK (event_type IN ('announcement', 'urgent', 'company_event', 'employee_event', 'birthday', 'training')),
  event_date TIMESTAMPTZ,
  visibility TEXT DEFAULT 'company' CHECK (visibility IN ('company', 'organization', 'branch')),
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  is_pinned BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  views_count INTEGER DEFAULT 0,
  attending_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance criteria
CREATE TABLE public.performance_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(3, 2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance reviews
CREATE TABLE public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  review_period_start DATE,
  review_period_end DATE,
  ratings JSONB DEFAULT '{}',
  overall_rating DECIMAL(2, 1),
  goals TEXT,
  goals_progress INTEGER DEFAULT 0,
  feedback TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hazard reports
CREATE TABLE public.hazard_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  location_details TEXT,
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'actions_assigned', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Risk assessments
CREATE TABLE public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  hazard_description TEXT,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  control_measures TEXT,
  evidence_files JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'completed')),
  review_date DATE,
  responsible_person_id UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- COSHH assessments
CREATE TABLE public.coshh_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  sds_file_path TEXT,
  sds_expiry_date DATE,
  ppe_requirements TEXT[],
  exposure_limits TEXT,
  storage_requirements TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'active', 'archived')),
  is_discontinued BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Method statements
CREATE TABLE public.method_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  steps JSONB DEFAULT '[]',
  ppe_required TEXT[],
  equipment TEXT[],
  responsibilities TEXT,
  manual_file_path TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'distributed')),
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Incidents (accidents and near misses)
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL CHECK (incident_type IN ('accident', 'near_miss')),
  title TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  incident_date TIMESTAMPTZ NOT NULL,
  location_details TEXT,
  victim_name TEXT,
  victim_employee_id UUID REFERENCES public.employees(id),
  injury_type TEXT,
  images JSONB DEFAULT '[]',
  witness_statements TEXT,
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'investigation', 'actions_taken', 'closed')),
  root_cause TEXT,
  corrective_actions TEXT,
  medical_documents JSONB DEFAULT '[]',
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  investigated_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Safety tasks
CREATE TABLE public.safety_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'general' CHECK (task_type IN ('risk_assessment', 'coshh_followup', 'method_statement_review', 'hazard_corrective', 'accident_investigation', 'near_miss_prevention', 'general')),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  related_hazard_id UUID REFERENCES public.hazard_reports(id),
  related_risk_assessment_id UUID REFERENCES public.risk_assessments(id),
  related_incident_id UUID REFERENCES public.incidents(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID REFERENCES auth.users(id),
  due_date DATE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'verified')),
  completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Update profiles table to add organization and branch foreign keys
ALTER TABLE public.profiles 
  ADD CONSTRAINT fk_profiles_organization 
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.profiles 
  ADD CONSTRAINT fk_profiles_branch 
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.right_to_work_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coshh_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for super_admin access (full access)
CREATE POLICY "Super admins have full access to organizations" ON public.organizations FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to branches" ON public.branches FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to employees" ON public.employees FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to employee_onboarding" ON public.employee_onboarding FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to contract_approvals" ON public.contract_approvals FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to right_to_work_checks" ON public.right_to_work_checks FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to document_types" ON public.document_types FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to folders" ON public.folders FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to documents" ON public.documents FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to trainings" ON public.trainings FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to training_assignments" ON public.training_assignments FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to daily_reports" ON public.daily_reports FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to maintenance_tickets" ON public.maintenance_tickets FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to locations" ON public.locations FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to clock_ins" ON public.clock_ins FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to salary_structures" ON public.salary_structures FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to payroll_records" ON public.payroll_records FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to leave_types" ON public.leave_types FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to leave_requests" ON public.leave_requests FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to rotas" ON public.rotas FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to rota_shifts" ON public.rota_shifts FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to events" ON public.events FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to performance_criteria" ON public.performance_criteria FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to performance_reviews" ON public.performance_reviews FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to hazard_reports" ON public.hazard_reports FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to risk_assessments" ON public.risk_assessments FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to coshh_assessments" ON public.coshh_assessments FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to method_statements" ON public.method_statements FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to incidents" ON public.incidents FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to safety_tasks" ON public.safety_tasks FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- HR policies based on access level
CREATE POLICY "HR can view organizations based on access level" ON public.organizations FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM public.profiles WHERE id = auth.uid()) = 'full'
    OR id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "HR can view branches based on access level" ON public.branches FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM public.profiles WHERE id = auth.uid()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "HR can manage employees in their scope" ON public.employees FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM public.profiles WHERE id = auth.uid()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Manager policies (branch-restricted)
CREATE POLICY "Managers can view their organization" ON public.organizations FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND 
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can view their branch" ON public.branches FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND 
  id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can manage employees in their branch" ON public.employees FOR ALL USING (
  has_role(auth.uid(), 'manager') AND 
  branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

-- Employee policies (personal access only)
CREATE POLICY "Employees can view their organization" ON public.organizations FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND 
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Employees can view their branch" ON public.branches FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND 
  id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Employees can view their own record" ON public.employees FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND user_id = auth.uid()
);

-- Employees can clock in/out
CREATE POLICY "Users can manage their own clock-ins" ON public.clock_ins FOR ALL USING (user_id = auth.uid());

-- Employees can view their own documents
CREATE POLICY "Employees can view their documents" ON public.documents FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR folder_id IN (SELECT id FROM public.folders WHERE access_level = 'public')
  )
);

-- Employees can view public events
CREATE POLICY "Employees can view events in their scope" ON public.events FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND (
    visibility = 'company'
    OR (visibility = 'organization' AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
    OR (visibility = 'branch' AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()))
  )
);

-- Employees can view their own leave requests
CREATE POLICY "Employees can manage their leave requests" ON public.leave_requests FOR ALL USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Employees can view their assigned shifts
CREATE POLICY "Employees can view their shifts" ON public.rota_shifts FOR SELECT USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Employees can view their own payroll
CREATE POLICY "Employees can view their payroll" ON public.payroll_records FOR SELECT USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Employees can view assigned trainings
CREATE POLICY "Users can view their training assignments" ON public.training_assignments FOR SELECT USING (
  assigned_to = auth.uid()
);

CREATE POLICY "Users can update their training assignments" ON public.training_assignments FOR UPDATE USING (
  assigned_to = auth.uid()
);

-- Employees can view and report hazards
CREATE POLICY "Employees can report hazards" ON public.hazard_reports FOR INSERT WITH CHECK (
  reported_by = auth.uid()
);

CREATE POLICY "Employees can view hazards they reported" ON public.hazard_reports FOR SELECT USING (
  reported_by = auth.uid()
);

-- Employees can view their safety tasks
CREATE POLICY "Users can view their safety tasks" ON public.safety_tasks FOR SELECT USING (
  assigned_to = auth.uid()
);

CREATE POLICY "Users can update their safety tasks" ON public.safety_tasks FOR UPDATE USING (
  assigned_to = auth.uid()
);

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_onboarding_updated_at BEFORE UPDATE ON public.employee_onboarding FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_approvals_updated_at BEFORE UPDATE ON public.contract_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_right_to_work_checks_updated_at BEFORE UPDATE ON public.right_to_work_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trainings_updated_at BEFORE UPDATE ON public.trainings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_assignments_updated_at BEFORE UPDATE ON public.training_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_tickets_updated_at BEFORE UPDATE ON public.maintenance_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clock_ins_updated_at BEFORE UPDATE ON public.clock_ins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_salary_structures_updated_at BEFORE UPDATE ON public.salary_structures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_records_updated_at BEFORE UPDATE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rotas_updated_at BEFORE UPDATE ON public.rotas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rota_shifts_updated_at BEFORE UPDATE ON public.rota_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hazard_reports_updated_at BEFORE UPDATE ON public.hazard_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_assessments_updated_at BEFORE UPDATE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coshh_assessments_updated_at BEFORE UPDATE ON public.coshh_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_method_statements_updated_at BEFORE UPDATE ON public.method_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_safety_tasks_updated_at BEFORE UPDATE ON public.safety_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create folder structure when organization is created
CREATE OR REPLACE FUNCTION public.create_organization_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auto_create_folder = true THEN
    INSERT INTO public.folders (name, folder_type, path, organization_id, created_by)
    VALUES (NEW.name, 'organization', 'Company Documents/' || NEW.name, NEW.id, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_org_folder_trigger
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION create_organization_folder();

-- Function to automatically create folder when branch is created
CREATE OR REPLACE FUNCTION public.create_branch_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_folder_id UUID;
  org_name TEXT;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
  SELECT id INTO org_folder_id FROM public.folders WHERE organization_id = NEW.organization_id AND folder_type = 'organization' LIMIT 1;
  
  INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, created_by)
  VALUES (NEW.name, org_folder_id, 'branch', 'Company Documents/' || org_name || '/' || NEW.name, NEW.organization_id, NEW.id, NEW.created_by);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_branch_folder_trigger
AFTER INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION create_branch_folder();

-- Function to automatically create employee folder when employee is created
CREATE OR REPLACE FUNCTION public.create_employee_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  branch_folder_id UUID;
  org_name TEXT;
  branch_name TEXT;
  employee_docs_folder_id UUID;
BEGIN
  SELECT o.name, b.name INTO org_name, branch_name 
  FROM public.branches b 
  JOIN public.organizations o ON b.organization_id = o.id 
  WHERE b.id = NEW.branch_id;
  
  SELECT id INTO branch_folder_id FROM public.folders WHERE branch_id = NEW.branch_id AND folder_type = 'branch' LIMIT 1;
  
  -- Check if Employee Documents folder exists for this branch
  SELECT id INTO employee_docs_folder_id FROM public.folders 
  WHERE parent_id = branch_folder_id AND name = 'Employee Documents' LIMIT 1;
  
  -- Create Employee Documents folder if it doesn't exist
  IF employee_docs_folder_id IS NULL THEN
    INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, created_by)
    VALUES ('Employee Documents', branch_folder_id, 'general', 'Company Documents/' || org_name || '/' || branch_name || '/Employee Documents', NEW.organization_id, NEW.branch_id, NEW.created_by)
    RETURNING id INTO employee_docs_folder_id;
  END IF;
  
  -- Create employee folder
  INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, employee_id, created_by)
  VALUES (
    NEW.first_name || ' ' || NEW.last_name, 
    employee_docs_folder_id, 
    'employee', 
    'Company Documents/' || org_name || '/' || branch_name || '/Employee Documents/' || NEW.first_name || ' ' || NEW.last_name,
    NEW.organization_id, 
    NEW.branch_id, 
    NEW.id, 
    NEW.created_by
  );
  
  -- Create onboarding record
  INSERT INTO public.employee_onboarding (employee_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_employee_folder_trigger
AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION create_employee_folder();