-- Add missing columns to trainings table
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP WITH TIME ZONE;

-- Create training_documents table for multiple file uploads
CREATE TABLE IF NOT EXISTS public.training_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT DEFAULT 'training',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on training_documents
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_documents
DROP POLICY IF EXISTS "Super admins have full access to training_documents" ON public.training_documents;
DROP POLICY IF EXISTS "HR can manage training_documents" ON public.training_documents;
DROP POLICY IF EXISTS "Managers can view and upload training documents" ON public.training_documents;

CREATE POLICY "Super admins have full access to training_documents"
ON public.training_documents FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage training_documents"
ON public.training_documents FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Managers can view and upload training documents"
ON public.training_documents FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  training_id IN (SELECT id FROM public.trainings WHERE assigned_to = auth.uid())
);

-- Add RLS policies to trainings if not exists
DROP POLICY IF EXISTS "Super admins have full access to trainings" ON public.trainings;
DROP POLICY IF EXISTS "HR can manage trainings" ON public.trainings;
DROP POLICY IF EXISTS "Managers can view their assigned trainings" ON public.trainings;
DROP POLICY IF EXISTS "Managers can update their assigned trainings" ON public.trainings;

CREATE POLICY "Super admins have full access to trainings"
ON public.trainings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "HR can manage trainings"
ON public.trainings FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Managers can view their assigned trainings"
ON public.trainings FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) AND assigned_to = auth.uid());

CREATE POLICY "Managers can update their assigned trainings"
ON public.trainings FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) AND assigned_to = auth.uid());

-- Fix Events RLS for managers
DROP POLICY IF EXISTS "Employees can view events in their scope" ON public.events;
DROP POLICY IF EXISTS "Users can view events in their scope" ON public.events;

CREATE POLICY "Users can view events in their scope"
ON public.events FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  (
    (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'employee'::app_role)) AND
    (
      visibility = 'company' OR
      (visibility = 'organization' AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())) OR
      (visibility = 'branch' AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()))
    )
  )
);

-- Storage bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-documents', 'training-documents', false)
ON CONFLICT (id) DO NOTHING;