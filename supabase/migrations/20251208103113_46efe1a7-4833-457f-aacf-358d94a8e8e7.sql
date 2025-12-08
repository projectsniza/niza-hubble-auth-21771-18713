-- Step 1: Add new columns to folders table
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deletable boolean DEFAULT true;

-- Step 2: Drop existing check constraint and add new one with 'root' type
ALTER TABLE public.folders DROP CONSTRAINT IF EXISTS folders_folder_type_check;
ALTER TABLE public.folders 
ADD CONSTRAINT folders_folder_type_check 
CHECK (folder_type IN ('general', 'organization', 'branch', 'employee', 'root'));