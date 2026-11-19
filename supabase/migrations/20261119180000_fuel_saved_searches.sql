-- =====================================================================
-- Niza Fuel: saved locations + "is there new data?" tracking
-- Safe to run more than once. No existing data is touched.
-- =====================================================================

-- Which version of the source we last downloaded, so we only download when the source publishes something new.
ALTER TABLE public.fuel_price_sync ADD COLUMN IF NOT EXISTS source_version text;
ALTER TABLE public.fuel_price_sync ADD COLUMN IF NOT EXISTS source_published_at timestamptz;
ALTER TABLE public.fuel_price_sync ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- Saved locations: a search that is kept for good and shown without configuring it again.
CREATE TABLE IF NOT EXISTS public.fuel_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('place', 'coords')),
  query text,                              -- what was typed for a postcode / city
  latitude double precision NOT NULL,      -- always stored, so showing it never needs a lookup
  longitude double precision NOT NULL,
  place_label text,
  radius_miles numeric NOT NULL DEFAULT 5 CHECK (radius_miles > 0 AND radius_miles <= 100),
  fuel text NOT NULL DEFAULT 'e10' CHECK (fuel IN ('e10', 'e5', 'b7')),
  sort text NOT NULL DEFAULT 'price' CHECK (sort IN ('price', 'distance')),
  result_limit int NOT NULL DEFAULT 10 CHECK (result_limit BETWEEN 1 AND 100),
  position int NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fuel_saved_searches_position_idx ON public.fuel_saved_searches (position, created_at);

ALTER TABLE public.fuel_saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage saved fuel searches" ON public.fuel_saved_searches;
CREATE POLICY "Super admins manage saved fuel searches" ON public.fuel_saved_searches
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
