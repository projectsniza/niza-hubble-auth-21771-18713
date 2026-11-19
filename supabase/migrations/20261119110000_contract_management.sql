-- =====================================================================
-- Contract management (Niza HR audit, part 2)
-- Super Admin approves / edits contracts; every change is logged.
-- Safe to run more than once. No data is deleted.
-- =====================================================================

-- 1. 'draft' was used by the app but not allowed by the table, so draft saves failed.
ALTER TABLE public.contract_approvals DROP CONSTRAINT IF EXISTS contract_approvals_status_check;
ALTER TABLE public.contract_approvals
  ADD CONSTRAINT contract_approvals_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

ALTER TABLE public.contract_approvals ADD COLUMN IF NOT EXISTS reopened_at timestamptz;
ALTER TABLE public.contract_approvals ADD COLUMN IF NOT EXISTS reopened_by uuid;

-- 2. One spelling for "contract submitted, waiting for the Super Admin".
UPDATE public.employees SET status = 'awaiting_approval' WHERE status = 'waiting_approval';

-- 3. Change history ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contract_approvals(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  action text NOT NULL,            -- edit | approve | reject | reopen | resubmit | signed_copy
  field text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_change_log_contract_idx ON public.contract_change_log (contract_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS contract_change_log_employee_idx ON public.contract_change_log (employee_id);
ALTER TABLE public.contract_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read contract log" ON public.contract_change_log;
CREATE POLICY "Super admins read contract log" ON public.contract_change_log
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "HR read contract log in scope" ON public.contract_change_log;
CREATE POLICY "HR read contract log in scope" ON public.contract_change_log
FOR SELECT TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));
-- Rows are written only by the functions below (no insert/update/delete policy).

CREATE OR REPLACE FUNCTION public._contract_log(
  _contract uuid, _employee uuid, _action text, _field text, _old jsonb, _new jsonb, _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.contract_change_log (contract_id, employee_id, action, field, old_value, new_value, reason, changed_by, changed_by_name)
  VALUES (_contract, _employee, _action, _field, _old, _new, _reason, auth.uid(),
          (SELECT COALESCE(p.name, p.email) FROM public.profiles p WHERE p.id = auth.uid()));
END;
$$;
REVOKE ALL ON FUNCTION public._contract_log(uuid, uuid, text, text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;

-- 4. Only Super Admin may approve, reject, sign, edit approved content or delete approved rows.
--    HR / managers keep creating drafts, submitting, and uploading the signed copy.
CREATE OR REPLACE FUNCTION public.guard_contract_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _non_signed_keys text[] := ARRAY['signed_contract_path','signed_contract_uploaded_at','signed_contract_uploaded_by','updated_at'];
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Only a Super Admin can delete an approved contract' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'Only a Super Admin can approve or reject a contract' USING ERRCODE = '42501';
    END IF;
    NEW.admin_signature := NULL; NEW.employer_signature := NULL; NEW.employer_signature_type := NULL;
    NEW.employer_signed_date := NULL; NEW.approved_by := NULL; NEW.approved_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.status = 'approved' THEN
    IF (to_jsonb(NEW) - _non_signed_keys) IS DISTINCT FROM (to_jsonb(OLD) - _non_signed_keys) THEN
      RAISE EXCEPTION 'Only a Super Admin can change an approved contract' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only a Super Admin can approve or reject a contract' USING ERRCODE = '42501';
  END IF;
  IF NEW.admin_signature IS DISTINCT FROM OLD.admin_signature
     OR NEW.employer_signature IS DISTINCT FROM OLD.employer_signature
     OR NEW.employer_signature_type IS DISTINCT FROM OLD.employer_signature_type
     OR NEW.employer_signed_date IS DISTINCT FROM OLD.employer_signed_date
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Only a Super Admin can sign or approve a contract' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_contract_approval ON public.contract_approvals;
CREATE TRIGGER guard_contract_approval
BEFORE INSERT OR UPDATE OR DELETE ON public.contract_approvals
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_approval();

-- 5. approve_contract ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_contract(
  p_approval_id uuid,
  p_signature text,
  p_signature_type text,
  p_signature_date date,
  p_employer_name text DEFAULT NULL
) RETURNS public.contract_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _row public.contract_approvals;
  _content jsonb;
  _name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin can approve contracts' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _row FROM public.contract_approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status = 'approved' THEN RAISE EXCEPTION 'This contract is already approved'; END IF;
  IF _row.status NOT IN ('pending', 'draft') THEN
    RAISE EXCEPTION 'Only a submitted contract can be approved (current status: %)', _row.status;
  END IF;
  IF COALESCE(NULLIF(trim(p_signature), ''), '') = '' THEN RAISE EXCEPTION 'A signature is required'; END IF;
  IF p_signature_type NOT IN ('typed', 'drawn', 'uploaded') THEN RAISE EXCEPTION 'Invalid signature type'; END IF;

  _content := COALESCE(_row.contract_content, '{}'::jsonb);
  _name := COALESCE(NULLIF(trim(p_employer_name), ''), NULLIF(trim(_content ->> 'employer_name'), ''));
  IF _name IS NULL THEN RAISE EXCEPTION 'The employer representative name is required'; END IF;

  _content := _content || jsonb_build_object('employer_name', _name);
  -- The contract date is only filled in when it is missing (an existing date is never overwritten).
  IF COALESCE(NULLIF(_content ->> 'contract_date', ''), '') = '' THEN
    _content := _content || jsonb_build_object('contract_date', to_char(COALESCE(p_signature_date, current_date), 'YYYY-MM-DD'));
  END IF;

  UPDATE public.contract_approvals SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    admin_signature = p_signature,
    employer_signature = p_signature,
    employer_signature_type = p_signature_type,
    employer_signed_date = COALESCE(p_signature_date, current_date),
    rejection_reason = NULL,
    contract_content = _content,
    updated_at = now()
  WHERE id = p_approval_id
  RETURNING * INTO _row;

  UPDATE public.employee_onboarding
     SET contract_approved = true,
         contract_submitted_for_approval = true,
         current_step = GREATEST(COALESCE(current_step, 1), 4)
   WHERE employee_id = _row.employee_id;

  UPDATE public.employees
     SET status = 'awaiting_signature', updated_at = now()
   WHERE id = _row.employee_id
     AND status IN ('pending', 'onboarding', 'in_progress', 'waiting_approval', 'awaiting_approval');

  PERFORM public._contract_log(_row.id, _row.employee_id, 'approve', NULL, NULL, to_jsonb(_name), NULL);
  RETURN _row;
END;
$$;

-- 6. reject_contract ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_contract(p_approval_id uuid, p_reason text)
RETURNS public.contract_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _row public.contract_approvals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin can reject contracts' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(NULLIF(trim(p_reason), ''), '') = '' THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  SELECT * INTO _row FROM public.contract_approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'Only a submitted contract can be rejected (current status: %)', _row.status; END IF;

  UPDATE public.contract_approvals SET
    status = 'rejected', approved_by = auth.uid(), approved_at = now(),
    rejection_reason = p_reason, updated_at = now()
  WHERE id = p_approval_id RETURNING * INTO _row;

  -- Put the employee back where HR can fix and resubmit (they must not vanish from the lists).
  UPDATE public.employee_onboarding SET contract_submitted_for_approval = false, contract_approved = false
   WHERE employee_id = _row.employee_id;
  UPDATE public.employees SET status = 'in_progress', updated_at = now()
   WHERE id = _row.employee_id AND status IN ('waiting_approval', 'awaiting_approval');

  PERFORM public._contract_log(_row.id, _row.employee_id, 'reject', NULL, NULL, NULL, p_reason);
  RETURN _row;
END;
$$;

-- 7. reopen_contract (approved -> pending again) --------------------------------
CREATE OR REPLACE FUNCTION public.reopen_contract(p_approval_id uuid, p_reason text)
RETURNS public.contract_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _row public.contract_approvals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin can reopen contracts' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(NULLIF(trim(p_reason), ''), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO _row FROM public.contract_approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved contract can be reopened'; END IF;

  UPDATE public.contract_approvals SET
    status = 'pending', approved_by = NULL, approved_at = NULL,
    admin_signature = NULL, employer_signature = NULL, employer_signature_type = NULL, employer_signed_date = NULL,
    reopened_at = now(), reopened_by = auth.uid(), updated_at = now()
  WHERE id = p_approval_id RETURNING * INTO _row;

  UPDATE public.employee_onboarding SET contract_approved = false, contract_submitted_for_approval = true
   WHERE employee_id = _row.employee_id;
  UPDATE public.employees SET status = 'awaiting_approval', updated_at = now()
   WHERE id = _row.employee_id AND status IN ('awaiting_signature', 'docs_pending');

  PERFORM public._contract_log(_row.id, _row.employee_id, 'reopen', NULL, NULL, NULL, p_reason);
  RETURN _row;
END;
$$;

-- 8. update_contract_details: edit a contract at ANY stage, with history ------------
--    p_content  = the fields to change inside contract_content (merged)
--    p_employee = optional employee fields to keep in sync: job_title, join_date, branch_id
--    p_signed_date = optional new employer signature date
CREATE OR REPLACE FUNCTION public.update_contract_details(
  p_approval_id uuid,
  p_content jsonb,
  p_employee jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL,
  p_signed_date date DEFAULT NULL
) RETURNS public.contract_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _row public.contract_approvals;
  _old jsonb;
  _new jsonb;
  _key text;
  _emp public.employees;
  _new_branch uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin can edit contracts' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _row FROM public.contract_approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;

  _old := COALESCE(_row.contract_content, '{}'::jsonb);
  _new := _old || COALESCE(p_content, '{}'::jsonb);

  FOR _key IN SELECT k FROM (SELECT jsonb_object_keys(_new) AS k UNION SELECT jsonb_object_keys(_old)) s LOOP
    IF (_old -> _key) IS DISTINCT FROM (_new -> _key) THEN
      PERFORM public._contract_log(_row.id, _row.employee_id, 'edit', _key, _old -> _key, _new -> _key, p_reason);
    END IF;
  END LOOP;

  IF p_signed_date IS NOT NULL AND p_signed_date IS DISTINCT FROM _row.employer_signed_date THEN
    PERFORM public._contract_log(_row.id, _row.employee_id, 'edit', 'employer_signed_date',
      to_jsonb(_row.employer_signed_date), to_jsonb(p_signed_date), p_reason);
  END IF;

  UPDATE public.contract_approvals SET
    contract_content = _new,
    employer_signed_date = COALESCE(p_signed_date, employer_signed_date),
    updated_at = now()
  WHERE id = p_approval_id RETURNING * INTO _row;

  -- Keep the employee record in line with the contract.
  SELECT * INTO _emp FROM public.employees WHERE id = _row.employee_id;
  IF p_employee ? 'job_title' AND COALESCE(NULLIF(p_employee ->> 'job_title', ''), '') <> '' THEN
    UPDATE public.employees SET job_title = p_employee ->> 'job_title', updated_at = now() WHERE id = _emp.id;
  END IF;
  IF p_employee ? 'join_date' AND COALESCE(NULLIF(p_employee ->> 'join_date', ''), '') <> '' THEN
    UPDATE public.employees SET join_date = (p_employee ->> 'join_date')::date, updated_at = now() WHERE id = _emp.id;
  END IF;
  IF p_employee ? 'branch_id' AND COALESCE(NULLIF(p_employee ->> 'branch_id', ''), '') <> '' THEN
    _new_branch := (p_employee ->> 'branch_id')::uuid;
    IF _new_branch IS DISTINCT FROM _emp.branch_id THEN
      PERFORM public.transfer_employee(_emp.id, _new_branch, false);
      PERFORM public._contract_log(_row.id, _row.employee_id, 'edit', 'employee_branch',
        to_jsonb(_emp.branch_id), to_jsonb(_new_branch), p_reason);
    END IF;
  END IF;

  RETURN _row;
END;
$$;

-- 9. Signed-copy replacement is logged too ------------------------------------
CREATE OR REPLACE FUNCTION public.log_contract_signed_copy(p_approval_id uuid, p_path text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _row public.contract_approvals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin can replace the signed copy' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _row FROM public.contract_approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  PERFORM public._contract_log(_row.id, _row.employee_id, 'signed_copy', 'signed_contract_path',
    to_jsonb(_row.signed_contract_path), to_jsonb(p_path), p_reason);
  UPDATE public.contract_approvals SET
    signed_contract_path = p_path,
    signed_contract_uploaded_at = now(),
    signed_contract_uploaded_by = auth.uid(),
    updated_at = now()
  WHERE id = p_approval_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_contract(uuid, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_contract(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_contract(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_details(uuid, jsonb, jsonb, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_contract_signed_copy(uuid, text, text) TO authenticated;
