
## Scope

Fix the Co-op daily uploads so that the per-day category totals reproduced in our system are **byte-for-byte identical** to the client's paperwork (`   SALE   ` and `CASH SUM1` tabs in the monthly XLS) for the two attached weekly zips (Southwater 22–28 Jun, Culverstone 22–28 Jun), and turn the upload flow into the client's real 3-file daily/weekly rhythm.

## 1. Fix the category totals

Root cause of the mismatch you flagged (`Tobacco 751.40 + 125.23 = 876.63`): the current parser is summing the **Amount** cell plus the **Vat Amount** cell for the same rate. Paperwork uses **Net (Amount)** only; VAT belongs in the separate VAT columns.

New behaviour — from `DEPARTMENTVAT dd.mm.yyyy.CSV`:

- Read **only** the three `Amount` cells per department (0%, 20%, 5% blocks); never add VAT into a category.
- Rebuild the mapping to match the paperwork ' SALE ' tab exactly. Confirmed from your attached files:

| Paperwork column | Departments used | VAT rate used |
|---|---|---|
| FUEL | `FUEL` | 20% Amount |
| TOBACCO | `CIGARETTES & TOBACCO` | 20% Amount |
| DRINKS | `SOFT BEVERAGES` + `BEVERAGES` (20% only) | 20% Amount |
| GROCERY STD (20%) | `GROCERY 1/2/3`, `GROCERY NONFOOD`, `FROZEN`, `PROVISIONS DAIRY/PREPARED`, `FRANCHISE LOCAL`, `CAR CARE`, `CONCESSION 1`, `DEPT 028`, `STORE EXPENSES`, `SEASONAL`, `INSTORE BKRY`, `BAKERY`, `FRUIT & VEGETABLES`, `MEAT & POULTRY`, `DELICATESSEN`, `OTHER GROCERY`, `LOCAL PRODUCTS` — 20% Amount columns |
| GROCERY ZERO (0%) | Same department list — 0% Amount columns |
| DOMESTIC 5% | Any department, 5% Amount column |
| ALCOHOL | (Southwater/Culverstone don't split alcohol; leave 0 unless a dept has ALCOHOL/WINE/SPIRIT/BEER label) |
| NEWSPAPERS | `NEWSPAPERS & MAGAZINES` 0% Amount |
| VENDING | `VENDING` — from X-Read (Dept VAT rarely lists it separately) |
| CAR WASH | Sum of `CAR WASH n` + `JET WASH n` — from X-Read |
| NAT LOTTERY | `Lottery` line in X-Read (not the `NATIONAL LOTTERY` Dept VAT row, which double-counts) |
| SCRATCHCARDS | `Scratchcards` line in X-Read |
| PAYPOINT | `Paypoint` line in X-Read |
| PAYZONE | `Payzone` line in X-Read |
| LOTTO PAYOUTS | `Lotto Prizes` + `Scratchcard Prizes` from X-Read (negative) |
| DRIVE OFF | `Drive Off` line from X-Read (negative) |
| NET 0% / NET 20% / VAT 20% / NET 5% / VAT 5% | Aggregated across all departments — Amount + Vat Amount columns per rate |

Test against the attached zips + monthly XLS SALE tabs; the parser will only be marked "done" when the weekly sum matches for both stores. (E.g. Culverstone 22 Jun: Fuel 25506.74, Tobacco 751.40, Paypoint 220.00, Nat Lottery 132.00 from X-Read, Newspapers 18.10.)

## 2. 3-file daily/weekly upload flow

Store login → **Daily Sales Upload** page becomes a **checklist** for the current sale date:

```text
┌─ Today: 15 Jul 2026 ─────────────────────────────┐
│ 1. X-Read (till report, CSV/TXT)      [Upload]   │  ← required daily
│ 2. Department VAT (CSV/XLSX)          [Upload]   │  ← required daily
│ 3. Cash Reconciliation (this week)    [Upload]   │  ← weekly, any day
└──────────────────────────────────────────────────┘
```

- Files 1 & 2 are marked complete when uploaded for the selected `sale_date`.
- File 3 is marked complete when the branch has *any* cash-rec upload covering the ISO week containing `sale_date` (Mon–Sun). Missing weekly file shows a soft amber banner: "Cash Reconciliation for week of dd Mon still to upload."
- Upload button stays disabled until both daily files are present; weekly file can be uploaded independently at any time.
- Recent uploads table gets three status columns (X-Read / Dept VAT / Cash Rec) with a green tick or a red cross per day so the store manager can see gaps at a glance.

Storage layout stays the same (`daily-sales` bucket, `branch_id/date/…`), and `daily_sales_uploads.source_format` becomes one of `xread`, `deptvat`, `cashrec` (weekly rows use `sale_date = Monday of the week`).

## 3. Cash Reconciliation weekly reminder

- Home dashboard tile "Cash Reconciliation due" appears from Sunday 00:00 until it is uploaded for the just-finished week.
- Store admin can dismiss for the current week (session-scoped) but the tile returns next Sunday.

## 4. Historical data / recalculation

- `normalizeCoopParsedTotals` will be re-run automatically whenever an existing daily row is re-viewed in Daily Sales Admin / Xero Export so previously ingested days start showing the corrected numbers without a re-upload.
- One-off script isn't needed; normalization happens at render time.

## Deliverables

- `src/lib/coopFuelParser.ts` — new department mapping + amount-only aggregation, X-Read wiring for Vending / Nat Lottery / Scratchcards / Paypoint / Payzone / Drive Off / Lotto Prizes / Car+Jet Wash.
- `src/pages/dashboard/DailySalesUpload.tsx` — 3-file checklist UI, per-file upload buttons, weekly cash-rec status, uploads table with tick/cross columns.
- Small addition to `src/components/dashboard/EmployeeDashboard.tsx` (or Home tile) for the weekly cash-rec reminder.
- No DB migration; `source_format` values just get expanded.

## Validation

Before merging, upload both attached zips through the new flow and confirm the resulting per-day rows match the CASH SUM1 columns of the corresponding monthly XLS for **all 7 days** (Fuel, Shop, Vending, Payzone, Lotto, Lotto Prize columns) and the ' SALE ' tab totals for the week for each rate band.

## Open question

Culverstone's paperwork uses only these categories: TOBACCO, GROCERY STD, GROCERY ZERO, NEWS & MAGS, ALCOHOL, LOW RATE (5%). Southwater's may differ slightly. **Please confirm that the mapping table in section 1 above is the split you want us to use for every Co-op branch**, or list any department that should sit in a different bucket. Once you confirm, I'll implement.
