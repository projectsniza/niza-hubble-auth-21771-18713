import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, CalendarDays, Search } from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

// Payroll month: 21st of month M → 20th of month M+1.
const getPayrollPeriod = (m: Date) => ({
  start: new Date(m.getFullYear(), m.getMonth(), 21),
  end: new Date(m.getFullYear(), m.getMonth() + 1, 20),
});

interface Row {
  employee_id: string;
  name: string;
  branch: string;
  worked: number;
  holiday: number;
  sick: number;
  earnedToDate: number;
  takenToDate: number;
  accumulated: number;
}

export function MonthlyHoursPanel() {
  const { user } = useAuth();
  const [month, setMonth] = useState<Date>(() => {
    const t = new Date();
    return t.getDate() < 21 ? subMonths(t, 1) : t;
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { start, end } = getPayrollPeriod(month);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');

        // Employees scoped by role
        let empQ = supabase
          .from('employees')
          .select('id, first_name, last_name, branch_id, branch:branches(name), user_id')
          .in('status', ['active', 'onboarding', 'on_leave']);
        if (user?.role === 'manager' && user?.branchId) {
          empQ = empQ.eq('branch_id', user.branchId);
        }
        if (user?.role === 'employee') {
          empQ = empQ.eq('user_id', user.id);
        }
        const { data: emps } = await empQ;
        const empList = emps || [];
        const ids = empList.map(e => e.id);
        if (!ids.length) { setRows([]); setLoading(false); return; }

        // Timesheets in month (by week_start_date overlap)
        const { data: ts } = await supabase
          .from('timesheets')
          .select('id, employee_id')
          .in('employee_id', ids)
          .gte('week_start_date', format(new Date(start.getFullYear(), start.getMonth(), 1), 'yyyy-MM-dd'))
          .lte('week_start_date', endStr);
        const tsIds = (ts || []).map(t => t.id);
        const tsByEmp: Record<string, string[]> = {};
        (ts || []).forEach(t => { (tsByEmp[t.employee_id] ||= []).push(t.id); });

        let entriesByEmp: Record<string, { w: number; h: number; s: number }> = {};
        if (tsIds.length) {
          const { data: ents } = await supabase
            .from('timesheet_entries')
            .select('timesheet_id, entry_date, actual_hours, holiday_hours, sick_hours')
            .in('timesheet_id', tsIds)
            .gte('entry_date', startStr)
            .lte('entry_date', endStr);
          const empByTs: Record<string, string> = {};
          (ts || []).forEach(t => { empByTs[t.id] = t.employee_id; });
          (ents || []).forEach((e: any) => {
            const eid = empByTs[e.timesheet_id];
            if (!eid) return;
            const a = (entriesByEmp[eid] ||= { w: 0, h: 0, s: 0 });
            a.w += Number(e.actual_hours) || 0;
            a.h += Number(e.holiday_hours) || 0;
            a.s += Number(e.sick_hours) || 0;
          });
        }

        // Accumulated holiday balance through end of this month
        // Sum approved entries from holiday year start (April 1) up to end-of-month.
        const yearStart = new Date(end.getFullYear(), 3, 1); // April 1 of same year as end
        const hyStart = end < yearStart ? new Date(end.getFullYear() - 1, 3, 1) : yearStart;
        const hyStartStr = format(hyStart, 'yyyy-MM-dd');

        const { data: allTs } = await supabase
          .from('timesheets')
          .select('id, employee_id, total_worked_hours, total_holiday_hours, week_start_date')
          .in('employee_id', ids)
          .gte('week_start_date', hyStartStr)
          .lte('week_start_date', endStr);

        // We need contract data for earned-to-date pro-rata.
        const { data: contracts } = await supabase
          .from('employee_contracts')
          .select('employee_id, weekly_contracted_hours, holiday_entitlement_days, effective_from, effective_to')
          .in('employee_id', ids);
        const contractByEmp: Record<string, any> = {};
        (contracts || []).forEach((c: any) => {
          const prior = contractByEmp[c.employee_id];
          if (!prior || new Date(c.effective_from) > new Date(prior.effective_from)) {
            contractByEmp[c.employee_id] = c;
          }
        });

        const workedToDate: Record<string, number> = {};
        const takenToDate: Record<string, number> = {};
        (allTs || []).forEach((t: any) => {
          workedToDate[t.employee_id] = (workedToDate[t.employee_id] || 0) + (Number(t.total_worked_hours) || 0);
          takenToDate[t.employee_id] = (takenToDate[t.employee_id] || 0) + (Number(t.total_holiday_hours) || 0);
        });

        const built: Row[] = empList.map((e: any) => {
          const m = entriesByEmp[e.id] || { w: 0, h: 0, s: 0 };
          const c = contractByEmp[e.id];
          const weekly = Number(c?.weekly_contracted_hours) || 40;
          const days = Number(c?.holiday_entitlement_days) || 28;
          const hoursPerDay = weekly / 5;
          const annual = hoursPerDay * days;
          const worked = workedToDate[e.id] || 0;
          const weeksWorked = weekly ? worked / weekly : 0;
          const earned = (annual / 52) * weeksWorked;
          const taken = takenToDate[e.id] || 0;
          return {
            employee_id: e.id,
            name: `${e.first_name} ${e.last_name}`,
            branch: e.branch?.name || '—',
            worked: m.w,
            holiday: m.h,
            sick: m.s,
            earnedToDate: earned,
            takenToDate: taken,
            accumulated: earned - taken,
          };
        });

        setRows(built);
      } finally {
        setLoading(false);
      }
    })();
  }, [month, user?.id, user?.role, user?.branchId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.branch.toLowerCase().includes(q));
  }, [rows, search]);

  const { start, end } = getPayrollPeriod(month);

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Monthly Working Hours & Accumulated Holiday
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee…"
                className="h-8 pl-7 w-48 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border bg-background">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonth(subMonths(month, 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 text-xs font-medium min-w-[140px] text-center">
                {format(start, 'dd MMM')} – {format(end, 'dd MMM yyyy')}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center h-32"><NizaLoaderInline /></div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Worked (mo)</TableHead>
                <TableHead className="text-right">Holiday Taken (mo)</TableHead>
                <TableHead className="text-right">Sick (mo)</TableHead>
                <TableHead className="text-right">Earned YTD</TableHead>
                <TableHead className="text-right">Taken YTD</TableHead>
                <TableHead className="text-right font-semibold">Accumulated Holiday</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No data</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell className="text-right">{r.worked.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-amber-700">{r.holiday.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-rose-700">{r.sick.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{r.earnedToDate.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{r.takenToDate.toFixed(1)}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.accumulated < 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                    {r.accumulated.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
