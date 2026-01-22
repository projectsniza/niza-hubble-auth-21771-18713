-- Add RLS policy for employees to view their own performance reviews
CREATE POLICY "Employees can view their own performance reviews"
ON public.performance_reviews
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND employee_id IN (
    SELECT e.id FROM employees e WHERE e.user_id = auth.uid()
  )
);

-- Add DELETE policy for super_admin and HR on performance_criteria
CREATE POLICY "Super admins can delete performance criteria"
ON public.performance_criteria
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can delete performance criteria"
ON public.performance_criteria
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role));