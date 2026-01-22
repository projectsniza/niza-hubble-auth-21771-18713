-- Add DELETE policy for daily_reports - allow managers/HR to delete their own reports
CREATE POLICY "Managers and HR can delete their own daily reports"
ON public.daily_reports FOR DELETE
USING (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr'))
  AND submitted_by = auth.uid()
);

-- Add UPDATE policy for daily_reports - allow managers/HR to update their own reports
CREATE POLICY "Managers and HR can update their own daily reports"
ON public.daily_reports FOR UPDATE
USING (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr'))
  AND submitted_by = auth.uid()
);

-- Add DELETE policy for maintenance_tickets - allow managers/HR to delete their own tickets
CREATE POLICY "Managers and HR can delete their own maintenance tickets"
ON public.maintenance_tickets FOR DELETE
USING (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr'))
  AND reported_by = auth.uid()
);

-- Add UPDATE policy for maintenance_tickets - allow managers/HR to update their own tickets
CREATE POLICY "Managers and HR can update their own maintenance tickets"
ON public.maintenance_tickets FOR UPDATE
USING (
  (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'hr'))
  AND reported_by = auth.uid()
);

-- Update trainings DELETE policy to allow managers to delete trainings in their branch (not just assigned)
DROP POLICY IF EXISTS "Managers can delete their own trainings" ON public.trainings;

CREATE POLICY "Managers can delete trainings in their branch"
ON public.trainings FOR DELETE
USING (
  has_role(auth.uid(), 'manager')
  AND branch_id = (SELECT branch_id FROM get_my_profile_data())
);