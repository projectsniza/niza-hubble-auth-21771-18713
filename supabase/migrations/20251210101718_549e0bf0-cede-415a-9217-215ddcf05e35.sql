-- Add RLS policies for managers and HR to create and view maintenance tickets
CREATE POLICY "Managers and HR can create maintenance tickets"
ON public.maintenance_tickets
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  AND reported_by = auth.uid()
);

CREATE POLICY "Managers and HR can view their own maintenance tickets"
ON public.maintenance_tickets
FOR SELECT
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  AND reported_by = auth.uid()
);

-- Add RLS policies for managers and HR to create and view daily reports
CREATE POLICY "Managers and HR can create daily reports"
ON public.daily_reports
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  AND submitted_by = auth.uid()
);

CREATE POLICY "Managers and HR can view their own daily reports"
ON public.daily_reports
FOR SELECT
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  AND submitted_by = auth.uid()
);