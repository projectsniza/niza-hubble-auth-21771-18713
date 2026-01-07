-- Add INSERT policy for managers on trainings table
CREATE POLICY "Managers can create trainings in their branch" 
ON public.trainings 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) 
  AND assigned_to = auth.uid() 
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);

-- Also add DELETE policy for managers (for their own trainings)
CREATE POLICY "Managers can delete their own trainings" 
ON public.trainings 
FOR DELETE 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND assigned_to = auth.uid()
);