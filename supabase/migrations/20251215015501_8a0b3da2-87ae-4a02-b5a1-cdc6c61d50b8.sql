-- ============================================
-- NIZA CLOUD - COMPLETE DATABASE SCHEMA
-- Consolidated from all migrations
-- ============================================

-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'hr', 'manager', 'employee');

-- Create enum for HR access levels
CREATE TYPE public.hr_access_level AS ENUM ('full', 'organization', 'branch');

-- Create enum for template types
CREATE TYPE public.template_type AS ENUM (
  'visiting_card',
  'email_signature', 
  'id_card',
  'visitor_pass',
  'invoice',
  'gift_card',
  'custom'
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  organization_id UUID,
  branch_id UUID,
  hr_access_level hr_access_level,
  force_password_change BOOLEAN DEFAULT true,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'hr' THEN 2 
      WHEN 'manager' THEN 3 
      WHEN 'employee' THEN 4 
    END
  LIMIT 1
$$;

-- Function to get profile data for current user (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_profile_data()
RETURNS TABLE (organization_id uuid, branch_id uuid, hr_access_level text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id, branch_id, hr_access_level::text
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Handle new user: create profile and assign role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  -- Create profile with optional organization/branch from metadata
  INSERT INTO public.profiles (id, email, name, organization_id, branch_id, hr_access_level)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NULLIF(NEW.raw_user_meta_data ->> 'organization_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data ->> 'branch_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data ->> 'hr_access_level', '')::hr_access_level
  );
  
  -- Get role from metadata, default to 'employee' for safety
  _role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', '')::app_role,
    'employee'::app_role
  );
  
  -- Assign the role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

-- Create employees table
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
  bulk_upload_id UUID,
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
  employer_signature TEXT,
  employer_signature_type TEXT CHECK (employer_signature_type IN ('typed', 'drawn', 'uploaded')),
  employer_signed_date DATE,
  contract_content JSONB DEFAULT '{}'::jsonb,
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

-- Document types
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
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  folder_type TEXT DEFAULT 'general' CHECK (folder_type IN ('general', 'organization', 'branch', 'employee', 'root')),
  path TEXT NOT NULL,
  access_level TEXT DEFAULT 'admin' CHECK (access_level IN ('admin', 'hr', 'staff', 'public')),
  is_system BOOLEAN DEFAULT false,
  is_deletable BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#3B82F6',
  show_in_safety BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
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
  assigned_to UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  completed_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Training documents
CREATE TABLE public.training_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT DEFAULT 'training',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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

-- Leave settings
CREATE TABLE public.leave_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_required BOOLEAN DEFAULT true,
  auto_approve_days INTEGER DEFAULT 0,
  carry_forward_enabled BOOLEAN DEFAULT false,
  carry_forward_max_days INTEGER DEFAULT 5,
  accrual_enabled BOOLEAN DEFAULT false,
  accrual_days_per_month NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(organization_id)
);

-- Mandatory leave
CREATE TABLE public.mandatory_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id),
  is_paid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
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
  employee_response TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rota settings
CREATE TABLE public.rota_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_view TEXT DEFAULT 'table',
  restricted_permissions BOOLEAN DEFAULT false,
  hide_shift_labels BOOLEAN DEFAULT false,
  accept_decline_enabled BOOLEAN DEFAULT false,
  open_shifts_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
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

-- Financial reports
CREATE TABLE public.financial_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quarter TEXT NOT NULL,
  store_name TEXT NOT NULL,
  revenue JSONB NOT NULL DEFAULT '{}'::jsonb,
  cost_of_sales JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_costs JSONB NOT NULL DEFAULT '{}'::jsonb,
  other_income JSONB NOT NULL DEFAULT '{}'::jsonb,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bulk uploads table
CREATE TABLE public.bulk_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  error_log JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Onboarding custom pages
CREATE TABLE public.onboarding_custom_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  page_order INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  logo_path TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Onboarding page fields
CREATE TABLE public.onboarding_page_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.onboarding_custom_pages(id) ON DELETE CASCADE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  field_options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT false,
  field_order INTEGER NOT NULL DEFAULT 1,
  placeholder TEXT,
  default_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contract templates
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'full_time',
  template_file_path TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  merge_fields JSONB DEFAULT '[]'::jsonb,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contract branding
CREATE TABLE public.contract_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  logo_path TEXT,
  header_template TEXT,
  footer_template TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Document requirements
CREATE TABLE public.document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  doc_order INTEGER NOT NULL DEFAULT 1,
  organization_id UUID REFERENCES public.organizations(id),
  branch_id UUID REFERENCES public.branches(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Onboarding form settings
CREATE TABLE public.onboarding_form_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  form_type TEXT NOT NULL CHECK (form_type IN ('application_form', 'starter_checklist', 'bank_details', 'custom_pages')),
  enabled BOOLEAN DEFAULT true,
  form_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, form_type)
);

-- Onboarding form responses
CREATE TABLE public.onboarding_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL,
  form_data JSONB DEFAULT '{}'::jsonb,
  signature TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, form_type)
);

-- Template folders
CREATE TABLE public.template_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  parent_id UUID REFERENCES public.template_folders(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Templates
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type template_type NOT NULL DEFAULT 'custom',
  folder_id UUID REFERENCES public.template_folders(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  content JSONB DEFAULT '{}'::jsonb,
  thumbnail_path TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Brand settings
CREATE TABLE public.brand_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  primary_logo_path TEXT,
  secondary_logo_path TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#10B981',
  accent_color TEXT DEFAULT '#8B5CF6',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  fonts JSONB DEFAULT '{"heading": "Inter", "body": "Inter"}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Gift cards
CREATE TABLE public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'birthday',
  valid_date DATE,
  discount TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  design_template JSONB DEFAULT '{}'::jsonb,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key constraints to profiles
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
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coshh_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_page_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - PROFILES
-- ========================================
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can view profiles in their scope" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (organization_id = (SELECT organization_id FROM get_my_profile_data())) OR 
    (branch_id = (SELECT branch_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "Managers can view profiles in their branch" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- ========================================
-- RLS POLICIES - USER ROLES
-- ========================================
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- ========================================
-- RLS POLICIES - SUPER ADMIN FULL ACCESS
-- ========================================
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
CREATE POLICY "Super admins have full access to trainings" ON public.trainings FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to training_documents" ON public.training_documents FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to training_assignments" ON public.training_assignments FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to daily_reports" ON public.daily_reports FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to maintenance_tickets" ON public.maintenance_tickets FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to locations" ON public.locations FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to clock_ins" ON public.clock_ins FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to salary_structures" ON public.salary_structures FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to payroll_records" ON public.payroll_records FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to leave_types" ON public.leave_types FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to leave_requests" ON public.leave_requests FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to leave_settings" ON public.leave_settings FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to mandatory_leave" ON public.mandatory_leave FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to rotas" ON public.rotas FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to rota_shifts" ON public.rota_shifts FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to rota_settings" ON public.rota_settings FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to events" ON public.events FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to performance_criteria" ON public.performance_criteria FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to performance_reviews" ON public.performance_reviews FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to hazard_reports" ON public.hazard_reports FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to risk_assessments" ON public.risk_assessments FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to coshh_assessments" ON public.coshh_assessments FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to method_statements" ON public.method_statements FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to incidents" ON public.incidents FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to safety_tasks" ON public.safety_tasks FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to financial_reports" ON public.financial_reports FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to bulk_uploads" ON public.bulk_uploads FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to onboarding_custom_pages" ON public.onboarding_custom_pages FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to onboarding_page_fields" ON public.onboarding_page_fields FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to contract_templates" ON public.contract_templates FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to contract_branding" ON public.contract_branding FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to document_requirements" ON public.document_requirements FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to onboarding_form_settings" ON public.onboarding_form_settings FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to onboarding_form_responses" ON public.onboarding_form_responses FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to template_folders" ON public.template_folders FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to templates" ON public.templates FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to brand_settings" ON public.brand_settings FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins have full access to gift_cards" ON public.gift_cards FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- ========================================
-- RLS POLICIES - HR ACCESS
-- ========================================
CREATE POLICY "HR can view organizations based on access level" ON public.organizations FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (id = (SELECT organization_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "HR can view branches based on access level" ON public.branches FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    ((SELECT hr_access_level FROM get_my_profile_data()) = 'full') OR 
    (organization_id = (SELECT organization_id FROM get_my_profile_data())) OR 
    (id = (SELECT branch_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "HR can manage employees in their scope" ON public.employees FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "HR can manage trainings" ON public.trainings FOR ALL USING (has_role(auth.uid(), 'hr')) WITH CHECK (has_role(auth.uid(), 'hr'));
CREATE POLICY "HR can manage training_documents" ON public.training_documents FOR ALL USING (has_role(auth.uid(), 'hr')) WITH CHECK (has_role(auth.uid(), 'hr'));
CREATE POLICY "HR can manage documents in their scope" ON public.documents FOR ALL USING (has_role(auth.uid(), 'hr'));
CREATE POLICY "HR can manage folders in their scope" ON public.folders FOR ALL USING (has_role(auth.uid(), 'hr'));

-- ========================================
-- RLS POLICIES - MANAGER ACCESS
-- ========================================
CREATE POLICY "Managers can view their organization" ON public.organizations FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND id = (SELECT organization_id FROM get_my_profile_data())
);

CREATE POLICY "Managers can view their branch" ON public.branches FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Managers can manage employees in their branch" ON public.employees FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Managers can view assigned trainings" ON public.trainings FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND assigned_to = auth.uid()
);

CREATE POLICY "Managers can update assigned trainings" ON public.trainings FOR UPDATE USING (
  has_role(auth.uid(), 'manager') AND assigned_to = auth.uid()
) WITH CHECK (
  has_role(auth.uid(), 'manager') AND assigned_to = auth.uid()
);

CREATE POLICY "Managers can manage their training documents" ON public.training_documents FOR ALL USING (
  has_role(auth.uid(), 'manager') AND training_id IN (SELECT id FROM trainings WHERE assigned_to = auth.uid())
) WITH CHECK (
  has_role(auth.uid(), 'manager') AND training_id IN (SELECT id FROM trainings WHERE assigned_to = auth.uid())
);

CREATE POLICY "Managers can manage folders in their branch" ON public.folders FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Managers can manage documents in their branch" ON public.documents FOR ALL USING (
  has_role(auth.uid(), 'manager') AND (
    employee_id IN (SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data()))
    OR folder_id IN (SELECT f.id FROM folders f WHERE f.branch_id = (SELECT branch_id FROM get_my_profile_data()))
  )
);

CREATE POLICY "Managers can view locations in their branch" ON public.locations FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- ========================================
-- RLS POLICIES - EMPLOYEE ACCESS
-- ========================================
CREATE POLICY "Employees can view their organization" ON public.organizations FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND id = (SELECT organization_id FROM get_my_profile_data())
);

CREATE POLICY "Employees can view their branch" ON public.branches FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Employees can view their own record" ON public.employees FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND user_id = auth.uid()
);

CREATE POLICY "Employees can view locations in their branch" ON public.locations FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Employees can view folders they have access to" ON public.folders FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND (
    access_level = 'public'
    OR employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Employees can view their documents" ON public.documents FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR folder_id IN (SELECT id FROM folders WHERE access_level = 'public')
  )
);

CREATE POLICY "Users can manage their own clock-ins" ON public.clock_ins FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Employees can manage their leave requests" ON public.leave_requests FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employees can view their shifts" ON public.rota_shifts FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employees can view their payroll" ON public.payroll_records FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Users can view events in their scope" ON public.events FOR SELECT USING (
  has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr') OR
  ((has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')) AND (
    visibility = 'company' OR
    (visibility = 'organization' AND organization_id = (SELECT organization_id FROM get_my_profile_data())) OR
    (visibility = 'branch' AND branch_id = (SELECT branch_id FROM get_my_profile_data()))
  ))
);

CREATE POLICY "All authenticated users can view leave_types" ON public.leave_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view their training assignments" ON public.training_assignments FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Users can update their training assignments" ON public.training_assignments FOR UPDATE USING (assigned_to = auth.uid());
CREATE POLICY "Users can view their safety tasks" ON public.safety_tasks FOR SELECT USING (assigned_to = auth.uid());
CREATE POLICY "Users can update their safety tasks" ON public.safety_tasks FOR UPDATE USING (assigned_to = auth.uid());

-- Employee hazard reporting
CREATE POLICY "Employees can report hazards" ON public.hazard_reports FOR INSERT WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Employees can view hazards they reported" ON public.hazard_reports FOR SELECT USING (reported_by = auth.uid());
CREATE POLICY "Employees can report incidents" ON public.incidents FOR INSERT WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Employees can view their incidents" ON public.incidents FOR SELECT USING (reported_by = auth.uid());
CREATE POLICY "Employees can view assigned risk_assessments" ON public.risk_assessments FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND responsible_person_id = auth.uid()
);

-- ========================================
-- ADDITIONAL HR/MANAGER POLICIES
-- ========================================
-- Contract approvals
CREATE POLICY "HR can manage contract approvals in their scope" ON public.contract_approvals FOR ALL USING (
  has_role(auth.uid(), 'hr') AND employee_id IN (
    SELECT e.id FROM employees e WHERE (
      (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
      OR e.organization_id = (SELECT organization_id FROM get_my_profile_data())
      OR e.branch_id = (SELECT branch_id FROM get_my_profile_data())
    )
  )
) WITH CHECK (
  has_role(auth.uid(), 'hr') AND employee_id IN (
    SELECT e.id FROM employees e WHERE (
      (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
      OR e.organization_id = (SELECT organization_id FROM get_my_profile_data())
      OR e.branch_id = (SELECT branch_id FROM get_my_profile_data())
    )
  )
);

CREATE POLICY "Managers can manage contract approvals in their branch" ON public.contract_approvals FOR ALL USING (
  has_role(auth.uid(), 'manager') AND employee_id IN (
    SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
) WITH CHECK (
  has_role(auth.uid(), 'manager') AND employee_id IN (
    SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Employee onboarding
CREATE POLICY "HR can manage employee_onboarding in their scope" ON public.employee_onboarding FOR ALL USING (
  has_role(auth.uid(), 'hr') AND employee_id IN (
    SELECT e.id FROM employees e WHERE (
      (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
      OR e.organization_id = (SELECT organization_id FROM get_my_profile_data())
      OR e.branch_id = (SELECT branch_id FROM get_my_profile_data())
    )
  )
);

CREATE POLICY "Managers can manage employee_onboarding in their branch" ON public.employee_onboarding FOR ALL USING (
  has_role(auth.uid(), 'manager') AND employee_id IN (
    SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Daily reports and maintenance
CREATE POLICY "Managers and HR can create maintenance tickets" ON public.maintenance_tickets FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr')) AND reported_by = auth.uid()
);

CREATE POLICY "Managers and HR can view their own maintenance tickets" ON public.maintenance_tickets FOR SELECT USING (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr')) AND reported_by = auth.uid()
);

CREATE POLICY "Managers and HR can create daily reports" ON public.daily_reports FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr')) AND submitted_by = auth.uid()
);

CREATE POLICY "Managers and HR can view their own daily reports" ON public.daily_reports FOR SELECT USING (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr')) AND submitted_by = auth.uid()
);

-- Rotas and shifts
CREATE POLICY "HR can manage rotas in their scope" ON public.rotas FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage rotas in their branch" ON public.rotas FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "Employees can view rotas in their branch" ON public.rotas FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can manage rota_shifts in their scope" ON public.rota_shifts FOR ALL USING (
  has_role(auth.uid(), 'hr') AND rota_id IN (
    SELECT id FROM rotas WHERE 
      (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
      OR organization_id = (SELECT organization_id FROM get_my_profile_data())
      OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage rota_shifts in their branch" ON public.rota_shifts FOR ALL USING (
  has_role(auth.uid(), 'manager') AND rota_id IN (
    SELECT id FROM rotas WHERE branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Leave management
CREATE POLICY "HR can view leave_settings in their scope" ON public.leave_settings FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
  )
);

CREATE POLICY "HR can manage mandatory_leave in their scope" ON public.mandatory_leave FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Users can view mandatory_leave in their scope" ON public.mandatory_leave FOR SELECT USING (
  (has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data()))
  OR (has_role(auth.uid(), 'employee') AND branch_id = (SELECT branch_id FROM get_my_profile_data()))
);

CREATE POLICY "HR can manage rota_settings in their scope" ON public.rota_settings FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
);

CREATE POLICY "Users can view rota_settings" ON public.rota_settings FOR SELECT USING (
  has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager')
);

-- Salary and leave
CREATE POLICY "HR can manage salary_structures in their scope" ON public.salary_structures FOR ALL USING (
  has_role(auth.uid(), 'hr') AND employee_id IN (
    SELECT e.id FROM employees e WHERE (
      (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
      OR e.organization_id = (SELECT organization_id FROM get_my_profile_data())
      OR e.branch_id = (SELECT branch_id FROM get_my_profile_data())
    )
  )
);

CREATE POLICY "Employees can view their own payroll_records" ON public.payroll_records FOR SELECT USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "HR can manage leave_requests in their scope" ON public.leave_requests FOR ALL USING (
  has_role(auth.uid(), 'hr') AND employee_id IN (
    SELECT e.id FROM employees e WHERE (
      (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
      OR e.organization_id = (SELECT organization_id FROM get_my_profile_data())
      OR e.branch_id = (SELECT branch_id FROM get_my_profile_data())
    )
  )
);

CREATE POLICY "Managers can manage leave_requests in their branch" ON public.leave_requests FOR ALL USING (
  has_role(auth.uid(), 'manager') AND employee_id IN (
    SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Safety policies
CREATE POLICY "HR can manage risk_assessments in their scope" ON public.risk_assessments FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage risk_assessments in their branch" ON public.risk_assessments FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can manage incidents in their scope" ON public.incidents FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage incidents in their branch" ON public.incidents FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can manage hazard_reports in their scope" ON public.hazard_reports FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage hazard_reports in their branch" ON public.hazard_reports FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can manage coshh_assessments in their scope" ON public.coshh_assessments FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage coshh_assessments in their branch" ON public.coshh_assessments FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can manage method_statements in their scope" ON public.method_statements FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage method_statements in their branch" ON public.method_statements FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

CREATE POLICY "HR can manage safety_tasks in their scope" ON public.safety_tasks FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
) WITH CHECK (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can manage safety_tasks in their branch" ON public.safety_tasks FOR ALL USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
) WITH CHECK (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Financial reports
CREATE POLICY "HR can manage financial_reports in their scope" ON public.financial_reports FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can view financial_reports in their branch" ON public.financial_reports FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Bulk uploads
CREATE POLICY "HR can manage bulk uploads in their scope" ON public.bulk_uploads FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM get_my_profile_data())
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Onboarding settings
CREATE POLICY "HR can view onboarding_custom_pages" ON public.onboarding_custom_pages FOR SELECT USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "HR can view onboarding_page_fields" ON public.onboarding_page_fields FOR SELECT USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "HR can view contract_templates" ON public.contract_templates FOR SELECT USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "HR can view contract_branding" ON public.contract_branding FOR SELECT USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "HR can view document_requirements" ON public.document_requirements FOR SELECT USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "HR can view onboarding_form_settings" ON public.onboarding_form_settings FOR SELECT USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "HR can manage onboarding_form_responses" ON public.onboarding_form_responses FOR ALL USING (has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

-- HR view locations
CREATE POLICY "HR can view locations in their scope" ON public.locations FOR SELECT USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full'
    OR branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
);

-- Employee trainings
CREATE POLICY "Employees can view trainings assigned to them" ON public.trainings FOR SELECT USING (
  has_role(auth.uid(), 'employee') AND assigned_to = auth.uid()
);

-- Template system policies
CREATE POLICY "HR can manage template_folders in their scope" ON public.template_folders FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    organization_id = (SELECT organization_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can view template_folders" ON public.template_folders FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "HR can manage templates in their scope" ON public.templates FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    organization_id = (SELECT organization_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can view templates" ON public.templates FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "HR can manage brand_settings in their scope" ON public.brand_settings FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    organization_id = (SELECT organization_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can view brand_settings" ON public.brand_settings FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "HR can manage gift_cards in their scope" ON public.gift_cards FOR ALL USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    organization_id = (SELECT organization_id FROM get_my_profile_data())
  )
);

CREATE POLICY "Managers can view gift_cards" ON public.gift_cards FOR SELECT USING (has_role(auth.uid(), 'manager'));

-- ========================================
-- TRIGGERS
-- ========================================
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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
CREATE TRIGGER update_performance_criteria_updated_at BEFORE UPDATE ON public.performance_criteria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_performance_reviews_updated_at BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hazard_reports_updated_at BEFORE UPDATE ON public.hazard_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_assessments_updated_at BEFORE UPDATE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coshh_assessments_updated_at BEFORE UPDATE ON public.coshh_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_method_statements_updated_at BEFORE UPDATE ON public.method_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_safety_tasks_updated_at BEFORE UPDATE ON public.safety_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_financial_reports_updated_at BEFORE UPDATE ON public.financial_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bulk_uploads_updated_at BEFORE UPDATE ON public.bulk_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_custom_pages_updated_at BEFORE UPDATE ON public.onboarding_custom_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_page_fields_updated_at BEFORE UPDATE ON public.onboarding_page_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_branding_updated_at BEFORE UPDATE ON public.contract_branding FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_requirements_updated_at BEFORE UPDATE ON public.document_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_form_settings_updated_at BEFORE UPDATE ON public.onboarding_form_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_form_responses_updated_at BEFORE UPDATE ON public.onboarding_form_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_template_folders_updated_at BEFORE UPDATE ON public.template_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brand_settings_updated_at BEFORE UPDATE ON public.brand_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FOLDER MANAGEMENT FUNCTIONS & TRIGGERS
-- ========================================
-- Prevent system folder deletion
CREATE OR REPLACE FUNCTION public.prevent_system_folder_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deletable = false THEN
    RAISE EXCEPTION 'Cannot delete protected system folder';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER prevent_system_folder_delete
BEFORE DELETE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_system_folder_deletion();

-- Auto-create organization folder
CREATE OR REPLACE FUNCTION public.create_organization_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  root_folder_id UUID;
BEGIN
  IF NEW.auto_create_folder = true THEN
    SELECT id INTO root_folder_id FROM public.folders 
    WHERE path = 'Company Documents' AND folder_type = 'root' LIMIT 1;
    
    INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, created_by, is_deletable)
    VALUES (NEW.name, root_folder_id, 'organization', 'Company Documents/' || NEW.name, NEW.id, NEW.created_by, false);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER create_organization_folder_trigger
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.create_organization_folder();

-- Auto-create branch folder
CREATE OR REPLACE FUNCTION public.create_branch_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_folder_id UUID;
  org_name TEXT;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
  SELECT id INTO org_folder_id FROM public.folders WHERE organization_id = NEW.organization_id AND folder_type = 'organization' LIMIT 1;
  
  INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, created_by, is_deletable)
  VALUES (NEW.name, org_folder_id, 'branch', 'Company Documents/' || org_name || '/' || NEW.name, NEW.organization_id, NEW.id, NEW.created_by, false);
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER create_branch_folder_trigger
AFTER INSERT ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.create_branch_folder();

-- Auto-create employee folder
CREATE OR REPLACE FUNCTION public.create_employee_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  branch_folder_id UUID;
  org_name TEXT;
  branch_name TEXT;
BEGIN
  SELECT o.name, b.name INTO org_name, branch_name 
  FROM public.organizations o
  JOIN public.branches b ON b.organization_id = o.id
  WHERE b.id = NEW.branch_id;
  
  SELECT id INTO branch_folder_id FROM public.folders 
  WHERE branch_id = NEW.branch_id AND folder_type = 'branch' LIMIT 1;
  
  INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, employee_id, created_by)
  VALUES (
    NEW.first_name || ' ' || NEW.last_name, 
    branch_folder_id, 
    'employee', 
    'Company Documents/' || org_name || '/' || branch_name || '/' || NEW.first_name || ' ' || NEW.last_name,
    NEW.organization_id, 
    NEW.branch_id, 
    NEW.id, 
    NEW.created_by
  );
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER create_employee_folder_trigger
AFTER INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.create_employee_folder();

-- ========================================
-- STORAGE BUCKETS
-- ========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('training-documents', 'training-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('template-assets', 'template-assets', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Super admins can manage all documents" ON storage.objects FOR ALL USING (bucket_id = 'documents' AND has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR can manage documents in their scope" ON storage.objects FOR ALL USING (bucket_id = 'documents' AND has_role(auth.uid(), 'hr'));
CREATE POLICY "Managers can upload documents for their branch" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can view documents in their branch" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND has_role(auth.uid(), 'manager'));
CREATE POLICY "Employees can view their own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND has_role(auth.uid(), 'employee') AND
  (storage.foldername(name))[1] = 'employees' AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Storage policies for template-assets bucket
CREATE POLICY "Authenticated users can view template assets" ON storage.objects FOR SELECT USING (bucket_id = 'template-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Super admins can manage template assets" ON storage.objects FOR ALL USING (bucket_id = 'template-assets' AND has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR can manage template assets" ON storage.objects FOR ALL USING (bucket_id = 'template-assets' AND has_role(auth.uid(), 'hr'));

-- ========================================
-- DEFAULT DATA
-- ========================================
-- Create root folder
INSERT INTO public.folders (name, path, folder_type, is_system, is_deletable, access_level)
VALUES ('Company Documents', 'Company Documents', 'root', true, false, 'admin')
ON CONFLICT DO NOTHING;

-- Create safety documents root folder
INSERT INTO public.folders (name, path, folder_type, is_deletable, is_system, show_in_safety)
VALUES ('Safety Documents', 'Safety Documents', 'root', false, true, true)
ON CONFLICT DO NOTHING;

-- Insert default Right to Work document requirement
INSERT INTO public.document_requirements (name, description, is_mandatory, is_locked, enabled, doc_order)
VALUES ('Right to Work', 'Mandatory right to work documentation', true, true, true, 1)
ON CONFLICT DO NOTHING;