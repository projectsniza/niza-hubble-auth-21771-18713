import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { chunkValues, fetchAllPages } from '@/lib/supabasePagination';

const ABNORMAL_HOUR_THRESHOLD = 16;

const getPayrollPeriod = (m: Date) => ({
  start: new Date(m.getFullYear(), m.getMonth(), 21),
  end: new Date(m.getFullYear(), m.getMonth() + 1, 20),
});

interface FlagRow {
  employee: string;
  branch: string;
  date: string;
  hours: number;
  rule: string;
}

export function AbnormalBehaviourReport() {
  const { user } = useAuth();
  const [month, setMonth] = useState<Date>(() => {
    const t = new Date();
    return t.getDate() < 21 ? subMonths(t, 1) : t;
  });
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { start, end } = getPayrollPeriod(month);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');

        let empQ = supabase
          .from('employees')
          .select('id, first_name, last_name, branch:branches(name), branch_id')
          .in('status', ['active', 'onboarding', 'on_leave']);
        if (user?.role === 'manager' && user?.branchId) {
          empQ = empQ.eq('branch_id', user.branchId);
        }
        if (user?.branchIds?.length) empQ = empQ.in('branch_id', user.branchIds);
        const emps = await fetchAllPages<any>((from, to) => empQ.order('id').range(from, to));
        const empMap: Record<string, { name: string; branch: string }> = {};
        (emps || []).forEach((e: any) => {
          empMap[e.id] = { name: `${e.first_name} ${e.last_name}`, branch: e.branch?.name || '—' };
        });
        const ids = (emps || []).map((e: any) => e.id);
        if (!ids.length) { setRows([]); setLoading(false); return; }

        const ts: any[] = [];
        for (const idChunk of chunkValues(ids)) ts.push(...await fetchAllPages((from, to) => supabase
          .from('timesheets').select('id, employee_id').in('employee_id', idChunk)
          .gte('week_start_date', format(new Date(start.getFullYear(), start.getMonth(), 1), 'yyyy-MM-dd'))
          .lte('week_start_date', endStr).order('id').range(from, to)));
        const tsIds = (ts || []).map(t => t.id);
        const empByTs: Record<string, string> = {};
        (ts || []).forEach(t => { empByTs[t.id] = t.employee_id; });
        if (!tsIds.length) { setRows([]); setLoading(false); return; }

        const ents: any[] = [];
        for (const tsChunk of chunkValues(tsIds)) ents.push(...await fetchAllPages((from, to) => supabase
          .from('timesheet_entries').select('timesheet_id, entry_date, actual_hours')
          .in('timesheet_id', tsChunk).gte('entry_date', startStr).lte('entry_date', endStr)
          .gt('actual_hours', ABNORMAL_HOUR_THRESHOLD).order('id').range(from, to)));

        const built: FlagRow[] = (ents || []).map((e: any) => {
          const eid = empByTs[e.timesheet_id];
          const info = empMap[eid] || { name: '—', branch: '—' };
          return {
            employee: info.name,
            branch: info.branch,
            date: e.entry_date,
            hours: Number(e.actual_hours) || 0,
            rule: `> ${ABNORMAL_HOUR_THRESHOLD}h in a single day`,
          };
        }).sort((a, b) => b.hours - a.hours);

        setRows(built);
      } finally {
        setLoading(false);
      }
    })();
  }, [month, user?.role, user?.branchId, user?.branchIds]);

  const { start, end } = getPayrollPeriod(month);

  const exportCsv = () => {
    const lines = [
      ['Employee', 'Branch', 'Date', 'Hours', 'Rule'].join(','),
      ...rows.map(r => [r.employee, r.branch, r.date, r.hours.toFixed(2), r.rule].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `abnormal_behaviour_${format(start, 'yyyy-MM')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-amber-500/5 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Abnormal Behaviour Report
          </CardTitle>
          <div className="flex items-center gap-2">
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
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
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
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No anomalies detected for this period</TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.employee}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell>{format(new Date(r.date), 'EEE, dd MMM yyyy')}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">{r.hours.toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-800 text-[10px]">{r.rule}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
