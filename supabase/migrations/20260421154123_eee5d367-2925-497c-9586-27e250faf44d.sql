UPDATE public.timesheets t SET
  total_worked_hours = COALESCE((SELECT SUM(actual_hours) FROM public.timesheet_entries WHERE timesheet_id = t.id), 0),
  total_holiday_hours = COALESCE((SELECT SUM(holiday_hours) FROM public.timesheet_entries WHERE timesheet_id = t.id), 0),
  total_sick_hours = COALESCE((SELECT SUM(sick_hours) FROM public.timesheet_entries WHERE timesheet_id = t.id), 0),
  total_adjustment_hours = COALESCE((SELECT SUM(adjustment_hours) FROM public.timesheet_entries WHERE timesheet_id = t.id), 0),
  updated_at = now();