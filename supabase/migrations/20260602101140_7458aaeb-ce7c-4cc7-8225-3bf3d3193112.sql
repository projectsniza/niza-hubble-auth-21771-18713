ALTER TABLE public.rota_settings DROP CONSTRAINT IF EXISTS rota_settings_time_increment_minutes_check;
ALTER TABLE public.rota_settings ADD CONSTRAINT rota_settings_time_increment_minutes_check CHECK (time_increment_minutes IN (1,5,10,15,20,30,60));
ALTER TABLE public.rota_settings ALTER COLUMN time_increment_minutes SET DEFAULT 1;
UPDATE public.rota_settings SET time_increment_minutes = 1;