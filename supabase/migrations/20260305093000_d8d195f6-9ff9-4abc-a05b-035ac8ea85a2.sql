
-- Add deactivation_reason column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deactivation_reason text;

-- Create bulk_upload_document_settings table for configuring required docs per bulk upload
CREATE TABLE IF NOT EXISTS public.bulk_upload_document_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_mandatory boolean NOT NULL DEFAULT false,
  doc_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  organization_id uuid REFERENCES public.organizations(id),
  branch_id uuid REFERENCES public.branches(id),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_upload_document_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for bulk_upload_document_settings
CREATE POLICY "Authenticated users can view bulk upload doc settings"
  ON public.bulk_upload_document_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins and HR can manage bulk upload doc settings"
  ON public.bulk_upload_document_settings FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'hr')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'hr')
  );
