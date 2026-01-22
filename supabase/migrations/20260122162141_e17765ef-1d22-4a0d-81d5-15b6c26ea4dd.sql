-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Users can view reminders assigned to them" ON public.reminders;

-- Create a new SELECT policy that allows users to view reminders they created OR are assigned to
CREATE POLICY "Users can view their own reminders"
ON public.reminders FOR SELECT
USING (created_by = auth.uid() OR assigned_to = auth.uid());