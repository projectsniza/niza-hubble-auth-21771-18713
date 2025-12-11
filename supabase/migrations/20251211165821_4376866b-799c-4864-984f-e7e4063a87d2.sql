-- Add column to folders table to mark folders that should appear in Niza Safe
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS show_in_safety boolean DEFAULT false;

-- Create a safety documents root folder using 'root' type
INSERT INTO public.folders (name, path, folder_type, is_deletable, is_system, show_in_safety)
VALUES ('Safety Documents', 'Safety Documents', 'root', false, true, true)
ON CONFLICT DO NOTHING;