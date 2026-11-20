// How a station's price compares with the other stations in the same search.
//
//   Cheapest : the lowest price in the list
//   Low      : at least 1p a litre below the area average
//   High     : at least 1p a litre above the area average
//   Average  : within 1p of the average
//
// The 1p band keeps a tiny difference (for example 0.3p) from being labelled "low" or "high".

export type PriceLevel = 'cheapest' | 'low' | 'average' | 'high';

export const LEVEL_BAND_PENCE = 1;

export interface LevelStats {
  min: number;
  avg: number;
  count: number;
}

/** Lowest, average and number of the given prices (ignores missing ones). Null when there are none. */
export function levelStats(prices: Array<number | null | undefined>): LevelStats | null {
  const xs = prices.filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (xs.length === 0) return null;
  return { min: Math.min(...xs), avg: xs.reduce((a, b) => a + b, 0) / xs.length, count: xs.length };
}

export function priceLevel(price: number | null | undefined, stats: LevelStats | null): PriceLevel | null {
  if (price === null || price === undefined || !stats) return null;
  if (price === stats.min) return 'cheapest';
  const diff = price - stats.avg;
  if (diff <= -LEVEL_BAND_PENCE) return 'low';
  if (diff >= LEVEL_BAND_PENCE) return 'high';
  return 'average';
}

export const LEVEL_LABEL: Record<PriceLevel, string> = {
  cheapest: 'Cheapest',
  low: 'Low',
  average: 'Average',
  high: 'High',
};

/** Bar / marker colours (hex) used by the charts, matching the tag colours. */
export const LEVEL_COLOR: Record<PriceLevel, string> = {
  cheapest: '#059669',
  low: '#10b981',
  average: '#f59e0b',
  high: '#f43f5e',
};
