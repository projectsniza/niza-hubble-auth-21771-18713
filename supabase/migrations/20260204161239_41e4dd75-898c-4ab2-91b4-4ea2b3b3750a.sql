-- Activity logs table to track important activities for super admin notifications
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT,
  activity_type TEXT NOT NULL,
  activity_category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can see all activities
CREATE POLICY "Super admins can view all activities"
ON public.activity_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can update (mark as read)
CREATE POLICY "Super admins can update activities"
ON public.activity_logs
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Anyone authenticated can insert activities
CREATE POLICY "Authenticated users can insert activities"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for faster queries
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_is_read ON public.activity_logs(is_read);
CREATE INDEX idx_activity_logs_category ON public.activity_logs(activity_category);

-- Document submissions table for Store/HR document uploads pending approval
CREATE TABLE public.document_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  submitted_by_name TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  expiry_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_submissions ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins full access to document_submissions"
ON public.document_submissions
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- HR can view submissions in their scope
CREATE POLICY "HR can view document_submissions in scope"
ON public.document_submissions
FOR SELECT
USING (
  public.has_role(auth.uid(), 'hr')
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.hr_access_level = 'full'
        OR p.organization_id = document_submissions.organization_id
      )
    )
  )
);

-- HR can insert in their scope
CREATE POLICY "HR can insert document_submissions"
ON public.document_submissions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'hr')
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.hr_access_level = 'full'
        OR p.organization_id = document_submissions.organization_id
      )
    )
  )
);

-- Managers can view/insert in their branch
CREATE POLICY "Managers can view document_submissions in branch"
ON public.document_submissions
FOR SELECT
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.branch_id = document_submissions.branch_id
  )
);

CREATE POLICY "Managers can insert document_submissions"
ON public.document_submissions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.branch_id = document_submissions.branch_id
  )
);

-- Index for faster queries
CREATE INDEX idx_document_submissions_status ON public.document_submissions(status);
CREATE INDEX idx_document_submissions_employee ON public.document_submissions(employee_id);
CREATE INDEX idx_document_submissions_branch ON public.document_submissions(branch_id);

-- Trigger for updated_at
CREATE TRIGGER update_document_submissions_updated_at
BEFORE UPDATE ON public.document_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE public.activity_logs IS 'Tracks important activities for super admin notifications';
COMMENT ON TABLE public.document_submissions IS 'Stores documents submitted by Store/HR for super admin approval';