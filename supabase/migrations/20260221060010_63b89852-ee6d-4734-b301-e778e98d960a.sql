
-- Table to configure which documents employees must upload after signing their contract
CREATE TABLE public.signed_document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  doc_order INTEGER NOT NULL DEFAULT 0,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signed_document_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR can manage signed document requirements"
  ON public.signed_document_requirements FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'hr')
  );

-- Table to store employee uploads for signed document requirements during onboarding
CREATE TABLE public.signed_document_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.signed_document_requirements(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, requirement_id)
);

ALTER TABLE public.signed_document_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR can manage signed document uploads"
  ON public.signed_document_uploads FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'hr')
  );

-- Add trigger for updated_at
CREATE TRIGGER update_signed_document_requirements_updated_at
  BEFORE UPDATE ON public.signed_document_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_signed_document_uploads_updated_at
  BEFORE UPDATE ON public.signed_document_uploads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
