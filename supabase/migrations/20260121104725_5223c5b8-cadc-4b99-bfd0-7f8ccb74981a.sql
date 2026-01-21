-- Fix departments RLS - allow super_admin to see ALL departments (including inactive ones) for management
DROP POLICY IF EXISTS "Anyone can view active departments" ON public.departments;

-- Create a more flexible SELECT policy
CREATE POLICY "Users can view departments" ON public.departments
FOR SELECT USING (
  -- Super admin can see all departments
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- Others can only see active departments
  is_active = true
);

-- Restrict INSERT to super_admin only
DROP POLICY IF EXISTS "Authenticated users can insert departments" ON public.departments;
CREATE POLICY "Super admin can insert departments" ON public.departments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Restrict UPDATE to super_admin only
DROP POLICY IF EXISTS "Authenticated users can update departments" ON public.departments;
CREATE POLICY "Super admin can update departments" ON public.departments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Restrict DELETE to super_admin only
DROP POLICY IF EXISTS "Authenticated users can delete departments" ON public.departments;
CREATE POLICY "Super admin can delete departments" ON public.departments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);