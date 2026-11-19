-- =====================================================================
-- Employee records and documents (Niza HR audit, part 3)
-- Safe to run more than once. No data is deleted.
-- =====================================================================

-- Leaving details are now saved with the deactivation.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deactivation_notes text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS leaving_date date;

-- Documents: a real, shared recycle bin (was kept only in each browser's localStorage).
-- A deleted document keeps its full original row, so a restore brings back employee, folder, dates, etc.
CREATE TABLE IF NOT EXISTS public.deleted_documents (
  id uuid PRIMARY KEY,                 -- the original document id
  original jsonb NOT NULL,             -- the complete original row
  title text,
  file_name text,
  file_path text,
  folder_name text,
  folder_path text,
  employee_name text,
  organization_id uuid,
  branch_id uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid,
  deleted_by_name text
);
CREATE INDEX IF NOT EXISTS deleted_documents_deleted_at_idx ON public.deleted_documents (deleted_at DESC);
ALTER TABLE public.deleted_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recycle bin: super admin" ON public.deleted_documents;
CREATE POLICY "Recycle bin: super admin" ON public.deleted_documents
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Recycle bin: HR in scope" ON public.deleted_documents;
CREATE POLICY "Recycle bin: HR in scope" ON public.deleted_documents
FOR ALL TO authenticated
USING (public.hr_scope_for_branch(organization_id, branch_id))
WITH CHECK (public.hr_scope_for_branch(organization_id, branch_id));

DROP POLICY IF EXISTS "Recycle bin: own deletions" ON public.deleted_documents;
CREATE POLICY "Recycle bin: own deletions" ON public.deleted_documents
FOR ALL TO authenticated
USING (deleted_by = auth.uid())
WITH CHECK (deleted_by = auth.uid());
