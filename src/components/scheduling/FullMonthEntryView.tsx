import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Calendar, Edit3, Lock } from 'lucide-react';
import { eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { calculateEntryWorkedHours, calculatePayableWeekTotal } from '@/lib/timesheetCalculations';

const DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const getPayrollPeriod = (m: Date) => ({
  start: new Date(m.getFullYear(), m.getMonth(), 21),
  end: new Date(m.getFullYear(), m.getMonth() + 1, 20),
});

const getPayrollWeeks = (m: Date) => {
  const { start, end } = getPayrollPeriod(m);
  const firstMonday = startOfWeek(start, { weekStartsOn: 1 });
  const weeks: Date[] = [];
  let cursor = firstMonday;
  while (cursor <= end) {
    weeks.push(cursor);
    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }
  return weeks;
};

interface Props {
  currentMonth: Date;
  filterMode?: 'all' | 'organization' | 'branch';
  selectedOrg?: string;
  selectedBranch?: string;
  onJumpToWeek?: (weekIndex: number) => void;
}

interface EmpRow {
  employee_id: string;
  name: string;
  branch: string;
  branch_id: string;
  daily: number[]; // 7
  worked: number;
  holiday: number;
  sick: number;
  adj: number;
  timesheet_id?: string;
}

export function FullMonthEntryView({ currentMonth, filterMode, selectedOrg, selectedBranch, onJumpToWeek }: Props) {
  const weeks = useMemo(() => getPayrollWeeks(currentMonth), [currentMonth]);
  const { start: payStart, end: payEnd } = useMemo(() => getPayrollPeriod(currentMonth), [currentMonth]);
  const [loading, setLoading] = useState(true);
  const [byWeek, setByWeek] = useState<Record<string, EmpRow[]>>({});

  // Stable string keys for effect deps (Date objects + memo array reidentify each render).
  const monthKey = format(currentMonth, 'yyyy-MM');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rangeStart = format(weeks[0] || payStart, 'yyyy-MM-dd');
        const rangeEnd = format(
          weeks[weeks.length - 1] ? endOfWeek(weeks[weeks.length - 1], { weekStartsOn: 1 }) : payEnd,
          'yyyy-MM-dd'
        );

        // PostgREST caps responses at 1000 rows regardless of .limit(), so all
        // month-wide reads are paginated with .range().
        const PAGE = 1000;
        const fetchAllPages = async (build: (from: number, to: number) => any): Promise<any[]> => {
          const out: any[] = [];
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await build(from, from + PAGE - 1);
            if (error) throw error;
            const rows = data || [];
            out.push(...rows);
            if (rows.length < PAGE) break;
          }
          return out;
        };

        // Active employees (scoped)
        const emps = await fetchAllPages((from, to) => {
          let empQ = supabase
            .from('employees')
            .select('id, first_name, last_name, branch_id, organization_id, branch:branches(name)')
            .in('status', ['active', 'onboarding', 'on_leave']);
          if (filterMode === 'organization' && selectedOrg) empQ = empQ.eq('organization_id', selectedOrg);
          if (filterMode === 'branch' && selectedBranch) empQ = empQ.eq('branch_id', selectedBranch);
          return empQ.order('id').range(from, to);
        });
        if (cancelled) return;
        const empIds = (emps || []).map((e: any) => e.id);
        if (empIds.length === 0) {
          setByWeek(Object.fromEntries(weeks.map(w => [format(w, 'yyyy-MM-dd'), []])));
          return;
        }

        // Timesheets restricted to these employees + date range
        const tsList: any[] = [];
        const empChunk = 100;
        for (let i = 0; i < empIds.length; i += empChunk) {
          const ids = empIds.slice(i, i + empChunk);
          const part = await fetchAllPages((from, to) =>
            supabase
              .from('timesheets')
              .select('id, employee_id, week_start_date, total_adjustment_hours')
              .in('employee_id', ids)
              .gte('week_start_date', rangeStart)
              .lte('week_start_date', rangeEnd)
              .order('id')
              .range(from, to)
          );
          if (cancelled) return;
          tsList.push(...part);
        }

        const tsIds = tsList.map(t => t.id);

        // Index timesheet by employee+week, entries by timesheet id (O(1) lookups)
        const tsByEmpWeek = new Map<string, any[]>();
        tsList.forEach(t => {
          const key = `${t.employee_id}|${t.week_start_date}`;
          tsByEmpWeek.set(key, [...(tsByEmpWeek.get(key) || []), t]);
        });

        const entriesByTs = new Map<string, any[]>();
        if (tsIds.length) {
          const chunkSize = 100;
          for (let i = 0; i < tsIds.length; i += chunkSize) {
            const chunk = tsIds.slice(i, i + chunkSize);
            const ents = await fetchAllPages((from, to) =>
              supabase
                .from('timesheet_entries')
                .select('timesheet_id, entry_date, actual_hours, shift_start_time, shift_end_time, break_duration_minutes, holiday_hours, sick_hours, adjustment_hours')
                .in('timesheet_id', chunk)
                .order('id')
                .range(from, to)
            );
            if (cancelled) return;
            ents.forEach((e: any) => {
              const arr = entriesByTs.get(e.timesheet_id) || [];
              arr.push(e);
              entriesByTs.set(e.timesheet_id, arr);
            });
          }
        }


        const out: Record<string, EmpRow[]> = {};
        weeks.forEach(weekStart => {
          const wsStr = format(weekStart, 'yyyy-MM-dd');
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
          const dayIndex = new Map<string, number>();
          days.forEach((d, i) => dayIndex.set(format(d, 'yyyy-MM-dd'), i));
          const rows: EmpRow[] = [];

          (emps || []).forEach((emp: any) => {
            const employeeWeekSheets = tsByEmpWeek.get(`${emp.id}|${wsStr}`) || [];
            const daily = new Array(7).fill(0);
            let worked = 0, holiday = 0, sick = 0, adj = 0;
            const bestByDate = new Map<string, any>();
            employeeWeekSheets.forEach(t => {
              (entriesByTs.get(t.id) || []).forEach((entry: any) => {
                const existing = bestByDate.get(entry.entry_date);
                const score = calculateEntryWorkedHours(entry) + (Number(entry.holiday_hours) || 0) + (Number(entry.sick_hours) || 0) + (Number(entry.adjustment_hours) || 0);
                const existingScore = existing ? calculateEntryWorkedHours(existing) + (Number(existing.holiday_hours) || 0) + (Number(existing.sick_hours) || 0) + (Number(existing.adjustment_hours) || 0) : -Infinity;
                if (!existing || score > existingScore) bestByDate.set(entry.entry_date, entry);
              });
            });
            bestByDate.forEach((e: any) => {
                const idx = dayIndex.get(e.entry_date);
                if (idx === undefined) return;
                const inPayroll = days[idx] >= payStart && days[idx] <= payEnd;
                if (!inPayroll) return;
                const h = calculateEntryWorkedHours(e);
                daily[idx] = h;
                worked += h;
                holiday += Number(e.holiday_hours) || 0;
                sick += Number(e.sick_hours) || 0;
                adj += Number(e.adjustment_hours) || 0;
            });
            if (employeeWeekSheets.length || worked || holiday || sick || adj) {
              rows.push({
                employee_id: emp.id,
                name: `${emp.first_name} ${emp.last_name}`,
                branch: emp.branch?.name || '—',
                branch_id: emp.branch_id,
                daily,
                worked,
                holiday,
                sick,
                adj,
                timesheet_id: employeeWeekSheets[0]?.id,
              });
            }
          });
          out[wsStr] = rows.sort(
            (a, b) => a.branch.localeCompare(b.branch) || a.name.localeCompare(b.name)
          );
        });
        if (!cancelled) setByWeek(out);
      } catch (e) {
        console.error('FullMonthEntryView load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, filterMode, selectedOrg, selectedBranch]);


  if (loading) {
    return <div className="flex items-center justify-center h-40"><NizaLoaderInline /></div>;
  }

  return (
    <div className="space-y-6">
      {weeks.map((weekStart, wi) => {
        const wsStr = format(weekStart, 'yyyy-MM-dd');
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        const rows = byWeek[wsStr] || [];
        return (
          <Card key={wsStr} className="overflow-hidden shadow-sm">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/5 to-transparent border-b">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  WEEK {wi + 1} • {format(weekStart, 'dd MMM')} – {format(weekEnd, 'dd MMM yyyy')}
                </CardTitle>
                {onJumpToWeek && (
                  <Button size="sm" variant="outline" onClick={() => onJumpToWeek(wi)}>
                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit in Weekly View
                  </Button>
                )}
              </div>
            </CardHeader>
            <ScrollArea className="w-full">
              <div className="min-w-[1100px]">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-40 sticky left-0 bg-muted/30 z-10 font-bold">NAME</TableHead>
                      {days.map((d, i) => {
                        const inPayroll = d >= payStart && d <= payEnd;
                        return (
                          <TableHead key={i} className={`text-center min-w-[60px] ${inPayroll ? '' : 'bg-muted/50 opacity-50'}`}>
                            <div className="font-bold">{DAYS_SHORT[i]}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{format(d, 'dd/MM')}</div>
                          </TableHead>
                        );
                      })}
                      <TableHead className="text-center bg-blue-50 dark:bg-blue-950/50 font-bold">HOURS</TableHead>
                      <TableHead className="text-center bg-amber-50 dark:bg-amber-950/50 font-bold">HOLIDAY</TableHead>
                      <TableHead className="text-center bg-rose-50 dark:bg-rose-950/50 font-bold">SICK</TableHead>
                      <TableHead className="text-center bg-purple-50 dark:bg-purple-950/50 font-bold">ADJ+/-</TableHead>
                      <TableHead className="text-center bg-emerald-50 dark:bg-emerald-950/50 font-bold">TOTAL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-4">No entries</TableCell></TableRow>
                    ) : (
                      (() => {
                        const grouped: Record<string, EmpRow[]> = {};
                        rows.forEach(r => { (grouped[r.branch] ||= []).push(r); });
                        return Object.entries(grouped).map(([branch, list]) => (
                          <React.Fragment key={branch}>
                            <TableRow className="bg-primary/5 hover:bg-primary/10">
                              <TableCell colSpan={13} className="py-1.5 font-semibold text-primary text-xs">
                                📍 {branch} <Badge variant="secondary" className="ml-1 text-[10px]">{list.length} staff</Badge>
                              </TableCell>
                            </TableRow>
                            {list.map(r => {
                              const total = calculatePayableWeekTotal({ worked: r.worked, holiday: r.holiday, sick: r.sick, adjustment: r.adj });
                              return (
                                <TableRow key={r.employee_id} className="hover:bg-muted/40">
                                  <TableCell className="font-medium sticky left-0 bg-background z-10">{r.name}</TableCell>
                                  {r.daily.map((h, di) => {
                                    const inP = days[di] >= payStart && days[di] <= payEnd;
                                    return (
                                      <TableCell key={di} className={`text-center ${inP ? '' : 'bg-muted/50 opacity-50'}`}>
                                        {h ? h.toFixed(1) : <span className="text-muted-foreground">-</span>}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-center font-semibold">{r.worked.toFixed(1)}</TableCell>
                                  <TableCell className="text-center text-amber-700">{r.holiday.toFixed(1)}</TableCell>
                                  <TableCell className="text-center text-rose-700">{r.sick.toFixed(1)}</TableCell>
                                  <TableCell className="text-center text-purple-700">{r.adj.toFixed(1)}</TableCell>
                                  <TableCell className="text-center font-bold text-emerald-700">{total.toFixed(1)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        ));
                      })()
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>
        );
      })}
    </div>
  );
}
