// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, test } from 'bun:test';
import { toUKDate, monthRangeUK, localDateString, formatUKDate } from './ukDate';

describe('ukDate', () => {
  test('summer: 23:30 UTC on 30 June is already 1 July in the UK', () => {
    expect(toUKDate(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
  });
  test('winter: UTC and UK dates match', () => {
    expect(toUKDate(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });
  test('month range handles February and leap years', () => {
    expect(monthRangeUK('2027-02-10')).toEqual({ start: '2027-02-01', end: '2027-02-28' });
    expect(monthRangeUK('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
  test('local date picker value has no timezone shift', () => {
    expect(localDateString(new Date(2026, 6, 1))).toBe('2026-07-01');
  });
  test('display format', () => {
    expect(formatUKDate('2026-07-01')).toBe('01/07/2026');
  });
});
