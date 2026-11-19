// Pure helpers for the fuel-prices function (kept separate so they can be unit-tested).
//
// Data comes from FuelCosts.co.uk's daily export (also on Hugging Face: jamesb7/fuel-prices-uk):
//   stations.csv       one row per station: node_id, names, coordinates, address, closed flags, fuel_types ...
//   price_history.csv  one row per price CHANGE: id, node_id, fuel_type, price_pence, recorded_at, source_updated_at
// The history file is large (about 175 MB) and sorted oldest to newest, so the latest price of each
// station and fuel is found by reading it from the END (see scanPriceLines).

// ---------------------------------------------------------------------------
// CSV parsing (quotes, commas and line breaks inside quotes, CRLF). Slice-based, so it is fast.
// ---------------------------------------------------------------------------
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const n = text.length;
  const rows: string[][] = [];
  let row: string[] = [];
  let pos = 0;
  let nextNl = text.indexOf("\n");
  if (nextNl < 0) nextNl = n;

  while (pos < n) {
    let field = "";
    let endOfRow = false;

    if (text.charCodeAt(pos) === 34) {
      // Quoted field: "" inside means a literal quote.
      let i = pos + 1;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q < 0) { field += text.slice(i); i = n; break; }
        field += text.slice(i, q);
        if (text.charCodeAt(q + 1) === 34) { field += '"'; i = q + 2; }
        else { i = q + 1; break; }
      }
      pos = i;
      if (pos >= n) endOfRow = true;
      else if (text.charCodeAt(pos) === 44) pos++;
      else {
        if (text.charCodeAt(pos) === 13) pos++;
        if (text.charCodeAt(pos) === 10) pos++;
        endOfRow = true;
      }
    } else {
      if (nextNl < pos) {
        nextNl = text.indexOf("\n", pos);
        if (nextNl < 0) nextNl = n;
      }
      const comma = text.indexOf(",", pos);
      if (comma >= 0 && comma < nextNl) {
        field = text.slice(pos, comma);
        pos = comma + 1;
      } else {
        const end = nextNl > pos && text.charCodeAt(nextNl - 1) === 13 ? nextNl - 1 : nextNl;
        field = text.slice(pos, end);
        pos = nextNl + 1;
        endOfRow = true;
      }
    }

    row.push(field);
    if (endOfRow) {
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    }
  }
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
  return rows;
}

/** Price as pounds (1.339), pence (133.9) or tenths of a penny (1339) -> pence, or null if it is not a real pump price. */
export function toPence(raw: string | undefined): number | null {
  if (!raw) return null;
  const v = parseFloat(String(raw).replace(/[£,\sp]/gi, ""));
  if (!Number.isFinite(v) || v <= 0) return null;
  let pence: number;
  if (v < 4) pence = v * 100;
  else if (v < 400) pence = v;
  else if (v < 4000) pence = v / 10;
  else return null;
  if (pence < 80 || pence > 400) return null;
  return Math.round(pence * 10) / 10;
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
export type FuelCol = "e10" | "e5" | "b7";

export interface StationBase {
  id: string;
  brand: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
  /** Fuels the station sells (from its fuel_types column). */
  fuels: Set<FuelCol>;
}

const isTrue = (v: string | undefined) => String(v ?? "").trim().toLowerCase() === "true";

/** "B7_STANDARD" / "B7_PREMIUM" both mean diesel for our purposes. */
function fuelColFromType(t: string): FuelCol | null {
  const u = t.trim().toUpperCase();
  if (u === "E10") return "e10";
  if (u === "E5") return "e5";
  if (u === "B7_STANDARD" || u === "B7_PREMIUM" || u === "B7") return "b7";
  return null;
}

const STALE_AFTER_DAYS = 7; // a station not seen in the feed for this long has stopped reporting

export function parseStations(
  table: string[][],
  nowMs: number
): { stations: StationBase[]; skipped: number; missing: string[] } {
  if (table.length < 2) return { stations: [], skipped: 0, missing: ["a header row and data"] };
  const h = table[0].map((x) => x.trim().toLowerCase());
  const idx = (name: string) => h.indexOf(name);
  const c = {
    id: idx("node_id"),
    name: idx("trading_name"),
    brand: idx("brand_name"),
    lat: idx("latitude"),
    lng: idx("longitude"),
    addr: idx("address_line_1"),
    city: idx("city"),
    postcode: idx("postcode"),
    tempClosed: idx("is_temporarily_closed"),
    permClosed: idx("is_permanently_closed"),
    fuelTypes: idx("fuel_types"),
    lastSeen: idx("last_seen"),
  };
  const missing = ["node_id", "latitude", "longitude"].filter((k) => idx(k) < 0);
  if (missing.length > 0) return { stations: [], skipped: 0, missing };

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const stations: StationBase[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let n = 1; n < table.length; n++) {
    const r = table[n];
    const id = get(r, c.id);
    if (!id || seen.has(id)) { skipped++; continue; }
    if (isTrue(get(r, c.tempClosed)) || isTrue(get(r, c.permClosed))) { skipped++; continue; }

    const lastSeen = Date.parse(get(r, c.lastSeen));
    if (Number.isFinite(lastSeen) && nowMs - lastSeen > STALE_AFTER_DAYS * 86_400_000) { skipped++; continue; }

    let lat = parseFloat(get(r, c.lat));
    let lng = parseFloat(get(r, c.lng));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue; }
    if (Math.abs(lat) < 10 && lng > 45) { const t = lat; lat = lng; lng = t; } // swapped
    if (lat < 49.5 || lat > 61.0 || lng < -8.8 || lng > 2.1) { skipped++; continue; }

    const fuels = new Set<FuelCol>();
    const ft = get(r, c.fuelTypes);
    if (ft) {
      try {
        for (const t of JSON.parse(ft)) {
          const f = fuelColFromType(String(t));
          if (f) fuels.add(f);
        }
      } catch { /* an unreadable list just means no known fuels */ }
    }
    if (fuels.size === 0) { skipped++; continue; }

    const postcode = get(r, c.postcode).toUpperCase() || null;
    let address = get(r, c.addr) || null;
    // The address often already ends with the postcode; the app shows the postcode separately.
    if (address && postcode && address.toUpperCase().endsWith(postcode)) {
      address = address.slice(0, address.length - postcode.length).replace(/[,\s]+$/, "") || null;
    }

    seen.add(id);
    stations.push({
      id,
      brand: get(r, c.brand) || null,
      name: get(r, c.name) || null,
      address,
      city: get(r, c.city) || null,
      postcode,
      latitude: lat,
      longitude: lng,
      fuels,
    });
  }
  return { stations, skipped, missing: [] };
}

// ---------------------------------------------------------------------------
// Latest prices, read from the end of price_history.csv
// ---------------------------------------------------------------------------
export interface PricePoint {
  pence: number;
  at: string | null;
}

/** key = `${node_id}|${FUEL_TYPE}` e.g. "ab12...|B7_STANDARD" */
export type LatestPrices = Map<string, PricePoint>;

const PRICE_FUELS = new Set(["E10", "E5", "B7_STANDARD", "B7_PREMIUM"]);

/**
 * Read lines of one chunk of price_history.csv from the LAST line to the first, and remember the first
 * (= newest) valid price seen for each station and fuel. Rows have no quoted fields, so a plain split is safe.
 * `body` must contain only whole lines. Returns how many NEW station/fuel prices were found.
 */
export function scanPriceLines(body: string, latest: LatestPrices): number {
  let added = 0;
  let end = body.length;
  // Walk backwards line by line with indexOf (much cheaper than splitting the whole chunk).
  while (end > 0) {
    const nl = body.lastIndexOf("\n", end - 1);
    const lineStart = nl + 1;
    const lineEnd = end;
    end = nl; // next line ends at the newline we just found (-1 after the first line)
    if (lineEnd <= lineStart) continue; // empty line

    // columns: id, node_id, fuel_type, price_pence, recorded_at, source_updated_at
    const c1 = body.indexOf(",", lineStart);
    if (c1 < 0 || c1 >= lineEnd) continue;
    const c2 = body.indexOf(",", c1 + 1);
    if (c2 < 0 || c2 >= lineEnd) continue;
    const c3 = body.indexOf(",", c2 + 1);
    if (c3 < 0 || c3 >= lineEnd) continue;

    const fuel = body.slice(c2 + 1, c3);
    if (!PRICE_FUELS.has(fuel)) continue; // also skips the header line
    const key = body.slice(c1 + 1, c2) + "|" + fuel;
    if (latest.has(key)) continue; // a newer price for this station and fuel was already found

    const c4 = body.indexOf(",", c3 + 1);
    if (c4 < 0 || c4 >= lineEnd) continue;
    const pence = toPence(body.slice(c3 + 1, c4));
    if (pence === null) continue;

    const c5 = body.indexOf(",", c4 + 1);
    let at = "";
    if (c5 >= 0 && c5 < lineEnd) at = body.slice(c5 + 1, lineEnd).trim();
    if (!at) at = body.slice(c4 + 1, c5 >= 0 && c5 < lineEnd ? c5 : lineEnd).trim();
    latest.set(key, { pence, at: at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : null });
    added++;
  }
  return added;
}

/**
 * Cut one downloaded chunk into [whole lines] and the partial line at its start.
 * The partial first line belongs to the PREVIOUS chunk's end, so the caller carries it over.
 * `carry` is the partial first line of the chunk that came after this one (the file is read backwards).
 */
export function splitChunk(text: string, carry: string, isFileStart: boolean): { body: string; carry: string } {
  const joined = text + carry;
  if (isFileStart) return { body: joined, carry: "" };
  const nl = joined.indexOf("\n");
  if (nl < 0) return { body: "", carry: joined };
  return { body: joined.slice(nl + 1), carry: joined.slice(0, nl) };
}

// ---------------------------------------------------------------------------
// Put stations and prices together
// ---------------------------------------------------------------------------
export interface SavedPrices {
  e10: number | null;
  e5: number | null;
  b7: number | null;
  source_updated_at: string | null;
}

export interface StationRow {
  id: string;
  brand: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
  e10: number | null;
  e5: number | null;
  b7: number | null;
  source_updated_at: string | null;
  fetched_at: string;
}

/** The set of `${node_id}|${FUEL_TYPE}` keys we still need a price for. */
export function wantedKeys(stations: StationBase[]): Set<string> {
  const keys = new Set<string>();
  for (const s of stations) {
    if (s.fuels.has("e10")) keys.add(s.id + "|E10");
    if (s.fuels.has("e5")) keys.add(s.id + "|E5");
    if (s.fuels.has("b7")) keys.add(s.id + "|B7_STANDARD");
  }
  return keys;
}

/**
 * One row per station with its latest E10, E5 and B7. A price not seen in the part of the history we read
 * keeps the value saved yesterday (`previous`). Stations with no price at all are left out.
 */
export function buildRows(
  stations: StationBase[],
  latest: LatestPrices,
  previous: Map<string, SavedPrices>,
  fetchedAt: string
): { rows: StationRow[]; withoutPrice: number; fromPrevious: number } {
  const rows: StationRow[] = [];
  let withoutPrice = 0;
  let fromPrevious = 0;

  for (const s of stations) {
    const prev = previous.get(s.id);
    let newest: string | null = null;
    const bump = (at: string | null) => { if (at && (!newest || at > newest)) newest = at; };

    const pick = (fuel: FuelCol, ...keys: string[]): number | null => {
      if (!s.fuels.has(fuel)) return null;
      for (const k of keys) {
        const hit = latest.get(s.id + "|" + k);
        if (hit) { bump(hit.at); return hit.pence; }
      }
      const old = prev?.[fuel] ?? null;
      if (old !== null) { fromPrevious++; bump(prev?.source_updated_at ?? null); }
      return old;
    };

    const e10 = pick("e10", "E10");
    const e5 = pick("e5", "E5");
    const b7 = pick("b7", "B7_STANDARD", "B7_PREMIUM");
    if (e10 === null && e5 === null && b7 === null) { withoutPrice++; continue; }

    rows.push({
      id: s.id, brand: s.brand, name: s.name, address: s.address, city: s.city, postcode: s.postcode,
      latitude: s.latitude, longitude: s.longitude, e10, e5, b7, source_updated_at: newest, fetched_at: fetchedAt,
    });
  }
  return { rows, withoutPrice, fromPrevious };
}
