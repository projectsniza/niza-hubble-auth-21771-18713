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
  const { start: payStart, end: payEnd } = getPayrollPeriod(currentMonth);
  const [loading, setLoading] = useState(true);
  const [byWeek, setByWeek] = useState<Record<string, EmpRow[]>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const startStr = format(payStart, 'yyyy-MM-dd');
        const endStr = format(payEnd, 'yyyy-MM-dd');
        const rangeStart = format(weeks[0] || payStart, 'yyyy-MM-dd');
        const rangeEnd = format(weeks[weeks.length - 1] ? endOfWeek(weeks[weeks.length - 1], { weekStartsOn: 1 }) : payEnd, 'yyyy-MM-dd');

        // Active employees
        let empQ = supabase
          .from('employees')
          .select('id, first_name, last_name, branch_id, organization_id, branch:branches(name)')
          .in('status', ['active', 'onboarding', 'on_leave']);
        if (filterMode === 'organization' && selectedOrg) empQ = empQ.eq('organization_id', selectedOrg);
        if (filterMode === 'branch' && selectedBranch) empQ = empQ.eq('branch_id', selectedBranch);
        const { data: emps } = await empQ;
        const empMap: Record<string, any> = {};
        (emps || []).forEach((e: any) => { empMap[e.id] = e; });

        const { data: ts } = await supabase
          .from('timesheets')
          .select('id, employee_id, week_start_date, total_adjustment_hours')
          .gte('week_start_date', rangeStart)
          .lte('week_start_date', rangeEnd);

        const tsIds = (ts || []).map(t => t.id);
        const tsMap: Record<string, any> = {};
        (ts || []).forEach(t => { tsMap[t.id] = t; });

        let entries: any[] = [];
        if (tsIds.length) {
          const { data: ents } = await supabase
            .from('timesheet_entries')
            .select('timesheet_id, entry_date, actual_hours, holiday_hours, sick_hours')
            .in('timesheet_id', tsIds);
          entries = ents || [];
        }

        // Group by week_start
        const out: Record<string, EmpRow[]> = {};
        weeks.forEach(weekStart => {
          const wsStr = format(weekStart, 'yyyy-MM-dd');
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
          const rows: EmpRow[] = [];

          // Per employee, find timesheet
          (emps || []).forEach((emp: any) => {
            const ts = (Object.values(tsMap) as any[]).find(t => t.employee_id === emp.id && t.week_start_date === wsStr);
            const daily = new Array(7).fill(0);
            let worked = 0, holiday = 0, sick = 0;
            if (ts) {
              entries.filter((e: any) => e.timesheet_id === ts.id).forEach((e: any) => {
                const idx = days.findIndex(d => format(d, 'yyyy-MM-dd') === e.entry_date);
                if (idx < 0) return;
                const inPayroll = days[idx] >= payStart && days[idx] <= payEnd;
                const h = Number(e.actual_hours) || 0;
                const hh = Number(e.holiday_hours) || 0;
                const sh = Number(e.sick_hours) || 0;
                if (inPayroll) {
                  daily[idx] = h;
                  worked += h; holiday += hh; sick += sh;
                }
              });
            }
            if (ts || worked || holiday || sick) {
              rows.push({
                employee_id: emp.id,
                name: `${emp.first_name} ${emp.last_name}`,
                branch: emp.branch?.name || '—',
                branch_id: emp.branch_id,
                daily,
                worked,
                holiday,
                sick,
                adj: Number(ts?.total_adjustment_hours) || 0,
                timesheet_id: ts?.id,
              });
            }
          });
          out[wsStr] = rows.sort((a, b) => a.branch.localeCompare(b.branch) || a.name.localeCompare(b.name));
        });
        setByWeek(out);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentMonth, filterMode, selectedOrg, selectedBranch, weeks, payStart, payEnd]);

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
                              const total = r.worked + r.holiday + r.sick + r.adj;
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
