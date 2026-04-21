CREATE OR REPLACE FUNCTION public.is_timesheet_month_locked(_branch_id uuid, _week_start date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- A weekly timesheet (Mon..Sun) belongs to the payroll period (21st–20th)
  -- that contains its END date (Sunday = week_start + 6). This prevents
  -- transition weeks (Mon before the 21st) from being treated as the
  -- previous payroll month and being incorrectly blocked when only the
  -- previous month is locked.
  WITH derived AS (
    SELECT
      CASE
        WHEN EXTRACT(DAY FROM (_week_start + INTERVAL '6 days')::date)::int >= 21
          THEN make_date(
                 EXTRACT(YEAR FROM (_week_start + INTERVAL '6 days')::date)::int,
                 EXTRACT(MONTH FROM (_week_start + INTERVAL '6 days')::date)::int,
                 21)
        ELSE (
          make_date(
            EXTRACT(YEAR FROM (_week_start + INTERVAL '6 days')::date)::int,
            EXTRACT(MONTH FROM (_week_start + INTERVAL '6 days')::date)::int,
            21) - INTERVAL '1 month'
        )::date
      END AS payroll_start
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.timesheet_month_locks l, derived d
    WHERE l.branch_id = _branch_id
      AND l.month_start = d.payroll_start
  );
$function$;