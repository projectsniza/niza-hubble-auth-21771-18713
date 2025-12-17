-- Drop the existing foreign key constraint and recreate with CASCADE
ALTER TABLE public.rota_shifts 
DROP CONSTRAINT IF EXISTS rota_shifts_employee_id_fkey;

ALTER TABLE public.rota_shifts 
ADD CONSTRAINT rota_shifts_employee_id_fkey 
FOREIGN KEY (employee_id) 
REFERENCES public.employees(id) 
ON DELETE CASCADE;

-- Add RLS policy to allow HR and Super Admin to delete events
CREATE POLICY "HR can manage events in their scope" 
ON public.events 
FOR ALL 
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    (SELECT get_my_profile_data.hr_access_level FROM get_my_profile_data()) = 'full' OR
    organization_id = (SELECT get_my_profile_data.organization_id FROM get_my_profile_data()) OR
    branch_id = (SELECT get_my_profile_data.branch_id FROM get_my_profile_data())
  )
);