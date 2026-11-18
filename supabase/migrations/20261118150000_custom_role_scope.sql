-- =====================================================================
-- Custom role scope is now enforced by the database.
--
-- Before: HR users default to hr_access_level = 'full', so a custom role scoped to
-- one organisation (or to specific branches) still saw every organisation. Documents
-- and folders were also visible to any HR user regardless of scope.
--
-- get_my_profile_data() is the helper almost every HR/manager RLS policy reads
-- ("hr_access_level = 'full' OR organization_id = mine OR branch_id = mine").
-- It now returns the EFFECTIVE scope of the user's active custom role, so all of
-- those policies follow the custom role without being rewritten one by one.
-- Users without a custom role behave exactly as before.
-- =====================================================================

-- Branches allowed by the user's active custom role (multi-branch, or the legacy single branch).
CREATE OR REPLACE FUNCTION public.get_my_custom_role_branch_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
           NULLIF(cr.branch_ids, ARRAY[]::uuid[]),
           CASE WHEN cr.branch_id IS NOT NULL THEN ARRAY[cr.branch_id] END,
           ARRAY[]::uuid[])
  FROM public.profiles p
  JOIN public.custom_roles cr ON cr.id = p.custom_role_id
  WHERE p.id = auth.uid()
    AND cr.is_active = true
  LIMIT 1
$$;

-- Effective scope:
--   custom role with branches       -> level 'branch',       branch = profile branch if allowed else first allowed, org = none
--   custom role with organisation   -> level 'organization', org = role org, branch = profile branch only if inside that org
--   custom role with no restriction -> profile values (unchanged behaviour)
--   no custom role                  -> profile values (unchanged behaviour)
CREATE OR REPLACE FUNCTION public.get_my_profile_data()
 RETURNS TABLE(organization_id uuid, branch_id uuid, hr_access_level text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT
      p.organization_id AS p_org,
      p.branch_id AS p_branch,
      COALESCE(p.hr_access_level::text, 'full') AS p_level,
      cr.id AS cr_id,
      cr.organization_id AS cr_org,
      COALESCE(
        NULLIF(cr.branch_ids, ARRAY[]::uuid[]),
        CASE WHEN cr.branch_id IS NOT NULL THEN ARRAY[cr.branch_id] END,
        ARRAY[]::uuid[]) AS cr_branches
    FROM public.profiles p
    LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id AND cr.is_active = true
    WHERE p.id = auth.uid()
    LIMIT 1
  )
  SELECT
    CASE
      WHEN cr_id IS NULL THEN p_org
      -- HR scoped to specific branches must not inherit their whole organisation;
      -- store / staff accounts keep their own organisation (only used to show it).
      WHEN cardinality(cr_branches) > 0 THEN
        CASE WHEN public.has_role(auth.uid(), 'hr'::public.app_role) THEN NULL ELSE p_org END
      WHEN cr_org IS NOT NULL THEN cr_org
      ELSE p_org
    END,
    CASE
      WHEN cr_id IS NULL THEN p_branch
      WHEN cardinality(cr_branches) > 0 THEN
        CASE WHEN p_branch = ANY(cr_branches) THEN p_branch ELSE cr_branches[1] END
      WHEN cr_org IS NOT NULL THEN
        CASE WHEN EXISTS (SELECT 1 FROM public.branches b WHERE b.id = p_branch AND b.organization_id = cr_org) THEN p_branch END
      ELSE p_branch
    END,
    CASE
      WHEN cr_id IS NULL THEN p_level
      WHEN cardinality(cr_branches) > 0 THEN 'branch'
      WHEN cr_org IS NOT NULL THEN 'organization'
      ELSE p_level
    END
  FROM me
$$;

-- is_in_my_hr_scope already combines get_my_profile_data() with the custom role branch
-- list, so it now follows the effective scope (including multi-branch roles) automatically.

-- ---------------------------------------------------------------------
-- Folders & documents: scoped for HR (previously any HR user saw everything)
-- ---------------------------------------------------------------------
-- A folder is visible to an HR user when it is a company-wide folder (no organisation,
-- branch or employee), or when its organisation / branch / employee is in their scope.
CREATE OR REPLACE FUNCTION public.hr_can_access_folder(_folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.id = _folder_id
      AND (
        (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
        OR (f.organization_id IS NULL AND f.branch_id IS NULL AND f.employee_id IS NULL)
        OR (f.employee_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.employees e
              WHERE e.id = f.employee_id AND public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
        OR (f.employee_id IS NULL AND (f.organization_id IS NOT NULL OR f.branch_id IS NOT NULL)
            AND public.is_in_my_hr_scope(
                  COALESCE(f.organization_id, (SELECT b.organization_id FROM public.branches b WHERE b.id = f.branch_id)),
                  f.branch_id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.hr_can_access_document(_employee_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR (_employee_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = _employee_id AND public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
    OR (_employee_id IS NULL AND (_folder_id IS NULL OR public.hr_can_access_folder(_folder_id)))
$$;

DROP POLICY IF EXISTS "HR can manage folders in their scope" ON public.folders;
CREATE POLICY "HR can manage folders in their scope" ON public.folders
FOR ALL
USING (public.has_role(auth.uid(), 'hr') AND public.hr_can_access_folder(id))
WITH CHECK (public.has_role(auth.uid(), 'hr') AND (
  (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
  OR (organization_id IS NULL AND branch_id IS NULL AND employee_id IS NULL)
  OR (employee_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = folders.employee_id AND public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
  OR (employee_id IS NULL AND public.is_in_my_hr_scope(
        COALESCE(organization_id, (SELECT b.organization_id FROM public.branches b WHERE b.id = folders.branch_id)),
        branch_id))
));

DROP POLICY IF EXISTS "HR can manage documents in their scope" ON public.documents;
CREATE POLICY "HR can manage documents in their scope" ON public.documents
FOR ALL
USING (public.has_role(auth.uid(), 'hr') AND public.hr_can_access_document(employee_id, folder_id))
WITH CHECK (public.has_role(auth.uid(), 'hr') AND public.hr_can_access_document(employee_id, folder_id));

REVOKE ALL ON FUNCTION public.hr_can_access_folder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_can_access_folder(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.hr_can_access_document(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_can_access_document(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Organisation / branch pickers in every module read these two tables, so their
-- visibility must follow multi-branch custom roles too (the old rules only matched
-- a single branch, so a role with several branches saw just the first one and no
-- organisation at all).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "HR can view branches based on access level" ON public.branches;
CREATE POLICY "HR can view branches based on access level" ON public.branches
FOR SELECT USING (
  public.has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR organization_id = (SELECT organization_id FROM public.get_my_profile_data())
    OR id = (SELECT branch_id FROM public.get_my_profile_data())
    OR id = ANY (public.get_my_custom_role_branch_ids())
  )
);

DROP POLICY IF EXISTS "Managers can view their branch" ON public.branches;
CREATE POLICY "Managers can view their branch" ON public.branches
FOR SELECT USING (
  public.has_role(auth.uid(), 'manager') AND (
    id = (SELECT branch_id FROM public.get_my_profile_data())
    OR id = ANY (public.get_my_custom_role_branch_ids())
  )
);

DROP POLICY IF EXISTS "HR can view organizations based on access level" ON public.organizations;
CREATE POLICY "HR can view organizations based on access level" ON public.organizations
FOR SELECT USING (
  public.has_role(auth.uid(), 'hr') AND (
    (SELECT hr_access_level FROM public.get_my_profile_data()) = 'full'
    OR id = (SELECT organization_id FROM public.get_my_profile_data())
    OR id IN (SELECT b.organization_id FROM public.branches b
              WHERE b.id = ANY (public.get_my_custom_role_branch_ids())
                 OR b.id = (SELECT branch_id FROM public.get_my_profile_data()))
  )
);

DROP POLICY IF EXISTS "Managers can view their organization" ON public.organizations;
CREATE POLICY "Managers can view their organization" ON public.organizations
FOR SELECT USING (
  public.has_role(auth.uid(), 'manager') AND (
    id = (SELECT organization_id FROM public.get_my_profile_data())
    OR id IN (SELECT b.organization_id FROM public.branches b
              WHERE b.id = ANY (public.get_my_custom_role_branch_ids())
                 OR b.id = (SELECT branch_id FROM public.get_my_profile_data()))
  )
);

-- ---------------------------------------------------------------------
-- Data tables that still gave every HR user full access, and store (manager)
-- rules that read the branch straight off the profile.
-- ---------------------------------------------------------------------
-- The store(s) a manager / store account works in (profile branch, or the custom role's stores).
CREATE OR REPLACE FUNCTION public.is_my_store_branch(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'manager'::public.app_role)
     AND _branch_id IS NOT NULL
     AND (_branch_id = (SELECT branch_id FROM public.get_my_profile_data())
          OR _branch_id = ANY (public.get_my_custom_role_branch_ids()))
$$;

-- HR scope for a row that has a branch and maybe an organisation.
CREATE OR REPLACE FUNCTION public.hr_scope_for_branch(_organization_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_in_my_hr_scope(
    COALESCE(_organization_id, (SELECT b.organization_id FROM public.branches b WHERE b.id = _branch_id)),
    _branch_id)
$$;

GRANT EXECUTE ON FUNCTION public.is_my_store_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_scope_for_branch(uuid, uuid) TO authenticated;

-- Customer accounts ---------------------------------------------------
DROP POLICY IF EXISTS "HR full access customer_accounts" ON public.customer_accounts;
CREATE POLICY "HR full access customer_accounts" ON public.customer_accounts
FOR ALL TO authenticated
USING (public.hr_scope_for_branch(organization_id, branch_id))
WITH CHECK (public.hr_scope_for_branch(organization_id, branch_id));
DROP POLICY IF EXISTS "Managers select customer_accounts" ON public.customer_accounts;
CREATE POLICY "Managers select customer_accounts" ON public.customer_accounts
FOR SELECT TO authenticated USING (public.is_my_store_branch(branch_id));
DROP POLICY IF EXISTS "Managers insert customer_accounts" ON public.customer_accounts;
CREATE POLICY "Managers insert customer_accounts" ON public.customer_accounts
FOR INSERT TO authenticated WITH CHECK (public.is_my_store_branch(branch_id));

DROP POLICY IF EXISTS "HR full access monthly_accounts" ON public.customer_monthly_accounts;
CREATE POLICY "HR full access monthly_accounts" ON public.customer_monthly_accounts
FOR ALL TO authenticated
USING (public.hr_scope_for_branch(organization_id, branch_id))
WITH CHECK (public.hr_scope_for_branch(organization_id, branch_id));
DROP POLICY IF EXISTS "Managers select monthly_accounts" ON public.customer_monthly_accounts;
CREATE POLICY "Managers select monthly_accounts" ON public.customer_monthly_accounts
FOR SELECT TO authenticated USING (public.is_my_store_branch(branch_id));
DROP POLICY IF EXISTS "Managers insert monthly_accounts" ON public.customer_monthly_accounts;
CREATE POLICY "Managers insert monthly_accounts" ON public.customer_monthly_accounts
FOR INSERT TO authenticated WITH CHECK (public.is_my_store_branch(branch_id));

DROP POLICY IF EXISTS "HR full access account_items" ON public.customer_account_items;
CREATE POLICY "HR full access account_items" ON public.customer_account_items
FOR ALL TO authenticated
USING (monthly_account_id IN (SELECT m.id FROM public.customer_monthly_accounts m WHERE public.hr_scope_for_branch(m.organization_id, m.branch_id)))
WITH CHECK (monthly_account_id IN (SELECT m.id FROM public.customer_monthly_accounts m WHERE public.hr_scope_for_branch(m.organization_id, m.branch_id)));
DROP POLICY IF EXISTS "Managers select account_items" ON public.customer_account_items;
CREATE POLICY "Managers select account_items" ON public.customer_account_items
FOR SELECT TO authenticated
USING (monthly_account_id IN (SELECT m.id FROM public.customer_monthly_accounts m WHERE public.is_my_store_branch(m.branch_id)));
DROP POLICY IF EXISTS "Managers insert account_items" ON public.customer_account_items;
CREATE POLICY "Managers insert account_items" ON public.customer_account_items
FOR INSERT TO authenticated
WITH CHECK (monthly_account_id IN (SELECT m.id FROM public.customer_monthly_accounts m WHERE public.is_my_store_branch(m.branch_id)));

-- Daily sales uploads --------------------------------------------------
DROP POLICY IF EXISTS "dsu admins all" ON public.daily_sales_uploads;
CREATE POLICY "dsu admins all" ON public.daily_sales_uploads
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin') OR public.hr_scope_for_branch(organization_id, branch_id))
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.hr_scope_for_branch(organization_id, branch_id));
DROP POLICY IF EXISTS "dsu managers select own branch" ON public.daily_sales_uploads;
CREATE POLICY "dsu managers select own branch" ON public.daily_sales_uploads
FOR SELECT USING (public.is_my_store_branch(branch_id));
DROP POLICY IF EXISTS "dsu managers insert own branch" ON public.daily_sales_uploads;
CREATE POLICY "dsu managers insert own branch" ON public.daily_sales_uploads
FOR INSERT WITH CHECK (public.is_my_store_branch(branch_id) AND uploaded_by = auth.uid());
DROP POLICY IF EXISTS "dsu managers delete own branch own row" ON public.daily_sales_uploads;
CREATE POLICY "dsu managers delete own branch own row" ON public.daily_sales_uploads
FOR DELETE USING (public.is_my_store_branch(branch_id) AND uploaded_by = auth.uid());

-- Performance reviews ----------------------------------------------------
DROP POLICY IF EXISTS "HR can view performance reviews" ON public.performance_reviews;
CREATE POLICY "HR can view performance reviews" ON public.performance_reviews
FOR SELECT TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));
DROP POLICY IF EXISTS "HR can insert performance reviews" ON public.performance_reviews;
CREATE POLICY "HR can insert performance reviews" ON public.performance_reviews
FOR INSERT TO authenticated
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));
DROP POLICY IF EXISTS "HR can update performance reviews" ON public.performance_reviews;
CREATE POLICY "HR can update performance reviews" ON public.performance_reviews
FOR UPDATE TO authenticated
USING (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)))
WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id)));

-- Employee separations (were readable by every signed-in user) -------------
DROP POLICY IF EXISTS "All authenticated can view separations" ON public.employee_separations;
CREATE POLICY "All authenticated can view separations" ON public.employee_separations
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.hr_scope_for_branch(organization_id, branch_id)
  OR public.is_my_store_branch(branch_id)
  OR employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Admins/HR can update separations" ON public.employee_separations;
CREATE POLICY "Admins/HR can update separations" ON public.employee_separations
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.hr_scope_for_branch(organization_id, branch_id));
DROP POLICY IF EXISTS "Admins/HR can delete separations" ON public.employee_separations;
CREATE POLICY "Admins/HR can delete separations" ON public.employee_separations
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.hr_scope_for_branch(organization_id, branch_id));

-- Signed document uploads ---------------------------------------------------
DROP POLICY IF EXISTS "Admins and HR can manage signed document uploads" ON public.signed_document_uploads;
CREATE POLICY "Admins and HR can manage signed document uploads" ON public.signed_document_uploads
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR employee_id IN (SELECT e.id FROM public.employees e WHERE public.is_in_my_hr_scope(e.organization_id, e.branch_id))
);
