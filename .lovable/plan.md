## Root cause

Your payroll cycle is **21st → 20th of next month**. Leave/holiday hours are stored per day in `timesheet_entries.entry_date`, but the **Holiday Balance** view buckets them into payroll months using only the parent timesheet's `week_start_date` (the Monday). Whenever a calendar week straddles the 21st, this attributes the entire week's holiday hours to whichever cycle the Monday falls in — not the day the leave was actually taken.

Example — leave taken Mon 23 Jun 2025 (June cycle = 21 Jun → 20 Jul):
- The timesheet week starts Mon 16 Jun → `week_start_date = 2025-06-16`
- 16 Jun falls in **May's cycle** (21 May → 20 Jun)
- Holiday hours for 23 Jun are summed under **May**, not June

The reverse also happens (e.g. leave on 21 May appearing under April for a week starting 19 May). MonthlyHoursPanel already buckets correctly by `entry_date`, so the two views disagree — which is what you're noticing.

A secondary, smaller bug: leave date ranges in `Attendance.tsx` are iterated with `new Date('YYYY-MM-DD')` (parsed as UTC midnight) combined with local `setDate` / `format`, which can shift a day in non-UTC timezones.

## Fix

### 1. `src/components/scheduling/HolidayBalance.tsx` (primary fix)
Replace the timesheet-level bucketing (lines ~194–215) with per-day bucketing:

- Fetch `timesheet_entries(entry_date, actual_hours, holiday_hours)` for the full fiscal year alongside the existing `timesheets` query, joined by `timesheet_id → employee_id`.
- For each month index, compute `payrollStart = 21st of monthDate` and `payrollEnd = 20th of monthDate+1`.
- `monthly_actual[idx]` = sum of `actual_hours` where `entry_date` ∈ [payrollStart, payrollEnd].
- `monthly_holiday[idx]` = sum of `holiday_hours` where `entry_date` ∈ [payrollStart, payrollEnd].
- Use `parseISO(entry_date)` and string comparison on `yyyy-MM-dd` to avoid any timezone drift (compare with `format(payrollStart,'yyyy-MM-dd')` ≤ entry_date ≤ `format(payrollEnd,'yyyy-MM-dd')`).
- Totals (`actualTotal`, `holidayTotal`, entitlement maths) stay unchanged — they are sums of the 12 monthly values, so totals remain correct, only the month a value lands in changes.

### 2. `src/pages/dashboard/Attendance.tsx` (timezone-safe date iteration)
In the two leave-expansion loops (~lines 715 and 728), replace:

```ts
const start = new Date(req.start_date);
const end   = new Date(req.end_date);
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { ... }
```

with a UTC-safe iterator using `parseISO` + `addDays` from `date-fns`, and key by `format(d,'yyyy-MM-dd')` (already done). Same pattern for the mandatory-leave loop.

### 3. `src/components/attendance/LeaveAttendanceOverview.tsx` (sanity pass)
Audit the leave/timesheet day-mapping (around the `dayStr` matching). Ensure every conversion of an ISO date string uses `parseISO` (not `new Date(str)`), so the day a leave is shown on matches the day it was approved for in any timezone.

### 4. No DB changes
No migration, no trigger, no payroll-cycle redefinition — the cycle (21 → 20) is correct and stays as is. Existing data is unaffected; the same rows simply display under the right month after the fix.

## Out of scope (will NOT touch)
- Payroll calculations, lock logic, approval workflow.
- `MonthlyHoursPanel` (already buckets by `entry_date` correctly).
- `TimesheetView` weekly/monthly entry — its display is week-based by design.
- Leave approval flow in `Attendance.tsx` (only the date-iteration helper).

## Verification
- Pick an employee with a leave that crosses the 21st (e.g. 19–25 May). Before: hours appear in the wrong cycle column on Holiday Balance. After: 19–20 May → April column, 21–25 May → May column, matching MonthlyHoursPanel.
- Confirm yearly totals (`actualTotal`, `holidayTotal`, remaining entitlement) are unchanged for the same employee.
