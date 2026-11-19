-- =====================================================================
-- UK fuel prices (Niza Fuel app, Super Admin only)
-- The CSV is downloaded by the `fuel-prices` edge function at most once a day and cached here.
-- Safe to run more than once. No existing data is touched.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.fuel_stations (
  id text PRIMARY KEY,                 -- id from the CSV (or a generated one when the CSV has none)
  brand text,
  name text,
  address text,
  city text,
  postcode text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  e10 numeric(6,1),                    -- pence per litre
  e5 numeric(6,1),
  b7 numeric(6,1),
  source_updated_at timestamptz,       -- when the price was last changed at the station (if the CSV says)
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fuel_stations_geo_idx ON public.fuel_stations (latitude, longitude);
CREATE INDEX IF NOT EXISTS fuel_stations_postcode_idx ON public.fuel_stations (upper(replace(postcode, ' ', '')));
CREATE INDEX IF NOT EXISTS fuel_stations_city_idx ON public.fuel_stations (lower(city));

-- One row describing the cache: when it was last refreshed and how it went.
CREATE TABLE IF NOT EXISTS public.fuel_price_sync (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_fetched_at timestamptz,
  last_attempt_at timestamptz,
  status text NOT NULL DEFAULT 'never',   -- never | running | ok | error
  row_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  source_url text,
  error text
);
INSERT INTO public.fuel_price_sync (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.fuel_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_price_sync ENABLE ROW LEVEL SECURITY;

-- Super Admin can read. Writes happen only through the edge function (service role bypasses RLS).
DROP POLICY IF EXISTS "Super admins read fuel stations" ON public.fuel_stations;
CREATE POLICY "Super admins read fuel stations" ON public.fuel_stations
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins read fuel sync" ON public.fuel_price_sync;
CREATE POLICY "Super admins read fuel sync" ON public.fuel_price_sync
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Nearest stations to a point, within a radius (great-circle distance in km).
-- A bounding box on the indexed lat/long columns keeps it fast; the exact distance is then worked out.
CREATE OR REPLACE FUNCTION public.nearby_fuel_stations(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 10,
  p_fuel text DEFAULT NULL,        -- e10 | e5 | b7 : only stations that sell it; NULL = any
  p_limit int DEFAULT 20,
  p_sort text DEFAULT 'distance'   -- distance | price
)
RETURNS TABLE (
  id text, brand text, name text, address text, city text, postcode text,
  latitude double precision, longitude double precision,
  e10 numeric, e5 numeric, b7 numeric, source_updated_at timestamptz,
  distance_km double precision
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  WITH box AS (
    SELECT
      p_lat - (p_radius_km / 111.0)                                           AS lat_min,
      p_lat + (p_radius_km / 111.0)                                           AS lat_max,
      p_lng - (p_radius_km / (111.0 * GREATEST(cos(radians(p_lat)), 0.01)))   AS lng_min,
      p_lng + (p_radius_km / (111.0 * GREATEST(cos(radians(p_lat)), 0.01)))   AS lng_max
  ),
  hits AS (
    SELECT s.*,
           2 * 6371.0088 * asin(sqrt(
             power(sin(radians(s.latitude - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(s.latitude)) *
             power(sin(radians(s.longitude - p_lng) / 2), 2)
           )) AS distance_km
    FROM public.fuel_stations s, box
    WHERE s.latitude  BETWEEN box.lat_min AND box.lat_max
      AND s.longitude BETWEEN box.lng_min AND box.lng_max
      AND (p_fuel IS NULL
           OR (lower(p_fuel) = 'e10' AND s.e10 IS NOT NULL)
           OR (lower(p_fuel) = 'e5'  AND s.e5  IS NOT NULL)
           OR (lower(p_fuel) = 'b7'  AND s.b7  IS NOT NULL))
  )
  SELECT h.id, h.brand, h.name, h.address, h.city, h.postcode, h.latitude, h.longitude,
         h.e10, h.e5, h.b7, h.source_updated_at, h.distance_km
  FROM hits h
  WHERE h.distance_km <= p_radius_km
  ORDER BY
    CASE WHEN p_sort = 'price' THEN
      CASE lower(COALESCE(p_fuel, 'e10')) WHEN 'e5' THEN h.e5 WHEN 'b7' THEN h.b7 ELSE h.e10 END
    END ASC NULLS LAST,
    h.distance_km ASC
  LIMIT GREATEST(1, LEAST(p_limit, 200))
$$;

-- Only the edge function (service role) calls this.
REVOKE ALL ON FUNCTION public.nearby_fuel_stations(double precision, double precision, double precision, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_fuel_stations(double precision, double precision, double precision, text, int, text) TO service_role;
