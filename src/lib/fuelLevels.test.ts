// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, test } from 'bun:test';
import { levelStats, priceLevel } from './fuelLevels';

describe('price levels', () => {
  const stats = levelStats([150, 152, 154, 156, 158])!; // average 154, lowest 150

  test('the lowest price is Cheapest', () => expect(priceLevel(150, stats)).toBe('cheapest'));
  test('1p or more under the average is Low', () => {
    expect(priceLevel(152, stats)).toBe('low'); // -2p
    expect(priceLevel(153, stats)).toBe('low'); // exactly -1p
  });
  test('within 1p of the average is Average', () => {
    expect(priceLevel(154, stats)).toBe('average');
    expect(priceLevel(153.4, stats)).toBe('average'); // -0.6p
    expect(priceLevel(154.9, stats)).toBe('average');
  });
  test('1p or more over the average is High', () => {
    expect(priceLevel(155, stats)).toBe('high'); // exactly +1p
    expect(priceLevel(158, stats)).toBe('high');
  });
  test('a station that does not sell the fuel has no level', () => {
    expect(priceLevel(null, stats)).toBeNull();
    expect(priceLevel(undefined, stats)).toBeNull();
    expect(priceLevel(150, null)).toBeNull();
  });
  test('a single station is the cheapest', () => expect(priceLevel(160, levelStats([160]))).toBe('cheapest'));
  test('missing prices are ignored when working out the average', () => {
    const s = levelStats([150, null, 170, undefined])!;
    expect(s).toEqual({ min: 150, avg: 160, count: 2 });
    expect(levelStats([null, undefined])).toBeNull();
  });
});
