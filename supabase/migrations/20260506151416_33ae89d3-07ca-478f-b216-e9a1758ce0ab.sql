
-- Table
CREATE TABLE public.daily_sales_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  source_filename TEXT NOT NULL,
  source_format TEXT NOT NULL DEFAULT 'csv',
  storage_path TEXT,
  raw_text TEXT,
  parsed_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dsu_branch_date ON public.daily_sales_uploads (branch_id, sale_date DESC);
CREATE INDEX idx_dsu_org_date ON public.daily_sales_uploads (organization_id, sale_date DESC);

CREATE TRIGGER trg_dsu_updated_at
BEFORE UPDATE ON public.daily_sales_uploads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.daily_sales_uploads ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "dsu admins all"
ON public.daily_sales_uploads FOR ALL
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr'))
WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr'));

CREATE POLICY "dsu managers select own branch"
ON public.daily_sales_uploads FOR SELECT
USING (
  public.has_role(auth.uid(),'manager')
  AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "dsu managers insert own branch"
ON public.daily_sales_uploads FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(),'manager')
  AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "dsu managers delete own branch own row"
ON public.daily_sales_uploads FOR DELETE
USING (
  public.has_role(auth.uid(),'manager')
  AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
  AND uploaded_by = auth.uid()
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-sales','daily-sales', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "daily-sales admins all"
ON storage.objects FOR ALL
USING (bucket_id = 'daily-sales' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr')))
WITH CHECK (bucket_id = 'daily-sales' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr')));

CREATE POLICY "daily-sales managers read own branch"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'daily-sales'
  AND public.has_role(auth.uid(),'manager')
  AND (storage.foldername(name))[1] = (SELECT branch_id::text FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "daily-sales managers upload own branch"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'daily-sales'
  AND public.has_role(auth.uid(),'manager')
  AND (storage.foldername(name))[1] = (SELECT branch_id::text FROM public.profiles WHERE id = auth.uid())
);
