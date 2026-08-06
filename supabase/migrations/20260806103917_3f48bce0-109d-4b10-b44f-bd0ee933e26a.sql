CREATE OR REPLACE FUNCTION public.enforce_lottery_month_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
  v_date date;
BEGIN
  IF TG_TABLE_NAME = 'lottery_daily_records' THEN
    IF TG_OP = 'DELETE' THEN
      v_branch := OLD.branch_id;
      v_date := OLD.record_date;
    ELSE
      v_branch := NEW.branch_id;
      v_date := NEW.record_date;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_branch := OLD.branch_id;
      v_date := OLD.month_year;
    ELSE
      v_branch := NEW.branch_id;
      v_date := NEW.month_year;
    END IF;
  END IF;

  IF v_date IS NOT NULL AND public.is_lottery_month_locked(v_branch, v_date)
     AND NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr')) THEN
    RAISE EXCEPTION 'This lottery month is locked by head office and can no longer be edited.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;