-- Create function to update organization folder when organization is renamed
CREATE OR REPLACE FUNCTION public.update_organization_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    -- Update organization folder name and path
    UPDATE public.folders 
    SET 
      name = NEW.name,
      path = 'Company Documents/' || NEW.name,
      updated_at = now()
    WHERE organization_id = NEW.id AND folder_type = 'organization';
    
    -- Update all branch folders paths under this organization
    UPDATE public.folders 
    SET 
      path = 'Company Documents/' || NEW.name || '/' || name,
      updated_at = now()
    WHERE organization_id = NEW.id AND folder_type = 'branch';
    
    -- Update all employee folders paths under this organization
    UPDATE public.folders f
    SET 
      path = 'Company Documents/' || NEW.name || '/' || (
        SELECT b.name FROM branches b WHERE b.id = f.branch_id
      ) || '/' || f.name,
      updated_at = now()
    WHERE f.organization_id = NEW.id AND f.folder_type = 'employee';
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for organization update
DROP TRIGGER IF EXISTS update_organization_folder_trigger ON public.organizations;
CREATE TRIGGER update_organization_folder_trigger
AFTER UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_organization_folder();

-- Create function to update branch folder when branch is renamed
CREATE OR REPLACE FUNCTION public.update_branch_folder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_name TEXT;
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
    
    -- Update branch folder name and path
    UPDATE public.folders 
    SET 
      name = NEW.name,
      path = 'Company Documents/' || org_name || '/' || NEW.name,
      updated_at = now()
    WHERE branch_id = NEW.id AND folder_type = 'branch';
    
    -- Update all employee folders paths under this branch
    UPDATE public.folders 
    SET 
      path = 'Company Documents/' || org_name || '/' || NEW.name || '/' || name,
      updated_at = now()
    WHERE branch_id = NEW.id AND folder_type = 'employee';
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for branch update
DROP TRIGGER IF EXISTS update_branch_folder_trigger ON public.branches;
CREATE TRIGGER update_branch_folder_trigger
AFTER UPDATE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.update_branch_folder();