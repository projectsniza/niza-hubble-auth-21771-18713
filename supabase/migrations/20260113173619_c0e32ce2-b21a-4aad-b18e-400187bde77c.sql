-- =============================================
-- TIMESHEET & HOLIDAY MANAGEMENT SYSTEM
-- Following UK Pro-rata Holiday Law
-- =============================================

-- Employee Contracts Table - Stores contract details for holiday calculation
CREATE TABLE public.employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'full-time' CHECK (contract_type IN ('full-time', 'part-time', 'zero-hours')),
  weekly_contracted_hours NUMERIC(5,2) NOT NULL DEFAULT 40,
  holiday_entitlement_days NUMERIC(4,1) NOT NULL DEFAULT 28, -- UK statutory minimum
  holiday_year_start DATE NOT NULL DEFAULT '2025-04-01', -- UK tax year
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, effective_from)
);

-- Timesheets Table - Weekly timesheet records
CREATE TABLE public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  week_start_date DATE NOT NULL, -- Always Monday
  week_end_date DATE NOT NULL,   -- Always Sunday
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  total_worked_hours NUMERIC(6,2) DEFAULT 0,
  total_holiday_hours NUMERIC(6,2) DEFAULT 0,
  total_sick_hours NUMERIC(6,2) DEFAULT 0,
  total_adjustment_hours NUMERIC(6,2) DEFAULT 0,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, week_start_date)
);

-- Timesheet Entries Table - Daily entries within a timesheet
CREATE TABLE public.timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  day_of_week TEXT NOT NULL, -- Monday, Tuesday, etc.
  shift_start_time TIME,
  shift_end_time TIME,
  break_duration_minutes INTEGER DEFAULT 0,
  actual_hours NUMERIC(5,2) DEFAULT 0,
  holiday_hours NUMERIC(5,2) DEFAULT 0,
  sick_hours NUMERIC(5,2) DEFAULT 0,
  adjustment_hours NUMERIC(5,2) DEFAULT 0,
  entry_type TEXT DEFAULT 'work' CHECK (entry_type IN ('work', 'holiday', 'sick', 'absence', 'bank_holiday')),
  notes TEXT,
  rota_shift_id UUID REFERENCES public.rota_shifts(id), -- Link to planned shift
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(timesheet_id, entry_date)
);

-- Holiday Balances Table - Tracks holiday accrual and usage
CREATE TABLE public.holiday_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  holiday_year_start DATE NOT NULL,
  holiday_year_end DATE NOT NULL,
  
  -- Contract info (cached for calculation)
  weekly_contracted_hours NUMERIC(5,2) NOT NULL,
  holiday_entitlement_days NUMERIC(4,1) NOT NULL,
  hours_per_day NUMERIC(5,2) GENERATED ALWAYS AS (weekly_contracted_hours / 5) STORED,
  total_holiday_hours_per_year NUMERIC(6,2) GENERATED ALWAYS AS ((weekly_contracted_hours / 5) * holiday_entitlement_days) STORED,
  
  -- Calculated from timesheets
  total_worked_hours NUMERIC(8,2) DEFAULT 0, -- Including holiday hours
  weeks_worked NUMERIC(6,2) DEFAULT 0,
  
  -- Pro-rata holiday calculation
  holiday_hours_earned NUMERIC(6,2) DEFAULT 0,
  holiday_hours_taken NUMERIC(6,2) DEFAULT 0,
  holiday_hours_remaining NUMERIC(6,2) DEFAULT 0,
  
  -- Carry forward from previous year
  carry_forward_hours NUMERIC(6,2) DEFAULT 0,
  
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, holiday_year_start)
);

-- Monthly Timesheet Summary - For payroll integration
CREATE TABLE public.timesheet_monthly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  total_worked_hours NUMERIC(8,2) DEFAULT 0,
  total_holiday_hours NUMERIC(6,2) DEFAULT 0,
  total_sick_hours NUMERIC(6,2) DEFAULT 0,
  total_adjustment_hours NUMERIC(6,2) DEFAULT 0,
  approved_timesheets_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, month_year)
);

-- Enable RLS
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_monthly_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_contracts
CREATE POLICY "Super admin full access to contracts"
ON public.employee_contracts FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage contracts in scope"
ON public.employee_contracts FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = employee_contracts.employee_id
    AND (p.hr_access_level = 'full' OR e.organization_id = p.organization_id)
  )
);

CREATE POLICY "Managers can view contracts in their branch"
ON public.employee_contracts FOR SELECT
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = employee_contracts.employee_id
    AND e.branch_id = p.branch_id
  )
);

CREATE POLICY "Employees can view their own contract"
ON public.employee_contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_contracts.employee_id
    AND e.user_id = auth.uid()
  )
);

-- RLS Policies for timesheets
CREATE POLICY "Super admin full access to timesheets"
ON public.timesheets FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage timesheets in scope"
ON public.timesheets FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.hr_access_level = 'full' OR timesheets.organization_id = p.organization_id)
  )
);

CREATE POLICY "Managers can manage timesheets in their branch"
ON public.timesheets FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND timesheets.branch_id = p.branch_id
  )
);

CREATE POLICY "Employees can view their own timesheets"
ON public.timesheets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = timesheets.employee_id
    AND e.user_id = auth.uid()
  )
);

-- RLS Policies for timesheet_entries
CREATE POLICY "Super admin full access to timesheet entries"
ON public.timesheet_entries FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage timesheet entries"
ON public.timesheet_entries FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.timesheets t
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE t.id = timesheet_entries.timesheet_id
    AND (p.hr_access_level = 'full' OR t.organization_id = p.organization_id)
  )
);

CREATE POLICY "Managers can manage timesheet entries in branch"
ON public.timesheet_entries FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.timesheets t
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE t.id = timesheet_entries.timesheet_id
    AND t.branch_id = p.branch_id
  )
);

CREATE POLICY "Employees can view their own timesheet entries"
ON public.timesheet_entries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.timesheets t
    JOIN public.employees e ON e.id = t.employee_id
    WHERE t.id = timesheet_entries.timesheet_id
    AND e.user_id = auth.uid()
  )
);

-- RLS Policies for holiday_balances
CREATE POLICY "Super admin full access to holiday balances"
ON public.holiday_balances FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage holiday balances"
ON public.holiday_balances FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = holiday_balances.employee_id
    AND (p.hr_access_level = 'full' OR e.organization_id = p.organization_id)
  )
);

CREATE POLICY "Managers can view holiday balances in branch"
ON public.holiday_balances FOR SELECT
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = holiday_balances.employee_id
    AND e.branch_id = p.branch_id
  )
);

CREATE POLICY "Employees can view their own holiday balance"
ON public.holiday_balances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = holiday_balances.employee_id
    AND e.user_id = auth.uid()
  )
);

-- RLS Policies for timesheet_monthly_summary
CREATE POLICY "Super admin full access to monthly summary"
ON public.timesheet_monthly_summary FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage monthly summary"
ON public.timesheet_monthly_summary FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = timesheet_monthly_summary.employee_id
    AND (p.hr_access_level = 'full' OR e.organization_id = p.organization_id)
  )
);

CREATE POLICY "Managers can view monthly summary in branch"
ON public.timesheet_monthly_summary FOR SELECT
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = timesheet_monthly_summary.employee_id
    AND e.branch_id = p.branch_id
  )
);

CREATE POLICY "Employees can view their own monthly summary"
ON public.timesheet_monthly_summary FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = timesheet_monthly_summary.employee_id
    AND e.user_id = auth.uid()
  )
);

-- Function to calculate holiday balance for an employee
CREATE OR REPLACE FUNCTION public.calculate_holiday_balance(
  p_employee_id UUID,
  p_holiday_year_start DATE DEFAULT '2025-04-01'::DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract RECORD;
  v_holiday_year_end DATE;
  v_total_worked_hours NUMERIC;
  v_total_holiday_hours NUMERIC;
  v_weeks_worked NUMERIC;
  v_hours_per_day NUMERIC;
  v_holiday_hours_per_year NUMERIC;
  v_holiday_earned NUMERIC;
BEGIN
  -- Get current contract
  SELECT * INTO v_contract
  FROM employee_contracts
  WHERE employee_id = p_employee_id
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_contract IS NULL THEN
    RETURN;
  END IF;
  
  v_holiday_year_end := p_holiday_year_start + INTERVAL '1 year' - INTERVAL '1 day';
  
  -- Calculate hours per day and annual entitlement
  v_hours_per_day := v_contract.weekly_contracted_hours / 5;
  v_holiday_hours_per_year := v_hours_per_day * v_contract.holiday_entitlement_days;
  
  -- Get totals from approved timesheets within holiday year
  SELECT 
    COALESCE(SUM(total_worked_hours + total_holiday_hours), 0),
    COALESCE(SUM(total_holiday_hours), 0)
  INTO v_total_worked_hours, v_total_holiday_hours
  FROM timesheets
  WHERE employee_id = p_employee_id
    AND week_start_date >= p_holiday_year_start
    AND week_end_date <= v_holiday_year_end
    AND status = 'approved';
  
  -- Calculate weeks worked
  v_weeks_worked := v_total_worked_hours / NULLIF(v_contract.weekly_contracted_hours, 0);
  
  -- Pro-rata holiday earned: (HolidayHoursPerYear / 52) × WeeksWorked
  v_holiday_earned := (v_holiday_hours_per_year / 52) * COALESCE(v_weeks_worked, 0);
  
  -- Upsert holiday balance
  INSERT INTO holiday_balances (
    employee_id,
    holiday_year_start,
    holiday_year_end,
    weekly_contracted_hours,
    holiday_entitlement_days,
    total_worked_hours,
    weeks_worked,
    holiday_hours_earned,
    holiday_hours_taken,
    holiday_hours_remaining,
    last_calculated_at
  )
  VALUES (
    p_employee_id,
    p_holiday_year_start,
    v_holiday_year_end,
    v_contract.weekly_contracted_hours,
    v_contract.holiday_entitlement_days,
    v_total_worked_hours,
    COALESCE(v_weeks_worked, 0),
    v_holiday_earned,
    v_total_holiday_hours,
    v_holiday_earned - v_total_holiday_hours,
    now()
  )
  ON CONFLICT (employee_id, holiday_year_start)
  DO UPDATE SET
    weekly_contracted_hours = EXCLUDED.weekly_contracted_hours,
    holiday_entitlement_days = EXCLUDED.holiday_entitlement_days,
    total_worked_hours = EXCLUDED.total_worked_hours,
    weeks_worked = EXCLUDED.weeks_worked,
    holiday_hours_earned = EXCLUDED.holiday_hours_earned,
    holiday_hours_taken = EXCLUDED.holiday_hours_taken,
    holiday_hours_remaining = EXCLUDED.holiday_hours_remaining,
    last_calculated_at = now(),
    updated_at = now();
END;
$$;

-- Function to update timesheet totals
CREATE OR REPLACE FUNCTION public.update_timesheet_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE timesheets t
  SET 
    total_worked_hours = (
      SELECT COALESCE(SUM(actual_hours), 0)
      FROM timesheet_entries
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    ),
    total_holiday_hours = (
      SELECT COALESCE(SUM(holiday_hours), 0)
      FROM timesheet_entries
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    ),
    total_sick_hours = (
      SELECT COALESCE(SUM(sick_hours), 0)
      FROM timesheet_entries
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    ),
    total_adjustment_hours = (
      SELECT COALESCE(SUM(adjustment_hours), 0)
      FROM timesheet_entries
      WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.timesheet_id, OLD.timesheet_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger for updating timesheet totals
CREATE TRIGGER update_timesheet_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_timesheet_totals();

-- Indexes for performance
CREATE INDEX idx_timesheets_employee_week ON public.timesheets(employee_id, week_start_date);
CREATE INDEX idx_timesheets_branch ON public.timesheets(branch_id);
CREATE INDEX idx_timesheets_status ON public.timesheets(status);
CREATE INDEX idx_timesheet_entries_date ON public.timesheet_entries(entry_date);
CREATE INDEX idx_holiday_balances_employee ON public.holiday_balances(employee_id);
CREATE INDEX idx_employee_contracts_employee ON public.employee_contracts(employee_id);