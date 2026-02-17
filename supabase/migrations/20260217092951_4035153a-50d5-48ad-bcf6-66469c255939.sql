-- Fix shared_templates RLS: managers should also see templates shared with their organization
DROP POLICY IF EXISTS "Managers can view shared templates for their branch" ON public.shared_templates;

CREATE POLICY "Managers can view shared templates for their scope"
ON public.shared_templates
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager') AND is_active = true AND (
    is_global = true
    OR branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
);