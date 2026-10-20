import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';
import type { TimesheetHours } from './timesheetCalculations';

export interface ExcelShiftEntry {
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  worked: number;
  holiday: number;
  sick: number;
  adjustment: number;
}

export interface ExcelEmployeeWeek {
  id: string;
  name: string;
  sourceBranch?: string;
  entries: ExcelShiftEntry[];
}

export interface ExcelWeekSection {
  start: Date;
  end: Date;
  branches: Record<string, ExcelEmployeeWeek[]>;
}

export interface ExcelMonthlyEmployee {
  id: string;
  name: string;
  weeklyHours: number[];
  lastMonthAdjustment: number;
  holidayHours: number;
  sickHours: number;
  isTemporary?: boolean;
}

export interface ExcelMonthlySection {
  branches: Record<string, ExcelMonthlyEmployee[]>;
}

export interface TemporaryMonthlyEmployee {
  id: string;
  name: string;
  weeklyHours: number[];
}

export function includeTemporaryEmployeesInMonthlyExport(
  monthly: ExcelMonthlySection,
  temporaryByBranch: Record<string, TemporaryMonthlyEmployee[]>,
): ExcelMonthlySection {
  const branches = Object.fromEntries(
    Object.entries(monthly.branches).map(([branch, employees]) => [branch, [...employees]]),
  );

  Object.entries(temporaryByBranch).forEach(([branch, employees]) => {
    const branchRows = branches[branch] || (branches[branch] = []);
    employees.forEach(employee => {
      branchRows.push({
        id: `temp-${employee.id}`,
        name: `[TEMP] ${employee.name}`,
        weeklyHours: employee.weeklyHours,
        lastMonthAdjustment: 0,
        holidayHours: 0,
        sickHours: 0,
        isTemporary: true,
      });
    });
  });

  return { branches };
}

const COLORS = {
  border: 'FF000000',
  week: 'FFDAE3F3',
  day: 'FFFBE5D6',
  date: 'FFE2F0D9',
  heading: 'FFFFF2CC',
  name: 'FFFFFFCC',
  holiday: 'FF00B050',
  sick: 'FFED7D31',
  total: 'FFFFFF00',
  branch: 'FFD9EAD3',
  subtotal: 'FFD9EAD3',
};

const thinBorder = {
  top: { style: 'thin', color: { rgb: COLORS.border } },
  bottom: { style: 'thin', color: { rgb: COLORS.border } },
  left: { style: 'thin', color: { rgb: COLORS.border } },
  right: { style: 'thin', color: { rgb: COLORS.border } },
};

function cell(value: unknown, fill?: string, bold = false, align: 'left' | 'center' | 'right' = 'center') {
  return {
    v: value ?? '',
    t: typeof value === 'number' ? 'n' : 's',
    s: {
      font: { name: 'Arial', sz: 9, bold },
      alignment: { horizontal: align, vertical: 'center', wrapText: true },
      border: thinBorder,
      ...(fill ? { fill: { patternType: 'solid', fgColor: { rgb: fill } } } : {}),
    },
  };
}

function timeForExcel(time: string | null): number | string {
  if (!time) return '';
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  return (hour * 60 + minute) / (24 * 60);
}

function addRow(sheet: XLSX.WorkSheet, row: number, values: Array<unknown | ReturnType<typeof cell>>, widths: number) {
  values.forEach((value, column) => {
    sheet[XLSX.utils.encode_cell({ r: row, c: column })] =
      value && typeof value === 'object' && 's' in value ? value as ReturnType<typeof cell> : cell(value);
  });
  sheet['!ref'] = sheet['!ref'] ? XLSX.utils.encode_range(XLSX.utils.decode_range(sheet['!ref']).s, { r: row, c: widths - 1 }) : XLSX.utils.encode_range({ r: row, c: 0 }, { r: row, c: widths - 1 });
}

function addMerged(sheet: XLSX.WorkSheet, row: number, startCol: number, endCol: number, value: string, fill: string, bold = true) {
  sheet[XLSX.utils.encode_cell({ r: row, c: startCol })] = cell(value, fill, bold);
  for (let col = startCol + 1; col <= endCol; col += 1) {
    sheet[XLSX.utils.encode_cell({ r: row, c: col })] = cell('', fill, bold);
  }
  sheet['!merges'] = [...(sheet['!merges'] || []), { s: { r: row, c: startCol }, e: { r: row, c: endCol } }];
}

function rowTotal(hours: TimesheetHours) {
  return hours.worked + hours.holiday + hours.adjustment;
}

function exportExcel(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx', compression: true });
}

export function exportTimesheetWorkbook(
  weeks: ExcelWeekSection[],
  monthly: ExcelMonthlySection,
  filename: string,
  payrollLabel: string,
) {
  const sheet: XLSX.WorkSheet = {};
  let row = 0;
  const colCount = 21;

  addRow(sheet, row, ['', cell('STAFF ATTENDANCE DETAILS', undefined, true, 'left')], colCount);
  sheet['!merges'] = [{ s: { r: row, c: 1 }, e: { r: row, c: 8 } }];
  row += 1;
  addRow(sheet, row, ['', cell(`Payroll: ${payrollLabel}`, undefined, true, 'left')], colCount);
  sheet['!merges'].push({ s: { r: row, c: 1 }, e: { r: row, c: 8 } });
  row += 2;

  weeks.forEach((week, weekIndex) => {
    const branchNames = Object.keys(week.branches).sort((a, b) => a.localeCompare(b));
    addMerged(sheet, row, 1, 20, `WEEK ${weekIndex + 1}  ·  ${format(week.start, 'dd MMM')} – ${format(week.end, 'dd MMM yyyy')}`, COLORS.week);
    row += 1;

    const dayLabels: Array<unknown> = [cell('', COLORS.week, true), cell(`WEEK ${weekIndex + 1}`, COLORS.week, true)];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(week.start);
      date.setDate(date.getDate() + dayIndex);
      dayLabels.push(cell(format(date, 'EEEE').toUpperCase(), COLORS.day, true));
      dayLabels.push(cell('', COLORS.day, true));
    }
    ['HOURS', 'HOLIDAY', 'SICK', 'ADJ+/-', 'TOTAL'].forEach(label => dayLabels.push(cell(label, COLORS.heading, true)));
    addRow(sheet, row, dayLabels, colCount);
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const startCol = 2 + dayIndex * 2;
      sheet['!merges'].push({ s: { r: row, c: startCol }, e: { r: row, c: startCol + 1 } });
    }
    row += 1;

    const dateRow: Array<unknown> = [cell('', COLORS.week), cell('', COLORS.week)];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(week.start);
      date.setDate(date.getDate() + dayIndex);
      dateRow.push(cell(format(date, 'dd/MM/yyyy'), COLORS.date), cell('', COLORS.date));
    }
    for (let col = 16; col < colCount; col += 1) dateRow.push(cell('', COLORS.heading));
    addRow(sheet, row, dateRow, colCount);
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const startCol = 2 + dayIndex * 2;
      sheet['!merges'].push({ s: { r: row, c: startCol }, e: { r: row, c: startCol + 1 } });
    }
    row += 1;

    const weekTotals: TimesheetHours = { worked: 0, holiday: 0, sick: 0, adjustment: 0 };
    branchNames.forEach(branchName => {
      addMerged(sheet, row, 1, 20, branchName.toUpperCase(), COLORS.branch);
      row += 1;
      const branchTotals: TimesheetHours = { worked: 0, holiday: 0, sick: 0, adjustment: 0 };
      week.branches[branchName].forEach(employee => {
        const byDate = new Map(employee.entries.map(entry => [entry.entry_date, entry]));
        const data: Array<unknown> = [cell('', COLORS.name), cell(employee.name.toUpperCase(), COLORS.name, true, 'left')];
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
          const date = new Date(week.start);
          date.setDate(date.getDate() + dayIndex);
          const entry = byDate.get(format(date, 'yyyy-MM-dd'));
          data.push(
            cell(timeForExcel(entry?.start_time || null)),
            cell(timeForExcel(entry?.end_time || null)),
          );
        }
        const hours = employee.entries.reduce<TimesheetHours>((totals, entry) => {
          totals.worked += entry.worked;
          totals.holiday += entry.holiday;
          totals.sick += entry.sick;
          totals.adjustment += entry.adjustment;
          return totals;
        }, { worked: 0, holiday: 0, sick: 0, adjustment: 0 });
        branchTotals.worked += hours.worked;
        branchTotals.holiday += hours.holiday;
        branchTotals.sick += hours.sick;
        branchTotals.adjustment += hours.adjustment;

        const excelRow = row + 1;
        data.push(
          cell(hours.worked, COLORS.heading),
          cell(hours.holiday || '', COLORS.holiday),
          cell(hours.sick || '', COLORS.sick),
          cell(hours.adjustment || ''),
          cell(rowTotal(hours), COLORS.total, true),
        );
        addRow(sheet, row, data, colCount);
        for (let col = 2; col <= 15; col += 1) {
          const shiftCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as XLSX.CellObject;
          if (typeof shiftCell.v === 'number') shiftCell.z = 'h:mm AM/PM';
        }
        row += 1;
      });
      const subtotal = Array.from({ length: colCount }, () => cell('', COLORS.subtotal, true));
      subtotal[1] = cell('SUBTOTAL', COLORS.subtotal, true, 'left');
      subtotal[16] = cell(branchTotals.worked, COLORS.heading, true);
      subtotal[17] = cell(branchTotals.holiday, COLORS.holiday, true);
      subtotal[18] = cell(branchTotals.sick, COLORS.sick, true);
      subtotal[19] = cell(branchTotals.adjustment, COLORS.subtotal, true);
      subtotal[20] = cell(rowTotal(branchTotals), COLORS.total, true);
      addRow(sheet, row, subtotal, colCount);
      row += 1;
      weekTotals.worked += branchTotals.worked;
      weekTotals.holiday += branchTotals.holiday;
      weekTotals.sick += branchTotals.sick;
      weekTotals.adjustment += branchTotals.adjustment;
    });

    const totalRow = Array.from({ length: colCount }, () => cell(''));
    totalRow[1] = cell('WEEK TOTAL', COLORS.week, true, 'left');
    totalRow[16] = cell(weekTotals.worked, COLORS.heading, true);
    totalRow[17] = cell(weekTotals.holiday, COLORS.holiday, true);
    totalRow[18] = cell(weekTotals.sick, COLORS.sick, true);
    totalRow[19] = cell(weekTotals.adjustment, COLORS.subtotal, true);
    totalRow[20] = cell(rowTotal(weekTotals), COLORS.total, true);
    addRow(sheet, row, totalRow, colCount);
    row += 2;
  });

  addMerged(sheet, row, 1, 13, 'MONTHLY CONSOLIDATION', COLORS.week);
  row += 1;
  const summaryHeaders: Array<unknown> = [cell('', COLORS.week), ...['NAME', 'WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4', 'WEEK 5', 'WEEK 6', 'TOTAL', '(+/-) LAST MONTH', 'TOTAL HRS', 'HOLIDAY HRS', 'SICK'].map((label, i) => cell(label, i === 7 ? COLORS.heading : COLORS.week, true))];
  addRow(sheet, row, summaryHeaders, colCount);
  row += 1;
  const monthlyGrand = { weeks: Array.from({ length: 6 }, () => 0), total: 0, lastMonth: 0, totalHrs: 0, holiday: 0, sick: 0 };

  Object.entries(monthly.branches).sort(([a], [b]) => a.localeCompare(b)).forEach(([branchName, employees]) => {
    addMerged(sheet, row, 1, 13, branchName.toUpperCase(), COLORS.branch);
    row += 1;
    const branchTotal = { weeks: Array.from({ length: 6 }, () => 0), total: 0, lastMonth: 0, totalHrs: 0, holiday: 0, sick: 0 };
    employees.forEach(employee => {
      const weeks = Array.from({ length: 6 }, (_, i) => employee.weeklyHours[i] || 0);
      const total = weeks.reduce((sum, n) => sum + n, 0);
      const totalHrs = total + employee.lastMonthAdjustment;
      const vals = ['', employee.name.toUpperCase(), ...weeks.map(value => value || ''), total || '', employee.lastMonthAdjustment || '', totalHrs || '', employee.holidayHours || '', employee.sickHours || ''];
      addRow(sheet, row, vals.map((value, i) => cell(value, i === 8 ? COLORS.heading : i === 10 ? COLORS.total : i === 11 ? COLORS.holiday : i === 12 ? COLORS.sick : undefined, false, i === 1 ? 'left' : 'center')), colCount);
      weeks.forEach((value, i) => { branchTotal.weeks[i] += value; monthlyGrand.weeks[i] += value; });
      branchTotal.total += total; monthlyGrand.total += total;
      branchTotal.lastMonth += employee.lastMonthAdjustment; monthlyGrand.lastMonth += employee.lastMonthAdjustment;
      branchTotal.totalHrs += totalHrs; monthlyGrand.totalHrs += totalHrs;
      branchTotal.holiday += employee.holidayHours; monthlyGrand.holiday += employee.holidayHours;
      branchTotal.sick += employee.sickHours; monthlyGrand.sick += employee.sickHours;
      row += 1;
    });
    const values = ['', 'SUBTOTAL', ...branchTotal.weeks, branchTotal.total, branchTotal.lastMonth, branchTotal.totalHrs, branchTotal.holiday, branchTotal.sick];
    addRow(sheet, row, values.map((value, i) => cell(value || '', i === 8 ? COLORS.heading : i === 10 ? COLORS.total : i === 11 ? COLORS.holiday : i === 12 ? COLORS.sick : COLORS.subtotal, true, i === 1 ? 'left' : 'center')), colCount);
    row += 1;
  });

  const grandValues = ['', 'GRAND TOTAL', ...monthlyGrand.weeks, monthlyGrand.total, '', monthlyGrand.totalHrs, monthlyGrand.holiday, monthlyGrand.sick];
  addRow(sheet, row, grandValues.map((value, i) => cell(value || '', i === 8 ? COLORS.heading : i === 10 ? COLORS.total : i === 11 ? COLORS.holiday : i === 12 ? COLORS.sick : COLORS.week, true, i === 1 ? 'left' : 'center')), colCount);
  sheet['!cols'] = [
    { wch: 2 }, { wch: 24 }, ...Array.from({ length: 14 }, () => ({ wch: 11 })),
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];
  sheet['!rows'] = Array.from({ length: row + 1 }, () => ({ hpt: 18 }));
  (sheet as any)['!views'] = [{ state: 'frozen', xSplit: 2, ySplit: 3, topLeftCell: 'C4' }];
  (sheet as any)['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
  (sheet as any)['!printOptions'] = { horizontalCentered: true };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Timesheet');
  exportExcel(workbook, filename);
}