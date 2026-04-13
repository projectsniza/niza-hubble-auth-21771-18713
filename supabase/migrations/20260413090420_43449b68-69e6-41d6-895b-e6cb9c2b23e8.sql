-- Add report_month column for folder-based organization
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS report_month text;

-- Backfill existing reports with month from submitted_at
UPDATE public.daily_reports SET report_month = to_char(submitted_at::date, 'YYYY-MM') WHERE report_month IS NULL AND submitted_at IS NOT NULL;