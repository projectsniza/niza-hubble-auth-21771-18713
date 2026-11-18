// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, it } from 'bun:test';
import { buildSlotSegments, priceOnDate, segmentCovers, ticketsSold } from './lotteryCalculations';

describe('priceOnDate', () => {
  const history = [
    { effective_date: '2026-11-01', ticket_price: 5 },
    { effective_date: '2026-11-14', ticket_price: 10 },
  ];

  it('keeps days before a mid-month change at the old price', () => {
    expect(priceOnDate(history, '2026-11-13', 10)).toBe(5);
    expect(priceOnDate(history, '2026-11-14', 10)).toBe(10);
    expect(priceOnDate(history, '2026-11-30', 10)).toBe(10);
  });

  it('values back-filled days before the first history row at the earliest price, not the current one', () => {
    const late = [
      { effective_date: '2026-11-10', ticket_price: 5 },
      { effective_date: '2026-11-20', ticket_price: 10 },
    ];
    expect(priceOnDate(late, '2026-11-02', 10)).toBe(5);
  });

  it('falls back to the given price only when there is no history', () => {
    expect(priceOnDate([], '2026-11-02', 3)).toBe(3);
  });

  it('works regardless of history order', () => {
    expect(priceOnDate([...history].reverse(), '2026-11-13', 10)).toBe(5);
  });
});

describe('ticketsSold', () => {
  it('subtracts returned / removed tickets', () => {
    expect(ticketsSold(100, 0, 60, 12)).toBe(28);
  });
  it('is null until a closing is entered', () => {
    expect(ticketsSold(100, 0, null, 0)).toBeNull();
  });
  it('never goes negative', () => {
    expect(ticketsSold(10, 0, 8, 5)).toBe(0);
  });
});

describe('buildSlotSegments', () => {
  it('shows both games on a mid-day swap date in the same slot', () => {
    const groups = buildSlotSegments(
      [
        { id: 'a', slot_number: 3, game_id: 'old', effective_from: '2026-10-01', effective_to: '2026-11-14' },
        { id: 'b', slot_number: 3, game_id: 'new', effective_from: '2026-11-14', effective_to: null },
      ],
      '2026-11-01',
      '2026-11-30',
    );
    expect(groups).toHaveLength(1);
    const [oldSeg, newSeg] = groups[0].segments;
    expect(oldSeg.gameId).toBe('old');
    expect(oldSeg.from).toBe('2026-11-01');
    expect(oldSeg.to).toBe('2026-11-14');
    expect(oldSeg.startsBefore).toBe(true);
    expect(newSeg.gameId).toBe('new');
    expect(newSeg.from).toBe('2026-11-14');
    expect(newSeg.to).toBe('2026-11-30');
    expect(segmentCovers(oldSeg, '2026-11-14') && segmentCovers(newSeg, '2026-11-14')).toBe(true);
  });

  it('marks a moved game and does not overlap the old slot', () => {
    const groups = buildSlotSegments(
      [
        { id: 'a', slot_number: 2, game_id: 'g', effective_from: '2026-10-01', effective_to: '2026-11-11' },
        { id: 'b', slot_number: 5, game_id: 'g', effective_from: '2026-11-12', effective_to: null },
      ],
      '2026-11-01',
      '2026-11-30',
    );
    expect(groups.map((g) => g.slot)).toEqual([2, 5]);
    expect(groups[0].segments[0].to).toBe('2026-11-11');
    expect(groups[1].segments[0].from).toBe('2026-11-12');
    expect(groups[1].segments[0].movedFromSlot).toBe(2);
  });

  it('ignores assignments outside the month', () => {
    const groups = buildSlotSegments(
      [{ id: 'a', slot_number: 1, game_id: 'g', effective_from: '2026-09-01', effective_to: '2026-10-15' }],
      '2026-11-01',
      '2026-11-30',
    );
    expect(groups).toHaveLength(0);
  });
});
