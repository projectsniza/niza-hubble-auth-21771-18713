-- =====================================================================
-- Niza Fuel: access by custom role, saved locations per person, and market overview for the charts
-- Safe to run more than once. No existing data is deleted.
-- =====================================================================

-- 1. Who may use Niza Fuel: a Super Admin, or anyone whose (active) custom role has "Niza Fuel" switched on.
--    Full HR accounts and store accounts WITHOUT a custom role do not get it by default.
CREATE OR REPLACE FUNCTION public.fuel_access_for(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user AND ur.role = 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.custom_roles cr ON cr.id = p.custom_role_id
      WHERE p.id = p_user
        AND p.is_active IS DISTINCT FROM false
        AND cr.is_active IS DISTINCT FROM false
        AND COALESCE(cr.app_access ->> 'niza_fuel', 'false') = 'true'
    )
$$;

CREATE OR REPLACE FUNCTION public.can_use_niza_fuel()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.fuel_access_for(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.fuel_access_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fuel_access_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_use_niza_fuel() TO authenticated;

-- 2. The cached prices can be read by anyone with access (writes still happen only through the edge function).
DROP POLICY IF EXISTS "Super admins read fuel stations" ON public.fuel_stations;
DROP POLICY IF EXISTS "Fuel users read fuel stations" ON public.fuel_stations;
CREATE POLICY "Fuel users read fuel stations" ON public.fuel_stations
FOR SELECT TO authenticated USING (public.can_use_niza_fuel());

DROP POLICY IF EXISTS "Super admins read fuel sync" ON public.fuel_price_sync;
DROP POLICY IF EXISTS "Fuel users read fuel sync" ON public.fuel_price_sync;
CREATE POLICY "Fuel users read fuel sync" ON public.fuel_price_sync
FOR SELECT TO authenticated USING (public.can_use_niza_fuel());

-- 3. Saved locations belong to the person who made them: every login keeps its own list.
DROP POLICY IF EXISTS "Super admins manage saved fuel searches" ON public.fuel_saved_searches;
DROP POLICY IF EXISTS "Users manage their own saved fuel searches" ON public.fuel_saved_searches;
CREATE POLICY "Users manage their own saved fuel searches" ON public.fuel_saved_searches
FOR ALL TO authenticated
USING (created_by = auth.uid() AND public.can_use_niza_fuel())
WITH CHECK (created_by = auth.uid() AND public.can_use_niza_fuel());

-- 4. Numbers for the Charts tab, worked out in the database from the saved copy of the prices:
--    statistics, a price histogram, brand averages and the cheapest / dearest cities.
CREATE OR REPLACE FUNCTION public.fuel_market_overview(p_fuel text DEFAULT 'e10')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_fuel text := CASE WHEN lower(coalesce(p_fuel, 'e10')) IN ('e10', 'e5', 'b7') THEN lower(coalesce(p_fuel, 'e10')) ELSE 'e10' END;
  v_result jsonb;
BEGIN
  WITH p AS (
    SELECT s.brand, s.city,
           (CASE v_fuel WHEN 'e5' THEN s.e5 WHEN 'b7' THEN s.b7 ELSE s.e10 END)::numeric AS price
    FROM public.fuel_stations s
  ),
  pr AS (SELECT * FROM p WHERE price IS NOT NULL),
  stats AS (
    SELECT count(*) AS n,
           round(avg(price), 1) AS avg,
           min(price) AS min,
           max(price) AS max,
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY price))::numeric, 1) AS median,
           percentile_cont(0.01) WITHIN GROUP (ORDER BY price) AS p01,
           percentile_cont(0.99) WITHIN GROUP (ORDER BY price) AS p99
    FROM pr
  ),
  edges AS (SELECT floor(p01)::int AS lo, ceil(p99)::int AS hi FROM stats),
  buckets AS (
    SELECT g AS b_lo FROM edges, generate_series(edges.lo, edges.hi, 2) AS g
  ),
  hist AS (
    SELECT b.b_lo, count(pr.price) AS cnt
    FROM buckets b
    LEFT JOIN pr ON (
      CASE
        WHEN b.b_lo = (SELECT lo FROM edges) THEN pr.price < b.b_lo + 2           -- everything cheaper goes in the first bar
        WHEN b.b_lo + 2 > (SELECT hi FROM edges) THEN pr.price >= b.b_lo         -- everything dearer goes in the last bar
        ELSE pr.price >= b.b_lo AND pr.price < b.b_lo + 2
      END
    )
    GROUP BY b.b_lo
  ),
  brands AS (
    SELECT initcap(lower(brand)) AS name, count(*) AS stations, round(avg(price), 1) AS avg, min(price) AS min
    FROM pr
    WHERE brand IS NOT NULL AND brand <> ''
    GROUP BY initcap(lower(brand))
    ORDER BY count(*) DESC, initcap(lower(brand))
    LIMIT 12
  ),
  cities AS (
    SELECT initcap(lower(city)) AS name, count(*) AS stations, round(avg(price), 1) AS avg
    FROM pr
    WHERE city IS NOT NULL AND city <> ''
    GROUP BY initcap(lower(city))
    HAVING count(*) >= 8
  ),
  cheap AS (SELECT * FROM cities ORDER BY avg ASC, stations DESC LIMIT 8),
  dear AS (SELECT * FROM cities ORDER BY avg DESC, stations DESC LIMIT 8),
  fuels AS (
    SELECT round(avg(e10), 1) AS e10, round(avg(e5), 1) AS e5, round(avg(b7), 1) AS b7,
           count(e10) AS n_e10, count(e5) AS n_e5, count(b7) AS n_b7
    FROM public.fuel_stations
  )
  SELECT jsonb_build_object(
    'fuel', v_fuel,
    'stats', (SELECT to_jsonb(stats) - 'p01' - 'p99' FROM stats),
    'histogram', COALESCE((SELECT jsonb_agg(jsonb_build_object('from', hist.b_lo, 'to', hist.b_lo + 2, 'count', hist.cnt) ORDER BY hist.b_lo) FROM hist), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(brands)) FROM brands), '[]'::jsonb),
    'cities_cheapest', COALESCE((SELECT jsonb_agg(to_jsonb(cheap) ORDER BY cheap.avg ASC) FROM cheap), '[]'::jsonb),
    'cities_dearest', COALESCE((SELECT jsonb_agg(to_jsonb(dear) ORDER BY dear.avg DESC) FROM dear), '[]'::jsonb),
    'fuel_averages', (SELECT to_jsonb(fuels) FROM fuels)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Only the edge function (service role) calls this.
REVOKE ALL ON FUNCTION public.fuel_market_overview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fuel_market_overview(text) TO service_role;
