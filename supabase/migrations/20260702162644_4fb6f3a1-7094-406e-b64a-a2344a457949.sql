CREATE TABLE public.lottery_game_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.lottery_games(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  ticket_price NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, effective_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lottery_game_price_history TO authenticated;
GRANT ALL ON public.lottery_game_price_history TO service_role;

ALTER TABLE public.lottery_game_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all lottery price history"
ON public.lottery_game_price_history
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR with full access can manage lottery price history"
ON public.lottery_game_price_history
FOR ALL
USING (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.hr_access_level, 'full') = 'full'
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'hr') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.hr_access_level, 'full') = 'full'
  )
);

CREATE POLICY "Managers can manage branch lottery price history"
ON public.lottery_game_price_history
FOR ALL
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.branch_id = lottery_game_price_history.branch_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.branch_id = lottery_game_price_history.branch_id
  )
);

CREATE INDEX idx_lottery_game_price_history_game_date
ON public.lottery_game_price_history(game_id, effective_date DESC);

CREATE TRIGGER update_lottery_game_price_history_updated_at
BEFORE UPDATE ON public.lottery_game_price_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, notes, created_at, updated_at)
SELECT
  g.id,
  g.branch_id,
  g.ticket_price,
  COALESCE((SELECT MIN(r.record_date) FROM public.lottery_daily_records r WHERE r.game_id = g.id), CURRENT_DATE),
  'Initial price captured for historical lottery calculations',
  now(),
  now()
FROM public.lottery_games g
ON CONFLICT (game_id, effective_date) DO UPDATE
SET ticket_price = EXCLUDED.ticket_price,
    branch_id = EXCLUDED.branch_id,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.track_lottery_game_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, changed_by, notes)
    VALUES (NEW.id, NEW.branch_id, NEW.ticket_price, CURRENT_DATE, NEW.created_by, 'Game created')
    ON CONFLICT (game_id, effective_date) DO UPDATE
    SET ticket_price = EXCLUDED.ticket_price,
        branch_id = EXCLUDED.branch_id,
        changed_by = EXCLUDED.changed_by,
        updated_at = now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.ticket_price IS DISTINCT FROM OLD.ticket_price THEN
    INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, changed_by, notes)
    VALUES (NEW.id, NEW.branch_id, NEW.ticket_price, CURRENT_DATE, NEW.created_by, 'Ticket price changed')
    ON CONFLICT (game_id, effective_date) DO UPDATE
    SET ticket_price = EXCLUDED.ticket_price,
        branch_id = EXCLUDED.branch_id,
        changed_by = EXCLUDED.changed_by,
        notes = EXCLUDED.notes,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_lottery_game_price_change_trigger ON public.lottery_games;
CREATE TRIGGER track_lottery_game_price_change_trigger
AFTER INSERT OR UPDATE OF ticket_price ON public.lottery_games
FOR EACH ROW
EXECUTE FUNCTION public.track_lottery_game_price_change();