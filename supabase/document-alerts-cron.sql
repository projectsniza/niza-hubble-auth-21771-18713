-- Daily schedule for the employee document expiry / follow-up emails.
-- NOT a migration: it holds a secret, so run it by hand once in the Supabase SQL editor.
--
-- Before running:
--   1. Replace PUT-YOUR-SECRET-HERE below with the same value as the function secret
--      DOC_ALERT_CRON_SECRET (or FUEL_CRON_SECRET, which the function accepts if the first is not set).
--   2. Deploy the function first:  npx supabase functions deploy document-expiry-alerts --project-ref bnxlmeilekynzadjbsrx --use-api
--
-- Runs every day at 07:30 UTC. Safe to re-run: it replaces the old schedule of the same name.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('document-expiry-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'document-expiry-alerts');

SELECT cron.schedule(
  'document-expiry-alerts',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bnxlmeilekynzadjbsrx.supabase.co/functions/v1/document-expiry-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PUT-YOUR-SECRET-HERE'),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
