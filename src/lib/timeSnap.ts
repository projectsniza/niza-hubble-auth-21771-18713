// Configurable time-increment snapping for scheduling shifts.
// Default increment is 30 (half-hour). Super Admin can change via Rota Settings.

const VALID_INCREMENTS = [5, 10, 15, 20, 30, 60] as const;
export type TimeIncrement = (typeof VALID_INCREMENTS)[number];

let CURRENT_INCREMENT: TimeIncrement = 30;

export function setGlobalTimeIncrement(mins: number) {
  const n = Number(mins);
  if ((VALID_INCREMENTS as readonly number[]).includes(n)) {
    CURRENT_INCREMENT = n as TimeIncrement;
  }
}
export function getGlobalTimeIncrement(): TimeIncrement {
  return CURRENT_INCREMENT;
}

// Snap a HH:MM string to nearest multiple of `mins` (defaults to global setting).
export function snapToIncrement(value: string | null | undefined, mins?: number): string {
  const step = mins ?? CURRENT_INCREMENT;
  if (!value) return value || '';
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  let h = parseInt(m[1], 10);
  let minutes = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(minutes)) return value;
  const rounded = Math.round(minutes / step) * step;
  if (rounded >= 60) {
    minutes = 0;
    h = (h + 1) % 24;
  } else {
    minutes = rounded;
  }
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function isIncrementAligned(value: string | null | undefined, mins?: number): boolean {
  const step = mins ?? CURRENT_INCREMENT;
  if (!value) return true;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return true;
  const minutes = parseInt(m[2], 10);
  return minutes % step === 0;
}

// Backward-compatible helpers (used by existing call sites).
export const snapToHalfHour = (v: string | null | undefined) => snapToIncrement(v, CURRENT_INCREMENT);
export const isHalfHourAligned = (v: string | null | undefined) => isIncrementAligned(v, CURRENT_INCREMENT);

// HTML <input type="time"> step attribute (seconds).
export const HALF_HOUR_TIME_STEP = 1800;
export const timeStepSeconds = (mins?: number) => (mins ?? CURRENT_INCREMENT) * 60;
