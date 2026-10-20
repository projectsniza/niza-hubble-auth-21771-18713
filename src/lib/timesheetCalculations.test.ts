// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, it } from 'bun:test';
import {
  calculateEntryWorkedHours,
  calculatePayableWeekTotal,
  calculateShiftHours,
  sumDatedTimesheetEntries,
} from './timesheetCalculations';

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

  it('keeps sickness separate from the reference weekly total', () => {
    expect(calculatePayableWeekTotal({ worked: 8, holiday: 2, sick: 4, adjustment: 1 })).toBe(11);
  });
});