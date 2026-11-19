// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, test } from 'bun:test';
import {
  parseCsv, parseStations, scanPriceLines, splitChunk, wantedKeys, buildRows, toPence,
  type LatestPrices, type SavedPrices,
} from './csv.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const RUN = '2026-11-19T12:00:00.000Z';

const STATION_HEADER =
  'id,node_id,trading_name,brand_name,organisation_name,latitude,longitude,address_line_1,city,county,postcode,is_motorway,is_supermarket,is_temporarily_closed,is_permanently_closed,amenities,opening_times,fuel_types,first_seen,last_seen,updated_at';

// Same layout as the real stations.csv (JSON columns are quoted, with doubled quotes inside).
const row = (o: Record<string, string>) =>
  [
    o.id ?? '1', o.node ?? 'n1', '"' + (o.name ?? 'Test Garage') + '"', o.brand ?? 'Shell', '', o.lat ?? '53.8', o.lng ?? '-1.55',
    '"' + (o.addr ?? 'A Road') + '"', o.city ?? 'LEEDS', '', o.pc ?? 'LS1 4AP', 'false', 'false', o.temp ?? 'false', o.perm ?? 'false',
    '"[""water_filling""]"', '"{""usual_days"":{}}"', o.fuels ?? '"[""B7_STANDARD"",""E10"",""E5""]"',
    '2026-02-10T00:00:00.000Z', o.seen ?? '2026-11-19T00:01:21.094Z', '2026-07-18T00:00:38.757Z',
  ].join(',');

describe('parseCsv', () => {
  test('keeps commas, quotes and line breaks that are inside quotes', () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n')).toEqual([['a', 'b'], ['x, y', 'line1\nline2']]);
    expect(parseCsv('a\n"say ""hi"""\n')).toEqual([['a'], ['say "hi"']]);
  });
  test('handles a BOM, CRLF, empty fields and a missing final newline', () => {
    expect(parseCsv('﻿a,b,c\r\n1,,3\r\n4,5,6')).toEqual([['a', 'b', 'c'], ['1', '', '3'], ['4', '5', '6']]);
  });
  test('a quoted field at the end of a line', () => {
    expect(parseCsv('a,b\n1,"2,3"\n4,"5"\n')).toEqual([['a', 'b'], ['1', '2,3'], ['4', '5']]);
  });
});

describe('toPence', () => {
  test('pounds, pence and tenths of a penny all become pence; rubbish becomes null', () => {
    expect(toPence('1.399')).toBe(139.9);
    expect(toPence('133.9')).toBe(133.9);
    expect(toPence('1339')).toBe(133.9);
    expect(toPence('126')).toBe(126);
    expect(toPence('0')).toBeNull();
    expect(toPence('')).toBeNull();
    expect(toPence('9999')).toBeNull();
    expect(toPence('12')).toBeNull();
  });
});

describe('parseStations', () => {
  const csv = [
    STATION_HEADER,
    row({ node: 'a', addr: 'B S B LTD, ALTOFTS ROAD, WF6 2AY', pc: 'WF6 2AY', brand: 'Jet', name: "Joe's, Garage" }),
    row({ node: 'b', temp: 'true' }),                                   // temporarily closed
    row({ node: 'c', perm: 'true' }),                                   // permanently closed
    row({ node: 'd', seen: '2026-11-01T00:00:00Z' }),                   // stopped reporting 18 days ago
    row({ node: 'e', lat: '10', lng: '10' }),                           // not in the UK
    row({ node: 'f', lat: '-2.24', lng: '53.48' }),                     // swapped
    row({ node: 'g', fuels: '"[""HVO""]"' }),                           // sells nothing we show
    row({ node: 'a' }),                                                 // duplicate id
    row({ node: 'h', fuels: '"[""B7_PREMIUM""]"' }),                    // premium diesel only
  ].join('\r\n');
  const { stations, skipped, missing } = parseStations(parseCsv(csv), NOW);
  const by = Object.fromEntries(stations.map((s) => [s.id, s]));

  test('finds the columns', () => expect(missing).toEqual([]));
  test('keeps open, recent, UK stations that sell E10/E5/diesel', () => {
    expect(Object.keys(by).sort()).toEqual(['a', 'f', 'h']);
    expect(skipped).toBe(6);
  });
  test('reads names, brand, location and strips the postcode from the address', () => {
    expect(by.a).toMatchObject({ name: "Joe's, Garage", brand: 'Jet', city: 'LEEDS', postcode: 'WF6 2AY', latitude: 53.8, longitude: -1.55 });
    expect(by.a.address).toBe('B S B LTD, ALTOFTS ROAD');
  });
  test('works out the fuels from fuel_types', () => {
    expect([...by.a.fuels].sort()).toEqual(['b7', 'e10', 'e5']);
    expect([...by.h.fuels]).toEqual(['b7']);
  });
  test('corrects swapped coordinates', () => {
    expect(by.f.latitude).toBe(53.48);
    expect(by.f.longitude).toBe(-2.24);
  });
  test('says what is missing instead of guessing', () => {
    expect(parseStations(parseCsv('name,postcode\nx,y\n'), NOW).missing).toEqual(['node_id', 'latitude', 'longitude']);
  });
});

describe('price history, read from the end', () => {
  const H = 'id,node_id,fuel_type,price_pence,recorded_at,source_updated_at';
  const hist = [
    H,
    '1,a,E10,126,2026-02-07T21:40:01.511Z,2026-02-06T12:46:05.000Z',
    '2,a,B7_STANDARD,135,2026-02-07T21:40:01.511Z,2026-02-06T12:46:05.000Z',
    '3,a,E10,128.9,2026-10-01T00:00:00.000Z,2026-10-01T00:00:00.000Z',
    '4,a,E10,0,2026-11-18T00:00:00.000Z,2026-11-18T00:00:00.000Z',     // bad newest value: ignored, older one used
    '5,b,E5,1459,2026-11-18T00:00:00.000Z,2026-11-18T00:00:00.000Z',   // tenths of a penny
    '6,a,HVO,200,2026-11-18T00:00:00.000Z,2026-11-18T00:00:00.000Z',   // not a fuel we show
    '7,a,E10,131.9,2026-11-19T00:00:00.000Z,2026-11-19T00:00:00.000Z', // newest
  ].join('\n');

  test('the newest valid price per station and fuel wins', () => {
    const latest: LatestPrices = new Map();
    scanPriceLines(hist, latest);
    expect(latest.get('a|E10')).toEqual({ pence: 131.9, at: '2026-11-19T00:00:00.000Z' });
    expect(latest.get('a|B7_STANDARD')?.pence).toBe(135);
    expect(latest.get('b|E5')?.pence).toBe(145.9);
    expect(latest.has('a|HVO')).toBe(false);
  });

  test('reading in chunks from the end gives the same answer as reading it whole', () => {
    const whole: LatestPrices = new Map();
    scanPriceLines(hist, whole);

    const chunked: LatestPrices = new Map();
    let carry = '';
    let end = hist.length;
    const SIZE = 53; // small chunks so lines are cut in the middle
    while (end > 0) {
      const start = Math.max(0, end - SIZE);
      const { body, carry: next } = splitChunk(hist.slice(start, end), carry, start === 0);
      carry = next;
      scanPriceLines(body, chunked);
      end = start;
    }
    expect([...chunked.entries()].sort()).toEqual([...whole.entries()].sort());
  });
});

describe('buildRows', () => {
  const stations = parseStations(parseCsv([
    STATION_HEADER,
    row({ node: 'a' }),
    row({ node: 'b', fuels: '"[""E5""]"' }),
    row({ node: 'c' }),
  ].join('\n')), NOW).stations;

  test('uses new prices, falls back to yesterday for unchanged ones, drops stations with no price', () => {
    const latest: LatestPrices = new Map([
      ['a|E10', { pence: 131.9, at: '2026-11-19T00:00:00.000Z' }],
      ['b|E5', { pence: 145.9, at: '2026-11-18T00:00:00.000Z' }],
    ]);
    const previous = new Map<string, SavedPrices>([
      ['a', { e10: 120, e5: 140.5, b7: 138.5, source_updated_at: '2026-10-01T00:00:00.000Z' }],
    ]);
    const { rows, withoutPrice, fromPrevious } = buildRows(stations, latest, previous, RUN);

    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({ e10: 131.9, e5: 140.5, b7: 138.5 }); // E10 new, E5/B7 from yesterday
    expect(rows[0].source_updated_at).toBe('2026-11-19T00:00:00.000Z');
    expect(rows[1]).toMatchObject({ e10: null, e5: 145.9, b7: null });   // b only sells E5
    expect(withoutPrice).toBe(1);                                        // c has no price anywhere
    expect(fromPrevious).toBe(2);
  });

  test('wantedKeys lists every station and fuel we need a price for', () => {
    expect([...wantedKeys(stations)].sort()).toEqual(['a|B7_STANDARD', 'a|E10', 'a|E5', 'b|E5', 'c|B7_STANDARD', 'c|E10', 'c|E5']);
  });
});
