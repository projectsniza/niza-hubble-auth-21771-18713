-- Add only missing RLS policies

-- HR can manage salary_structures in their scope
CREATE POLICY "HR can manage salary_structures in their scope"
ON public.salary_structures
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND employee_id IN (
    SELECT e.id FROM employees e
    WHERE (
      (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
      OR e.organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
      OR e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
);

-- Employees can view their own payroll_records
CREATE POLICY "Employees can view their own payroll_records"
ON public.payroll_records
FOR SELECT
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- HR can manage leave_requests in their scope
CREATE POLICY "HR can manage leave_requests in their scope"
ON public.leave_requests
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND employee_id IN (
    SELECT e.id FROM employees e
    WHERE (
      (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
      OR e.organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
      OR e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
);

-- Managers can manage leave_requests in their branch
CREATE POLICY "Managers can manage leave_requests in their branch"
ON public.leave_requests
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND employee_id IN (
    SELECT e.id FROM employees e
    WHERE e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

-- HR can manage documents in their scope
CREATE POLICY "HR can manage documents in their scope"
ON public.documents
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role)
);

-- Managers can manage documents in their branch
CREATE POLICY "Managers can manage documents in their branch"
ON public.documents
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND (
    employee_id IN (
      SELECT e.id FROM employees e
      WHERE e.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
    OR folder_id IN (
      SELECT f.id FROM folders f
      WHERE f.branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
    )
  )
);

-- HR can manage folders in their scope
CREATE POLICY "HR can manage folders in their scope"
ON public.folders
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role)
);

-- Managers can manage folders in their branch
CREATE POLICY "Managers can manage folders in their branch"
ON public.folders
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Employees can view folders they have access to
CREATE POLICY "Employees can view folders they have access to"
ON public.folders
FOR SELECT
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND (
    access_level = 'public'
    OR employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);