
-- =============================================
-- LEAVE MANAGEMENT SYSTEM
-- =============================================

-- Leave settings table (organization-level configuration)
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

-- Mandatory leave periods (shutdown periods, bank holidays)
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

-- Rota settings table (company-wide configuration)
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

-- Add status column to rota_shifts for accept/decline
ALTER TABLE public.rota_shifts ADD COLUMN IF NOT EXISTS employee_response TEXT DEFAULT 'pending';

-- Enable RLS
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_settings
CREATE POLICY "Super admins have full access to leave_settings"
ON public.leave_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can view leave_settings in their scope"
ON public.leave_settings FOR SELECT
USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
);

-- RLS Policies for mandatory_leave
CREATE POLICY "Super admins have full access to mandatory_leave"
ON public.mandatory_leave FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage mandatory_leave in their scope"
ON public.mandatory_leave FOR ALL
USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view mandatory_leave in their scope"
ON public.mandatory_leave FOR SELECT
USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  OR has_role(auth.uid(), 'employee') AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
);

-- RLS Policies for rota_settings
CREATE POLICY "Super admins have full access to rota_settings"
ON public.rota_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage rota_settings in their scope"
ON public.rota_settings FOR ALL
USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
  )
);

CREATE POLICY "Users can view rota_settings"
ON public.rota_settings FOR SELECT
USING (
  has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager')
);

-- Add RLS policy for leave_types to allow all authenticated users to view
CREATE POLICY "All authenticated users can view leave_types"
ON public.leave_types FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add HR/Manager policies for rotas
CREATE POLICY "HR can manage rotas in their scope"
ON public.rotas FOR ALL
USING (
  has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Managers can manage rotas in their branch"
ON public.rotas FOR ALL
USING (
  has_role(auth.uid(), 'manager') AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Employees can view rotas in their branch"
ON public.rotas FOR SELECT
USING (
  has_role(auth.uid(), 'employee') AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
);

-- Add RLS for rota_shifts
CREATE POLICY "HR can manage rota_shifts in their scope"
ON public.rota_shifts FOR ALL
USING (
  has_role(auth.uid(), 'hr') AND (
    rota_id IN (SELECT id FROM rotas WHERE 
      (SELECT hr_access_level FROM profiles WHERE id = auth.uid()) = 'full'
      OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage rota_shifts in their branch"
ON public.rota_shifts FOR ALL
USING (
  has_role(auth.uid(), 'manager') AND rota_id IN (
    SELECT id FROM rotas WHERE branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Employees can view their own shifts"
ON public.rota_shifts FOR SELECT
USING (
  has_role(auth.uid(), 'employee') AND employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);

-- Add policy for location deletion
CREATE POLICY "Super admins can delete locations"
ON public.locations FOR DELETE
USING (has_role(auth.uid(), 'super_admin'));
