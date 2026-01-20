# Timesheet & Holiday Hours System Documentation

## Overview
Complete UK-compliant timesheet and holiday entitlement tracking system following pro-rata calculations.

---

## 1. TIMESHEET MODULE

### Weekly View (Staff Attendance Details)
- **Format**: Matches Excel "For the month of [Month] [Year]"
- **Columns**: NAME, Mon-Sun (Start/End times), HOURS, HOLIDAY, SICK, ADJ+/-, TOTAL
- **Grouping**: By branch/location with SUMIF subtotals
- **Features**:
  - Week navigation with week number display
  - Auto-calculate hours from start/end times (handles overnight shifts)
  - Branch subtotals and grand totals
  - Create timesheets for all employees in bulk
  - Edit dialog with time inputs for each day
  - Export to CSV, Print functionality

### Monthly Consolidation View
- **Format**: NAME, WEEK 1-6, TOTAL, (+/-) LAST MONTH, TOTAL HRS, HOLIDAY HRS, SICK
- **Features**:
  - Aggregates weekly data into monthly summary
  - Last month adjustment carry-forward
  - Branch subtotals and grand totals

---

## 2. HOLIDAY HOURS MODULE

### REF Summary View (Quick Reference)
| Column | Description |
|--------|-------------|
| REF | Global sequential number |
| Employee REF | Per-branch sequential number |
| EMPLOYEE NAME | Full name |
| SHOP NAME | Branch/Location |
| TOTAL HOURS | Actual worked hours |
| HOLIDAY HOURS | Holiday hours taken |
| ANNUM / PER HOUR | Annual salary reference |
| NOTES | Additional notes |

### Full Monthly View (Staff Holiday Working)
| Column Group | Columns |
|--------------|---------|
| Employee Info | No, Staff Name, Location, Contract Type |
| Summary | Total Worked Hours With Holiday Hours, No of Weeks, Holiday Entitlement |
| Actual Working Hours | Apr-Mar monthly breakdown + Total |
| Holiday Hours Taken | Apr-Mar monthly breakdown + Total |
| Balance | Holiday Hours Remaining |

---

## 3. FORMULAS & CALCULATIONS

### UK Pro-Rata Holiday Calculation
```
Hours Per Day = Weekly Contracted Hours / 5
Total Holiday Hours Per Year = Holiday Entitlement Days × Hours Per Day
Weeks Worked = (Total Worked + Holiday Taken) / Weekly Contracted Hours
Holiday Earned = (Total Holiday Hours Per Year / 52) × Weeks Worked
Holiday Remaining = Holiday Earned + Carry Forward - Holiday Taken
```

### Defaults (when no contract exists)
- Weekly Contracted Hours: 40
- Holiday Entitlement Days: 28
- Weeks Per Year: 52

### SUMIF Totals
- Branch subtotals for all numeric columns
- Grand totals at bottom of each view
- Monthly column aggregations

---

## 4. UK FISCAL YEAR
- **Start**: April 1st
- **End**: March 31st
- **Months Order**: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar

---

## 5. DATA SOURCES

### Tables Used
- `employees` - Staff records with branch assignments
- `timesheets` - Weekly timesheet headers
- `timesheet_entries` - Daily time entries
- `employee_contracts` - Contract details (hours, entitlement)
- `holiday_balances` - Carry forward hours

---

## 6. EXPORT OPTIONS
- **Weekly CSV**: Staff name, daily start/end times, totals
- **Monthly CSV**: Consolidated weekly hours with subtotals
- **Holiday REF CSV**: Simple reference format
- **Holiday Full CSV**: Complete monthly breakdown with SUMIF

---

## 7. PRINT SUPPORT
- Print-friendly styling with `print:hidden` for action buttons
- Optimized table layout for paper output
