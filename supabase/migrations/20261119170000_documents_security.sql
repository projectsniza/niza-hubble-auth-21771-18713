-- =====================================================================
-- Documents security
--  1. Only a Super Admin can delete documents (HR and store accounts cannot).
--  2. The documents recycle bin is Super Admin only.
--  3. HR cannot change security rules in Business Rules (Super Admin only).
-- Safe to run more than once. No data is deleted.
-- =====================================================================

-- RESTRICTIVE policies are ANDed with every existing policy, so whatever else lets HR or a store account
-- delete a document today, this still requires a Super Admin as well.
DROP POLICY IF EXISTS "Only super admins can delete documents" ON public.documents;
CREATE POLICY "Only super admins can delete documents" ON public.documents
AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Recycle bin: super admin only" ON public.deleted_documents;
CREATE POLICY "Recycle bin: super admin only" ON public.deleted_documents
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- HR may still manage its own organisation's business rules, except the security ones.
DROP POLICY IF EXISTS "HR manage own organisation settings" ON public.org_settings;
CREATE POLICY "HR manage own organisation settings" ON public.org_settings
FOR ALL TO authenticated
USING (
  organization_id IS NOT NULL
  AND key <> ALL (ARRAY['documents_reauth', 'min_password_length'])
  AND public.is_in_my_hr_scope(organization_id, NULL)
)
WITH CHECK (
  organization_id IS NOT NULL
  AND key <> ALL (ARRAY['documents_reauth', 'min_password_length'])
  AND public.is_in_my_hr_scope(organization_id, NULL)
);
