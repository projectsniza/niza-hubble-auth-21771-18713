-- Create the Company Documents root folder
INSERT INTO public.folders (name, path, folder_type, is_system, is_deletable, access_level)
VALUES ('Company Documents', 'Company Documents', 'root', true, false, 'admin')
ON CONFLICT DO NOTHING;

-- Create trigger function to prevent deletion of protected folders
CREATE OR REPLACE FUNCTION public.prevent_system_folder_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deletable = false THEN
    RAISE EXCEPTION 'Cannot delete protected system folder';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_system_folder_delete ON public.folders;
CREATE TRIGGER prevent_system_folder_delete
BEFORE DELETE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_system_folder_deletion();

-- Update create_organization_folder to use Company Documents as parent
CREATE OR REPLACE FUNCTION public.create_organization_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  root_folder_id UUID;
BEGIN
  IF NEW.auto_create_folder = true THEN
    SELECT id INTO root_folder_id FROM public.folders 
    WHERE path = 'Company Documents' AND folder_type = 'root' LIMIT 1;
    
    INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, created_by, is_deletable)
    VALUES (NEW.name, root_folder_id, 'organization', 'Company Documents/' || NEW.name, NEW.id, NEW.created_by, false);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update create_branch_folder to mark as non-deletable
CREATE OR REPLACE FUNCTION public.create_branch_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_folder_id UUID;
  org_name TEXT;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
  SELECT id INTO org_folder_id FROM public.folders WHERE organization_id = NEW.organization_id AND folder_type = 'organization' LIMIT 1;
  
  INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, created_by, is_deletable)
  VALUES (NEW.name, org_folder_id, 'branch', 'Company Documents/' || org_name || '/' || NEW.name, NEW.organization_id, NEW.id, NEW.created_by, false);
  
  RETURN NEW;
END;
$function$;

-- Mark existing organization and branch folders as non-deletable
UPDATE public.folders SET is_deletable = false WHERE folder_type IN ('organization', 'branch');

-- Update existing org folders to have Company Documents as parent
DO $$
DECLARE
  root_id UUID;
BEGIN
  SELECT id INTO root_id FROM public.folders WHERE path = 'Company Documents' AND folder_type = 'root' LIMIT 1;
  
  IF root_id IS NOT NULL THEN
    UPDATE public.folders 
    SET parent_id = root_id 
    WHERE folder_type = 'organization' AND parent_id IS NULL;
  END IF;
END $$;