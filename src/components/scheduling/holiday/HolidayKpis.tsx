import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CalendarCheck, CalendarClock, Clock, Users, Wallet } from 'lucide-react';
import type { EmployeeBalance } from '../HolidayBalance';
import { hrs, statusOf } from './holidayData';

interface Props {
  balances: EmployeeBalance[];
}

/** The headline numbers for whatever is currently listed (the filters apply). */
export default function HolidayKpis({ balances }: Props) {
  const sum = (pick: (b: EmployeeBalance) => number) => balances.reduce((a, b) => a + pick(b), 0);
  const worked = sum((b) => b.total_worked_hours);
  const taken = sum((b) => b.holiday_hours_taken);
  const entitlement = sum((b) => b.holiday_entitlement);
  const remaining = sum((b) => b.holiday_hours_remaining);
  const statuses = balances.map(statusOf);
  const overdrawn = statuses.filter((s) => s === 'Overdrawn').length;
  const low = statuses.filter((s) => s === 'Low').length;

  const tiles = [
    { label: 'Staff', value: String(balances.length), icon: Users, tone: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
    { label: 'Hours worked', value: hrs(worked, 1), icon: Clock, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
    { label: 'Holiday entitlement', value: hrs(entitlement, 1), icon: Wallet, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'Holiday taken', value: hrs(taken, 1), icon: CalendarCheck, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
    { label: 'Holiday remaining', value: hrs(remaining, 1), icon: CalendarClock, tone: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.label} className="border shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.tone}`}>
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{t.label}</p>
              <p className="text-xl font-semibold leading-tight">{t.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className={`border shadow-sm ${overdrawn > 0 ? 'border-rose-300 bg-rose-50/60 dark:bg-rose-950/20' : ''}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdrawn > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">Need attention</p>
            <p className="text-xl font-semibold leading-tight">
              {overdrawn + low}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {overdrawn} overdrawn · {low} low
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
