-- One login per email address, enforced by the database (not only by the create-user function).
-- Compared case-insensitively. If duplicates already exist this stops with a message instead of guessing
-- which one to keep: fix them first, then run this again.
--
-- To see existing duplicates:
--   SELECT lower(email) AS email, count(*), array_agg(id) FROM public.profiles
--   WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1;
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM public.profiles WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION '% email address(es) are used by more than one profile. Run the SELECT in the comment at the top of this file to list them, fix them, then run this again.', dup_count;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique ON public.profiles (lower(email));
END $$;
