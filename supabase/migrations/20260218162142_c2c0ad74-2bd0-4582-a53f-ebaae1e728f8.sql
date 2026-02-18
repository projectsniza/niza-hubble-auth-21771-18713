
-- Drop old check constraint and add new one with safety folder types
ALTER TABLE public.folders DROP CONSTRAINT folders_folder_type_check;
ALTER TABLE public.folders ADD CONSTRAINT folders_folder_type_check 
  CHECK (folder_type = ANY (ARRAY['general','organization','branch','employee','root','safety_organization','safety_branch']));

-- Create Safety Documents root folder if it doesn't exist
INSERT INTO public.folders (name, path, folder_type, is_deletable, is_system, show_in_safety)
SELECT 'Safety Documents', 'Safety Documents', 'root', false, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.folders WHERE path = 'Safety Documents' AND folder_type = 'root'
);

-- Create safety org folders for existing organizations
INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, is_deletable, show_in_safety)
SELECT 
  o.name,
  (SELECT id FROM public.folders WHERE path = 'Safety Documents' AND folder_type = 'root' LIMIT 1),
  'safety_organization',
  'Safety Documents/' || o.name,
  o.id,
  false,
  false
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.folders f WHERE f.organization_id = o.id AND f.folder_type = 'safety_organization'
);

-- Create safety branch folders for existing branches
INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, is_deletable, show_in_safety)
SELECT 
  b.name,
  (SELECT f.id FROM public.folders f WHERE f.organization_id = b.organization_id AND f.folder_type = 'safety_organization' LIMIT 1),
  'safety_branch',
  'Safety Documents/' || o.name || '/' || b.name,
  b.organization_id,
  b.id,
  false,
  false
FROM public.branches b
JOIN public.organizations o ON o.id = b.organization_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.folders f WHERE f.branch_id = b.id AND f.folder_type = 'safety_branch'
);

-- Trigger: auto-create safety org folder
CREATE OR REPLACE FUNCTION public.create_safety_organization_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE safety_root_id UUID;
BEGIN
  SELECT id INTO safety_root_id FROM public.folders WHERE path = 'Safety Documents' AND folder_type = 'root' LIMIT 1;
  IF safety_root_id IS NOT NULL THEN
    INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, created_by, is_deletable, show_in_safety)
    VALUES (NEW.name, safety_root_id, 'safety_organization', 'Safety Documents/' || NEW.name, NEW.id, NEW.created_by, false, false);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: auto-create safety branch folder
CREATE OR REPLACE FUNCTION public.create_safety_branch_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE safety_org_folder_id UUID; org_name TEXT;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
  SELECT id INTO safety_org_folder_id FROM public.folders WHERE organization_id = NEW.organization_id AND folder_type = 'safety_organization' LIMIT 1;
  IF safety_org_folder_id IS NOT NULL THEN
    INSERT INTO public.folders (name, parent_id, folder_type, path, organization_id, branch_id, created_by, is_deletable, show_in_safety)
    VALUES (NEW.name, safety_org_folder_id, 'safety_branch', 'Safety Documents/' || org_name || '/' || NEW.name, NEW.organization_id, NEW.id, NEW.created_by, false, false);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_safety_org_folder_trigger AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.create_safety_organization_folder();
CREATE TRIGGER create_safety_branch_folder_trigger AFTER INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION public.create_safety_branch_folder();

-- Rename triggers for safety folders
CREATE OR REPLACE FUNCTION public.update_safety_organization_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.folders SET name = NEW.name, path = 'Safety Documents/' || NEW.name, updated_at = now()
    WHERE organization_id = NEW.id AND folder_type = 'safety_organization';
    UPDATE public.folders SET path = 'Safety Documents/' || NEW.name || '/' || name, updated_at = now()
    WHERE organization_id = NEW.id AND folder_type = 'safety_branch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_safety_branch_folder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org_name TEXT;
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;
    UPDATE public.folders SET name = NEW.name, path = 'Safety Documents/' || org_name || '/' || NEW.name, updated_at = now()
    WHERE branch_id = NEW.id AND folder_type = 'safety_branch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_safety_org_folder_trigger AFTER UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_safety_organization_folder();
CREATE TRIGGER update_safety_branch_folder_trigger AFTER UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_safety_branch_folder();

-- Update delete_branch_cascade to clean up safety folders
CREATE OR REPLACE FUNCTION public.delete_branch_cascade(p_branch_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can delete branches';
  END IF;
  PERFORM set_config('app.allow_protected_folder_delete', 'on', true);
  DELETE FROM trainings WHERE branch_id = p_branch_id;
  DELETE FROM bulk_uploads WHERE branch_id = p_branch_id;
  DELETE FROM clock_ins WHERE branch_id = p_branch_id;
  DELETE FROM locations WHERE branch_id = p_branch_id;
  DELETE FROM documents WHERE folder_id IN (SELECT id FROM folders WHERE branch_id = p_branch_id);
  DELETE FROM documents WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM folders WHERE branch_id = p_branch_id;
  DELETE FROM employee_onboarding WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM contract_approvals WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM absence_records WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM gdpr_consent_records WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM onboarding_form_responses WHERE employee_id IN (SELECT id FROM employees WHERE branch_id = p_branch_id);
  DELETE FROM employees WHERE branch_id = p_branch_id;
  DELETE FROM teams WHERE branch_id = p_branch_id;
  DELETE FROM safety_tasks WHERE branch_id = p_branch_id;
  DELETE FROM hazard_reports WHERE branch_id = p_branch_id;
  DELETE FROM incidents WHERE branch_id = p_branch_id;
  DELETE FROM risk_assessments WHERE branch_id = p_branch_id;
  DELETE FROM coshh_assessments WHERE branch_id = p_branch_id;
  DELETE FROM method_statements WHERE branch_id = p_branch_id;
  DELETE FROM maintenance_tickets WHERE branch_id = p_branch_id;
  DELETE FROM daily_reports WHERE branch_id = p_branch_id;
  DELETE FROM events WHERE branch_id = p_branch_id;
  DELETE FROM financial_reports WHERE branch_id = p_branch_id;
  DELETE FROM mandatory_leave WHERE branch_id = p_branch_id;
  DELETE FROM document_requirements WHERE branch_id = p_branch_id;
  DELETE FROM document_types WHERE branch_id = p_branch_id;
  DELETE FROM onboarding_custom_pages WHERE branch_id = p_branch_id;
  DELETE FROM rotas WHERE branch_id = p_branch_id;
  DELETE FROM branches WHERE id = p_branch_id;
  PERFORM set_config('app.allow_protected_folder_delete', 'off', true);
END;
$function$;
