-- =====================================================================
-- Per-organisation business rules (Niza HR audit, part 5)
-- organization_id NULL = group default; a row for an organisation overrides it.
-- Safe to run more than once. No data is deleted.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (organisation, key); the group default (NULL organisation) is unique per key too.
CREATE UNIQUE INDEX IF NOT EXISTS org_settings_unique
  ON public.org_settings (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone signed in can read settings" ON public.org_settings;
CREATE POLICY "Everyone signed in can read settings" ON public.org_settings
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins manage settings" ON public.org_settings;
CREATE POLICY "Super admins manage settings" ON public.org_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "HR manage own organisation settings" ON public.org_settings;
CREATE POLICY "HR manage own organisation settings" ON public.org_settings
FOR ALL TO authenticated
USING (organization_id IS NOT NULL AND public.is_in_my_hr_scope(organization_id, NULL))
WITH CHECK (organization_id IS NOT NULL AND public.is_in_my_hr_scope(organization_id, NULL));

CREATE OR REPLACE FUNCTION public.org_settings_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS org_settings_touch ON public.org_settings;
CREATE TRIGGER org_settings_touch BEFORE INSERT OR UPDATE ON public.org_settings
FOR EACH ROW EXECUTE FUNCTION public.org_settings_touch();
