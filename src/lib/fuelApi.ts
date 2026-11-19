import { supabase } from '@/integrations/supabase/client';

export type FuelType = 'e10' | 'e5' | 'b7';

export interface FuelStation {
  id: string;
  brand: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  prices: { e10: number | null; e5: number | null; b7: number | null };
  price: number | null;
  price_updated_at: string | null;
}

export interface FuelSearchParams {
  query?: string;
  lat?: number;
  lng?: number;
  radius_km: number;
  fuel: FuelType;
  limit: number;
  sort: 'distance' | 'price';
}

export interface FuelSearchResult {
  center: { lat: number; lng: number; label: string };
  radius_km: number;
  fuel: string;
  count: number;
  stations: FuelStation[];
  cache: {
    last_fetched_at: string | null;
    source_published_at: string | null;
    stations_held: number;
    stale: boolean;
    refreshing: boolean;
    warning: string | null;
  };
}

export interface FuelSync {
  last_fetched_at: string | null;
  last_attempt_at: string | null;
  last_checked_at: string | null;
  source_published_at: string | null;
  source_version: string | null;
  status: 'never' | 'running' | 'ok' | 'error';
  row_count: number;
  skipped_count: number;
  source_url: string | null;
  error: string | null;
}

async function call<T>(body: Record<string, unknown>): Promise<T & { success: true }> {
  const { data, error } = await supabase.functions.invoke('fuel-prices', { body });
  if (error) throw new Error(error.message || 'The fuel prices service could not be reached');
  if (!data?.success) throw new Error(data?.error || 'The fuel prices service returned an error');
  return data;
}

export const searchFuelStations = (params: FuelSearchParams) =>
  call<FuelSearchResult>({ action: 'search', ...params });

export const getFuelStatus = () =>
  call<{ sync: FuelSync | null; source_configured: boolean }>({ action: 'status' });

/** Check whether the source published new data and download it only if so. */
export const syncFuelPrices = () =>
  call<{ result: { changed: boolean; reason?: string; rows?: number }; sync: FuelSync | null }>({ action: 'sync' });

/** Download now, even if nothing new was published. */
export const refreshFuelPrices = () =>
  call<{ result: { rows?: number; skipped?: number | string }; sync: FuelSync | null }>({ action: 'refresh', force: true });

export const KM_PER_MILE = 1.609344;

// ---------------------------------------------------------------------------
// Saved locations (kept for good, shown without configuring again)
// ---------------------------------------------------------------------------
export interface SavedLocation {
  id: string;
  name: string;
  kind: 'place' | 'coords';
  query: string | null;
  latitude: number;
  longitude: number;
  place_label: string | null;
  radius_miles: number;
  fuel: FuelType;
  sort: 'price' | 'distance';
  result_limit: number;
  position: number;
}

export type SavedLocationInput = Omit<SavedLocation, 'id' | 'position'>;

export async function listSavedLocations(): Promise<SavedLocation[]> {
  const { data, error } = await supabase
    .from('fuel_saved_searches')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({ ...r, radius_miles: Number(r.radius_miles) })) as SavedLocation[];
}

export async function createSavedLocation(input: SavedLocationInput, position: number): Promise<void> {
  const { error } = await supabase.from('fuel_saved_searches').insert({ ...input, position });
  if (error) throw new Error(error.message);
}

export async function updateSavedLocation(id: string, input: SavedLocationInput): Promise<void> {
  const { error } = await supabase.from('fuel_saved_searches').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSavedLocation(id: string): Promise<void> {
  const { error } = await supabase.from('fuel_saved_searches').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Run a saved location's search (it already holds coordinates, so no lookup is needed). */
export const runSavedLocation = (s: SavedLocation) =>
  searchFuelStations({
    lat: s.latitude,
    lng: s.longitude,
    radius_km: s.radius_miles * KM_PER_MILE,
    fuel: s.fuel,
    limit: s.result_limit,
    sort: s.sort,
  });
