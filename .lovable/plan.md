# Niza HR — functional problems found (read-only audit)

Nothing has been changed. Below is what I found and, if you want, the order I would fix it in.

## 1. Creating a staff account signs the admin out of their own account
Employee Hub > Pending Accounts > "Create Account" signs up the new person through the normal sign-up route, which replaces the current session. The admin ends up logged in as the employee they just created.
Fix: create the account through the existing secure account-creation service (the one already used elsewhere in the app), leaving the admin's session untouched.

## 2. The red number on "Pending Accounts" doesn't match the list
The badge counts people marked "not activated and active", while the list shows people with no login yet and not terminated. So the badge can show a number when the list is empty (or vice versa).
Fix: make the badge use exactly the same rule as the list.

## 3. Long lists get cut off
- The staff list loads at most 200 people.
- Leave & Attendance overview and the schedule load month data in one request, which the database caps at 1000 rows.
Result: missing staff, missing leave and missing hours on busy months — and any totals built from them are understated.
Fix: use the paging helper already in the project so every row is loaded.

## 4. Month boundaries can shift by a day
Several screens convert dates through UTC (leave overview, Overview stats, My Profile leave submission, payroll month key). Late-evening or early-morning records can land in the wrong month.
Fix: compare plain calendar dates instead of UTC timestamps.

## 5. Branch and company pickers ignore the user's scope
The Leave & Attendance overview loads every organisation and branch, so a scoped HR or custom-role user sees branches they shouldn't be able to pick.
Fix: filter those pickers through the same visible-branch rules used by the rest of the app.

## 6. Failures show as zeros with no warning
Badge counts and the leave overview swallow errors, so a failed load looks like "nothing pending".
Fix: surface a short error message and a retry instead of silently showing 0.

## Suggested order
1, 2, 3 first (they cause wrong data and a broken admin flow), then 4, 5, 6.

## Technical notes
- `src/pages/dashboard/Employees.tsx` `PendingAccountsOnly.handleActivateAccount` uses `supabase.auth.signUp`; should call the `create-user` edge function.
- `src/hooks/useNotificationCounts.ts` pending-accounts query (`account_activated=false` + `status='active'`) vs list query (`account_activated=false`, `user_id is null`, `status != 'terminated'`).
- `src/hooks/useEmployees.ts` `.limit(200)`; `src/components/attendance/LeaveAttendanceOverview.tsx` and `src/pages/dashboard/Scheduling.tsx` need `fetchAllPages` from `src/lib/supabasePagination.ts`.
- `toISOString().split('T')[0]` usages in `Overview.tsx`, `MyProfile.tsx`, `Payroll.tsx`; `monthEnd.toISOString()` in `LeaveAttendanceOverview.tsx`.
- `fetchOrgsAndBranches` in `LeaveAttendanceOverview.tsx` bypasses `OrgBranchContext` visible-branch filtering.
