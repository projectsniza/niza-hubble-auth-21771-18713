CREATE OR REPLACE FUNCTION public.assign_lottery_game_to_slot(
  p_branch_id uuid,
  p_slot_number integer,
  p_game_id uuid DEFAULT NULL,
  p_game_name text DEFAULT NULL,
  p_ticket_price numeric DEFAULT NULL,
  p_effective_from date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_profile RECORD;
  v_current RECORD;
  v_game_id uuid;
  v_assignment_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to manage lottery slots'; END IF;
  IF p_slot_number IS NULL OR p_slot_number < 1 THEN RAISE EXCEPTION 'Slot number must be a positive number'; END IF;
  IF p_effective_from IS DISTINCT FROM CURRENT_DATE THEN RAISE EXCEPTION 'Slot changes can only take effect today'; END IF;

  SELECT b.organization_id INTO v_org_id FROM public.branches b WHERE b.id = p_branch_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Branch not found'; END IF;
  SELECT p.branch_id, p.organization_id, COALESCE(p.hr_access_level, 'full'::public.hr_access_level) AS hr_access_level
  INTO v_profile FROM public.profiles p WHERE p.id = v_user_id;

  IF public.has_role(v_user_id, 'manager'::public.app_role) THEN
    IF v_profile.branch_id IS DISTINCT FROM p_branch_id THEN RAISE EXCEPTION 'You can only manage lottery slots for your branch'; END IF;
  ELSIF public.has_role(v_user_id, 'hr'::public.app_role) THEN
    IF v_profile.hr_access_level <> 'full'::public.hr_access_level OR (v_profile.organization_id IS NOT NULL AND v_profile.organization_id <> v_org_id) THEN
      RAISE EXCEPTION 'You do not have access to manage lottery slots for this branch';
    END IF;
  ELSIF NOT public.has_role(v_user_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'You are not authorized to manage lottery slots';
  END IF;

  IF p_game_id IS NOT NULL THEN
    SELECT g.id INTO v_game_id FROM public.lottery_games g WHERE g.id = p_game_id AND g.branch_id = p_branch_id AND g.is_active = true;
    IF v_game_id IS NULL THEN RAISE EXCEPTION 'Select an active game from this branch'; END IF;
  ELSE
    IF NULLIF(trim(p_game_name), '') IS NULL OR p_ticket_price IS NULL OR p_ticket_price <= 0 THEN
      RAISE EXCEPTION 'Enter a game name and a price greater than zero';
    END IF;
    INSERT INTO public.lottery_games (branch_id, organization_id, game_name, ticket_price, is_active, created_by)
    VALUES (p_branch_id, v_org_id, trim(p_game_name), p_ticket_price, true, v_user_id)
    RETURNING id INTO v_game_id;
  END IF;

  SELECT a.id, a.game_id, a.effective_from INTO v_current
  FROM public.lottery_slot_assignments a
  WHERE a.branch_id = p_branch_id AND a.slot_number = p_slot_number AND a.effective_to IS NULL
  FOR UPDATE;
  IF v_current.id IS NOT NULL THEN
    IF v_current.game_id = v_game_id THEN RAISE EXCEPTION 'This game is already assigned to slot %', p_slot_number; END IF;
    IF v_current.effective_from >= p_effective_from THEN RAISE EXCEPTION 'This slot was already changed today; end the current game before assigning another'; END IF;
    UPDATE public.lottery_slot_assignments
    SET effective_to = p_effective_from - 1, ended_by = v_user_id, ended_at = now(),
        notes = COALESCE(notes || E'\n', '') || 'Replaced by a new slot assignment'
    WHERE id = v_current.id;
    UPDATE public.lottery_games SET is_active = false WHERE id = v_current.game_id;
  END IF;

  INSERT INTO public.lottery_slot_assignments (branch_id, slot_number, game_id, effective_from, assigned_by)
  VALUES (p_branch_id, p_slot_number, v_game_id, p_effective_from, v_user_id)
  RETURNING id INTO v_assignment_id;
  RETURN v_assignment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_lottery_slot_game(p_assignment_id uuid, p_effective_to date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment RECORD;
  v_profile RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to end a lottery game'; END IF;
  IF p_effective_to IS DISTINCT FROM CURRENT_DATE THEN RAISE EXCEPTION 'Game endings can only take effect today'; END IF;
  SELECT a.id, a.branch_id, a.game_id, a.effective_from, b.organization_id INTO v_assignment
  FROM public.lottery_slot_assignments a JOIN public.branches b ON b.id = a.branch_id
  WHERE a.id = p_assignment_id AND a.effective_to IS NULL FOR UPDATE OF a;
  IF v_assignment.id IS NULL THEN RAISE EXCEPTION 'Current slot assignment not found'; END IF;
  IF v_assignment.effective_from >= p_effective_to THEN RAISE EXCEPTION 'A game assigned today cannot be ended until a later date'; END IF;

  SELECT p.branch_id, p.organization_id, COALESCE(p.hr_access_level, 'full'::public.hr_access_level) AS hr_access_level
  INTO v_profile FROM public.profiles p WHERE p.id = v_user_id;
  IF public.has_role(v_user_id, 'manager'::public.app_role) THEN
    IF v_profile.branch_id IS DISTINCT FROM v_assignment.branch_id THEN RAISE EXCEPTION 'You can only manage lottery slots for your branch'; END IF;
  ELSIF public.has_role(v_user_id, 'hr'::public.app_role) THEN
    IF v_profile.hr_access_level <> 'full'::public.hr_access_level OR (v_profile.organization_id IS NOT NULL AND v_profile.organization_id <> v_assignment.organization_id) THEN
      RAISE EXCEPTION 'You do not have access to manage lottery slots for this branch';
    END IF;
  ELSIF NOT public.has_role(v_user_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'You are not authorized to manage lottery slots';
  END IF;

  UPDATE public.lottery_slot_assignments
  SET effective_to = p_effective_to, ended_by = v_user_id, ended_at = now(),
      notes = COALESCE(notes || E'\n', '') || 'Game ended'
  WHERE id = v_assignment.id;
  UPDATE public.lottery_games SET is_active = false WHERE id = v_assignment.game_id;
END;
$function$;

GRANT SELECT, INSERT ON public.lottery_slot_assignments TO authenticated;
GRANT UPDATE (effective_to, ended_by, ended_at, notes) ON public.lottery_slot_assignments TO authenticated;
DROP POLICY "Authorized lottery users can view slot assignment history" ON public.lottery_slot_assignments;
CREATE POLICY "Authorized lottery users can view slot assignment history"
ON public.lottery_slot_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.branch_id = lottery_slot_assignments.branch_id))
  OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.branches b ON b.id = lottery_slot_assignments.branch_id
    WHERE p.id = auth.uid() AND COALESCE(p.hr_access_level, 'full'::public.hr_access_level) = 'full'::public.hr_access_level
      AND (p.organization_id = b.organization_id OR p.organization_id IS NULL)
  ))
);
CREATE POLICY "Authorized lottery users can create slot assignments"
ON public.lottery_slot_assignments FOR INSERT TO authenticated
WITH CHECK (
  assigned_by = auth.uid() AND effective_from = CURRENT_DATE AND effective_to IS NULL
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.branch_id = lottery_slot_assignments.branch_id))
    OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.branches b ON b.id = lottery_slot_assignments.branch_id
      WHERE p.id = auth.uid() AND COALESCE(p.hr_access_level, 'full'::public.hr_access_level) = 'full'::public.hr_access_level
        AND (p.organization_id = b.organization_id OR p.organization_id IS NULL)
    ))
  )
);
CREATE POLICY "Authorized lottery users can close current slot assignments"
ON public.lottery_slot_assignments FOR UPDATE TO authenticated
USING (
  effective_to IS NULL AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.branch_id = lottery_slot_assignments.branch_id))
    OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.branches b ON b.id = lottery_slot_assignments.branch_id
      WHERE p.id = auth.uid() AND COALESCE(p.hr_access_level, 'full'::public.hr_access_level) = 'full'::public.hr_access_level
        AND (p.organization_id = b.organization_id OR p.organization_id IS NULL)
    ))
  )
)
WITH CHECK (
  effective_to = CURRENT_DATE AND ended_by = auth.uid() AND ended_at IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'manager'::public.app_role) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.branch_id = lottery_slot_assignments.branch_id))
    OR (public.has_role(auth.uid(), 'hr'::public.app_role) AND EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.branches b ON b.id = lottery_slot_assignments.branch_id
      WHERE p.id = auth.uid() AND COALESCE(p.hr_access_level, 'full'::public.hr_access_level) = 'full'::public.hr_access_level
        AND (p.organization_id = b.organization_id OR p.organization_id IS NULL)
    ))
  )
);