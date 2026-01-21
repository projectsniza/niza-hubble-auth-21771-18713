# Timesheet & Holiday Hours System Documentation

## Overview
UK-compliant timesheet and holiday entitlement tracking system matching Excel formats with premium UI.

---

## 1. TIMESHEET MODULE

### Weekly Entry View
- **Columns**: NAME | MON-SUN (Start/End times) | HOURS | HOLIDAY | SICK | ADJ+/- | TOTAL
- **Features**: 
  - Inline time editing (click to edit start/end times)
  - Side panel for notes/adjustments (hybrid editing)
  - Auto-calculate hours with overnight shift support
  - Branch grouping with SUMIF subtotals
  - Week 1-6 selector within month

### Monthly Consolidation View
- **Columns**: NAME | WEEK 1-6 | TOTAL | (+/-) LAST MONTH | TOTAL HRS | HOLIDAY HRS | SICK
- Branch subtotals and grand totals

---

## 2. HOLIDAY HOURS MODULE

### REF Summary View (Matches Excel Page 2)
- **Columns**: REF | Employee REF | EMPLOYEE NAME | SHOP NAME | TOTAL HOURS | HOLIDAY HOURS | ANNUM / PER HOUR | NOTES
- Month selector for monthly snapshots
- Notes/Annum stored in `employee_payroll_notes` table

### Full Monthly View (Matches Excel Page 1)
- **Columns**: No | Staff Name | Location | Contract Type | Total Worked + Holiday | Weeks | Entitlement | Apr-Mar Actual | Total | Apr-Mar Holiday | Total | Remaining
- UK Fiscal Year (April - March)
- Branch grouping with subtotals

---

## 3. FORMULAS

```
Hours Per Day = Weekly Contracted Hours / 5
Total Holiday Hours Per Year = Holiday Days × Hours Per Day
Weeks Worked = (Total Worked + Holiday Taken) / Weekly Contracted Hours
Holiday Entitlement = (Total Holiday Hours Per Year / 52) × Weeks Worked
Holiday Remaining = Entitlement + Carry Forward - Taken
```

### Overnight Shift Calculation
```javascript
if (totalMins < 0) totalMins += 24 * 60; // Add 24 hours
```

---

## 4. DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `timesheets` | Weekly timesheet headers |
| `timesheet_entries` | Daily time entries (7 per week) |
| `employee_contracts` | Contract details (hours, holiday days) |
| `holiday_balances` | Carry forward hours |
| `employee_payroll_notes` | REF view notes/annum per month |

---

## 5. UI FEATURES

- Premium gradient headers and summary cards
- Hybrid editing: inline times + side panel for notes/adjustments
- Branch grouping with employee REF numbering
- Month/Week navigation
- Export to CSV matching Excel format
- Responsive scrollable tables
