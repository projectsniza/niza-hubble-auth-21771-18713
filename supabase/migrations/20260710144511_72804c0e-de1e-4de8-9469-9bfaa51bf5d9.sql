
-- Reminders: add snooze + acknowledgement tracking
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

-- Certifications: tier weightage (bronze/silver/gold/platinum/diamond)
ALTER TABLE public.employee_certifications
  ADD COLUMN IF NOT EXISTS coin_tier text NOT NULL DEFAULT 'gold';

-- Backfill existing rows to a sensible tier based on existing gold_coins weight
UPDATE public.employee_certifications
SET coin_tier = CASE
  WHEN gold_coins >= 20 THEN 'diamond'
  WHEN gold_coins >= 10 THEN 'platinum'
  WHEN gold_coins >= 5  THEN 'gold'
  WHEN gold_coins >= 3  THEN 'silver'
  ELSE 'bronze'
END
WHERE coin_tier = 'gold';
