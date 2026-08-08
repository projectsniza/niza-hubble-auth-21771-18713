# Scheduling Module Audit — Findings Only (nothing changed)

Scanned: `src/pages/dashboard/Scheduling.tsx`, all of `src/components/scheduling/**` (Timesheet, FullMonthEntry, HolidayBalance, MonthlyHoursPanel, TempStaff, BranchHourTargets, MonthlyLockStatus, RotaSettings, reports/*), `src/lib/timeSnap.ts`.

## Critical

1. **Managers see every branch in Full Month view.** `TimesheetView.tsx:217` defaults the entry view to `full`, and `TimesheetView.tsx:1504-1510` renders `FullMonthEntryView` without any branch scope. `FullMonthEntryView.tsx:88-96` filters only by the super-admin/HR org/branch picker — no manager or custom-role branch filter. The Weekly view scopes correctly (`TimesheetView.tsx:379,422,436,472`), so this is a bypass on one path only.
2. **Holiday Balance is unscoped.** `HolidayBalance.tsx:139-143` fetches all active employees with no role filter — managers/HR see entitlement and remaining hours for staff outside their branch.
3. **Shop Target Hours report is unscoped.** `ShopTargetHoursReport.tsx:59-95` fetches all branches, targets, timesheets, temp entries; the file never imports `useAuth`.
4. **Two screens disagree on holiday entitlement.** Spec is `WeeksWorked = (worked + holidayTaken) / weeklyHours`. `HolidayBalance.tsx:256-260` does this correctly; `MonthlyHoursPanel.tsx:136-137` uses `worked / weekly` only (`taken` read at :138 but never added). Same employee, two different Entitlement/Accumulated numbers.

## High

5. **1000-row truncation (silent undercounting).** `fetchAllPages` exists (`TimesheetView.tsx:77-90`, `FullMonthEntryView.tsx:74-85`) but is not used in: `HolidayBalance.tsx:160-164` and `:179-183` (500-id chunks × 7 entries can exceed 1000), `MonthlyHoursPanel.tsx:65-70,77-82,101-106,109-112`, `ShopTargetHoursReport.tsx:59-95`, `AbnormalBehaviourReport.tsx:44-76`, `StaffListLive.tsx:47-96`, `TimesheetView.tsx:1206-1229` (CSV temp-staff prefetch).
6. **Abnormal Behaviour report scopes manager but not HR.** `AbnormalBehaviourReport.tsx:48-50` — no `scopedBranchIds` branch, so scoped HR sees company-wide flags.
7. **Timezone bucketing bug in reports.** `ShopTargetHoursReport.tsx:102,108` uses `new Date(e.entry_date)` (UTC midnight) compared against locally-built week boundaries (`:11-14,17-30`). Entries on the 21st/20th or a Monday can land in the wrong week or drop out entirely (`wi === -1`). The codebase already has `parseLocalDate` (`TimesheetView.tsx:126-129`) that the reports never use. Same pattern for display in `AbnormalBehaviourReport.tsx:159`, `StaffListLive.tsx:169,208`.
8. **Month lock is client-side only, and defaults to "unlocked".** `editingDisabled` gates saves at `TimesheetView.tsx:782,830,854` and `TempStaffSection.tsx:250`, but `isMonthLocked` starts `false` and the lock fetch is async (`:384-397`) — edits during that window pass. Worse, when no branch is selected `lockBranchId` is `null` and the effect short-circuits to unlocked (`:386`), so HR/Admin viewing "All branches" never sees or enforces a lock.

## Medium

9. **Rows keyed by name, not employee id.** `getTimesheetMonthlyKey` (`TimesheetView.tsx:142-146`) is branch+name; two employees with the same name at one branch silently merge into one row in both weekly (`:1006-1042`) and monthly (`:1105-1141`) views — one person disappears from grand totals.
10. **"Best duplicate" chosen on the wrong number.** `TimesheetView.tsx:1125-1140` picks the duplicate timesheet by *stored* totals but then applies *payroll-clamped* entry totals — for weeks straddling the 20th/21st these can disagree, breaking the weekly/monthly parity that block is meant to guarantee.
11. **ADJ column not clamped to the payroll period.** `FullMonthEntryView.tsx:188` uses the whole `total_adjustment_hours` while worked/holiday/sick are day-filtered (`:165-176`). Week 1 / Week 6 rows can include adjustments belonging to the other payroll month.
12. **Temp staff HOLIDAY/SICK/ADJ are hardcoded 0.** `TempStaffSection.tsx:365-366` with columns still shown (`:353-357`), so temp TOTAL means something different from regular TOTAL (`FullMonthEntryView.tsx:272`). Same in CSV export (`TimesheetView.tsx:1275-1286`).
13. **Holiday CSV column counts are hand-maintained.** `HolidayBalance.tsx:61-62,395-425` — header built from `MONTHS_SHORT`, data indexed off `MONTHS`; correct today, desyncs silently if either list changes.

## Hour-calculation edge cases

14. **`00:00` end time becomes a 15-hour shift.** The `+24h` rollover is duplicated three times (`TimesheetView.tsx:773-775`, `:904-906`, `TempStaffSection.tsx:244-246`) with no shared helper and no upper bound, so `09:00 → 00:00` silently records 15h instead of flagging a missing end time.
15. **Negative hours can be saved.** Same blocks apply the rollover once, not as a clamp — a break longer than the shift can leave `totalMins` negative and write a negative `actual_hours`; nothing floors at 0 or caps at 24.
16. **Half-entered shifts keep stale hours.** `TimesheetView.tsx:766-767` recomputes only when both times exist; clearing one time leaves the previous `actual_hours` in place.
17. **Bad values silently become 0.** `Number(x) || 0` throughout (`TimesheetView.tsx:786-789`, `HolidayBalance.tsx:195-196`, `MonthlyHoursPanel.tsx:89-91`) — a malformed `"1,5"` becomes 0 with no warning.
18. **Rounding drift.** Each entry is rounded to 2dp before summing (`TimesheetView.tsx:775`, `:906`, `TempStaffSection.tsx:246`); monthly totals accumulate that error instead of rounding once at the end.

## Silent failures / React issues

19. **Saves that report success without checking errors.** `HolidayBalance.tsx:319-333` (payroll note update/insert never checks `.error`, then toasts "Saved successfully"), `TimesheetView.tsx:841-843` (`calculate_holiday_balance` RPC failure swallowed by empty `catch`), `MonthlyLockStatus.tsx:50-53` (`Promise.all` errors ignored, screen renders empty), `TempStaffSection.tsx:109-114` (`fetchBranches` error ignored).
20. **Fragile effect deps.** `TimesheetView.tsx:301` uses `[currentWeekStart && format(...)]` (a boolean-or-string dep); `FullMonthEntryView.tsx:205-206` suppresses exhaustive-deps while using `weeks/payStart/payEnd`; `Scheduling.tsx:39-43` depends on the whole `user` object.
21. **Monthly cache loses entries after an inline edit.** `TimesheetView.tsx:936-957` patches `allMonthTimesheets` with the narrower weekly snapshot, dropping entries that only existed via the dated-entry safety net (`:517-531`) until the next full fetch.
22. **Blank hour target saves as a hard 0.** `BranchHourTargets.tsx:95-108` coerces `''` to `0`, so an untouched threshold becomes a real 0 target rather than "not configured".

## Not verified (needs DB inspection, not in this scan)
- Whether any RLS policy or trigger enforces `timesheet_month_locks` server-side (finding 8).
- The exact rounding/clamping in the `update_timesheet_totals` trigger vs. the client's `getTsInPeriodTotals` (feeds finding 10).

Nothing was modified. Tell me which numbers you want fixed and I'll plan the changes.
