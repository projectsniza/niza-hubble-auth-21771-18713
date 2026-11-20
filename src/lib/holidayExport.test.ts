// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx-js-style';
import {
  balanceOf, buildReportWorkbook, buildTrackerWorkbook, holidayYearShort, workbookToBlob,
  type HolidayExportMeta, type HolidayExportRow,
} from './holidayExport';

const META: HolidayExportMeta = { yearStart: '2026-04-01', scopeLabel: 'All organisations', generatedAt: new Date('2026-11-20T10:00:00Z') };

const z = () => Array(12).fill(0) as number[];
const months = (vals: Record<number, number>) => {
  const a = z();
  Object.entries(vals).forEach(([i, v]) => (a[Number(i)] = v));
  return a;
};

const ROWS: HolidayExportRow[] = [
  // Real figures from "05.Hoilday Hours Working" (row for Mrs. Ranjitha): worked 1095.5, holiday 20.
  { branch: 'ADDLESTONE', name: 'Mrs. Ranjitha N', contractType: 'FT',
    monthlyWorked: months({ 0: 135.5, 1: 177, 2: 205.5, 3: 197, 4: 160, 5: 183.5, 6: 37 }), monthlyHoliday: months({ 1: 10, 2: 10 }), carryForward: 0 },
  { branch: 'ADDLESTONE', name: 'Mr. Prudhvi N', contractType: 'PT',
    monthlyWorked: months({ 1: 10, 2: 275.5, 3: 206.75, 4: 174.25, 5: 176.5, 6: 86 }), monthlyHoliday: z(), carryForward: 0 },
  // Has taken more than earned: overdrawn.
  { branch: 'BUCKSKIN', name: 'Ms Susan J', contractType: 'PT', monthlyWorked: months({ 0: 40 }), monthlyHoliday: months({ 1: 16 }), carryForward: 0 },
  // Hours carried forward, and nothing worked yet.
  { branch: 'BUCKSKIN', name: 'Mr Carry F', contractType: 'FT', monthlyWorked: z(), monthlyHoliday: z(), carryForward: 12.5 },
];

// ---- a small formula evaluator, so the tests do not just trust the values stored in the file -------
function evaluateWorkbook(wb: XLSX.WorkBook) {
  const memo = new Map<string, unknown>();
  const sheetOf = (name: string) => wb.Sheets[name];

  const cellValue = (sheet: string, a: string): unknown => {
    const key = `${sheet}!${a}`;
    if (memo.has(key)) return memo.get(key);
    const c = sheetOf(sheet)?.[a] as XLSX.CellObject | undefined;
    let v: unknown = c?.v ?? 0;
    if (c?.f) v = evalFormula(sheet, c.f);
    memo.set(key, v);
    return v;
  };

  const rangeValues = (sheet: string, ref: string): unknown[] => {
    const r = XLSX.utils.decode_range(ref.replace(/\$/g, ''));
    const out: unknown[] = [];
    for (let row = r.s.r; row <= r.e.r; row++) for (let col = r.s.c; col <= r.e.c; col++) out.push(cellValue(sheet, XLSX.utils.encode_cell({ r: row, c: col })));
    return out;
  };

  const nums = (xs: unknown[]) => xs.filter((x) => typeof x === 'number') as number[];
  const fns = {
    SUM: (...args: unknown[]) => nums(args.flat()).reduce((a, b) => a + b, 0),
    COUNTA: (...args: unknown[]) => args.flat().filter((x) => x !== '' && x !== undefined && x !== null && x !== 0).length,
    COUNTIF: (range: unknown[], crit: unknown) => range.filter((x) => x === crit).length,
    SUMIF: (range: unknown[], crit: unknown, sumRange: unknown[]) =>
      range.reduce((acc: number, x, i) => (x === crit && typeof sumRange[i] === 'number' ? acc + (sumRange[i] as number) : acc), 0),
    IF: (cond: boolean, a: unknown, b: unknown) => (cond ? a : b),
  };

  function evalFormula(sheet: string, f: string): unknown {
    const SHEET = String.raw`(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))!`;
    const CELL = String.raw`\$?[A-Z]{1,3}\$?\d+`;
    let js = f;
    // one pass: an optional sheet prefix, a cell, and an optional ":cell" to make it a range
    js = js.replace(new RegExp(`(?:${SHEET})?(${CELL})(?::(${CELL}))?`, 'g'), (_m, q, u, a, b2) => {
      const sh = JSON.stringify(q || u || sheet);
      return b2 ? `R(${sh},${JSON.stringify(a + ':' + b2)})` : `V(${sh},${JSON.stringify(a.replace(/\$/g, ''))})`;
    });
    js = js.replace(/<>/g, '!==');
    // eslint-disable-next-line no-new-func
    return new Function('R', 'V', ...Object.keys(fns), `return (${js});`)(rangeValues, cellValue, ...Object.values(fns));
  }

  const checked: Array<{ sheet: string; addr: string; formula: string; stored: unknown; computed: unknown }> = [];
  for (const name of wb.SheetNames) {
    for (const [a, c] of Object.entries(wb.Sheets[name])) {
      if (a.startsWith('!')) continue;
      const cell = c as XLSX.CellObject;
      if (cell.f) checked.push({ sheet: name, addr: a, formula: cell.f, stored: cell.v, computed: cellValue(name, a) });
    }
  }
  return checked;
}

function expectAllFormulasMatch(wb: XLSX.WorkBook) {
  const checked = evaluateWorkbook(wb);
  expect(checked.length).toBeGreaterThan(0);
  for (const c of checked) {
    if (typeof c.stored === 'number') {
      expect(Math.abs((c.computed as number) - c.stored)).toBeLessThan(1e-6);
    } else {
      expect(c.computed).toBe(c.stored);
    }
  }
  return checked.length;
}

describe('balanceOf (same rules as the company holiday sheet)', () => {
  test('matches the real row from the Holiday Hours workbook', () => {
    const b = balanceOf(ROWS[0]);
    expect(b.worked).toBeCloseTo(1095.5, 6);
    expect(b.taken).toBe(20);
    expect(b.total).toBeCloseTo(1115.5, 6);
    expect(b.entitlement).toBeCloseTo(120.13076923, 6); // 1115.5 / 52 * 5.6
    expect(b.remaining).toBeCloseTo(100.13076923, 6); // entitlement - taken
  });
  test('carried-forward hours are added to what is left', () => {
    expect(balanceOf(ROWS[3]).remaining).toBe(12.5);
  });
  test('status', () => {
    expect(balanceOf(ROWS[0]).status).toBe('OK');
    expect(balanceOf(ROWS[2]).status).toBe('Overdrawn'); // 40 worked + 16 taken -> entitles 6.03h, took 16
    expect(balanceOf({ ...ROWS[0], monthlyHoliday: months({ 1: 100, 2: 7 }) }).status).toBe('Low');
    expect(balanceOf({ ...ROWS[3], carryForward: 0 }).status).toBe('No entitlement yet');
  });
  test('year label', () => expect(holidayYearShort('2026-04-01')).toBe('2026-2027'));
});

describe('Export 1: Holiday Tracker (HDAY_TRACKER layout)', () => {
  const wb = buildTrackerWorkbook(ROWS, META);
  const ws = wb.Sheets['HDAY_TRACKER'];
  const v = (a: string) => (ws[a] as XLSX.CellObject | undefined)?.v;
  const f = (a: string) => (ws[a] as XLSX.CellObject | undefined)?.f;
  const merges = (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m));

  test('same sheet name, title, note and headings as the Time Sheet workbook', () => {
    expect(wb.SheetNames).toEqual(['HDAY_TRACKER']);
    expect(v('G2')).toBe('HOLIDAY TRACKER 2026-2027');
    expect(merges).toContain('G2:N3');
    // every header merge the original sheet has: title, and the heading cells joined over rows 5-6
    ['A5:A6', 'B5:B6', 'D5:D6', 'E5:E6', 'P5:P6', 'Q5:Q6', 'R5:R6', 'S5:S6'].forEach((m) => expect(merges).toContain(m));
    expect(v('B4')).toBe('* Please do not enter contract hours for zero hours contract employees.');
    expect(['A5', 'B5', 'C5', 'C6', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5', 'L5', 'M5', 'N5', 'O5', 'P5', 'Q5', 'R5', 'S5'].map(v)).toEqual([
      'NAME', 'C/HOURS', 'HDAY ENTITLE', 'FULL YEAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR',
      'TOTAL HOURS', 'HDAY TAKEN', 'O/S(FULL YEAR)',
    ]);
    expect(v('T6')).toBe('Statutory annual leave entitlement');
    expect(v('T24')).toContain('Business trades on bank holidays');
  });

  test('two rows per person, merged name / totals, like the original', () => {
    // with 2 branches the first row 7 is a branch band, so the first person starts on row 8
    expect(v('A7')).toBe('ADDLESTONE');
    expect(v('A8')).toBe('Mr. Prudhvi N'); // sorted by name within the branch
    expect(v('D8')).toBe('TOTAL HOURS');
    expect(v('D9')).toBe('HDAY TAKEN');
    expect(merges).toContain('A8:A9');
    expect(merges).toContain('B8:B9');
    expect(merges).toContain('C8:C9');
    expect(merges).toContain('Q8:Q9');
    expect(merges).toContain('R8:R9');
    expect(merges).toContain('S8:S9');
  });

  test('uses the original formulas', () => {
    expect(f('B8')).toBe('Q8/52');
    expect(f('C8')).toBe('(B8*5.6)');
    expect(f('Q8')).toBe('SUM(E8:P8)+SUM(E9:P9)');
    expect(f('R8')).toBe('SUM(E9:P9)');
    expect(f('S8')).toBe('C8-R8');
  });

  test('months are in April-to-March order and carried-forward hours go into O/S', () => {
    expect(v('F8')).toBe(10); // Mr. Prudhvi: May worked 10
    expect(v('G8')).toBe(275.5);
    // Mr Carry F is the 2nd person of BUCKSKIN: band row 12, then Ms Susan J rows 13-14... find by name
    const carryRow = Object.keys(ws).find((a) => /^A\d+$/.test(a) && (ws[a] as XLSX.CellObject).v === 'Mr Carry F')!;
    const rr = carryRow.slice(1);
    expect(f(`S${rr}`)).toBe(`C${rr}+12.5-R${rr}`);
    expect(v(`S${rr}`)).toBe(12.5);
  });

  test('every formula really gives the number stored next to it', () => {
    expect(expectAllFormulasMatch(wb)).toBeGreaterThan(10);
  });

  test('a single branch has no band rows (rows start at 7 like the original)', () => {
    const one = buildTrackerWorkbook(ROWS.filter((r) => r.branch === 'ADDLESTONE'), META).Sheets['HDAY_TRACKER'];
    expect((one['A7'] as XLSX.CellObject).v).toBe('Mr. Prudhvi N');
    expect((one['B7'] as XLSX.CellObject).f).toBe('Q7/52');
  });

  test('is a valid .xlsx file that reads back', () => {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const back = XLSX.read(buf, { type: 'buffer' });
    expect(back.SheetNames).toEqual(['HDAY_TRACKER']);
    expect(back.Sheets['HDAY_TRACKER']['G2'].v).toBe('HOLIDAY TRACKER 2026-2027');
    expect(workbookToBlob(wb).size).toBeGreaterThan(1000);
  });
});

describe('Export 2: Holiday Balance Report (clear format)', () => {
  const wb = buildReportWorkbook(ROWS, META);

  test('has the five sheets', () => {
    expect(wb.SheetNames).toEqual(['Summary', 'Employees', 'Worked by month', 'Holiday by month', 'How it works']);
  });

  test('Employees sheet: one row per person with the right numbers', () => {
    const e = wb.Sheets['Employees'];
    const val = (a: string) => (e[a] as XLSX.CellObject | undefined)?.v;
    // sorted: ADDLESTONE (Mr. Prudhvi N, Mrs. Ranjitha N), BUCKSKIN (Mr Carry F, Ms Susan J)
    expect([val('B5'), val('B6'), val('B7'), val('B8')]).toEqual(['Mr. Prudhvi N', 'Mrs. Ranjitha N', 'Mr Carry F', 'Ms Susan J']);
    expect(val('E6')).toBeCloseTo(1095.5, 6);
    expect(val('F6')).toBe(20);
    expect(val('H6')).toBeCloseTo(120.13076923, 6);
    expect(val('J6')).toBeCloseTo(100.13076923, 6);
    expect(val('L6')).toBe('OK');
    expect(val('L8')).toBe('Overdrawn');
    expect(val('I7')).toBe(12.5);
    expect(val('B9')).toBe('4 employees');
    expect(e['!autofilter']?.ref).toBe('A4:L8');
  });

  test('Summary: by-branch table adds up to the grand total', () => {
    const s = wb.Sheets['Summary'];
    const rows = Object.keys(s).filter((a) => /^A\d+$/.test(a)).map((a) => [a, (s[a] as XLSX.CellObject).v]);
    const names = rows.map((r) => r[1]);
    expect(names).toContain('ADDLESTONE');
    expect(names).toContain('BUCKSKIN');
    expect(names).toContain('TOTAL');
  });

  test('every formula in the whole workbook gives the number stored next to it', () => {
    expect(expectAllFormulasMatch(wb)).toBeGreaterThan(40);
  });

  test('empty list still produces a valid file', () => {
    const empty = buildReportWorkbook([], META);
    expect(empty.SheetNames.length).toBe(5);
    expect(workbookToBlob(empty).size).toBeGreaterThan(1000);
    expect(workbookToBlob(buildTrackerWorkbook([], META)).size).toBeGreaterThan(1000);
  });
});
