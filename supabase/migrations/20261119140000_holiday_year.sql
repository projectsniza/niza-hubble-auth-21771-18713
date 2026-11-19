-- =====================================================================
-- Holiday balance: use the CURRENT holiday year when none is given
-- (the function defaulted to 2025-04-01, so approving a timesheet recalculated last year's balance).
-- Safe to run more than once.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'calculate_holiday_balance_for_year') THEN
    ALTER FUNCTION public.calculate_holiday_balance(uuid, date) RENAME TO calculate_holiday_balance_for_year;
  END IF;
END $$;

-- First day (1 April) of the holiday year that contains today's UK date.
CREATE OR REPLACE FUNCTION public.current_holiday_year_start()
RETURNS date
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM (now() AT TIME ZONE 'Europe/London')) >= 4
      THEN make_date(EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/London'))::int, 4, 1)
    ELSE make_date(EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/London'))::int - 1, 4, 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.calculate_holiday_balance(
  p_employee_id uuid,
  p_holiday_year_start date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.calculate_holiday_balance_for_year(
    p_employee_id,
    COALESCE(p_holiday_year_start, public.current_holiday_year_start())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_holiday_year_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_holiday_balance(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_holiday_balance_for_year(uuid, date) TO authenticated;
