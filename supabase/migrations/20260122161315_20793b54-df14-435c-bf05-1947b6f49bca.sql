-- Add policy for users to create their own reminders
CREATE POLICY "Users can create their own reminders"
ON public.reminders FOR INSERT
WITH CHECK (created_by = auth.uid() AND assigned_to = auth.uid());

-- Add policy for users to delete their own reminders
CREATE POLICY "Users can delete their own reminders"
ON public.reminders FOR DELETE
USING (created_by = auth.uid());