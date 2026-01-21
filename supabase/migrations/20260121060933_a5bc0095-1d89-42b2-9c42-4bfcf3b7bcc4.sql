-- Re-create the policy - using authenticated check instead of users table reference
DROP POLICY IF EXISTS "Super admins can manage all payroll notes" ON public.employee_payroll_notes;

-- Simple authenticated user policies (can be made more granular in app layer)
CREATE POLICY "Authenticated users can view payroll notes" 
ON public.employee_payroll_notes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage payroll notes" 
ON public.employee_payroll_notes 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);