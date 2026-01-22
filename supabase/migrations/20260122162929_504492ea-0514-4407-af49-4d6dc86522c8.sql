-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own reminders" ON public.reminders;

-- Create a simpler INSERT policy that allows users to create reminders for themselves
CREATE POLICY "Users can create reminders"
ON public.reminders FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Drop and recreate UPDATE policy to allow users to update reminders they created OR are assigned to
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;

CREATE POLICY "Users can update their own reminders"
ON public.reminders FOR UPDATE
USING (created_by = auth.uid() OR assigned_to = auth.uid());

-- Drop and recreate DELETE policy to also allow deleting reminders assigned to user
DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.reminders;

CREATE POLICY "Users can delete their own reminders"
ON public.reminders FOR DELETE
USING (created_by = auth.uid() OR assigned_to = auth.uid());