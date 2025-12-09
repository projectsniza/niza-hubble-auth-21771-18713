-- Fix foreign key constraint to cascade delete employee folders when employee is deleted
ALTER TABLE public.folders 
DROP CONSTRAINT IF EXISTS folders_employee_id_fkey;

ALTER TABLE public.folders 
ADD CONSTRAINT folders_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;

-- Also add cascade delete for other employee-related tables
ALTER TABLE public.employee_onboarding 
DROP CONSTRAINT IF EXISTS employee_onboarding_employee_id_fkey;

ALTER TABLE public.employee_onboarding 
ADD CONSTRAINT employee_onboarding_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;

ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_employee_id_fkey;

ALTER TABLE public.documents 
ADD CONSTRAINT documents_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;

ALTER TABLE public.contract_approvals 
DROP CONSTRAINT IF EXISTS contract_approvals_employee_id_fkey;

ALTER TABLE public.contract_approvals 
ADD CONSTRAINT contract_approvals_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;

ALTER TABLE public.right_to_work_checks 
DROP CONSTRAINT IF EXISTS right_to_work_checks_employee_id_fkey;

ALTER TABLE public.right_to_work_checks 
ADD CONSTRAINT right_to_work_checks_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;