# Timesheet Excel export and calculation alignment

## Outcome
Provide the branch-filtered timesheet export in a styled Excel workbook matching the October reference, with weekly daily-entry sections and a monthly six-week summary. Ensure totals derive from dated entries, shift durations use consistent break and overnight logic, and the monthly hours panel includes payroll-start and holiday-year boundary entries.

## Implementation
- Add a shared, testable timesheet calculation helper for shift durations and date-bounded entry totals.
- Replace the plain CSV export with one formatted XLSX workbook that follows the reference colours, paired daily times, weekly subtotals, and monthly consolidation; respect the selected branch.
- Correct the monthly hours panel to fetch from the Monday containing the payroll/holiday start, then aggregate actual entries by entry date.
- Add focused tests for shift duration and date-boundary totals; run them and check preview build diagnostics.

## Technical details
- Generate Excel client-side with xlsx-js-style, since CSV cannot preserve the requested fills, alignment, merges, or column sizing.
- Keep the established 21st–20th payroll cycle and calculate across real entry dates, not parent-week totals.
