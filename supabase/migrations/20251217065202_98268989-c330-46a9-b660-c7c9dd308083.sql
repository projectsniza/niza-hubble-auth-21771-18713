-- Allow super_admin to delete from user_roles
DROP POLICY IF EXISTS "Super admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Super admins can delete user_roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));