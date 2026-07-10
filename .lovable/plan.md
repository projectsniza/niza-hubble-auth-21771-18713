
## 1. My Reminders — Proper Task System

**Problems today**
- Editing an existing reminder makes it vanish.
- No time-of-day, no popup at due time, no professional dismissed state.

**Changes**
- **Data model** (`reminders` table migration):
  - Add `due_at timestamptz` (date + time) alongside existing `due_date`.
  - Add `status text` with values: `active`, `snoozed`, `acknowledged`, `completed` (replaces informal "closed" — user wants professional wording; UI shows "Acknowledged" / "Completed").
  - Add `snoozed_until timestamptz`, `acknowledged_at timestamptz`.
  - Backfill `due_at` from `due_date` + 09:00; keep RLS as-is.
- **Edit flow fix**: current save path likely does an insert instead of update when `id` is present, or the query filter drops updated rows. Rewrite `saveReminder` in `RemindersSidebar.tsx` to `upsert` on `id` and re-fetch, so retouching never deletes.
- **Reminder editor UI**:
  - Date picker + time picker (24h) → writes `due_at`.
  - Buttons: Save, Mark Acknowledged, Snooze (15m / 1h / tomorrow / custom), Complete.
- **Due popup** (`TaskReminderListener.tsx` already exists — extend it):
  - Poll every 30s for reminders where `due_at <= now()` and `status = 'active'` and (`snoozed_until` null or past).
  - Show large centered modal (shadcn Dialog, max-w-lg) with title, notes, due time, and actions: **Snooze** (dropdown 5m/15m/1h/tomorrow/pick time), **Acknowledge**, **Mark Complete**.
  - "Acknowledged" reminders remain visible in the sidebar under a collapsed "Acknowledged" group with a muted badge (styling like completed but distinct wording).
- Sidebar sections: **Upcoming**, **Overdue** (red), **Snoozed** (amber), **Acknowledged** (muted), **Completed** (existing collapsed).

## 2. Certification Coins — Tiered Weightage

**Changes**
- **`add_certification` dialog** (`EmployeeCertifications.tsx`):
  - Replace single "Gold Coins (Points)" numeric field with a **Tier selector**: Bronze (1), Silver (3), Gold (5), Platinum (10), Diamond (20) — with editable point override.
  - Store on `employee_certifications`: `coin_tier text`, `coin_points int` (already have points field — reuse; add `coin_tier` column).
- **Employee list hover tooltip** (`EmployeeList.tsx` and profile summary):
  - Show total coins next to the name with tier icons (Lucide `Medal`, `Award`, `Trophy`, `Gem`).
  - On hover: shadcn `HoverCard` listing each certification with its tier chip and points.
- **Employee profile detail** (`EmployeeProfile.tsx` → certifications tab):
  - Table with columns: Certification, Tier (colored badge), Points, Issued/Expiry, Notes.
  - Totals row per tier + grand total.
- Tier colors (semantic tokens in `index.css`, not hardcoded):
  - `--tier-bronze`, `--tier-silver`, `--tier-gold`, `--tier-platinum`, `--tier-diamond`.

## 3. Events & Announcements — Login Popup

**Changes**
- New component `TodayEventsPopup.tsx` mounted in `Dashboard.tsx`.
- On fresh session load (checked via `sessionStorage` key `today-events-shown-<yyyy-mm-dd>`), query `events` where `event_date = today` AND event is visible to the user (respect existing branch/org scoping already used on the Events page).
- If any results, show a large dialog listing each event (title, category badge, description, time, branch).
- Buttons: **Dismiss for today** (sets sessionStorage), **View all events** (routes to `/dashboard/events`).
- Also include birthdays occurring today from the same source used by Events page.

## Technical Notes

- Migrations: 1 migration adding reminder columns + status enum-like check; 1 adding `coin_tier` to `employee_certifications`. Include grants + RLS updates.
- All new colors go through `index.css` tokens.
- No changes to unrelated scheduling/lottery logic.
- Files touched (approx):
  - `supabase/migrations/*_reminders_upgrade.sql`
  - `supabase/migrations/*_certification_tiers.sql`
  - `src/components/reminders/RemindersSidebar.tsx`
  - `src/components/reminders/TaskReminderListener.tsx`
  - `src/components/reminders/ReminderDuePopup.tsx` (new)
  - `src/components/employees/EmployeeCertifications.tsx`
  - `src/components/employees/EmployeeList.tsx`
  - `src/components/employees/CertificationCoinsHover.tsx` (new)
  - `src/pages/dashboard/EmployeeProfile.tsx`
  - `src/components/dashboard/TodayEventsPopup.tsx` (new)
  - `src/pages/Dashboard.tsx`
  - `src/index.css` (tier tokens)

Confirm and I'll implement in that order (reminders → coins → events popup).
