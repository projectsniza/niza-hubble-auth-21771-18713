-- Allow managers to read signed_document_requirements so PostApprovalOnboarding works for them
CREATE POLICY "All authenticated users can read signed document requirements"
ON public.signed_document_requirements
FOR SELECT
TO authenticated
USING (true);

-- Drop the old combined policy and recreate for write-only operations
DROP POLICY IF EXISTS "Admins and HR can manage signed document requirements" ON public.signed_document_requirements;

CREATE POLICY "Admins and HR can manage signed document requirements"
ON public.signed_document_requirements
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));