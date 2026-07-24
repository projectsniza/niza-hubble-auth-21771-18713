This spans 9 items across Custom Roles, the Co-op Fuel daily upload pipeline, and the XeroExport / DailySalesAdmin views. Below is what I'll ship.

## 1. Custom Roles — multi-branch assignment
- Add `branch_ids uuid[]` column to `custom_roles` (keep `branch_id` for backwards compat; when a single branch is picked we still populate it).
- `CustomRoleForm.tsx`: replace the single Branch select with a checkbox list of branches under the chosen org, plus an "All branches" toggle. Save as an array.
- `useCustomRoleAccess`, HR-scoping helpers, and any place that reads `role.branch_id` will fall back to `branch_ids` (array contains check).

## 2 + 4 + 5 + 6. Co-op Fuel parser correctness
In `src/lib/coopFuelParser.ts`:
- Keep Drinks and Alcohol as separate outputs (do not merge). Update the aggregate "shop" total accordingly and add `alcohol` to `parsed_totals.breakdown`.
- Cash Reconciliation CSV/XLSX: parse it and expose per-day banking / cash / carwash / vending / payzone / paypoint / lotto values. Store parsed result on the `cashrec` row's `parsed_totals`.
- Culverstone rule: fuel-zero-rated amount that isn't fuel → Vending. Houndsmills rule: fuel-zero-rated total = Car Wash + Vending; subtract Car Wash (from X-Read) from the fuel-zero-rated amount, remainder = Vending. Driven by a per-branch flag `vending_split_mode` ('culverstone' | 'houndsmills') on `branches`.
- Ensure Drive Off and Alcohol pull from correct columns (fix orange-cell issues in feedback).

## 3. XLSX Export cleanup
In `src/pages/niza-analysis/XeroExport.tsx`:
- Remove tabs: SHIFT SHEET, COUNTING, DIPS, P & L, BANK, STOCK CONT, Week Wages, HOURS & WAGES, comp statement.
- Keep C.CARD tab as empty plain sheet (headers only, no data).
- Remove blue/yellow highlighting; keep green as-is; orange tabs recomputed with parser fixes above.

## 7. Live CSV preview UI
New tab in Niza Analysis "Live Preview" (`/niza-analysis/live-preview`):
- Date range filter (default current payroll period).
- Renders each output sheet (SALE, CASH SUM1, OBJECTIVE, C.CARD, C.PURCH, EXPENSES, PURCHASES) live in a scrollable table, exactly as export will produce them.
- "Download XLSX" button reuses the export function.

## 8. Uploaded files viewer
New tab "Uploaded Files" in Niza Analysis:
- Lists all `daily_sales_uploads` rows with branch + date + type (X-Read / Dept VAT / Cash Rec).
- Signed URL download button per file (1h expiry).
- Filter by branch and date range.

## 9. Formulas viewer
New tab "Formulas & Calculations":
- Static documented list of every output cell with its formula/source (e.g. "SALE!Fuel = X-Read total fuel litres × price"; "CASH SUM1!Shop Sales = TO+DR+GS+GZ+DO+AL+NP+VM"; "Vending (Houndsmills) = fuel_zero_rated - car_wash").
- Grouped by output tab, expandable rows.

## Technical notes
- Single migration adds `custom_roles.branch_ids uuid[]` and `branches.vending_split_mode text default 'culverstone'`.
- No changes to Supabase Storage buckets.
- No new edge functions.
- All existing flows preserved (weekly cycle, category alerts, daily 3-file upload UX).

Given the size, I'll ship in this order per turn: migration → parser + export cleanup → custom role UI → live preview → uploaded files → formulas viewer.

Please approve and I'll start with the migration.