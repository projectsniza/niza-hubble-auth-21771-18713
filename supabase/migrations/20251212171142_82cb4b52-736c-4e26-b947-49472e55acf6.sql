-- Add RLS policies for safety_tasks for HR and Manager roles
CREATE POLICY "HR can manage safety_tasks in their scope" 
ON public.safety_tasks 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
    OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'hr'::app_role) 
  AND (
    (SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level
    OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

CREATE POLICY "Managers can manage safety_tasks in their branch" 
ON public.safety_tasks 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
);

-- Allow employees to view risk assessments assigned to them
CREATE POLICY "Employees can view assigned risk_assessments" 
ON public.risk_assessments 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND responsible_person_id = auth.uid()
);

-- Allow employees to report incidents (near misses)
CREATE POLICY "Employees can report incidents" 
ON public.incidents 
FOR INSERT 
TO authenticated
WITH CHECK (
  reported_by = auth.uid()
);

-- Allow employees to view incidents they reported
CREATE POLICY "Employees can view their incidents" 
ON public.incidents 
FOR SELECT 
TO authenticated
USING (
  reported_by = auth.uid()
);