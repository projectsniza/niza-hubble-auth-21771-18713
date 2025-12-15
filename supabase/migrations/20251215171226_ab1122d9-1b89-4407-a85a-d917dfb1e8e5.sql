-- =====================================================
-- UK COMPLIANCE FEATURES - DATABASE SCHEMA
-- =====================================================

-- 1. GDPR MODULE TABLES
-- =====================================================

-- Data retention policies
CREATE TABLE public.gdpr_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  data_category TEXT NOT NULL, -- 'employee_records', 'payroll', 'recruitment', etc.
  retention_period_months INTEGER NOT NULL DEFAULT 84, -- UK default 7 years
  legal_basis TEXT, -- 'legal_obligation', 'legitimate_interest', 'consent'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Consent records
CREATE TABLE public.gdpr_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'marketing', 'data_sharing', 'photo_usage', etc.
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date TIMESTAMPTZ,
  withdrawal_date TIMESTAMPTZ,
  ip_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Data subject requests (right to erasure, access, etc.)
CREATE TABLE public.gdpr_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  employee_id UUID REFERENCES public.employees(id),
  request_type TEXT NOT NULL, -- 'access', 'erasure', 'rectification', 'portability'
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'rejected'
  due_date DATE, -- Must be completed within 30 days
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. UK PAYROLL TABLES
-- =====================================================

-- UK Tax codes
CREATE TABLE public.uk_tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  tax_code TEXT NOT NULL DEFAULT '1257L', -- Current UK personal allowance code
  tax_code_basis TEXT DEFAULT 'cumulative', -- 'cumulative' or 'week1_month1'
  ni_category TEXT DEFAULT 'A', -- NI category letter
  student_loan_plan TEXT, -- 'plan1', 'plan2', 'plan4', 'postgrad', null
  is_director BOOLEAN DEFAULT false,
  director_ni_method TEXT, -- 'annual' or 'alternative'
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  p45_received BOOLEAN DEFAULT false,
  starter_declaration TEXT, -- 'A', 'B', 'C' (new employee declaration)
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pension settings (auto-enrolment)
CREATE TABLE public.uk_pension_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) UNIQUE,
  pension_provider TEXT,
  employer_contribution_percent NUMERIC(5,2) DEFAULT 3.00, -- UK minimum
  employee_contribution_percent NUMERIC(5,2) DEFAULT 5.00, -- UK minimum
  qualifying_earnings_lower NUMERIC(10,2) DEFAULT 6240, -- 2024/25 threshold
  qualifying_earnings_upper NUMERIC(10,2) DEFAULT 50270,
  auto_enrolment_enabled BOOLEAN DEFAULT true,
  postponement_period_months INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Employee pension enrolment
CREATE TABLE public.uk_employee_pension (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  enrolled BOOLEAN DEFAULT false,
  enrolment_date DATE,
  opt_out_date DATE,
  opt_out_reason TEXT,
  contribution_percent_override NUMERIC(5,2), -- If different from org default
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- UK Tax bands (reference table - updated annually)
CREATE TABLE public.uk_tax_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year TEXT NOT NULL, -- '2024-25'
  band_name TEXT NOT NULL, -- 'personal_allowance', 'basic', 'higher', 'additional'
  lower_limit NUMERIC(12,2) NOT NULL,
  upper_limit NUMERIC(12,2), -- null for top band
  rate_percent NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert current UK tax bands (2024-25)
INSERT INTO public.uk_tax_bands (tax_year, band_name, lower_limit, upper_limit, rate_percent) VALUES
  ('2024-25', 'personal_allowance', 0, 12570, 0),
  ('2024-25', 'basic', 12571, 50270, 20),
  ('2024-25', 'higher', 50271, 125140, 40),
  ('2024-25', 'additional', 125141, NULL, 45);

-- UK NI bands (reference table)
CREATE TABLE public.uk_ni_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year TEXT NOT NULL,
  ni_category TEXT NOT NULL DEFAULT 'A',
  band_name TEXT NOT NULL, -- 'LEL', 'PT', 'ST', 'UEL'
  weekly_threshold NUMERIC(10,2) NOT NULL,
  employee_rate_percent NUMERIC(5,2) NOT NULL,
  employer_rate_percent NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert current UK NI bands (2024-25, Category A)
INSERT INTO public.uk_ni_bands (tax_year, ni_category, band_name, weekly_threshold, employee_rate_percent, employer_rate_percent) VALUES
  ('2024-25', 'A', 'LEL', 123, 0, 0),
  ('2024-25', 'A', 'PT', 242, 0, 0),
  ('2024-25', 'A', 'ST', 175, 0, 13.8),
  ('2024-25', 'A', 'UEL', 967, 8, 13.8);

-- 3. STATUTORY LEAVE TABLES
-- =====================================================

-- Statutory leave entitlements
CREATE TABLE public.statutory_leave_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL, -- 'maternity', 'paternity', 'adoption', 'shared_parental', 'bereavement'
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  weeks_entitled INTEGER,
  weeks_taken INTEGER DEFAULT 0,
  pay_type TEXT, -- 'statutory', 'enhanced', 'unpaid'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'active', 'completed', 'cancelled'
  baby_due_date DATE,
  baby_birth_date DATE,
  kit_days_used INTEGER DEFAULT 0, -- Keeping In Touch days
  split_days_used INTEGER DEFAULT 0, -- Shared Parental In Touch days
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Statutory Sick Pay (SSP) records
CREATE TABLE public.ssp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_start_date DATE NOT NULL,
  absence_end_date DATE,
  waiting_days INTEGER DEFAULT 0, -- First 3 days are waiting days
  qualifying_days INTEGER DEFAULT 0,
  days_paid INTEGER DEFAULT 0,
  weekly_rate NUMERIC(10,2) DEFAULT 116.75, -- 2024/25 SSP rate
  total_ssp_paid NUMERIC(10,2) DEFAULT 0,
  fit_note_received BOOLEAN DEFAULT false,
  fit_note_path TEXT,
  linked_period BOOLEAN DEFAULT false, -- If within 8 weeks of previous absence
  previous_ssp_id UUID REFERENCES public.ssp_records(id),
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'excluded'
  exclusion_reason TEXT, -- If employee doesn't qualify for SSP
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BRADFORD FACTOR TABLE
-- =====================================================

-- Absence records for Bradford calculation
CREATE TABLE public.absence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type TEXT NOT NULL, -- 'sickness', 'unauthorised', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  is_ssp_applicable BOOLEAN DEFAULT false,
  ssp_record_id UUID REFERENCES public.ssp_records(id),
  return_to_work_completed BOOLEAN DEFAULT false,
  return_to_work_date DATE,
  return_to_work_by UUID,
  reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bradford Factor thresholds
CREATE TABLE public.bradford_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  threshold_score INTEGER NOT NULL,
  action_required TEXT NOT NULL, -- 'informal_discussion', 'verbal_warning', 'written_warning', 'final_warning', 'dismissal'
  description TEXT,
  color TEXT DEFAULT '#EF4444', -- For UI display
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default Bradford thresholds
INSERT INTO public.bradford_thresholds (organization_id, threshold_score, action_required, description, color) VALUES
  (NULL, 50, 'informal_discussion', 'Manager should have informal conversation about attendance', '#FCD34D'),
  (NULL, 150, 'verbal_warning', 'Issue verbal warning and set improvement targets', '#F97316'),
  (NULL, 400, 'written_warning', 'Issue written warning with formal improvement plan', '#EF4444'),
  (NULL, 600, 'final_warning', 'Issue final written warning', '#DC2626'),
  (NULL, 900, 'dismissal', 'Consider dismissal proceedings', '#7F1D1D');

-- =====================================================
-- ENABLE RLS ON ALL NEW TABLES
-- =====================================================

ALTER TABLE public.gdpr_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uk_tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uk_pension_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uk_employee_pension ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uk_tax_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uk_ni_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bradford_thresholds ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Super admin full access to all tables
CREATE POLICY "Super admins have full access to gdpr_retention_policies" ON public.gdpr_retention_policies FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to gdpr_consent_records" ON public.gdpr_consent_records FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to gdpr_data_requests" ON public.gdpr_data_requests FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to uk_tax_codes" ON public.uk_tax_codes FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to uk_pension_settings" ON public.uk_pension_settings FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to uk_employee_pension" ON public.uk_employee_pension FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to uk_tax_bands" ON public.uk_tax_bands FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to uk_ni_bands" ON public.uk_ni_bands FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to statutory_leave_entitlements" ON public.statutory_leave_entitlements FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to ssp_records" ON public.ssp_records FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to absence_records" ON public.absence_records FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins have full access to bradford_thresholds" ON public.bradford_thresholds FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- HR access policies
CREATE POLICY "HR can manage gdpr_retention_policies in their scope" ON public.gdpr_retention_policies FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "HR can manage gdpr_consent_records in their scope" ON public.gdpr_consent_records FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  employee_id IN (
    SELECT e.id FROM employees e WHERE
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    e.organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
    e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
));

CREATE POLICY "HR can manage gdpr_data_requests in their scope" ON public.gdpr_data_requests FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "HR can manage uk_tax_codes in their scope" ON public.uk_tax_codes FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  employee_id IN (
    SELECT e.id FROM employees e WHERE
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    e.organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
    e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
));

CREATE POLICY "HR can manage uk_pension_settings in their scope" ON public.uk_pension_settings FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data())
));

CREATE POLICY "HR can manage uk_employee_pension in their scope" ON public.uk_employee_pension FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  employee_id IN (
    SELECT e.id FROM employees e WHERE
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    e.organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
    e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
));

CREATE POLICY "HR can manage statutory_leave_entitlements in their scope" ON public.statutory_leave_entitlements FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  employee_id IN (
    SELECT e.id FROM employees e WHERE
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    e.organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
    e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
));

CREATE POLICY "HR can manage ssp_records in their scope" ON public.ssp_records FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  employee_id IN (
    SELECT e.id FROM employees e WHERE
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    e.organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
    e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
));

CREATE POLICY "HR can manage absence_records in their scope" ON public.absence_records FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  employee_id IN (
    SELECT e.id FROM employees e WHERE
    (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
    e.organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
    e.branch_id = (SELECT branch_id FROM get_my_profile_data())
  )
));

CREATE POLICY "HR can manage bradford_thresholds in their scope" ON public.bradford_thresholds FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role) AND (
  (SELECT hr_access_level FROM get_my_profile_data()) = 'full' OR
  organization_id = (SELECT organization_id FROM get_my_profile_data()) OR
  organization_id IS NULL
));

-- Manager access policies
CREATE POLICY "Managers can manage uk_tax_codes in their branch" ON public.uk_tax_codes FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) AND (
  employee_id IN (SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data()))
));

CREATE POLICY "Managers can manage statutory_leave_entitlements in their branch" ON public.statutory_leave_entitlements FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) AND (
  employee_id IN (SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data()))
));

CREATE POLICY "Managers can manage ssp_records in their branch" ON public.ssp_records FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) AND (
  employee_id IN (SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data()))
));

CREATE POLICY "Managers can manage absence_records in their branch" ON public.absence_records FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role) AND (
  employee_id IN (SELECT e.id FROM employees e WHERE e.branch_id = (SELECT branch_id FROM get_my_profile_data()))
));

CREATE POLICY "Managers can view bradford_thresholds" ON public.bradford_thresholds FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

-- Employee view policies
CREATE POLICY "Employees can view their own consent records" ON public.gdpr_consent_records FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can view their own tax codes" ON public.uk_tax_codes FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can view their own pension" ON public.uk_employee_pension FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can view their own statutory leave" ON public.statutory_leave_entitlements FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can view their own ssp" ON public.ssp_records FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can view their own absence records" ON public.absence_records FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Public read access for reference tables
CREATE POLICY "Authenticated users can view uk_tax_bands" ON public.uk_tax_bands FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view uk_ni_bands" ON public.uk_ni_bands FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add triggers for updated_at
CREATE TRIGGER update_gdpr_retention_policies_updated_at BEFORE UPDATE ON public.gdpr_retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gdpr_consent_records_updated_at BEFORE UPDATE ON public.gdpr_consent_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gdpr_data_requests_updated_at BEFORE UPDATE ON public.gdpr_data_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_uk_tax_codes_updated_at BEFORE UPDATE ON public.uk_tax_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_uk_pension_settings_updated_at BEFORE UPDATE ON public.uk_pension_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_uk_employee_pension_updated_at BEFORE UPDATE ON public.uk_employee_pension FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_statutory_leave_entitlements_updated_at BEFORE UPDATE ON public.statutory_leave_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ssp_records_updated_at BEFORE UPDATE ON public.ssp_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_absence_records_updated_at BEFORE UPDATE ON public.absence_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bradford_thresholds_updated_at BEFORE UPDATE ON public.bradford_thresholds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();