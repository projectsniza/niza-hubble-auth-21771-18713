-- Add custom_role_id column to profiles to track users created from custom roles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_custom_role_id ON public.profiles(custom_role_id);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.custom_role_id IS 'Links to the custom_role that this user account was created from';