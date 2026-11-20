import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import type { EmployeeBalance } from '../HolidayBalance';
import { MONTH_NAMES, hrs, payrollPeriodLabel, statusOf, usedShare } from './holidayData';

const STATUS_STYLE: Record<string, { badge: string; bar: string }> = {
  OK: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300', bar: 'bg-emerald-500' },
  Low: { badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300', bar: 'bg-amber-500' },
  Overdrawn: { badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300', bar: 'bg-rose-500' },
  'No entitlement yet': { badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300', bar: 'bg-slate-400' },
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={`whitespace-nowrap font-medium ${STATUS_STYLE[status]?.badge || ''}`}>{status}</Badge>;
}

function UsageBar({ share, status }: { share: number; status: string }) {
  const pct = Math.round(share * 100);
  return (
    <div className="flex min-w-[120px] items-center gap-2" title={`${pct}% of the available holiday used`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${STATUS_STYLE[status]?.bar || 'bg-slate-400'}`} style={{ width: `${Math.min(share, 1) * 100}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

interface Props {
  groupedByBranch: Record<string, EmployeeBalance[]>;
  yearStart: string;
}

/** Holiday balances grouped by branch. Click a person to see their month-by-month breakdown. */
export default function BalancesView({ groupedByBranch, yearStart }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<EmployeeBalance | null>(null);
  const startYear = parseInt(yearStart.slice(0, 4), 10);

  const toggle = (branch: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(branch)) next.delete(branch);
      else next.add(branch);
      return next;
    });

  const entries = Object.entries(groupedByBranch);
  if (entries.length === 0) {
    return <Card className="p-10 text-center text-muted-foreground">No staff match these filters.</Card>;
  }

  return (
    <div className="space-y-4">
      {entries.map(([branch, people]) => {
        const isClosed = collapsed.has(branch);
        const taken = people.reduce((a, b) => a + b.holiday_hours_taken, 0);
        const ent = people.reduce((a, b) => a + b.holiday_entitlement, 0);
        const rem = people.reduce((a, b) => a + b.holiday_hours_remaining, 0);
        return (
          <Card key={branch} className="overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggle(branch)}
              className="flex w-full flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-emerald-500/5 to-transparent px-4 py-3 text-left hover:bg-muted/30"
              aria-expanded={!isClosed}
            >
              <span className="flex items-center gap-2 font-semibold">
                {isClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <MapPin className="h-4 w-4 text-emerald-600" />
                {branch}
                <Badge variant="secondary">{people.length}</Badge>
              </span>
              <span className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>Entitlement <b className="text-foreground">{hrs(ent, 1)} h</b></span>
                <span>Taken <b className="text-foreground">{hrs(taken, 1)} h</b></span>
                <span>Remaining <b className={rem < 0 ? 'text-rose-600' : 'text-foreground'}>{hrs(rem, 1)} h</b></span>
              </span>
            </button>

            {!isClosed && (
              <div className="overflow-x-auto">
                <Table className="min-w-[900px] table-fixed text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[230px]">Employee</TableHead>
                      <TableHead className="w-[105px] text-right">Hours worked</TableHead>
                      <TableHead className="w-[105px] text-right">Holiday taken</TableHead>
                      <TableHead className="w-[105px] text-right">Entitlement</TableHead>
                      <TableHead className="w-[105px] text-right">Remaining</TableHead>
                      <TableHead className="w-[170px]">Used</TableHead>
                      <TableHead className="w-[150px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people.map((b) => {
                      const status = statusOf(b);
                      return (
                        <TableRow key={b.employee.id} className="cursor-pointer" onClick={() => setOpen(b)}>
                          <TableCell>
                            <div className="font-medium">{b.employee.first_name} {b.employee.last_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {b.contract_type === 'Full-Time' ? 'Full-time' : 'Part-time'} · avg {hrs(b.total_worked_with_holiday / b.weeks_worked, 1)} h a week
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{hrs(b.total_worked_hours, 1)}</TableCell>
                          <TableCell className="text-right tabular-nums">{hrs(b.holiday_hours_taken, 1)}</TableCell>
                          <TableCell className="text-right tabular-nums">{hrs(b.holiday_entitlement, 1)}</TableCell>
                          <TableCell className={`text-right font-semibold tabular-nums ${b.holiday_hours_remaining < 0 ? 'text-rose-600' : ''}`}>
                            {hrs(b.holiday_hours_remaining, 1)}
                          </TableCell>
                          <TableCell><UsageBar share={usedShare(b)} status={status} /></TableCell>
                          <TableCell><StatusBadge status={status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        );
      })}
      <p className="px-1 text-xs text-muted-foreground">Click a person to see their month-by-month hours.</p>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {open.employee.first_name} {open.employee.last_name}
                  <StatusBadge status={statusOf(open)} />
                </SheetTitle>
                <SheetDescription>
                  {open.employee.branch?.name || 'Unassigned'} · {open.contract_type === 'Full-Time' ? 'Full-time' : 'Part-time'} · holiday year {startYear}-{startYear + 1}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[
                  { l: 'Entitlement', v: open.holiday_entitlement, c: 'text-emerald-700' },
                  { l: 'Taken', v: open.holiday_hours_taken, c: 'text-amber-700' },
                  { l: 'Remaining', v: open.holiday_hours_remaining, c: open.holiday_hours_remaining < 0 ? 'text-rose-600' : 'text-cyan-700' },
                ].map((t) => (
                  <div key={t.l} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{t.l}</p>
                    <p className={`text-xl font-bold ${t.c}`}>{hrs(t.v, 1)}</p>
                    <p className="text-[10px] text-muted-foreground">hours</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                <b className="text-foreground">How it is worked out:</b> {hrs(open.total_worked_hours, 1)} h worked + {hrs(open.holiday_hours_taken, 1)} h holiday
                = {hrs(open.total_worked_with_holiday, 1)} h, divided by 52 and multiplied by 5.6 = <b className="text-foreground">{hrs(open.holiday_entitlement, 2)} h</b> entitlement.
                {Math.abs(open.holiday_hours_remaining - open.holiday_entitlement + open.holiday_hours_taken) >= 0.005 && (
                  <> Includes {hrs(open.holiday_hours_remaining - open.holiday_entitlement + open.holiday_hours_taken, 2)} h carried forward.</>
                )}
              </div>

              <Table className="mt-4 text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Payroll month</TableHead>
                    <TableHead className="text-right">Worked</TableHead>
                    <TableHead className="text-right">Holiday</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MONTH_NAMES.map((m, i) => (
                    <TableRow key={m}>
                      <TableCell>
                        <div className="font-medium">{m}</div>
                        <div className="text-[11px] text-muted-foreground">{payrollPeriodLabel(i, startYear)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{open.monthly_actual[i] > 0 ? hrs(open.monthly_actual[i], 1) : '–'}</TableCell>
                      <TableCell className={`text-right tabular-nums ${open.monthly_holiday[i] > 0 ? 'font-semibold text-amber-700' : ''}`}>
                        {open.monthly_holiday[i] > 0 ? hrs(open.monthly_holiday[i], 1) : '–'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{hrs(open.actualTotal, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{hrs(open.holidayTotal, 1)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
