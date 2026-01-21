# Timesheet & Holiday Hours System Documentation

## Overview
Complete UK-compliant timesheet and holiday entitlement tracking system following pro-rata calculations, matching Excel formats exactly.

---

## 1. TIMESHEET MODULE (Staff Attendance Details)

### Weekly View
**Format**: Matches Excel "Staff Attendance Details - For the month of [Month] [Year]"

#### Header Structure
```
|     | WEEK # | MONDAY        | TUESDAY       | ... | SUNDAY        | HOURS | HOLIDAY | SICK | ADJ+/- | TOTAL |
|     |        | [date]        | [date]        | ... | [date]        |       |         |      |        |       |
```

#### Columns
| Column | Description |
|--------|-------------|
| WEEK # | Week number (1-6) within month |
| Mon-Sun | Start time / End time for each day (AM/PM format like Excel) |
| HOURS | Total worked hours (auto-calculated from start/end, handles overnight shifts) |
| HOLIDAY | Holiday hours taken during the week |
| SICK | Sick hours recorded |
| ADJ+/- | Adjustment hours (positive/negative) |
| TOTAL | Sum of HOURS + HOLIDAY + SICK + ADJ+/- |

#### Features
- Week selector (WEEK 1-6) within selected month
- Month navigation with quick access
- Auto-calculate hours from start/end times (handles overnight shifts like 10:00 PM - 7:00 AM)
- Branch/Location grouping with SUMIF subtotals
- Create timesheets for all employees in bulk
- Edit dialog with time inputs for each day
- Export to CSV, Print functionality
- Approval workflow (Draft → Submitted → Approved)

#### SUMIF Subtotals
Each branch section includes a subtotal row with:
- Total HOURS for branch
- Total HOLIDAY for branch
- Total SICK for branch
- Total ADJ+/- for branch
- Grand TOTAL for branch

---

### Monthly Consolidation View
**Format**: Matches Excel monthly summary table

#### Header Structure
```
| NAME | WEEK 1 | WEEK 2 | WEEK 3 | WEEK 4 | WEEK 5 | WEEK 6 | TOTAL | (+/-) LAST MONTH | TOTAL HRS | HOLIDAY HRS | SICK |
```

#### Columns
| Column | Description |
|--------|-------------|
| NAME | Employee name (uppercase like Excel) |
| WEEK 1-6 | Hours worked in each week |
| TOTAL | Sum of all weekly hours |
| (+/-) LAST MONTH | Carry-forward adjustment from previous month |
| TOTAL HRS | TOTAL + (+/-) LAST MONTH |
| HOLIDAY HRS | Total holiday hours for the month |
| SICK | Total sick hours for the month |

#### Features
- Aggregates weekly data into monthly summary
- Last month adjustment carry-forward from previous month's ADJ+/- totals
- Branch grouping with SUMIF subtotals
- Grand totals row at bottom
- Export to CSV matching Excel format

---

## 2. HOLIDAY HOURS MODULE (Staff Holiday Working)

### REF Summary View
**Format**: Matches Excel Page 2 "Holiday Hours Reference" table

#### Header Structure
```
| REF | Employee REF | EMPLOYEE NAME | SHOP NAME | TOTAL HOURS | HOLIDAY HOURS | ANNUM / PER HOUR | NOTES |
```

#### Columns
| Column | Description |
|--------|-------------|
| REF | Global sequential reference number (1, 2, 3...) |
| Employee REF | Per-branch sequential number (resets for each branch) |
| EMPLOYEE NAME | Full name of employee |
| SHOP NAME | Branch/Location name |
| TOTAL HOURS | Actual hours worked (from timesheets) |
| HOLIDAY HOURS | Holiday hours taken |
| ANNUM / PER HOUR | Annual salary reference (e.g., £27,500.00) |
| NOTES | Additional notes (e.g., "Please add Management Allowance of £197.40") |

---

### Full Monthly View
**Format**: Matches Excel Page 1 "Staff Holiday Working" complete breakdown

#### Header Structure (Row 1 - Categories)
```
| No | Staff Name | Location | Contract Type | Total Worked Hours With Holiday Hours | No of Weeks | Holiday Entitlement | Actual Working Hours [12 months] | Total | Holiday Hours Taken [12 months] | Total | Holiday Hours Remaining | SUMIF columns |
```

#### Header Structure (Row 2 - Months)
```
| ... | ... | ... | ... | ... | ... | ... | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Jan | Feb | Mar | Total | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Jan | Feb | Mar | Total | ... | Actual Hours | Differences | Holiday Hours | Differences |
```

#### Column Details

**Employee Info Section**
| Column | Description |
|--------|-------------|
| No | Row number within branch |
| Staff Name | Employee full name |
| Location | Branch/Shop name |
| Contract Type | FT (Full-Time) or PT (Part-Time) badge |

**Summary Section**
| Column | Description |
|--------|-------------|
| Total Worked Hours With Holiday Hours | Actual + Holiday combined |
| No of Weeks | (Total Worked With Holiday) / Weekly Contracted Hours |
| Holiday Entitlement | Pro-rata holiday earned based on weeks worked |

**Actual Working Hours Section**
- 12 monthly columns (Apr-Mar following UK fiscal year)
- Total column summing all months
- Values from timesheet `total_worked_hours`

**Holiday Hours Taken Section**
- 12 monthly columns (Apr-Mar following UK fiscal year)
- Total column summing all months
- Values from timesheet `total_holiday_hours`

**Balance Section**
| Column | Description |
|--------|-------------|
| Holiday Hours Remaining | Entitlement + Carry Forward - Taken |

**SUMIF Section** (matching Excel formula columns)
| Column | Description |
|--------|-------------|
| Actual Hours | SUMIF of actual hours |
| Differences | Variance tracking |
| Holiday Hours | SUMIF of holiday hours |
| Differences | Variance tracking |

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

### Overnight Shift Calculation
```javascript
// If end time is before start time, add 24 hours
let totalMins = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
if (totalMins < 0) totalMins += 24 * 60; // Overnight shift
hours = totalMins / 60;
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
- **Fiscal Year Selection**: Apr 2024-Mar 2025, Apr 2025-Mar 2026, Apr 2026-Mar 2027

---

## 5. DATA SOURCES

### Tables Used
| Table | Purpose |
|-------|---------|
| `employees` | Staff records with branch assignments |
| `branches` | Location/shop information |
| `timesheets` | Weekly timesheet headers (totals per week) |
| `timesheet_entries` | Daily time entries (start/end times per day) |
| `employee_contracts` | Contract details (weekly hours, holiday entitlement) |
| `holiday_balances` | Carry forward hours from previous year |

### Key Relationships
- Timesheet → Employee → Branch
- Timesheet → Timesheet Entries (7 per week)
- Employee → Contract (current active)
- Employee → Holiday Balance

---

## 6. EXPORT OPTIONS

### Weekly CSV
- Staff name, daily start/end times for each day
- HOURS, HOLIDAY, SICK, ADJ+/-, TOTAL columns
- Branch subtotals included

### Monthly Consolidation CSV
- NAME, WEEK 1-6 columns
- TOTAL, (+/-) LAST MONTH, TOTAL HRS
- HOLIDAY HRS, SICK columns
- Branch subtotals and grand totals

### Holiday REF CSV
- REF, Employee REF, EMPLOYEE NAME, SHOP NAME
- TOTAL HOURS, HOLIDAY HOURS, ANNUM / PER HOUR, NOTES

### Holiday Full Monthly CSV
- Complete monthly breakdown with all columns
- SUMIF columns included
- Branch groupings with totals

---

## 7. PRINT SUPPORT

- Print-friendly styling with `print:hidden` for action buttons
- Optimized table layout for paper output
- Maintains color coding in print view

---

## 8. USER INTERFACE FEATURES

### Navigation
- Month selector with prev/next buttons
- Week selector dropdown (WEEK 1-6) for weekly view
- Fiscal year selector for holiday view
- Quick "Today" button

### Filtering
- Organization filter (super_admin/HR full access only)
- Branch filter
- Employee search by name

### Summary Cards
- Staff count
- Total HOURS
- Total HOLIDAY
- Total SICK
- Grand TOTAL

### Actions
- Create timesheets for all employees (bulk)
- Edit individual timesheet entries
- Approve timesheets
- Export to CSV
- Print view
- Recalculate balances

---

## 9. TIME FORMAT

### Display Format (matching Excel)
- 12-hour format with AM/PM (e.g., "10:00 PM", "7:00 AM")
- Stored as 24-hour format in database

### Input Format
- HTML time input (24-hour)
- Auto-converted for display

---

## 10. BRANCH GROUPING

Both modules group employees by branch/location:
- Branch header row showing branch name and staff count
- Employee rows within each branch
- SUMIF subtotal row after each branch
- Grand total row at bottom of table

This matches the Excel format where employees are grouped by shop (ADDLESTONE, BUCKSKIN, CARSHALTON, etc.) with subtotals per shop.
