-- Update employee status options to support enhanced workflow
-- New statuses: pending, in_progress, waiting_approval, awaiting_signature, docs_pending, completed, active, inactive, terminated

-- Add bulk_upload_id to track employees from CSV uploads
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS bulk_upload_id uuid;

-- Create bulk_uploads table to track CSV imports
CREATE TABLE IF NOT EXISTS public.bulk_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  status text DEFAULT 'processing',
  error_log jsonb DEFAULT '[]'::jsonb,
  uploaded_by uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on bulk_uploads
ALTER TABLE public.bulk_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for bulk_uploads
CREATE POLICY "Super admins have full access to bulk_uploads"
ON public.bulk_uploads
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage bulk uploads in their scope"
ON public.bulk_uploads
FOR ALL
USING (
  has_role(auth.uid(), 'hr'::app_role) AND (
    ((SELECT profiles.hr_access_level FROM profiles WHERE profiles.id = auth.uid()) = 'full'::hr_access_level)
    OR organization_id = (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR branch_id = (SELECT profiles.branch_id FROM profiles WHERE profiles.id = auth.uid())
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_bulk_uploads_updated_at
BEFORE UPDATE ON public.bulk_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();