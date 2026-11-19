// UK fuel prices endpoint (Super Admin only).
//
//   POST { action: "search", query?: "LS1 4AP" | "Leeds", lat?: 53.8, lng?: -1.55,
//          radius_km?: 10, fuel?: "e10"|"e5"|"b7", limit?: 20, sort?: "distance"|"price" }
//   POST { action: "status" }
//   POST { action: "refresh", force?: true }        (Super Admin, or the x-cron-secret header)
//
// Data: FuelCosts.co.uk's free daily export, read from its Hugging Face copy (jamesb7/fuel-prices-uk):
//   stations.csv (9 MB)  +  the END of price_history.csv (175 MB; only the last few MB are read).
// It is downloaded at most once every 24 hours (the first search after that triggers it) and cached in the
// fuel_stations table. Prices not seen in the part of the history that was read keep yesterday's value.
//
// Optional secrets:  FUEL_STATIONS_URL, FUEL_PRICES_URL (override the two file addresses; the prices host
//                    must support HTTP Range requests, Hugging Face does)
//                    FUEL_CSV_TOKEN (sent as "Authorization: Bearer ...")
//                    FUEL_CRON_SECRET (lets a scheduler call "refresh" without a user login)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseCsv, parseStations, scanPriceLines, splitChunk, wantedKeys, buildRows, type LatestPrices, type SavedPrices } from "./csv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ROWS_TO_REPLACE = 50; // a file smaller than this is treated as a broken download
const DEFAULT_STATIONS_URL = "https://huggingface.co/datasets/jamesb7/fuel-prices-uk/resolve/main/stations.csv";
const DEFAULT_PRICES_URL = "https://huggingface.co/datasets/jamesb7/fuel-prices-uk/resolve/main/price_history.csv";
const CHUNK_BYTES = 8 * 1024 * 1024;       // read the price history this much at a time, newest first
const MAX_PRICE_BYTES = 32 * 1024 * 1024;  // never read further back than this (keeps CPU time in budget)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// ---------------------------------------------------------------------------
// Daily cache
// ---------------------------------------------------------------------------
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "niza-fuel/1.0", Accept: "text/csv,*/*" };
  const token = Deno.env.get("FUEL_CSV_TOKEN");
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Read price_history.csv from the end, one chunk at a time, until every wanted price is found or the cap is hit. */
async function readLatestPrices(url: string, wanted: Set<string>): Promise<{ latest: LatestPrices; bytesRead: number; missing: number }> {
  const latest: LatestPrices = new Map();
  let carry = "";
  let bytesRead = 0;
  let rangeStart = -1; // start byte of the chunk just read; -1 = nothing read yet

  while (bytesRead < MAX_PRICE_BYTES) {
    let headers: Record<string, string>;
    if (rangeStart < 0) {
      headers = { ...authHeaders(), Range: `bytes=-${CHUNK_BYTES}` };
    } else {
      if (rangeStart === 0) break; // reached the start of the file
      const end = rangeStart - 1;
      const start = Math.max(0, end - CHUNK_BYTES + 1);
      headers = { ...authHeaders(), Range: `bytes=${start}-${end}` };
    }

    const res = await fetchWithTimeout(url, { headers }, 60_000);
    if (res.status !== 206) {
      // A server that ignores Range would send the whole 175 MB file: refuse it.
      await res.body?.cancel();
      throw new Error(
        `The price file server does not support partial downloads (HTTP ${res.status}). ` +
        "Use the Hugging Face address for FUEL_PRICES_URL.",
      );
    }
    const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(res.headers.get("content-range") || "");
    if (!m) throw new Error("The price file server did not say which part it sent");
    const start = Number(m[1]);
    const text = await res.text();
    bytesRead += text.length;

    const { body, carry: nextCarry } = splitChunk(text, carry, start === 0);
    carry = nextCarry;
    scanPriceLines(body, latest);
    rangeStart = start;

    let have = 0;
    for (const k of wanted) if (latest.has(k)) have++;
    if (have >= wanted.size) break;
  }
  let missing = 0;
  for (const k of wanted) if (!latest.has(k)) missing++;
  return { latest, bytesRead, missing };
}

// deno-lint-ignore no-explicit-any
async function loadPreviousPrices(admin: any): Promise<Map<string, SavedPrices>> {
  const map = new Map<string, SavedPrices>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("fuel_stations").select("id, e10, e5, b7, source_updated_at").range(from, from + 999);
    if (error) throw new Error("Reading saved prices failed: " + error.message);
    // deno-lint-ignore no-explicit-any
    for (const r of (data || []) as any[]) {
      map.set(r.id, {
        e10: r.e10 === null ? null : Number(r.e10),
        e5: r.e5 === null ? null : Number(r.e5),
        b7: r.b7 === null ? null : Number(r.b7),
        source_updated_at: r.source_updated_at,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return map;
}

// deno-lint-ignore no-explicit-any
async function refreshCache(admin: any, force: boolean) {
  const stationsUrl = Deno.env.get("FUEL_STATIONS_URL") || DEFAULT_STATIONS_URL;
  const pricesUrl = Deno.env.get("FUEL_PRICES_URL") || DEFAULT_PRICES_URL;

  const { data: sync } = await admin.from("fuel_price_sync").select("*").eq("id", 1).maybeSingle();
  if (!force && sync?.status === "running" && sync.last_attempt_at &&
      Date.now() - new Date(sync.last_attempt_at).getTime() < 10 * 60 * 1000) {
    return { skipped: "A refresh is already running" };
  }

  const runStart = new Date().toISOString();
  await admin.from("fuel_price_sync").update({ status: "running", last_attempt_at: runStart, source_url: stationsUrl }).eq("id", 1);

  try {
    // 1. Stations (the whole file, about 9 MB)
    const sres = await fetchWithTimeout(stationsUrl, { headers: authHeaders() }, 90_000);
    if (!sres.ok) throw new Error(`The stations download failed (HTTP ${sres.status})`);
    const { stations, skipped, missing } = parseStations(parseCsv(await sres.text()), Date.now());
    if (missing.length > 0) {
      throw new Error(`The stations file is missing columns: ${missing.join(", ")}. Check FUEL_STATIONS_URL.`);
    }
    if (stations.length < MIN_ROWS_TO_REPLACE) {
      throw new Error(`Only ${stations.length} usable stations found, so the saved data was left as it was.`);
    }

    // 2. Latest prices (only the end of the big history file)
    const { latest, bytesRead, missing: unpriced } = await readLatestPrices(pricesUrl, wantedKeys(stations));
    if (latest.size < MIN_ROWS_TO_REPLACE) {
      throw new Error(`Only ${latest.size} prices found in the price history, so the saved data was left as it was.`);
    }

    // 3. Combine with yesterday's prices for anything that has not changed recently
    const previous = await loadPreviousPrices(admin);
    const { rows, withoutPrice, fromPrevious } = buildRows(stations, latest, previous, runStart);
    if (rows.length < MIN_ROWS_TO_REPLACE) {
      throw new Error("Too few stations ended up with a price, so the saved data was left as it was.");
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("fuel_stations").upsert(rows.slice(i, i + 500), { onConflict: "id" });
      if (error) throw new Error("Saving stations failed: " + error.message);
    }
    // Stations no longer in today's file (closed, or stopped reporting) are removed.
    const { error: delError } = await admin.from("fuel_stations").delete().lt("fetched_at", runStart);
    if (delError) throw new Error("Cleaning old stations failed: " + delError.message);

    await admin.from("fuel_price_sync").update({
      status: "ok", last_fetched_at: runStart, row_count: rows.length, skipped_count: skipped + withoutPrice, error: null,
    }).eq("id", 1);
    return {
      rows: rows.length,
      skipped: skipped + withoutPrice,
      price_history_mb_read: Math.round(bytesRead / 1048576),
      prices_still_missing: unpriced,
      kept_from_yesterday: fromPrevious,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("fuel_price_sync").update({ status: "error", error: message }).eq("id", 1);
    throw new Error(message);
  }
}

// deno-lint-ignore no-explicit-any
async function ensureFresh(admin: any) {
  const { data: sync } = await admin.from("fuel_price_sync").select("*").eq("id", 1).maybeSingle();
  const fresh = sync?.last_fetched_at && Date.now() - new Date(sync.last_fetched_at).getTime() < DAY_MS;
  if (fresh) return { stale: false, warning: null as string | null };
  try {
    await refreshCache(admin, false);
    return { stale: false, warning: null };
  } catch (e) {
    // Keep serving yesterday's data if there is any.
    const { count } = await admin.from("fuel_stations").select("id", { count: "exact", head: true });
    if ((count || 0) > 0) {
      return { stale: true, warning: "Showing the last saved prices. Today's refresh failed: " + (e instanceof Error ? e.message : String(e)) };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Place -> coordinates (postcodes.io is free and needs no key)
// ---------------------------------------------------------------------------
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

async function getJson(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return await res.json();
}

// deno-lint-ignore no-explicit-any
async function geocode(admin: any, query: string): Promise<{ lat: number; lng: number; label: string }> {
  const q = query.trim();
  if (!q) throw new Error("Enter a postcode, a city, or latitude and longitude");

  if (FULL_POSTCODE.test(q)) {
    const compact = q.replace(/\s+/g, "").toUpperCase();
    const body = await getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`);
    const r = body?.result;
    if (r?.latitude && r?.longitude) {
      return { lat: r.latitude, lng: r.longitude, label: `${r.postcode}${r.admin_district ? ", " + r.admin_district : ""}` };
    }
    throw new Error(`Postcode "${q.toUpperCase()}" was not found`);
  }
  if (OUTCODE.test(q)) {
    const body = await getJson(`https://api.postcodes.io/outcodes/${encodeURIComponent(q.toUpperCase())}`);
    const r = body?.result;
    if (r?.latitude && r?.longitude) return { lat: r.latitude, lng: r.longitude, label: r.outcode };
  }

  // A city or town name.
  const places = await getJson(`https://api.postcodes.io/places?q=${encodeURIComponent(q)}&limit=10`);
  // deno-lint-ignore no-explicit-any
  const list: any[] = (places?.result || []).filter((p: any) => p.latitude && p.longitude);
  // deno-lint-ignore no-explicit-any
  const best = list.find((p: any) => /city|town/i.test(p.local_type || "")) || list[0];
  if (best) {
    return { lat: best.latitude, lng: best.longitude, label: `${best.name_1}${best.county_unitary ? ", " + best.county_unitary : ""}` };
  }

  // Last resort: the middle of the stations we hold for that city.
  const { data } = await admin.from("fuel_stations").select("latitude, longitude").ilike("city", q).limit(500);
  if (data && data.length > 0) {
    // deno-lint-ignore no-explicit-any
    const lat = data.reduce((a: number, s: any) => a + s.latitude, 0) / data.length;
    // deno-lint-ignore no-explicit-any
    const lng = data.reduce((a: number, s: any) => a + s.longitude, 0) / data.length;
    return { lat, lng, label: q };
  }
  throw new Error(`Could not find "${q}". Try a postcode or a nearby town.`);
}

// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Missing environment configuration");

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "search";

    // Who is calling: a signed-in Super Admin, or a scheduler holding the cron secret (refresh only).
    const cronSecret = Deno.env.get("FUEL_CRON_SECRET");
    const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret && action === "refresh";
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Missing authorization header");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) throw new Error("Unauthorized");
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles || []).some((r: { role: string }) => r.role === "super_admin")) {
        throw new Error("Only a Super Admin can use fuel prices");
      }
    }

    if (action === "status") {
      const { data: sync } = await admin.from("fuel_price_sync").select("*").eq("id", 1).maybeSingle();
      return json({ success: true, sync, source_configured: true });
    }

    if (action === "refresh") {
      const result = await refreshCache(admin, body.force === true);
      const { data: sync } = await admin.from("fuel_price_sync").select("*").eq("id", 1).maybeSingle();
      return json({ success: true, result, sync });
    }

    if (action !== "search") throw new Error("Unknown action");

    const cache = await ensureFresh(admin);

    // Where to search from: latitude/longitude, or a postcode / city typed in `query`.
    let center: { lat: number; lng: number; label: string };
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (body.lat !== undefined && body.lng !== undefined && body.lat !== "" && body.lng !== "" &&
        Number.isFinite(lat) && Number.isFinite(lng)) {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("Latitude or longitude is out of range");
      center = { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    } else {
      center = await geocode(admin, String(body.query ?? body.postcode ?? body.city ?? ""));
    }

    const radius = Math.min(Math.max(Number(body.radius_km) || 10, 0.5), 100);
    const limit = Math.min(Math.max(Math.floor(Number(body.limit) || 20), 1), 100);
    const fuelIn = String(body.fuel || "e10").toLowerCase();
    const fuel = ["e10", "e5", "b7"].includes(fuelIn) ? fuelIn : null;
    const sort = body.sort === "price" ? "price" : "distance";

    const { data, error } = await admin.rpc("nearby_fuel_stations", {
      p_lat: center.lat, p_lng: center.lng, p_radius_km: radius, p_fuel: fuel, p_limit: limit, p_sort: sort,
    });
    if (error) throw new Error("Search failed: " + error.message);

    const { data: sync } = await admin.from("fuel_price_sync").select("last_fetched_at, row_count").eq("id", 1).maybeSingle();

    // deno-lint-ignore no-explicit-any
    const stations = (data || []).map((s: any) => ({
      id: s.id,
      brand: s.brand,
      name: s.name,
      address: s.address,
      city: s.city,
      postcode: s.postcode,
      latitude: s.latitude,
      longitude: s.longitude,
      distance_km: Math.round(s.distance_km * 100) / 100,
      prices: {
        e10: s.e10 === null ? null : Number(s.e10),
        e5: s.e5 === null ? null : Number(s.e5),
        b7: s.b7 === null ? null : Number(s.b7),
      },
      price: fuel ? (s[fuel] === null ? null : Number(s[fuel])) : null,
      price_updated_at: s.source_updated_at,
    }));

    return json({
      success: true,
      center,
      radius_km: radius,
      fuel: fuel || "any",
      sort,
      count: stations.length,
      stations,
      cache: { last_fetched_at: sync?.last_fetched_at ?? null, stations_held: sync?.row_count ?? 0, stale: cache.stale, warning: cache.warning },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An error occurred";
    console.error("fuel-prices error:", message);
    // 200 so the app can show the message (invoke() hides the body of non-2xx replies).
    return json({ success: false, error: message });
  }
});
