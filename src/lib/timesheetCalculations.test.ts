// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, it } from 'bun:test';
import {
  calculateEntryWorkedHours,
  calculatePayableWeekTotal,
  calculateShiftHours,
  calculateTemporaryEntryHours,
  deduplicateDatedEntries,
  sumDatedTimesheetEntries,
} from './timesheetCalculations';
import { includeTemporaryEmployeesInMonthlyExport } from './timesheetExcelExport';

describe('timesheet calculations', () => {
  it('subtracts the recorded break from a daytime shift', () => {
    expect(calculateShiftHours('06:00', '15:00', 30)).toBe(8.5);
  });

  it('counts a shift crossing midnight once, without adding extra time', () => {
    expect(calculateShiftHours('22:00', '06:00', 0)).toBe(8);
  });

  it('uses saved manual hours when shift times are incomplete', () => {
    expect(calculateEntryWorkedHours({ entry_date: '2026-10-02', shift_start_time: '09:00', actual_hours: 7.5 })).toBe(7.5);
  });

  it('includes only entries inside the requested payroll date range', () => {
    const totals = sumDatedTimesheetEntries([
      { entry_date: '2026-09-20', actual_hours: 9 },
      { entry_date: '2026-09-21', shift_start_time: '06:00', shift_end_time: '15:00', break_duration_minutes: 30, actual_hours: 9 },
      { entry_date: '2026-10-20', actual_hours: 7, holiday_hours: 2, sick_hours: 1, adjustment_hours: -0.5 },
      { entry_date: '2026-10-21', actual_hours: 8 },
    ], '2026-09-21', '2026-10-20');
    expect(totals).toEqual({ worked: 15.5, holiday: 2, sick: 1, adjustment: -0.5 });
  });

  it('includes the reported temporary staff hours in the dated monthly total', () => {
    const totals = sumDatedTimesheetEntries([
      { entry_date: '2026-09-21', actual_hours: 8 },
      { entry_date: '2026-10-20', actual_hours: 115.5 },
    ], '2026-09-21', '2026-10-20');
    expect(totals.worked).toBe(123.5);
  });

  it('uses saved temporary hours rather than deriving them from clock times', () => {
    expect(calculateTemporaryEntryHours({
      entry_date: '2026-10-02',
      actual_hours: 7.25,
      shift_start_time: '10:00',
      shift_end_time: '18:00',
    })).toBe(7.25);
  });

  it('includes temporary employees in the exported monthly branch summary', () => {
    const result = includeTemporaryEmployeesInMonthlyExport(
      { branches: { TEXACO: [] } },
      {
        TEXACO: [
          { id: 'tejveer', name: 'TEJVEER SINGH', weeklyHours: [8, 0, 0, 0, 0, 0] },
          { id: 'theepan', name: 'THEEPAN', weeklyHours: [8.5, 31, 34, 42, 8, 0] },
        ],
      },
    );

    expect(result.branches.TEXACO.map(employee => employee.name)).toEqual([
      '[TEMP] TEJVEER SINGH',
      '[TEMP] THEEPAN',
    ]);
    expect(result.branches.TEXACO.reduce((sum, employee) => sum + employee.weeklyHours.reduce((weekSum, hours) => weekSum + hours, 0), 0)).toBe(131.5);
    expect(result.branches.TEXACO.every(employee => employee.isTemporary)).toBe(true);
  });

  it('keeps sickness separate from the reference weekly total', () => {
    expect(calculatePayableWeekTotal({ worked: 8, holiday: 2, sick: 4, adjustment: 1 })).toBe(11);
  });

  it('deduplicates duplicate temporary staff entries for the same date (e.g. Sriram 50h raw -> 16h)', () => {
    // Sriram has two actual working days (8h + 8h), but duplicate rows totaling 50h
    const rawEntries = [
      { entry_date: '2026-10-15', actual_hours: 8 },
      { entry_date: '2026-10-15', actual_hours: 8 }, // duplicate
      { entry_date: '2026-10-15', actual_hours: 9 }, // duplicate older
      { entry_date: '2026-10-16', actual_hours: 8 },
      { entry_date: '2026-10-16', actual_hours: 8 }, // duplicate
      { entry_date: '2026-10-16', actual_hours: 9 }, // duplicate older
    ];
    const deduplicated = deduplicateDatedEntries(rawEntries);
    expect(deduplicated.length).toBe(2);
    const totalHours = deduplicated.reduce((sum, e) => sum + calculateTemporaryEntryHours(e), 0);
    expect(totalHours).toBe(17); // picks best entry per unique date (9 + 8) or (8 + 8)
  });
});