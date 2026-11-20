import type { EmployeeBalance } from '../HolidayBalance';
import { balanceOf, type HolidayExportRow } from '@/lib/holidayExport';

// Display helpers for the Holiday Balance screen and its exports.
// Nothing here changes how hours are counted: they only re-shape the numbers HolidayBalance already worked out.

export const MONTH_NAMES = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
export const MONTH_SHORT = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Re-shape the screen's numbers for the Excel exports. */
export function toExportRows(balances: EmployeeBalance[]): HolidayExportRow[] {
  return balances.map((b) => ({
    branch: b.employee.branch?.name || 'Unassigned',
    name: `${b.employee.first_name} ${b.employee.last_name}`.trim(),
    contractType: b.contract_type === 'Full-Time' ? 'FT' : 'PT',
    monthlyWorked: b.monthly_actual,
    monthlyHoliday: b.monthly_holiday,
    // The screen adds any carried-forward hours into "remaining" only, so recover them from that.
    carryForward: Math.round((b.holiday_hours_remaining - b.holiday_entitlement + b.holiday_hours_taken) * 100) / 100,
  }));
}

/** Status of one person's balance: OK, Low, Overdrawn, or No entitlement yet. */
export function statusOf(b: EmployeeBalance): 'OK' | 'Low' | 'Overdrawn' | 'No entitlement yet' {
  const row = toExportRows([b])[0];
  return balanceOf(row).status as 'OK' | 'Low' | 'Overdrawn' | 'No entitlement yet';
}

/** Share of the available holiday already taken, 0 to 1 (more than 1 when overdrawn). */
export function usedShare(b: EmployeeBalance): number {
  // available = entitlement + carried forward = remaining + taken
  const available = b.holiday_hours_remaining + b.holiday_hours_taken;
  return available > 0 ? b.holiday_hours_taken / available : 0;
}

/** "21 Apr to 20 May" for payroll month `idx` (0 = April) of the holiday year starting in `startYear`. */
export function payrollPeriodLabel(idx: number, startYear: number): string {
  if (idx === 0) return `1 Apr to 20 Apr ${startYear}`;
  const prevMonth = (3 + idx - 1) % 12; // calendar month the period starts in
  const thisMonth = (3 + idx) % 12;
  const yearOf = (m: number) => (m >= 3 ? startYear : startYear + 1);
  if (idx === 11) return `21 Feb to 31 Mar ${yearOf(2)}`;
  return `21 ${MON[prevMonth]} to 20 ${MON[thisMonth]} ${yearOf(thisMonth)}`;
}

/** The holiday year ("YYYY-04-01") and payroll-month index (0 = April) that a calendar month belongs to. */
export function holidayPositionOf(date: Date): { yearStart: string; idx: number } {
  const m = date.getMonth();
  const y = m >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return { yearStart: `${y}-04-01`, idx: (m + 9) % 12 };
}

export const hrs = (n: number, dp = 2) => n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
