-- Drop and recreate super_admin policy with WITH CHECK
DROP POLICY IF EXISTS "Super admins have full access to trainings" ON public.trainings;

CREATE POLICY "Super admins have full access to trainings"
ON public.trainings
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Fix HR policy too
DROP POLICY IF EXISTS "HR can manage trainings" ON public.trainings;

CREATE POLICY "HR can manage trainings"
ON public.trainings
FOR ALL
USING (public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'hr'));