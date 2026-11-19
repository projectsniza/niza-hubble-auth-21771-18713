// Dates in UK local time (Europe/London), as "YYYY-MM-DD" text.
// `new Date().toISOString().split('T')[0]` gives the UTC date, which is the wrong day for
// the first hour after midnight in summer (BST) and for any local date built at midnight.

const UK = 'Europe/London';

/** UK calendar date of a moment, as YYYY-MM-DD. */
export function toUKDate(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: UK, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function todayUK(): string {
  return toUKDate(new Date());
}

/** A plain local calendar date (as picked in a date picker) as YYYY-MM-DD, with no timezone shift. */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First and last day (YYYY-MM-DD) of the month containing `d`, in UK time. */
export function monthRangeUK(d: Date | string = new Date()): { start: string; end: string } {
  const [y, m] = toUKDate(d).split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

/** dd/mm/yyyy for display. */
export function formatUKDate(d: Date | string): string {
  const [y, m, day] = toUKDate(d).split('-');
  return `${day}/${m}/${y}`;
}
