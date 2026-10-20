export interface DatedHoursEntry {
  entry_date: string;
  actual_hours?: number | string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  break_duration_minutes?: number | string | null;
  holiday_hours?: number | string | null;
  sick_hours?: number | string | null;
  adjustment_hours?: number | string | null;
}

export interface TimesheetHours {
  worked: number;
  holiday: number;
  sick: number;
  adjustment: number;
}

export type TimesheetHourTotals = TimesheetHours;

const numberOrZero = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateShiftHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  breakMinutes = 0,
): number {
  if (!startTime || !endTime) return 0;
  const timePattern = /^(\d{1,2}):(\d{2})/;
  const start = timePattern.exec(startTime);
  const end = timePattern.exec(endTime);
  if (!start || !end) return 0;

  const startHour = Number(start[1]);
  const startMinute = Number(start[2]);
  const endHour = Number(end[1]);
  const endMinute = Number(end[2]);
  if (
    startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59
  ) return 0;

  let durationMinutes = endHour * 60 + endMinute - startHour * 60 - startMinute;
  if (durationMinutes < 0) durationMinutes += 24 * 60;
  durationMinutes = Math.max(0, durationMinutes - Math.max(0, numberOrZero(breakMinutes)));
  return Math.round(durationMinutes / 60 * 100) / 100;
}

export function sumDatedTimesheetEntries(
  entries: readonly DatedHoursEntry[],
  startDate: string,
  endDate: string,
): TimesheetHours {
  return entries.reduce<TimesheetHours>((totals, entry) => {
    if (entry.entry_date < startDate || entry.entry_date > endDate) return totals;
    totals.worked += calculateEntryWorkedHours(entry);
    totals.holiday += numberOrZero(entry.holiday_hours);
    totals.sick += numberOrZero(entry.sick_hours);
    totals.adjustment += numberOrZero(entry.adjustment_hours);
    return totals;
  }, { worked: 0, holiday: 0, sick: 0, adjustment: 0 });
}

export function calculateEntryWorkedHours(entry: DatedHoursEntry): number {
  if (entry.shift_start_time && entry.shift_end_time) {
    return calculateShiftHours(
      entry.shift_start_time,
      entry.shift_end_time,
      numberOrZero(entry.break_duration_minutes),
    );
  }
  return numberOrZero(entry.actual_hours);
}

export function calculatePayableWeekTotal(hours: TimesheetHours): number {
  return hours.worked + hours.holiday + hours.adjustment;
}