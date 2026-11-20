-- 1) Speed: Daily Reports and Documents were reading their tables with no index on the columns they filter and
--    sort by (only report_date and vendor_ids had one), so every open scanned the whole table.
--    Plain indexes only: nothing about the data or the screens' results changes.
CREATE INDEX IF NOT EXISTS idx_daily_reports_submitted_at ON public.daily_reports (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_branch_id ON public.daily_reports (branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_organization_id ON public.daily_reports (organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_submitted_by ON public.daily_reports (submitted_by);

CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON public.documents (folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON public.documents (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_follow_up_date ON public.documents (follow_up_date) WHERE follow_up_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_employee_id ON public.folders (employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folders_folder_type ON public.folders (folder_type);

-- 2) Memory of the expiry / follow-up emails already sent, so nobody is emailed twice for the same thing.
--    interval_days = the "days before expiry" step that was reached (0 = the document is now overdue).
CREATE TABLE IF NOT EXISTS public.document_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('expiry', 'follow_up')),
  due_date DATE NOT NULL,
  interval_days INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, kind, due_date, interval_days)
);

-- Only the email job (service role) reads and writes it.
ALTER TABLE public.document_alert_log ENABLE ROW LEVEL SECURITY;
