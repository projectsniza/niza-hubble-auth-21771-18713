-- =====================================================================
-- Lottery planogram changes
--  * official National Lottery game number per game
--  * "returned / removed" unsold tickets on daily records
--  * audit log of every planogram change (never updated / deleted)
--  * one transactional RPC that applies a change without rewriting history
-- Existing daily records are never modified by this migration.
-- =====================================================================

-- 1. Official National Lottery game number --------------------------------
ALTER TABLE public.lottery_games ADD COLUMN IF NOT EXISTS game_number text;
CREATE INDEX IF NOT EXISTS lottery_games_branch_game_number ON public.lottery_games (branch_id, game_number);

-- 2. Returned / removed unsold tickets ------------------------------------
ALTER TABLE public.lottery_daily_records
  ADD COLUMN IF NOT EXISTS returned_tickets integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.lottery_daily_records
    ADD CONSTRAINT lottery_daily_records_returned_non_negative CHECK (returned_tickets >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tickets_sold now also subtracts returned tickets. Every existing row has
-- returned_tickets = 0, so all historical values stay exactly the same.
ALTER TABLE public.lottery_daily_records DROP COLUMN IF EXISTS tickets_sold;
ALTER TABLE public.lottery_daily_records
  ADD COLUMN tickets_sold integer GENERATED ALWAYS AS (
    GREATEST(0, stock_begin + activated_tickets - COALESCE(stock_end, 0) - returned_tickets)
  ) STORED;

-- 3. Planogram change audit log -------------------------------------------
CREATE TABLE IF NOT EXISTS public.lottery_planogram_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  change_date date NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('replace', 'replace_move', 'move', 'price')),
  from_slot integer,
  to_slot integer,
  old_game_id uuid REFERENCES public.lottery_games(id) ON DELETE SET NULL,
  new_game_id uuid REFERENCES public.lottery_games(id) ON DELETE SET NULL,
  old_game_number text,
  new_game_number text,
  old_game_name text,
  new_game_name text,
  old_price numeric(10,2),
  new_price numeric(10,2),
  old_final_closing integer,
  old_returned integer,
  new_opening_activated integer,
  notes text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lottery_planogram_changes_branch_date
  ON public.lottery_planogram_changes (branch_id, change_date DESC);

GRANT SELECT ON public.lottery_planogram_changes TO authenticated;
GRANT ALL ON public.lottery_planogram_changes TO service_role;
ALTER TABLE public.lottery_planogram_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized lottery users can view planogram changes" ON public.lottery_planogram_changes;
CREATE POLICY "Authorized lottery users can view planogram changes"
ON public.lottery_planogram_changes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.branch_id = lottery_planogram_changes.branch_id))
  OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.branches b ON b.id = lottery_planogram_changes.branch_id
    WHERE p.id = auth.uid() AND COALESCE(p.hr_access_level, 'full'::public.hr_access_level) = 'full'::public.hr_access_level
      AND (p.organization_id = b.organization_id OR p.organization_id IS NULL)))
);
-- No INSERT/UPDATE/DELETE policies: rows are only written by the RPC below.

-- 4a. Backfill slot assignments for active games (GAME 3 -> slot 3) ----------
DO $$
DECLARE
  g RECORD;
  v_slot integer;
  v_from date;
BEGIN
  FOR g IN
    SELECT lg.id, lg.branch_id, lg.created_at,
           NULLIF(substring(lg.game_name from '(\d+)'), '')::integer AS wanted
    FROM public.lottery_games lg
    WHERE lg.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.lottery_slot_assignments a WHERE a.game_id = lg.id)
    ORDER BY lg.branch_id, NULLIF(substring(lg.game_name from '(\d+)'), '')::integer NULLS LAST, lg.created_at
  LOOP
    v_slot := CASE WHEN g.wanted BETWEEN 1 AND 999 THEN g.wanted ELSE NULL END;
    IF v_slot IS NULL OR EXISTS (
      SELECT 1 FROM public.lottery_slot_assignments a
      WHERE a.branch_id = g.branch_id AND a.slot_number = v_slot AND a.effective_to IS NULL
    ) THEN
      SELECT s INTO v_slot FROM generate_series(1, 999) s
      WHERE NOT EXISTS (
        SELECT 1 FROM public.lottery_slot_assignments a
        WHERE a.branch_id = g.branch_id AND a.slot_number = s AND a.effective_to IS NULL)
      ORDER BY s LIMIT 1;
    END IF;

    SELECT LEAST(COALESCE(MIN(r.record_date), g.created_at::date), g.created_at::date) INTO v_from
    FROM public.lottery_daily_records r WHERE r.game_id = g.id;

    INSERT INTO public.lottery_slot_assignments (branch_id, slot_number, game_id, effective_from, notes)
    VALUES (g.branch_id, v_slot, g.id, v_from, 'Backfilled from existing game row');
  END LOOP;
END $$;

-- 4b. Opening price row at each game's first record date ---------------------
-- Days before a game's first price-history row must never be valued at a later price.
INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, notes)
SELECT g.id, g.branch_id,
       COALESCE(
         (SELECT h.ticket_price FROM public.lottery_game_price_history h
          WHERE h.game_id = g.id ORDER BY h.effective_date ASC LIMIT 1),
         g.ticket_price),
       f.first_date,
       'Opening price backfilled for historical lottery calculations'
FROM public.lottery_games g
JOIN (SELECT game_id, MIN(record_date) AS first_date FROM public.lottery_daily_records GROUP BY game_id) f
  ON f.game_id = g.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.lottery_game_price_history h
  WHERE h.game_id = g.id AND h.effective_date <= f.first_date
)
ON CONFLICT (game_id, effective_date) DO NOTHING;

-- 5. Permission helper ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lottery_assert_can_manage(p_branch_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_profile RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to manage lottery games'; END IF;
  SELECT b.organization_id INTO v_org_id FROM public.branches b WHERE b.id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Branch not found'; END IF;
  SELECT p.branch_id, p.organization_id, COALESCE(p.hr_access_level, 'full'::public.hr_access_level) AS hr_access_level
  INTO v_profile FROM public.profiles p WHERE p.id = v_user_id;

  IF public.has_role(v_user_id, 'super_admin'::public.app_role) THEN
    RETURN v_org_id;
  ELSIF public.has_role(v_user_id, 'hr'::public.app_role) THEN
    IF v_profile.hr_access_level <> 'full'::public.hr_access_level
       OR (v_profile.organization_id IS NOT NULL AND v_profile.organization_id IS DISTINCT FROM v_org_id) THEN
      RAISE EXCEPTION 'You do not have access to manage lottery games for this branch';
    END IF;
    RETURN v_org_id;
  ELSIF public.has_role(v_user_id, 'manager'::public.app_role) THEN
    IF v_profile.branch_id IS DISTINCT FROM p_branch_id THEN
      RAISE EXCEPTION 'You can only manage lottery games for your branch';
    END IF;
    RETURN v_org_id;
  END IF;
  RAISE EXCEPTION 'You are not authorized to manage lottery games';
END;
$function$;

-- 6. Apply a planogram change (one transaction) ------------------------------
CREATE OR REPLACE FUNCTION public.apply_lottery_planogram_change(
  p_branch_id uuid,
  p_change_type text,              -- 'replace' | 'move' | 'price'
  p_change_date date,
  p_slot_number integer,           -- slot the old game is in now
  p_old_game_id uuid,
  p_old_final_closing integer DEFAULT NULL,
  p_old_returned integer DEFAULT 0,
  p_new_game_number text DEFAULT NULL,
  p_new_game_name text DEFAULT NULL,
  p_new_ticket_price numeric DEFAULT NULL,
  p_new_opening_activated integer DEFAULT 0,
  p_new_slot_number integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_is_head_office boolean;
  v_current RECORD;
  v_old_game RECORD;
  v_old_price numeric;
  v_target_slot integer;
  v_new_game_id uuid;
  v_type text;
  v_opening integer;
  v_change_id uuid;
  v_last_price_date date;
BEGIN
  v_org_id := public.lottery_assert_can_manage(p_branch_id);
  v_is_head_office := public.has_role(v_user_id, 'super_admin'::public.app_role) OR public.has_role(v_user_id, 'hr'::public.app_role);

  IF p_change_type NOT IN ('replace', 'move', 'price') THEN RAISE EXCEPTION 'Unknown change type %', p_change_type; END IF;
  IF p_change_date IS NULL THEN RAISE EXCEPTION 'Choose the date of the planogram change'; END IF;
  IF p_change_date > CURRENT_DATE THEN RAISE EXCEPTION 'A planogram change cannot be dated in the future'; END IF;
  IF public.is_lottery_month_locked(p_branch_id, p_change_date) AND NOT v_is_head_office THEN
    RAISE EXCEPTION 'This lottery month is locked by head office and can no longer be edited.';
  END IF;
  IF COALESCE(p_old_returned, 0) < 0 OR COALESCE(p_old_final_closing, 0) < 0 OR COALESCE(p_new_opening_activated, 0) < 0 THEN
    RAISE EXCEPTION 'Ticket counts cannot be negative';
  END IF;

  SELECT g.* INTO v_old_game FROM public.lottery_games g WHERE g.id = p_old_game_id AND g.branch_id = p_branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found in this branch'; END IF;

  SELECT a.* INTO v_current FROM public.lottery_slot_assignments a
  WHERE a.branch_id = p_branch_id AND a.slot_number = p_slot_number AND a.game_id = p_old_game_id AND a.effective_to IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This game is not currently in slot %', p_slot_number; END IF;
  IF p_change_date <= v_current.effective_from THEN
    RAISE EXCEPTION 'The change date must be after % (when this game went into slot %)', to_char(v_current.effective_from, 'DD Mon YYYY'), p_slot_number;
  END IF;
  IF EXISTS (SELECT 1 FROM public.lottery_planogram_changes c
             WHERE c.branch_id = p_branch_id AND (c.to_slot = p_slot_number OR c.from_slot = p_slot_number) AND c.change_date >= p_change_date) THEN
    RAISE EXCEPTION 'This slot already has a planogram change on or after this date';
  END IF;

  -- price the old game had just before the change
  SELECT h.ticket_price INTO v_old_price FROM public.lottery_game_price_history h
  WHERE h.game_id = p_old_game_id AND h.effective_date <= p_change_date ORDER BY h.effective_date DESC LIMIT 1;
  IF v_old_price IS NULL THEN
    SELECT h.ticket_price INTO v_old_price FROM public.lottery_game_price_history h
    WHERE h.game_id = p_old_game_id ORDER BY h.effective_date ASC LIMIT 1;
  END IF;
  v_old_price := COALESCE(v_old_price, v_old_game.ticket_price);

  -- ---------------------------------------------------------------- replace
  IF p_change_type = 'replace' THEN
    IF NULLIF(trim(p_new_game_number), '') IS NULL THEN RAISE EXCEPTION 'Enter the new National Lottery game number'; END IF;
    IF p_new_ticket_price IS NULL OR p_new_ticket_price <= 0 THEN RAISE EXCEPTION 'Enter a ticket price greater than zero'; END IF;
    IF EXISTS (SELECT 1 FROM public.lottery_daily_records r WHERE r.game_id = p_old_game_id AND r.record_date > p_change_date) THEN
      RAISE EXCEPTION 'The old game already has stock entered after %. Choose a later change date or clear those days first.', to_char(p_change_date, 'DD Mon YYYY');
    END IF;

    v_target_slot := COALESCE(p_new_slot_number, p_slot_number);
    v_type := CASE WHEN v_target_slot <> p_slot_number THEN 'replace_move' ELSE 'replace' END;
    IF v_target_slot <> p_slot_number AND EXISTS (
      SELECT 1 FROM public.lottery_slot_assignments a
      WHERE a.branch_id = p_branch_id AND a.slot_number = v_target_slot AND (a.effective_to IS NULL OR a.effective_to >= p_change_date)
    ) THEN
      RAISE EXCEPTION 'Slot % is occupied on that date', v_target_slot;
    END IF;

    -- old game: final count on the change date (mid-day swap - it still sold that morning)
    SELECT r.stock_end INTO v_opening FROM public.lottery_daily_records r
    WHERE r.game_id = p_old_game_id AND r.record_date < p_change_date AND r.stock_end IS NOT NULL
    ORDER BY r.record_date DESC LIMIT 1;
    INSERT INTO public.lottery_daily_records (game_id, branch_id, record_date, stock_begin, activated_tickets, stock_end, returned_tickets, created_by)
    VALUES (p_old_game_id, p_branch_id, p_change_date, COALESCE(v_opening, 0), 0, COALESCE(p_old_final_closing, 0), COALESCE(p_old_returned, 0), v_user_id)
    ON CONFLICT (game_id, record_date) DO UPDATE
      SET stock_end = COALESCE(p_old_final_closing, 0),
          returned_tickets = COALESCE(p_old_returned, 0),
          updated_at = now();

    UPDATE public.lottery_slot_assignments
    SET effective_to = p_change_date, ended_by = v_user_id, ended_at = now(),
        notes = COALESCE(notes || E'\n', '') || 'Replaced by game ' || trim(p_new_game_number) || ' (planogram change)'
    WHERE id = v_current.id;
    UPDATE public.lottery_games SET is_active = false WHERE id = p_old_game_id;

    INSERT INTO public.lottery_games (branch_id, organization_id, game_name, game_number, ticket_price, is_active, created_by)
    VALUES (p_branch_id, v_org_id,
            COALESCE(NULLIF(trim(p_new_game_name), ''), 'Game ' || trim(p_new_game_number)),
            trim(p_new_game_number), p_new_ticket_price, true, v_user_id)
    RETURNING id INTO v_new_game_id;

    INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, changed_by, notes)
    VALUES (v_new_game_id, p_branch_id, p_new_ticket_price, p_change_date, v_user_id, 'Planogram change: new game')
    ON CONFLICT (game_id, effective_date) DO UPDATE SET ticket_price = EXCLUDED.ticket_price, updated_at = now();

    INSERT INTO public.lottery_slot_assignments (branch_id, slot_number, game_id, effective_from, assigned_by, notes)
    VALUES (p_branch_id, v_target_slot, v_new_game_id, p_change_date, v_user_id, 'Planogram change');

    INSERT INTO public.lottery_daily_records (game_id, branch_id, record_date, stock_begin, activated_tickets, stock_end, created_by)
    VALUES (v_new_game_id, p_branch_id, p_change_date, 0, COALESCE(p_new_opening_activated, 0), NULL, v_user_id)
    ON CONFLICT (game_id, record_date) DO NOTHING;

  -- ------------------------------------------------------------------- move
  ELSIF p_change_type = 'move' THEN
    v_target_slot := p_new_slot_number;
    v_type := 'move';
    IF v_target_slot IS NULL OR v_target_slot < 1 THEN RAISE EXCEPTION 'Choose the new slot number'; END IF;
    IF v_target_slot = p_slot_number THEN RAISE EXCEPTION 'The game is already in slot %', p_slot_number; END IF;
    IF EXISTS (
      SELECT 1 FROM public.lottery_slot_assignments a
      WHERE a.branch_id = p_branch_id AND a.slot_number = v_target_slot AND (a.effective_to IS NULL OR a.effective_to >= p_change_date)
    ) THEN
      RAISE EXCEPTION 'Slot % is occupied on that date', v_target_slot;
    END IF;
    v_new_game_id := p_old_game_id;

    UPDATE public.lottery_slot_assignments
    SET effective_to = p_change_date - 1, ended_by = v_user_id, ended_at = now(),
        notes = COALESCE(notes || E'\n', '') || 'Moved to slot ' || v_target_slot
    WHERE id = v_current.id;
    INSERT INTO public.lottery_slot_assignments (branch_id, slot_number, game_id, effective_from, assigned_by, notes)
    VALUES (p_branch_id, v_target_slot, p_old_game_id, p_change_date, v_user_id, 'Moved from slot ' || p_slot_number);

  -- ------------------------------------------------------------------ price
  ELSE
    v_type := 'price';
    v_target_slot := p_slot_number;
    v_new_game_id := p_old_game_id;
    IF p_new_ticket_price IS NULL OR p_new_ticket_price <= 0 THEN RAISE EXCEPTION 'Enter a ticket price greater than zero'; END IF;
    IF p_new_ticket_price = v_old_price THEN RAISE EXCEPTION 'The new price is the same as the current price'; END IF;
    SELECT MAX(h.effective_date) INTO v_last_price_date FROM public.lottery_game_price_history h WHERE h.game_id = p_old_game_id;
    IF v_last_price_date IS NOT NULL AND p_change_date <= v_last_price_date THEN
      RAISE EXCEPTION 'This game already has a price change on %; choose a later date', to_char(v_last_price_date, 'DD Mon YYYY');
    END IF;

    INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, changed_by, notes)
    VALUES (p_old_game_id, p_branch_id, p_new_ticket_price, p_change_date, v_user_id,
            'Planogram change: price £' || to_char(v_old_price, 'FM999990.00') || ' -> £' || to_char(p_new_ticket_price, 'FM999990.00'));
    -- this is now the game's latest price, so the "current price" can follow it
    UPDATE public.lottery_games SET ticket_price = p_new_ticket_price WHERE id = p_old_game_id;
  END IF;

  INSERT INTO public.lottery_planogram_changes (
    branch_id, change_date, change_type, from_slot, to_slot, old_game_id, new_game_id,
    old_game_number, new_game_number, old_game_name, new_game_name, old_price, new_price,
    old_final_closing, old_returned, new_opening_activated, notes, changed_by)
  VALUES (
    p_branch_id, p_change_date, v_type, p_slot_number, v_target_slot, p_old_game_id, v_new_game_id,
    v_old_game.game_number,
    CASE WHEN v_type IN ('replace', 'replace_move') THEN trim(p_new_game_number) ELSE v_old_game.game_number END,
    v_old_game.game_name,
    CASE WHEN v_type IN ('replace', 'replace_move') THEN COALESCE(NULLIF(trim(p_new_game_name), ''), 'Game ' || trim(p_new_game_number)) ELSE v_old_game.game_name END,
    v_old_price,
    CASE WHEN v_type = 'move' THEN v_old_price ELSE p_new_ticket_price END,
    CASE WHEN v_type IN ('replace', 'replace_move') THEN COALESCE(p_old_final_closing, 0) END,
    CASE WHEN v_type IN ('replace', 'replace_move') THEN COALESCE(p_old_returned, 0) END,
    CASE WHEN v_type IN ('replace', 'replace_move') THEN COALESCE(p_new_opening_activated, 0) END,
    NULLIF(trim(p_notes), ''), v_user_id)
  RETURNING id INTO v_change_id;

  RETURN v_change_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_lottery_planogram_change(uuid, text, date, integer, uuid, integer, integer, text, text, numeric, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_lottery_planogram_change(uuid, text, date, integer, uuid, integer, integer, text, text, numeric, integer, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.lottery_assert_can_manage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_assert_can_manage(uuid) TO authenticated;

-- 7. Add a brand-new game to a free slot from a chosen start date --------------
CREATE OR REPLACE FUNCTION public.add_lottery_game_to_slot(
  p_branch_id uuid,
  p_slot_number integer,
  p_game_number text,
  p_ticket_price numeric,
  p_start_date date DEFAULT CURRENT_DATE,
  p_game_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_game_id uuid;
BEGIN
  v_org_id := public.lottery_assert_can_manage(p_branch_id);
  IF p_slot_number IS NULL OR p_slot_number < 1 THEN RAISE EXCEPTION 'Slot number must be a positive number'; END IF;
  IF p_ticket_price IS NULL OR p_ticket_price <= 0 THEN RAISE EXCEPTION 'Enter a ticket price greater than zero'; END IF;
  IF p_start_date IS NULL OR p_start_date > CURRENT_DATE THEN RAISE EXCEPTION 'The start date cannot be in the future'; END IF;
  IF public.is_lottery_month_locked(p_branch_id, p_start_date)
     AND NOT (public.has_role(v_user_id, 'super_admin'::public.app_role) OR public.has_role(v_user_id, 'hr'::public.app_role)) THEN
    RAISE EXCEPTION 'This lottery month is locked by head office and can no longer be edited.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lottery_slot_assignments a
    WHERE a.branch_id = p_branch_id AND a.slot_number = p_slot_number AND (a.effective_to IS NULL OR a.effective_to >= p_start_date)
  ) THEN
    RAISE EXCEPTION 'Slot % is already in use. Use Planogram Change on that slot instead.', p_slot_number;
  END IF;

  INSERT INTO public.lottery_games (branch_id, organization_id, game_name, game_number, ticket_price, is_active, created_by)
  VALUES (p_branch_id, v_org_id,
          COALESCE(NULLIF(trim(p_game_name), ''), CASE WHEN NULLIF(trim(p_game_number), '') IS NULL THEN 'Slot ' || p_slot_number ELSE 'Game ' || trim(p_game_number) END),
          NULLIF(trim(p_game_number), ''), p_ticket_price, true, v_user_id)
  RETURNING id INTO v_game_id;

  INSERT INTO public.lottery_game_price_history (game_id, branch_id, ticket_price, effective_date, changed_by, notes)
  VALUES (v_game_id, p_branch_id, p_ticket_price, p_start_date, v_user_id, 'Game added')
  ON CONFLICT (game_id, effective_date) DO UPDATE SET ticket_price = EXCLUDED.ticket_price, updated_at = now();

  INSERT INTO public.lottery_slot_assignments (branch_id, slot_number, game_id, effective_from, assigned_by, notes)
  VALUES (p_branch_id, p_slot_number, v_game_id, p_start_date, v_user_id, 'Game added');

  RETURN v_game_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_lottery_game_to_slot(uuid, integer, text, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_lottery_game_to_slot(uuid, integer, text, numeric, date, text) TO authenticated;
