-- Add RLS policies for HR and Manager to access contract_approvals

-- HR can view and create contract approvals within their scope
CREATE POLICY "HR can manage contract approvals in their scope"
ON public.contract_approvals
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) AND
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE (
      (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
      OR e.organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
      OR e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'hr'::app_role) AND
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE (
      (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
      OR e.organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
      OR e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
);

-- Manager can view and create contract approvals in their branch
CREATE POLICY "Managers can manage contract approvals in their branch"
ON public.contract_approvals
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) AND
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

-- Also add policies for employee_onboarding for HR and Manager
CREATE POLICY "HR can manage employee_onboarding in their scope"
ON public.employee_onboarding
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) AND
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE (
      (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
      OR e.organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
      OR e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage employee_onboarding in their branch"
ON public.employee_onboarding
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);