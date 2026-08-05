CREATE TABLE public.lottery_month_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  month_year date NOT NULL,
  locked_by uuid,
  locked_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, month_year)
);

GRANT SELECT ON public.lottery_month_locks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lottery_month_locks TO authenticated;
GRANT ALL ON public.lottery_month_locks TO service_role;

ALTER TABLE public.lottery_month_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lottery month locks"
  ON public.lottery_month_locks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage lottery month locks"
  ON public.lottery_month_locks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_lottery_month_locks_updated_at
  BEFORE UPDATE ON public.lottery_month_locks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_lottery_month_locked(_branch_id uuid, _record_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lottery_month_locks
    WHERE branch_id = _branch_id
      AND month_year = date_trunc('month', _record_date)::date
  )
$$;

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
  IF TG_OP = 'DELETE' THEN
    v_branch := OLD.branch_id;
    v_date := CASE WHEN TG_TABLE_NAME = 'lottery_daily_records' THEN OLD.record_date ELSE OLD.month_year END;
  ELSE
    v_branch := NEW.branch_id;
    v_date := CASE WHEN TG_TABLE_NAME = 'lottery_daily_records' THEN NEW.record_date ELSE NEW.month_year END;
  END IF;

  IF public.is_lottery_month_locked(v_branch, v_date)
     AND NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr')) THEN
    RAISE EXCEPTION 'This lottery month is locked by head office and can no longer be edited.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lottery_daily_records_month_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.lottery_daily_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lottery_month_lock();

CREATE TRIGGER trg_lottery_monthly_summaries_month_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.lottery_monthly_summaries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lottery_month_lock();