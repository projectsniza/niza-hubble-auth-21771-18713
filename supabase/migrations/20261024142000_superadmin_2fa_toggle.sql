-- Migration: Global 2-Factor Authentication Setting for Super Admin
-- Allows Super Admin to disable 2FA system-wide.

INSERT INTO public.message_settings (setting_key, setting_value, description)
VALUES (
  'two_factor_auth_enabled',
  'true',
  'Global 2-Factor Authentication toggle (controlled by Super Admin in Settings)'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Ensure authenticated users can read the 2FA setting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'message_settings' AND policyname = 'Anyone can view 2fa setting'
  ) THEN
    CREATE POLICY "Anyone can view 2fa setting"
    ON public.message_settings FOR SELECT
    TO anon, authenticated
    USING (setting_key = 'two_factor_auth_enabled');
  END IF;
END $$;
