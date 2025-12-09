-- Fix training_documents RLS policies with WITH CHECK clauses
DROP POLICY IF EXISTS "Super admins have full access to training_documents" ON public.training_documents;
DROP POLICY IF EXISTS "HR can manage training_documents" ON public.training_documents;
DROP POLICY IF EXISTS "Managers can view and upload training documents" ON public.training_documents;

CREATE POLICY "Super admins have full access to training_documents"
ON public.training_documents
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR can manage training_documents"
ON public.training_documents
FOR ALL
USING (public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Managers can manage their training documents"
ON public.training_documents
FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND 
  training_id IN (SELECT id FROM public.trainings WHERE assigned_to = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager') AND 
  training_id IN (SELECT id FROM public.trainings WHERE assigned_to = auth.uid())
);