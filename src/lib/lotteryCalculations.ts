/**
 * Pure lottery (scratchcard) calculations, shared by the Lottery page, its export and
 * the Visualization. Kept free of React / Supabase so they can be unit tested.
 */

export interface PriceRow {
  effective_date: string; // yyyy-MM-dd
  ticket_price: number | string;
}

/**
 * Ticket price in force on `dateStr`.
 * Uses the newest history row on or before the date. Days before the first history row
 * use the EARLIEST known price - never the current price - so a later price change can
 * never re-value earlier days. `fallback` is only used when there is no history at all.
 */
export function priceOnDate(history: readonly PriceRow[], dateStr: string, fallback: number): number {
  if (!history.length) return Number(fallback) || 0;
  let active: number | null = null;
  let earliest: PriceRow | null = null;
  let earliestOnOrBefore: PriceRow | null = null;
  for (const row of history) {
    if (!earliest || row.effective_date < earliest.effective_date) earliest = row;
    if (row.effective_date <= dateStr && (!earliestOnOrBefore || row.effective_date >= earliestOnOrBefore.effective_date)) {
      earliestOnOrBefore = row;
    }
  }
  if (earliestOnOrBefore) active = Number(earliestOnOrBefore.ticket_price);
  else if (earliest) active = Number(earliest.ticket_price);
  return Number.isFinite(active) && active !== null ? active : Number(fallback) || 0;
}

/** Tickets sold = opening + activated - closing - returned/removed. Null until a closing is entered. */
export function ticketsSold(
  stockBegin: number,
  activated: number,
  stockEnd: number | null,
  returned = 0,
): number | null {
  if (stockEnd === null || stockEnd === undefined) return null;
  return Math.max(0, (Number(stockBegin) || 0) + (Number(activated) || 0) - (Number(stockEnd) || 0) - (Number(returned) || 0));
}

export interface SlotAssignment {
  id: string;
  slot_number: number;
  game_id: string;
  effective_from: string; // yyyy-MM-dd
  effective_to: string | null; // inclusive, null = still in the slot
}

export interface SlotSegment {
  assignmentId: string;
  gameId: string;
  slot: number;
  /** first day shown in this month (inclusive) */
  from: string;
  /** last day shown in this month (inclusive) */
  to: string;
  /** the assignment started before this month */
  startsBefore: boolean;
  /** the assignment continues after this month */
  endsAfter: boolean;
  /** if the same game was in another slot the day before, that slot number */
  movedFromSlot: number | null;
}

export interface SlotGroup {
  slot: number;
  segments: SlotSegment[];
}

const prevDay = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
};

/**
 * Group dated slot assignments into one entry per dispenser slot for a month, each with
 * the ordered game segments that occupied it. A mid-day swap shows both games on the
 * change date (the old segment ends on it, the new one starts on it).
 */
export function buildSlotSegments(assignments: readonly SlotAssignment[], monthStart: string, monthEnd: string): SlotGroup[] {
  const bySlot = new Map<number, SlotSegment[]>();
  for (const a of assignments) {
    const end = a.effective_to ?? '9999-12-31';
    if (a.effective_from > monthEnd || end < monthStart) continue; // no overlap with this month
    const dayBefore = prevDay(a.effective_from);
    const movedFrom = assignments.find(
      (o) => o.game_id === a.game_id && o.id !== a.id && o.slot_number !== a.slot_number && o.effective_to === dayBefore,
    );
    const seg: SlotSegment = {
      assignmentId: a.id,
      gameId: a.game_id,
      slot: a.slot_number,
      from: a.effective_from > monthStart ? a.effective_from : monthStart,
      to: end < monthEnd ? end : monthEnd,
      startsBefore: a.effective_from < monthStart,
      endsAfter: end > monthEnd,
      movedFromSlot: movedFrom ? movedFrom.slot_number : null,
    };
    const list = bySlot.get(a.slot_number) || [];
    list.push(seg);
    bySlot.set(a.slot_number, list);
  }
  return Array.from(bySlot.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([slot, segments]) => ({
      slot,
      segments: segments.sort((x, y) => (x.from === y.from ? x.to.localeCompare(y.to) : x.from.localeCompare(y.from))),
    }));
}

/** True when `dateStr` falls inside the segment (inclusive). */
export const segmentCovers = (seg: Pick<SlotSegment, 'from' | 'to'>, dateStr: string) => dateStr >= seg.from && dateStr <= seg.to;
