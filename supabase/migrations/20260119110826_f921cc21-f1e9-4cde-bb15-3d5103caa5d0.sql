-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Super admins can manage departments" ON public.departments;

-- Create proper RLS policies for departments
CREATE POLICY "Anyone can view active departments"
ON public.departments
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can insert departments"
ON public.departments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update departments"
ON public.departments
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete departments"
ON public.departments
FOR DELETE
TO authenticated
USING (true);