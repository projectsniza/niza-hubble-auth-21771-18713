-- Fix leave_requests policy for employees - need WITH CHECK for INSERT
DROP POLICY IF EXISTS "Employees can manage their leave requests" ON public.leave_requests;

-- Employees can view their own leave requests
CREATE POLICY "Employees can view their leave requests"
ON public.leave_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT employees.id FROM employees WHERE employees.user_id = auth.uid()
  )
);

-- Employees can insert their own leave requests
CREATE POLICY "Employees can create their leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT employees.id FROM employees WHERE employees.user_id = auth.uid()
  )
);

-- Employees can update their pending leave requests (e.g., cancel)
CREATE POLICY "Employees can update their pending leave requests"
ON public.leave_requests
FOR UPDATE
USING (
  employee_id IN (
    SELECT employees.id FROM employees WHERE employees.user_id = auth.uid()
  )
  AND status = 'pending'
);