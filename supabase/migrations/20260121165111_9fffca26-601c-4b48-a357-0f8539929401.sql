-- Allow flexible report types (including 'other' custom types)
ALTER TABLE public.daily_reports
DROP CONSTRAINT IF EXISTS daily_reports_report_type_check;

-- Ensure a sensible default remains
ALTER TABLE public.daily_reports
ALTER COLUMN report_type SET DEFAULT 'report';