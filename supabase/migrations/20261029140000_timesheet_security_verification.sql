-- Migration: Timesheet & Rota Security Verification (Passcode vs 2FA vs Disabled)
-- Allows Super Admin to configure granular verification for Timesheets & Rota independently of global 2FA.

CREATE TABLE IF NOT EXISTS public.timesheet_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'two_factor' CHECK (mode IN ('disabled', 'passcode', 'two_factor')),
  passcode TEXT DEFAULT NULL,
  updated_by TEXT DEFAULT 'Super Admin',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure a single default row exists
INSERT INTO public.timesheet_security_settings (mode, passcode, updated_by, updated_at)
SELECT 'two_factor', NULL, 'System Default', now()
WHERE NOT EXISTS (SELECT 1 FROM public.timesheet_security_settings);

-- Enable RLS
ALTER TABLE public.timesheet_security_settings ENABLE ROW LEVEL SECURITY;

-- Super Admin can do everything on timesheet_security_settings
DROP POLICY IF EXISTS "Super admins can manage timesheet security settings" ON public.timesheet_security_settings;
CREATE POLICY "Super admins can manage timesheet security settings"
ON public.timesheet_security_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Ensure anyone can query the public view or message_settings for timesheet settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'message_settings' AND policyname = 'Anyone can view timesheet settings'
  ) THEN
    CREATE POLICY "Anyone can view timesheet settings"
    ON public.message_settings FOR SELECT
    TO anon, authenticated
    USING (setting_key IN ('timesheet_verification_mode', 'timesheet_passcode_configured'));
  END IF;
END $$;

-- Also keep default keys in message_settings for fallback
INSERT INTO public.message_settings (setting_key, setting_value, description)
VALUES 
  ('timesheet_verification_mode', '"two_factor"', 'Timesheet & Rota verification mode (disabled, passcode, two_factor)'),
  ('timesheet_passcode_configured', 'false', 'Whether a timesheet passcode is currently set by Super Admin')
ON CONFLICT (setting_key) DO NOTHING;

-- Public/Authenticated function to read current timesheet security mode & status (WITHOUT exposing passcode)
CREATE OR REPLACE FUNCTION public.get_timesheet_verification_status()
RETURNS TABLE (
  mode TEXT,
  is_passcode_set BOOLEAN,
  updated_at TIMESTAMPTZ,
  updated_by TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tss.mode,
    (tss.passcode IS NOT NULL AND trim(tss.passcode) <> '') AS is_passcode_set,
    tss.updated_at,
    tss.updated_by
  FROM public.timesheet_security_settings tss
  LIMIT 1;
END;
$$;

-- Secure function for Super Admin to read full settings (including passcode)
CREATE OR REPLACE FUNCTION public.get_timesheet_security_admin()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_res JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only super admins can view full timesheet security settings';
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'mode', tss.mode,
    'passcode', tss.passcode,
    'is_passcode_set', (tss.passcode IS NOT NULL AND trim(tss.passcode) <> ''),
    'updated_at', tss.updated_at,
    'updated_by', tss.updated_by
  ) INTO v_res
  FROM public.timesheet_security_settings tss
  LIMIT 1;

  RETURN COALESCE(v_res, jsonb_build_object('success', true, 'mode', 'two_factor', 'is_passcode_set', false));
END;
$$;

-- Secure function for Super Admin to update timesheet security settings
CREATE OR REPLACE FUNCTION public.update_timesheet_security_settings(
  p_mode TEXT,
  p_passcode TEXT DEFAULT NULL,
  p_updated_by TEXT DEFAULT 'Super Admin'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_res JSONB;
  v_passcode_set BOOLEAN;
  v_current_passcode TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only super admins can configure timesheet security settings';
  END IF;

  IF p_mode NOT IN ('disabled', 'passcode', 'two_factor') THEN
    RAISE EXCEPTION 'Invalid verification mode. Must be disabled, passcode, or two_factor.';
  END IF;

  SELECT passcode INTO v_current_passcode FROM public.timesheet_security_settings LIMIT 1;

  UPDATE public.timesheet_security_settings
  SET
    mode = p_mode,
    passcode = CASE 
      WHEN p_passcode IS NOT NULL THEN NULLIF(trim(p_passcode), '')
      ELSE passcode 
    END,
    updated_by = p_updated_by,
    updated_at = now();

  IF NOT FOUND THEN
    INSERT INTO public.timesheet_security_settings (mode, passcode, updated_by, updated_at)
    VALUES (p_mode, NULLIF(trim(p_passcode), ''), p_updated_by, now());
  END IF;

  SELECT (passcode IS NOT NULL AND trim(passcode) <> '') INTO v_passcode_set
  FROM public.timesheet_security_settings LIMIT 1;

  -- Sync to message_settings
  INSERT INTO public.message_settings (setting_key, setting_value, description, updated_at)
  VALUES 
    ('timesheet_verification_mode', to_jsonb(p_mode), 'Timesheet verification mode', now()),
    ('timesheet_passcode_configured', to_jsonb(v_passcode_set), 'Whether passcode is configured', now())
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value, updated_at = now();

  SELECT jsonb_build_object(
    'success', true,
    'mode', tss.mode,
    'passcode', tss.passcode,
    'is_passcode_set', (tss.passcode IS NOT NULL AND trim(tss.passcode) <> ''),
    'updated_at', tss.updated_at,
    'updated_by', tss.updated_by
  ) INTO v_res
  FROM public.timesheet_security_settings tss
  LIMIT 1;

  RETURN v_res;
END;
$$;

-- Secure function to verify a timesheet passcode (callable by anyone authenticated)
CREATE OR REPLACE FUNCTION public.verify_timesheet_passcode(p_passcode TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stored_passcode TEXT;
  v_mode TEXT;
BEGIN
  SELECT mode, passcode INTO v_mode, v_stored_passcode
  FROM public.timesheet_security_settings
  LIMIT 1;

  IF v_mode = 'disabled' THEN
    RETURN jsonb_build_object('success', true, 'verified', true, 'message', 'Timesheet verification is disabled');
  END IF;

  -- Until passcode is set, normal access is granted
  IF v_stored_passcode IS NULL OR trim(v_stored_passcode) = '' THEN
    RETURN jsonb_build_object('success', true, 'verified', true, 'message', 'No passcode is set. Normal access granted.');
  END IF;

  IF trim(p_passcode) = trim(v_stored_passcode) THEN
    RETURN jsonb_build_object('success', true, 'verified', true, 'message', 'Passcode verified successfully');
  ELSE
    RETURN jsonb_build_object('success', false, 'verified', false, 'error', 'Incorrect passcode. Please try again.');
  END IF;
END;
$$;

