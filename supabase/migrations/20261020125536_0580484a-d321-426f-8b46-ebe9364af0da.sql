CREATE OR REPLACE FUNCTION public.update_timesheet_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_timesheet_id UUID;
BEGIN
  target_timesheet_id := COALESCE(NEW.timesheet_id, OLD.timesheet_id);

  UPDATE public.timesheets t
  SET
    total_worked_hours = (
      SELECT COALESCE(SUM(
        CASE
          WHEN e.shift_start_time IS NOT NULL AND e.shift_end_time IS NOT NULL THEN
            ROUND(
              GREATEST(
                0,
                EXTRACT(EPOCH FROM (e.shift_end_time - e.shift_start_time))
                  + CASE WHEN e.shift_end_time < e.shift_start_time THEN 86400 ELSE 0 END
                  - GREATEST(COALESCE(e.break_duration_minutes, 0), 0) * 60
              )::numeric / 3600,
              2
            )
          ELSE COALESCE(e.actual_hours, 0)
        END
      ), 0)
      FROM public.timesheet_entries e
      WHERE e.timesheet_id = target_timesheet_id
    ),
    total_holiday_hours = (
      SELECT COALESCE(SUM(e.holiday_hours), 0)
      FROM public.timesheet_entries e
      WHERE e.timesheet_id = target_timesheet_id
    ),
    total_sick_hours = (
      SELECT COALESCE(SUM(e.sick_hours), 0)
      FROM public.timesheet_entries e
      WHERE e.timesheet_id = target_timesheet_id
    ),
    total_adjustment_hours = (
      SELECT COALESCE(SUM(e.adjustment_hours), 0)
      FROM public.timesheet_entries e
      WHERE e.timesheet_id = target_timesheet_id
    ),
    updated_at = now()
  WHERE t.id = target_timesheet_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

UPDATE public.timesheets t
SET total_worked_hours = COALESCE((
  SELECT SUM(
    CASE
      WHEN e.shift_start_time IS NOT NULL AND e.shift_end_time IS NOT NULL THEN
        ROUND(
          GREATEST(
            0,
            EXTRACT(EPOCH FROM (e.shift_end_time - e.shift_start_time))
              + CASE WHEN e.shift_end_time < e.shift_start_time THEN 86400 ELSE 0 END
              - GREATEST(COALESCE(e.break_duration_minutes, 0), 0) * 60
          )::numeric / 3600,
          2
        )
      ELSE COALESCE(e.actual_hours, 0)
    END
  )
  FROM public.timesheet_entries e
  WHERE e.timesheet_id = t.id
), 0)
WHERE EXISTS (
  SELECT 1 FROM public.timesheet_entries e WHERE e.timesheet_id = t.id
);