-- Update the handle_new_user function to default to super_admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role app_role;
BEGIN
  -- Create profile with optional organization/branch from metadata
  INSERT INTO public.profiles (id, email, name, organization_id, branch_id, hr_access_level)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NULLIF(NEW.raw_user_meta_data ->> 'organization_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data ->> 'branch_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data ->> 'hr_access_level', '')::hr_access_level
  );
  
  -- Get role from metadata, default to 'super_admin' for users created directly in Supabase
  _role := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'role', '')::app_role,
    'super_admin'::app_role
  );
  
  -- Assign the role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$$;