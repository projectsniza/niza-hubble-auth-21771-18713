import { Fragment } from 'react';
import { Card } from '@/components/ui/card';
import type { EmployeeBalance } from '../HolidayBalance';
import { MONTH_SHORT, hrs } from './holidayData';

interface Props {
  groupedByBranch: Record<string, EmployeeBalance[]>;
}

const cell = 'border border-border px-2 py-1 text-right tabular-nums';
const head = 'border border-border bg-muted/60 px-2 py-1.5 text-center text-[11px] font-bold uppercase';

/**
 * The same layout as the HDAY_TRACKER sheet of the Time Sheet workbook:
 * two rows per person (TOTAL HOURS and HDAY TAKEN) from April to March, then totals and what is left.
 */
export default function TrackerView({ groupedByBranch }: Props) {
  const entries = Object.entries(groupedByBranch);
  if (entries.length === 0) {
    return <Card className="p-10 text-center text-muted-foreground">No staff match these filters.</Card>;
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${head} sticky left-0 z-10 min-w-[190px] text-left`}>Name</th>
              <th className={head}>C/Hours</th>
              <th className={head}>Hday entitle<div className="font-normal normal-case">full year</div></th>
              <th className={head} />
              {MONTH_SHORT.map((m) => <th key={m} className={`${head} w-[58px]`}>{m}</th>)}
              <th className={head}>Total hours</th>
              <th className={head}>Hday taken</th>
              <th className={head}>O/S (full year)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([branch, people]) => (
              <Fragment key={branch}>
                <tr>
                  <td colSpan={20} className="border border-border bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold">{branch}</td>
                </tr>
                {people.map((b) => {
                  const remaining = b.holiday_hours_remaining;
                  return (
                    <Fragment key={b.employee.id}>
                      <tr>
                        <td rowSpan={2} className="sticky left-0 z-10 border border-border bg-background px-2 py-1 font-medium">
                          {b.employee.first_name} {b.employee.last_name}
                        </td>
                        <td rowSpan={2} className={`${cell} text-center text-base font-bold`}>{hrs(b.total_worked_with_holiday / b.weeks_worked)}</td>
                        <td rowSpan={2} className={`${cell} text-center text-base font-bold text-emerald-700`}>{hrs(b.holiday_entitlement)}</td>
                        <td className="whitespace-nowrap border border-border bg-muted/30 px-2 text-center text-[9px]">TOTAL HOURS</td>
                        {b.monthly_actual.map((v, i) => (
                          <td key={i} className={`${cell} ${v > 0 ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'text-muted-foreground'}`}>{v > 0 ? hrs(v) : '-'}</td>
                        ))}
                        <td rowSpan={2} className={`${cell} text-center text-base font-bold`}>{hrs(b.total_worked_with_holiday)}</td>
                        <td rowSpan={2} className={`${cell} text-center text-base font-bold text-amber-700`}>{hrs(b.holiday_hours_taken)}</td>
                        <td rowSpan={2} className={`${cell} text-center text-base font-bold ${remaining < 0 ? 'text-rose-600' : 'text-cyan-700'}`}>{hrs(remaining)}</td>
                      </tr>
                      <tr>
                        <td className="whitespace-nowrap border border-border bg-muted/30 px-2 text-center text-[9px]">HDAY TAKEN</td>
                        {b.monthly_holiday.map((v, i) => (
                          <td key={i} className={`${cell} ${v > 0 ? 'bg-amber-100/70 font-semibold dark:bg-amber-950/30' : 'text-muted-foreground'}`}>{v > 0 ? hrs(v) : '-'}</td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        C/Hours = total hours ÷ 52 · Entitlement = C/Hours × 5.6 · O/S = entitlement − holiday taken (plus any hours carried forward).
        Months are payroll months (21st to 20th).
      </p>
    </Card>
  );
}
