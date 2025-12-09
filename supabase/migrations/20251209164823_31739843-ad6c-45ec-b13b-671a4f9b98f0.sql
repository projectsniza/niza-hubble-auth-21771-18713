-- Drop ALL existing RLS policies on trainings table
DROP POLICY IF EXISTS "Managers can view their assigned trainings" ON public.trainings;
DROP POLICY IF EXISTS "Managers can update their assigned trainings" ON public.trainings;
DROP POLICY IF EXISTS "HR can manage trainings in their scope" ON public.trainings;

-- Recreate manager policies with correct names
CREATE POLICY "Managers can view assigned trainings"
ON public.trainings
FOR SELECT
USING (
  public.has_role(auth.uid(), 'manager') AND 
  assigned_to = auth.uid()
);

CREATE POLICY "Managers can update assigned trainings"
ON public.trainings
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'manager') AND 
  assigned_to = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager') AND 
  assigned_to = auth.uid()
);