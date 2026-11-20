import * as XLSX from 'xlsx-js-style';

// ---------------------------------------------------------------------------------------------
// Holiday Balance exports (Excel).
//
// These only LAY OUT numbers that the Holiday Balance screen already worked out. Nothing here
// changes how hours are counted. The rules below are the same ones the screen and the company
// sheets use, so keep them in step with HolidayBalance.tsx:
//     Total hours   = hours worked + holiday hours taken
//     Entitlement   = Total hours / 52 * 5.6
//     Remaining     = Entitlement + carried forward - holiday taken
// ---------------------------------------------------------------------------------------------

const WEEKS_PER_YEAR = 52;
const HOLIDAY_WEEKS = 5.6;
export const HOLIDAY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

export interface HolidayExportRow {
  branch: string;
  name: string;
  /** 'FT' or 'PT' */
  contractType: string;
  /** Hours worked per payroll month, April first (12 values). Holiday hours are NOT included. */
  monthlyWorked: number[];
  /** Holiday hours taken per payroll month, April first (12 values). */
  monthlyHoliday: number[];
  /** Hours carried forward from the previous year (0 when none). */
  carryForward: number;
}

export interface HolidayExportMeta {
  /** First day of the holiday year, e.g. "2026-04-01". */
  yearStart: string;
  /** What the list covers, e.g. "All organisations" or "ADDLESTONE". */
  scopeLabel: string;
  generatedAt: Date;
}

/** "2026-2027" */
export function holidayYearShort(yearStart: string): string {
  const y = parseInt(yearStart.slice(0, 4), 10);
  return `${y}-${y + 1}`;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number(b) || 0), 0);

/** The numbers the screen shows for one person, worked out from their monthly hours. */
export function balanceOf(row: HolidayExportRow) {
  const worked = sum(row.monthlyWorked);
  const taken = sum(row.monthlyHoliday);
  const total = worked + taken;
  const entitlement = (total / WEEKS_PER_YEAR) * HOLIDAY_WEEKS;
  const remaining = entitlement + row.carryForward - taken;
  const available = entitlement + row.carryForward;
  const status =
    remaining < 0 ? 'Overdrawn' : available <= 0 ? 'No entitlement yet' : remaining / available <= 0.2 ? 'Low' : 'OK';
  return { worked, taken, total, entitlement, remaining, available, avgWeekly: total / WEEKS_PER_YEAR, status };
}

/** Branch, then name. */
function sortRows(rows: HolidayExportRow[]): HolidayExportRow[] {
  return [...rows].sort(
    (a, b) => a.branch.localeCompare(b.branch, 'en', { sensitivity: 'base' }) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
}

// ---------------------------------------------------------------------------------------------
// Small helpers for building cells
// ---------------------------------------------------------------------------------------------
type Style = XLSX.CellStyle;
const BLACK = 'FF000000';
const thin = { style: 'thin' as const, color: { rgb: BLACK } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

function num(v: number, s?: Style, z?: string, f?: string): XLSX.CellObject {
  const cell: XLSX.CellObject = { t: 'n', v, s };
  if (z) cell.z = z;
  if (f) cell.f = f;
  return cell;
}
function str(v: string, s?: Style, f?: string): XLSX.CellObject {
  const cell: XLSX.CellObject = { t: 's', v, s };
  if (f) cell.f = f;
  return cell;
}
const addr = (r: number, c: number) => XLSX.utils.encode_cell({ r: r - 1, c }); // r is 1-based, c is 0-based
const col = (c: number) => XLSX.utils.encode_col(c);

class Sheet {
  ws: XLSX.WorkSheet = {};
  merges: XLSX.Range[] = [];
  private maxR = 0;
  private maxC = 0;
  put(r: number, c: number, cell: XLSX.CellObject) {
    this.ws[addr(r, c)] = cell;
    this.maxR = Math.max(this.maxR, r);
    this.maxC = Math.max(this.maxC, c);
  }
  /** Merge r1:r2 / c1:c2 (r 1-based, c 0-based) and fill the covered cells with the same border/fill so the box looks whole. */
  merge(r1: number, c1: number, r2: number, c2: number, filler?: XLSX.CellObject) {
    this.merges.push({ s: { r: r1 - 1, c: c1 }, e: { r: r2 - 1, c: c2 } });
    if (filler) {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (!(r === r1 && c === c1) && !this.ws[addr(r, c)]) this.put(r, c, { t: 's', v: '', s: filler.s });
        }
      }
    }
  }
  /** Column widths and row heights are written; frozen panes and print setup are not supported by xlsx-js-style. */
  finish(opts: { widths?: number[]; rowHeights?: Record<number, number> } = {}): XLSX.WorkSheet {
    this.ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: this.maxR - 1, c: this.maxC } });
    if (this.merges.length) this.ws['!merges'] = this.merges;
    if (opts.widths) this.ws['!cols'] = opts.widths.map((wch) => ({ wch }));
    if (opts.rowHeights) {
      const rows: XLSX.RowInfo[] = [];
      Object.entries(opts.rowHeights).forEach(([r, hpt]) => (rows[Number(r) - 1] = { hpt }));
      this.ws['!rows'] = rows;
    }
    return this.ws;
  }
}

function newBook(): XLSX.WorkBook {
  return XLSX.utils.book_new();
}

export function workbookToBlob(wb: XLSX.WorkBook): Blob {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const url = URL.createObjectURL(workbookToBlob(wb));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===============================================================================================
// EXPORT 1 - the "HDAY_TRACKER" layout of the Time Sheet workbook
// Same columns, headings, two rows per person (TOTAL HOURS / HDAY TAKEN), same formulas
// (C/HOURS = total / 52, entitlement = C/HOURS * 5.6, O/S = entitlement - taken) and the same notes.
// ===============================================================================================
const TRACKER_NOTES: Record<number, { text: string; bold?: boolean; big?: boolean }> = {
  6: { text: 'Statutory annual leave entitlement', bold: true, big: true },
  7: { text: 'Most workers who work a 5-day week must receive at least 28 days’ paid annual leave a year. This is the equivalent of 5.6 weeks of holiday.' },
  9: { text: 'Working part-time', bold: true },
  10: { text: 'Part-time workers are entitled to at least 5.6 weeks’ paid holiday, but this will amount to fewer than 28 days.' },
  11: { text: 'For example, if they work 3 days a week, they must get at least 16.8 days’ leave a year (3 × 5.6).' },
  12: { text: 'Use the holiday entitlement calculator to work out a part-time worker’s leave.' },
  14: { text: 'Irregular hours', bold: true },
  15: { text: 'People working irregular hours (Zero hours contract) are entitled to paid time off for every hour they work.' },
  16: { text: 'They might find it helpful to get an estimate of holiday entitlement by calculating leave based on days or hours worked in an average week.' },
  18: { text: 'Limits on statutory leave', bold: true },
  19: { text: 'Statutory paid holiday entitlement is limited to 28 days. For example, staff working 6 days a week are only entitled to 28 days’ paid holiday.' },
  21: { text: 'Bank holidays', bold: true },
  22: { text: 'Bank or public holidays do not have to be given as paid leave.' },
  23: { text: 'An employer can choose to include bank holidays as part of a worker’s statutory annual leave.' },
  24: { text: 'Business trades on bank holidays, as a normal trading day, will be scheduled to work in accordance with availability unless on Annual Leave.' },
};

export function buildTrackerWorkbook(rowsIn: HolidayExportRow[], meta: HolidayExportMeta): XLSX.WorkBook {
  const rows = sortRows(rowsIn);
  const sh = new Sheet();

  const C = { NAME: 0, CH: 1, ENT: 2, LABEL: 3, M0: 4, TOTAL: 16, TAKEN: 17, OS: 18, NOTE: 19 };
  const calibri = (sz: number, bold = false, color = BLACK): Style['font'] => ({ name: 'Calibri', sz, bold, color: { rgb: color } });
  const center: Style['alignment'] = { horizontal: 'center', vertical: 'center' };
  const boxed = (font: Style['font'], extra: Partial<Style> = {}): Style => ({ font, alignment: center, border: BORDER, ...extra });

  // --- title ---
  sh.put(2, 6, str(`HOLIDAY TRACKER ${holidayYearShort(meta.yearStart)}`, boxed(calibri(24, true))));
  sh.merge(2, 6, 3, 13, str('', boxed(calibri(24, true))));
  sh.put(4, 1, str('* Please do not enter contract hours for zero hours contract employees.', { font: calibri(12, true, 'FFFF0000') }));

  // --- headings (rows 5-6) ---
  const head = boxed(calibri(11, true));
  const headTall = (text: string, c: number, font = calibri(11, true)) => {
    sh.put(5, c, str(text, boxed(font)));
    sh.merge(5, c, 6, c, str('', boxed(font)));
  };
  headTall('NAME', C.NAME, calibri(12, true));
  headTall('C/HOURS', C.CH);
  sh.put(5, C.ENT, str('HDAY ENTITLE', { font: calibri(11, true), alignment: { vertical: 'top', horizontal: 'center' }, border: { ...BORDER, bottom: undefined } }));
  sh.put(6, C.ENT, str('FULL YEAR', { font: calibri(11, true), alignment: { vertical: 'top', horizontal: 'center' }, border: { ...BORDER, top: undefined } }));
  sh.put(5, C.LABEL, str('', head));
  sh.merge(5, C.LABEL, 6, C.LABEL, str('', head));
  HOLIDAY_MONTHS.forEach((m, i) => headTall(m.toUpperCase(), C.M0 + i));
  headTall('TOTAL HOURS', C.TOTAL);
  headTall('HDAY TAKEN', C.TAKEN);
  headTall('O/S(FULL YEAR)', C.OS);

  // --- people: two rows each ---
  const multiBranch = new Set(rows.map((r) => r.branch)).size > 1;
  const labelStyle: Style = { font: calibri(8), alignment: { horizontal: 'center' }, border: BORDER, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } } };
  const accounting = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-';
  const firstMonth = col(C.M0);
  const lastMonth = col(C.M0 + 11);

  let r = 7;
  let lastBranch = '';
  const rowHeights: Record<number, number> = { 2: 24, 3: 24, 5: 18, 6: 22.8 };
  const carryNotes: string[] = [];

  for (const p of rows) {
    if (multiBranch && p.branch !== lastBranch) {
      // A coloured band naming the branch, so a long list stays readable.
      const band: Style = { font: calibri(12, true), alignment: { vertical: 'center' }, border: BORDER, fill: { patternType: 'solid', fgColor: { rgb: 'FFD9E1F2' } } };
      sh.put(r, 0, str(p.branch, band));
      sh.merge(r, 0, r, C.OS, str('', band));
      rowHeights[r] = 20;
      r += 1;
      lastBranch = p.branch;
    }
    const b = balanceOf(p);
    const r2nd = r + 1;
    const carry = p.carryForward;

    // merged name / C-HOURS / entitlement / totals / taken / balance (like the original sheet)
    sh.put(r, C.NAME, str(p.name, { font: { name: 'Arial', sz: 11 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER }));
    sh.merge(r, C.NAME, r2nd, C.NAME, str('', { border: BORDER }));

    sh.put(r, C.CH, num(b.avgWeekly, boxed(calibri(16, true)), '0.00', `Q${r}/52`));
    sh.merge(r, C.CH, r2nd, C.CH, str('', { border: BORDER }));

    sh.put(r, C.ENT, num(b.entitlement, boxed(calibri(16, true)), '0.00', `(B${r}*5.6)`));
    sh.merge(r, C.ENT, r2nd, C.ENT, str('', { border: BORDER }));

    sh.put(r, C.LABEL, str('TOTAL HOURS', labelStyle));
    sh.put(r2nd, C.LABEL, str('HDAY TAKEN', labelStyle));

    HOLIDAY_MONTHS.forEach((_, i) => {
      const cellStyle: Style = { font: calibri(11), border: BORDER };
      sh.put(r, C.M0 + i, num(p.monthlyWorked[i] || 0, cellStyle, accounting));
      sh.put(r2nd, C.M0 + i, num(p.monthlyHoliday[i] || 0, cellStyle, accounting));
    });

    sh.put(r, C.TOTAL, num(b.total, boxed(calibri(16, true)), 'General', `SUM(${firstMonth}${r}:${lastMonth}${r})+SUM(${firstMonth}${r2nd}:${lastMonth}${r2nd})`));
    sh.merge(r, C.TOTAL, r2nd, C.TOTAL, str('', { border: BORDER }));

    sh.put(r, C.TAKEN, num(b.taken, boxed(calibri(16, true)), 'General', `SUM(${firstMonth}${r2nd}:${lastMonth}${r2nd})`));
    sh.merge(r, C.TAKEN, r2nd, C.TAKEN, str('', { border: BORDER }));

    // O/S = entitlement - taken (as in the sheet). Hours carried forward from last year, if any, are added.
    const osFormula = carry ? `C${r}+${carry}-R${r}` : `C${r}-R${r}`;
    const osStyle = boxed(calibri(16, true, b.remaining < 0 ? 'FFC00000' : BLACK));
    const os = num(b.remaining, osStyle, '0.00', osFormula);
    if (carry) {
      os.c = [{ a: 'Niza', t: `Includes ${carry} hours carried forward from last year.` }];
      carryNotes.push(`${p.name}: ${carry} h carried forward`);
    }
    sh.put(r, C.OS, os);
    sh.merge(r, C.OS, r2nd, C.OS, str('', { border: BORDER }));

    rowHeights[r] = 18;
    rowHeights[r2nd] = 18;
    r += 2;
  }

  // --- the standing notes, in column T, exactly where the original sheet has them ---
  Object.entries(TRACKER_NOTES).forEach(([row, n]) => {
    sh.put(Number(row), C.NOTE, str(n.text, {
      font: { name: 'Arial', sz: n.big ? 18 : n.bold ? 14 : 11, bold: !!n.bold, color: { rgb: 'FF0B0C0C' } },
      alignment: { vertical: 'center', wrapText: true },
    }));
  });

  // carry-forward footnote under the table
  if (carryNotes.length) {
    sh.put(r + 1, 0, str(`Includes hours carried forward from last year: ${carryNotes.join('; ')}`, { font: calibri(10, false, 'FF595959') }));
  }

  const ws = sh.finish({
    widths: [30, 9, 13, 12, ...Array(12).fill(9.5), 12, 11.4, 14.5, 120],
    rowHeights,
  });
  const wb = newBook();
  XLSX.utils.book_append_sheet(wb, ws, 'HDAY_TRACKER');
  return wb;
}

// ===============================================================================================
// EXPORT 2 - a clearer report: Summary, Employees, Worked by month, Holiday by month, How it works
// ===============================================================================================
const PALETTE = {
  title: 'FF1F4E79',
  header: 'FF1F4E79',
  headerText: 'FFFFFFFF',
  band: 'FFD9E1F2',
  total: 'FFEDEDED',
  worked: 'FFDDEBF7',
  holiday: 'FFFFF2CC',
  ok: ['FFC6EFCE', 'FF006100'],
  low: ['FFFFEB9C', 'FF7F6000'],
  over: ['FFFFC7CE', 'FF9C0006'],
  none: ['FFEDEDED', 'FF595959'],
} as const;

function statusColors(status: string): readonly [string, string] {
  return status === 'Overdrawn' ? PALETTE.over : status === 'Low' ? PALETTE.low : status === 'OK' ? PALETTE.ok : PALETTE.none;
}

const arial = (sz: number, bold = false, color = BLACK): Style['font'] => ({ name: 'Arial', sz, bold, color: { rgb: color } });
const fill = (rgb: string): Style['fill'] => ({ patternType: 'solid', fgColor: { rgb } });
const headStyle: Style = {
  font: arial(10, true, PALETTE.headerText),
  fill: fill(PALETTE.header),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER,
};

function titleRows(sh: Sheet, title: string, meta: HolidayExportMeta, lastCol: number) {
  sh.put(1, 0, str(title, { font: arial(16, true, PALETTE.title) }));
  sh.merge(1, 0, 1, lastCol);
  const y0 = parseInt(meta.yearStart.slice(0, 4), 10);
  const generated = meta.generatedAt.toLocaleDateString('en-GB');
  sh.put(2, 0, str(`Holiday year 1 April ${y0} to 31 March ${y0 + 1}   ·   ${meta.scopeLabel}   ·   Created ${generated}`, { font: arial(10, false, 'FF595959') }));
  sh.merge(2, 0, 2, lastCol);
}

export function buildReportWorkbook(rowsIn: HolidayExportRow[], meta: HolidayExportMeta): XLSX.WorkBook {
  const rows = sortRows(rowsIn);
  const n = rows.length;
  const FIRST = 5; // first data row on the per-employee sheets
  const LAST = FIRST + n - 1;
  const totalRow = LAST + 1;

  const cell = (extra: Partial<Style> = {}): Style => ({ font: arial(10), border: BORDER, ...extra });
  const hours = '#,##0.00;[Red]-#,##0.00;"-"';

  // ---------------------------------------------------------------- Worked by month / Holiday by month
  const monthSheet = (title: string, pick: (r: HolidayExportRow) => number[], tint: string, highlightNonZero: boolean): XLSX.WorkSheet => {
    const sh = new Sheet();
    titleRows(sh, title, meta, 14);
    const heads = ['Branch', 'Employee', ...HOLIDAY_MONTHS, 'Total'];
    heads.forEach((h, c) => sh.put(4, c, str(h, headStyle)));
    rows.forEach((p, i) => {
      const r = FIRST + i;
      sh.put(r, 0, str(p.branch, cell()));
      sh.put(r, 1, str(p.name, cell({ font: arial(10, true) })));
      pick(p).forEach((v, m) => {
        const has = (v || 0) > 0;
        sh.put(r, 2 + m, num(v || 0, cell({ alignment: { horizontal: 'right' }, ...(highlightNonZero && has ? { fill: fill(tint) } : {}) }), hours));
      });
      const sumv = pick(p).reduce((a, b) => a + (b || 0), 0);
      sh.put(r, 14, num(sumv, cell({ font: arial(10, true), fill: fill(tint) }), hours, `SUM(C${r}:N${r})`));
    });
    const totalStyle = cell({ font: arial(10, true), fill: fill(PALETTE.total) });
    sh.put(totalRow, 0, str('TOTAL', totalStyle));
    sh.put(totalRow, 1, str('', totalStyle));
    for (let c = 2; c <= 14; c++) {
      const v = rows.reduce((a, p) => a + (c === 14 ? pick(p).reduce((x, y) => x + (y || 0), 0) : pick(p)[c - 2] || 0), 0);
      sh.put(totalRow, c, num(v, { ...totalStyle, alignment: { horizontal: 'right' } }, hours, `SUM(${col(c)}${FIRST}:${col(c)}${LAST})`));
    }
    return sh.finish({ widths: [20, 30, ...Array(12).fill(9), 12], rowHeights: { 1: 24, 4: 22 } });
  };

  const workedWs = monthSheet('Hours worked by month', (p) => p.monthlyWorked, PALETTE.worked, false);
  const holidayWs = monthSheet('Holiday taken by month', (p) => p.monthlyHoliday, PALETTE.holiday, true);

  // ---------------------------------------------------------------- Employees
  const emp = new Sheet();
  titleRows(emp, 'Holiday balance by employee', meta, 11);
  [
    'Branch', 'Employee', 'Type', 'Average hours a week', 'Hours worked', 'Holiday taken (hours)', 'Worked + holiday',
    'Holiday entitlement (hours)', 'Carried forward (hours)', 'Holiday remaining (hours)', '% of holiday used', 'Status',
  ].forEach((h, c) => emp.put(4, c, str(h, headStyle)));

  rows.forEach((p, i) => {
    const r = FIRST + i;
    const b = balanceOf(p);
    const [bg, fg] = statusColors(b.status);
    emp.put(r, 0, str(p.branch, cell()));
    emp.put(r, 1, str(p.name, cell({ font: arial(10, true) })));
    emp.put(r, 2, str(p.contractType, cell({ alignment: { horizontal: 'center' } })));
    emp.put(r, 3, num(b.avgWeekly, cell(), hours, `G${r}/52`));
    emp.put(r, 4, num(b.worked, cell(), hours, `'Worked by month'!O${r}`));
    emp.put(r, 5, num(b.taken, cell(), hours, `'Holiday by month'!O${r}`));
    emp.put(r, 6, num(b.total, cell(), hours, `E${r}+F${r}`));
    emp.put(r, 7, num(b.entitlement, cell({ font: arial(10, true) }), hours, `G${r}/52*5.6`));
    emp.put(r, 8, num(p.carryForward, cell(), hours));
    emp.put(r, 9, num(b.remaining, cell({ font: arial(10, true, b.remaining < 0 ? 'FFC00000' : BLACK) }), hours, `H${r}+I${r}-F${r}`));
    emp.put(r, 10, num(b.available > 0 ? b.taken / b.available : 0, cell(), '0%', `IF(H${r}+I${r}<=0,0,F${r}/(H${r}+I${r}))`));
    emp.put(
      r, 11,
      str(b.status, cell({ font: arial(10, true, fg), fill: fill(bg), alignment: { horizontal: 'center' } }),
        `IF(J${r}<0,"Overdrawn",IF(H${r}+I${r}<=0,"No entitlement yet",IF(J${r}/(H${r}+I${r})<=0.2,"Low","OK")))`)
    );
  });

  const totStyle = cell({ font: arial(10, true), fill: fill(PALETTE.total) });
  const T = (c: number, v: number, f: string, z = hours) => emp.put(totalRow, c, num(v, { ...totStyle, alignment: { horizontal: 'right' } }, z, f));
  emp.put(totalRow, 0, str('TOTAL', totStyle));
  emp.put(totalRow, 1, str(`${n} employee${n === 1 ? '' : 's'}`, totStyle));
  emp.put(totalRow, 2, str('', totStyle));
  const all = rows.map(balanceOf);
  const tot = {
    worked: all.reduce((a, b) => a + b.worked, 0),
    taken: all.reduce((a, b) => a + b.taken, 0),
    total: all.reduce((a, b) => a + b.total, 0),
    ent: all.reduce((a, b) => a + b.entitlement, 0),
    carry: rows.reduce((a, p) => a + p.carryForward, 0),
    rem: all.reduce((a, b) => a + b.remaining, 0),
  };
  emp.put(totalRow, 3, str('', totStyle));
  T(4, tot.worked, `SUM(E${FIRST}:E${LAST})`);
  T(5, tot.taken, `SUM(F${FIRST}:F${LAST})`);
  T(6, tot.total, `SUM(G${FIRST}:G${LAST})`);
  T(7, tot.ent, `SUM(H${FIRST}:H${LAST})`);
  T(8, tot.carry, `SUM(I${FIRST}:I${LAST})`);
  T(9, tot.rem, `SUM(J${FIRST}:J${LAST})`);
  T(10, tot.ent + tot.carry > 0 ? tot.taken / (tot.ent + tot.carry) : 0, `IF(H${totalRow}+I${totalRow}<=0,0,F${totalRow}/(H${totalRow}+I${totalRow}))`, '0%');
  emp.put(totalRow, 11, str('', totStyle));

  const empWs = emp.finish({
    widths: [20, 30, 7, 12, 12, 13, 13, 15, 13, 15, 11, 18],
    rowHeights: { 1: 24, 4: 36 },
  });
  if (n > 0) empWs['!autofilter'] = { ref: `A4:L${LAST}` };

  // ---------------------------------------------------------------- Summary
  const sm = new Sheet();
  titleRows(sm, 'Staff holiday balance - summary', meta, 7);
  const overdrawn = all.filter((b) => b.status === 'Overdrawn').length;
  const low = all.filter((b) => b.status === 'Low').length;
  const range = (c: string) => `Employees!$${c}$${FIRST}:$${c}$${LAST}`;

  sm.put(4, 0, str('At a glance', { font: arial(12, true, PALETTE.title) }));
  const kpis: Array<[string, number, string, string]> = [
    ['Employees', n, `COUNTA(${range('B')})`, '0'],
    ['Hours worked', tot.worked, `SUM(${range('E')})`, hours],
    ['Holiday taken (hours)', tot.taken, `SUM(${range('F')})`, hours],
    ['Holiday entitlement (hours)', tot.ent, `SUM(${range('H')})`, hours],
    ['Holiday remaining (hours)', tot.rem, `SUM(${range('J')})`, hours],
    ['Overdrawn (taken more than entitled)', overdrawn, `COUNTIF(${range('L')},"Overdrawn")`, '0'],
    ['Low (20% or less left)', low, `COUNTIF(${range('L')},"Low")`, '0'],
  ];
  kpis.forEach(([label, v, f, z], i) => {
    const r = 5 + i;
    sm.put(r, 0, str(label, cell({ fill: fill('FFF2F2F2') })));
    sm.merge(r, 0, r, 1, str('', cell({ fill: fill('FFF2F2F2') })));
    sm.put(r, 2, num(v, cell({ font: arial(11, true), alignment: { horizontal: 'right' } }), z, f));
  });

  const bTop = 5 + kpis.length + 2; // "By branch" heading row
  sm.put(bTop, 0, str('By branch', { font: arial(12, true, PALETTE.title) }));
  ['Branch', 'Employees', 'Hours worked', 'Holiday taken', 'Entitlement', 'Remaining', '% used'].forEach((h, c) => sm.put(bTop + 1, c, str(h, headStyle)));
  const branches = Array.from(new Set(rows.map((p) => p.branch)));
  branches.forEach((bn, i) => {
    const r = bTop + 2 + i;
    const inBranch = rows.filter((p) => p.branch === bn);
    const bal = inBranch.map(balanceOf);
    const worked = bal.reduce((a, b) => a + b.worked, 0);
    const taken = bal.reduce((a, b) => a + b.taken, 0);
    const ent = bal.reduce((a, b) => a + b.entitlement, 0);
    const carry = inBranch.reduce((a, p) => a + p.carryForward, 0);
    const rem = bal.reduce((a, b) => a + b.remaining, 0);
    const sumif = (c: string) => `SUMIF(${range('A')},$A${r},${range(c)})`;
    sm.put(r, 0, str(bn, cell({ font: arial(10, true) })));
    sm.put(r, 1, num(inBranch.length, cell(), '0', `COUNTIF(${range('A')},$A${r})`));
    sm.put(r, 2, num(worked, cell(), hours, sumif('E')));
    sm.put(r, 3, num(taken, cell(), hours, sumif('F')));
    sm.put(r, 4, num(ent, cell(), hours, sumif('H')));
    sm.put(r, 5, num(rem, cell({ font: arial(10, true, rem < 0 ? 'FFC00000' : BLACK) }), hours, sumif('J')));
    sm.put(r, 6, num(ent + carry > 0 ? taken / (ent + carry) : 0, cell(), '0%', `IF(E${r}+${sumif('I')}<=0,0,D${r}/(E${r}+${sumif('I')}))`));
  });
  const bEnd = bTop + 1 + branches.length;
  const bTotal = bEnd + 1;
  const sumB = (c: string) => `SUM(${c}${bTop + 2}:${c}${bEnd})`;
  sm.put(bTotal, 0, str('TOTAL', totStyle));
  sm.put(bTotal, 1, num(n, { ...totStyle, alignment: { horizontal: 'right' } }, '0', sumB('B')));
  sm.put(bTotal, 2, num(tot.worked, { ...totStyle, alignment: { horizontal: 'right' } }, hours, sumB('C')));
  sm.put(bTotal, 3, num(tot.taken, { ...totStyle, alignment: { horizontal: 'right' } }, hours, sumB('D')));
  sm.put(bTotal, 4, num(tot.ent, { ...totStyle, alignment: { horizontal: 'right' } }, hours, sumB('E')));
  sm.put(bTotal, 5, num(tot.rem, { ...totStyle, alignment: { horizontal: 'right' } }, hours, sumB('F')));
  sm.put(bTotal, 6, num(tot.ent + tot.carry > 0 ? tot.taken / (tot.ent + tot.carry) : 0, { ...totStyle, alignment: { horizontal: 'right' } }, '0%',
    `IF(E${bTotal}+SUM(${range('I')})<=0,0,D${bTotal}/(E${bTotal}+SUM(${range('I')})))`));
  const summaryWs = sm.finish({ widths: [30, 14, 16, 16, 16, 16, 10], rowHeights: { 1: 24, [bTop + 1]: 22 } });

  // ---------------------------------------------------------------- How it works
  const nt = new Sheet();
  nt.put(1, 0, str('How this report is worked out', { font: arial(16, true, PALETTE.title) }));
  const y0 = parseInt(meta.yearStart.slice(0, 4), 10);
  const lines: Array<[string, boolean]> = [
    ['Holiday year', true],
    [`1 April ${y0} to 31 March ${y0 + 1}.`, false],
    ['', false],
    ['The three numbers', true],
    ['Worked + holiday  =  hours worked  +  holiday hours taken.', false],
    ['Holiday entitlement  =  (worked + holiday)  ÷  52  ×  5.6   (the UK 5.6 weeks of paid holiday).', false],
    ['Holiday remaining  =  entitlement  +  hours carried forward  -  holiday taken.', false],
    ['', false],
    ['Status column', true],
    ['Overdrawn = has taken more holiday than the entitlement so far.   Low = 20% or less of the holiday is left.   OK = more than 20% left.', false],
    ['', false],
    ['Months', true],
    ['Hours are grouped by payroll month, the same as the company holiday sheet: April is 1 to 20 April; May to February run from the 21st of the', false],
    ['previous month to the 20th; March is 21 February to 31 March. The 12 periods cover the whole year with no gaps or overlaps.', false],
    ['', false],
    ['Where the hours come from', true],
    ['From the Weekly Timesheets, using the same rules as Weekly Timesheets and Monthly Hours. If a person has more than one entry for the same day, only', false],
    ['the entry with the most activity is counted, so nothing is counted twice. Holiday hours are not included in "hours worked".', false],
    ['', false],
    ['Using the numbers', true],
    ['Totals, entitlement, remaining and the branch table are live formulas: change an hours figure on the month sheets and the other sheets update.', false],
  ];
  lines.forEach(([t, bold], i) => nt.put(3 + i, 0, str(t, { font: arial(bold ? 11 : 10, bold, bold ? PALETTE.title : BLACK) })));
  const notesWs = nt.finish({ widths: [150] });

  const wb = newBook();
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
  XLSX.utils.book_append_sheet(wb, empWs, 'Employees');
  XLSX.utils.book_append_sheet(wb, workedWs, 'Worked by month');
  XLSX.utils.book_append_sheet(wb, holidayWs, 'Holiday by month');
  XLSX.utils.book_append_sheet(wb, notesWs, 'How it works');
  return wb;
}

export const trackerFileName = (yearStart: string) => `Holiday_Tracker_${holidayYearShort(yearStart)}.xlsx`;
export const reportFileName = (yearStart: string) => `Holiday_Balance_Report_${holidayYearShort(yearStart)}.xlsx`;
