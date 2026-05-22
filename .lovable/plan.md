# Scheduling Enhancements

Five changes across the Timesheets/Scheduling module. All UI-only except for one small table for "left the job" flagging.

## 1. Shift time restriction (00 / 30 minutes only)
- In `TimesheetView.tsx` and `TempStaffSection.tsx`, restrict every shift start/end input (inline edits + edit panel) to `:00` and `:30`.
- Implementation: `step="1800"` on time inputs + on-blur snap that rounds to nearest half-hour and rejects `:15` / `:45` with a toast.

## 2. New "Full view" toggle in Weekly Entry
- Add a view switcher next to the week navigator: **Full view** (default) vs **Weekly view**.
- **Full view**: render all 5–6 payroll weeks stacked vertically (one TimesheetGrid per week, with its own header bar). No week selector.
- **Weekly view**: current behaviour — single week with prev/next selector.
- Persist choice in `localStorage` (`scheduling.entryView`).

## 3. Three new reports under a new "Reports" tab in Scheduling

### a. Shop Target Hours (matches uploaded XLSX layout)
Columns: `No | Intercompany | Location | Weekly Target | Week1..Week5 actuals | Comments` for the selected payroll month, grouped by organization with blank separator rows, totals at bottom. Each week column header shows the date range and day-count (e.g. "3 Days"). Export to XLSX.

### b. Abnormal Behaviour Report
Auto-flagged rows for the selected month:
- Any employee with `actual_hours > 16` on a single day.
- (Future-extensible list — leave room for more rules.)
Columns: Employee, Branch, Date, Hours, Rule, Notes. Export to CSV.

### c. Staff List (live tracker)
Live count of staff currently inside each store using `clock_ins` (clocked-in, not clocked-out). Per-store list with names + total count, auto-refresh every 30s.
- Adds a **"Mark as Left the Job"** action for managers/HR/super_admin. New table `employee_separations(employee_id, branch_id, left_on, reason, recorded_by)` + RLS. Flagged rows show a red "LEFT" badge in the Head Office view; manager view shows the action only.

## 4. Monthly Working Hours + Holiday Hours topic
- New top section in `HolidayBalance.tsx` (and visible to employees in their own view) showing per-employee, per-month:
  - Total worked hours (sum of approved timesheets in that payroll month)
  - Holiday hours taken that month
  - **Accumulated holiday hours** (running total of `holiday_hours_earned` minus `holiday_hours_taken` up to end of that month)
- Month picker; default = current payroll month. Table groups by employee.

## Technical notes
- New DB migration: `employee_separations` table + RLS.
- New files:
  - `src/components/scheduling/reports/ShopTargetHoursReport.tsx`
  - `src/components/scheduling/reports/AbnormalBehaviourReport.tsx`
  - `src/components/scheduling/reports/StaffListLive.tsx`
  - `src/components/scheduling/reports/SchedulingReports.tsx` (tab container)
  - `src/components/scheduling/MonthlyHoursPanel.tsx`
- Edits:
  - `src/pages/dashboard/Scheduling.tsx` — add "Reports" tab.
  - `src/components/scheduling/TimesheetView.tsx` — Full/Weekly toggle + time-snap.
  - `src/components/scheduling/TempStaffSection.tsx` — time-snap.
  - `src/components/scheduling/HolidayBalance.tsx` — mount `MonthlyHoursPanel`.

No changes to payroll logic, lock logic, or existing data.
