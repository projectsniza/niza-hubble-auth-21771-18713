// Snap a HH:MM time string to the nearest half hour (00 or 30).
// Returns the snapped value. If the input is empty/invalid, returns it as-is.
export function snapToHalfHour(value: string | null | undefined): string {
  if (!value) return value || '';
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  let h = parseInt(m[1], 10);
  let mins = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(mins)) return value;
  // Round to nearest 30
  const rounded = Math.round(mins / 30) * 30;
  if (rounded === 60) {
    mins = 0;
    h = (h + 1) % 24;
  } else {
    mins = rounded;
  }
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// True when a time string is already aligned to :00 or :30.
export function isHalfHourAligned(value: string | null | undefined): boolean {
  if (!value) return true;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return true;
  const mins = parseInt(m[2], 10);
  return mins === 0 || mins === 30;
}

// Props to spread onto a time <Input>: enforces 30-min step in browsers that support it.
export const HALF_HOUR_TIME_STEP = 1800; // seconds
