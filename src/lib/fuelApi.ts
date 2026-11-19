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
  cache: { last_fetched_at: string | null; stations_held: number; stale: boolean; warning: string | null };
}

export interface FuelSync {
  last_fetched_at: string | null;
  last_attempt_at: string | null;
  status: 'never' | 'running' | 'ok' | 'error';
  row_count: number;
  skipped_count: number;
  source_url: string | null;
  error: string | null;
}

// deno-lint-ignore no-explicit-any
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

export const refreshFuelPrices = () =>
  call<{ result: { rows?: number; skipped?: number | string }; sync: FuelSync | null }>({ action: 'refresh', force: true });

export const KM_PER_MILE = 1.609344;
