import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { addMonths, eachDayOfInterval, endOfWeek, format, startOfWeek, subMonths } from 'date-fns';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { toast } from 'sonner';

const getPayrollPeriod = (m: Date) => ({
  start: new Date(m.getFullYear(), m.getMonth(), 21),
  end: new Date(m.getFullYear(), m.getMonth() + 1, 20),
});

// Weeks within payroll period: Monday-based, intersection with [start..end]
const getPayrollWeeks = (m: Date) => {
  const { start, end } = getPayrollPeriod(m);
  const firstMonday = startOfWeek(start, { weekStartsOn: 1 });
  const weeks: { start: Date; end: Date; dayCount: number }[] = [];
  let cursor = firstMonday;
  while (cursor <= end) {
    const wEnd = endOfWeek(cursor, { weekStartsOn: 1 });
    const clampedStart = cursor < start ? start : cursor;
    const clampedEnd = wEnd > end ? end : wEnd;
    const days = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
    weeks.push({ start: cursor, end: wEnd, dayCount: days.length });
    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }
  return weeks;
};

interface ShopRow {
  orgName: string;
  branchName: string;
  weeklyTarget: number;
  weekly: number[];
}

export function ShopTargetHoursReport() {
  const [month, setMonth] = useState<Date>(() => {
    const t = new Date();
    return t.getDate() < 21 ? subMonths(t, 1) : t;
  });
  const [rows, setRows] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);

  const weeks = useMemo(() => getPayrollWeeks(month), [month]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { start, end } = getPayrollPeriod(month);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const rangeStart = format(startOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd');

        const { data: branches } = await supabase
          .from('branches')
          .select('id, name, organization_id, organization:organizations(name)')
          .order('name');

        const { data: targets } = await supabase
          .from('branch_weekly_hour_targets')
          .select('branch_id, target_hours');
        const targetMap: Record<string, number> = {};
        (targets || []).forEach((t: any) => { targetMap[t.branch_id] = Number(t.target_hours) || 0; });

        const { data: ts } = await supabase
          .from('timesheets')
          .select('id, branch_id, week_start_date')
          .gte('week_start_date', rangeStart)
          .lte('week_start_date', endStr);
        const tsIds = (ts || []).map(t => t.id);
        const tsMeta: Record<string, { branch_id: string }> = {};
        (ts || []).forEach(t => { tsMeta[t.id] = { branch_id: t.branch_id }; });

        let entries: any[] = [];
        if (tsIds.length) {
          const { data: ents } = await supabase
            .from('timesheet_entries')
            .select('timesheet_id, entry_date, actual_hours')
            .in('timesheet_id', tsIds)
            .gte('entry_date', startStr)
            .lte('entry_date', endStr);
          entries = ents || [];
        }

        // Optional: temporary staff
        const { data: tempEnts } = await supabase
          .from('temporary_timesheet_entries')
          .select('branch_id, entry_date, actual_hours')
          .gte('entry_date', startStr)
          .lte('entry_date', endStr);

        const built: ShopRow[] = (branches || []).map((b: any) => {
          const weekly = weeks.map(() => 0);
          entries.forEach((e: any) => {
            const meta = tsMeta[e.timesheet_id];
            if (!meta || meta.branch_id !== b.id) return;
            const d = new Date(e.entry_date);
            const wi = weeks.findIndex(w => d >= w.start && d <= w.end);
            if (wi >= 0) weekly[wi] += Number(e.actual_hours) || 0;
          });
          (tempEnts || []).forEach((e: any) => {
            if (e.branch_id !== b.id) return;
            const d = new Date(e.entry_date);
            const wi = weeks.findIndex(w => d >= w.start && d <= w.end);
            if (wi >= 0) weekly[wi] += Number(e.actual_hours) || 0;
          });
          return {
            orgName: b.organization?.name || '—',
            branchName: b.name,
            weeklyTarget: targetMap[b.id] || 0,
            weekly,
          };
        });

        // Drop branches with zero data and zero target (keeps the layout focused)
        const filtered = built.filter(r => r.weeklyTarget > 0 || r.weekly.some(v => v > 0));
        // Group by org
        filtered.sort((a, b) => a.orgName.localeCompare(b.orgName) || a.branchName.localeCompare(b.branchName));
        setRows(filtered);
      } finally {
        setLoading(false);
      }
    })();
  }, [month, weeks]);

  const { start, end } = getPayrollPeriod(month);

  const exportXlsx = async () => {
    try {
      const XLSX = await import('xlsx');
      const header1 = ['No', 'Intercompany', 'Location', 'Weekly Target', ...weeks.map(() => 'Actual Shop Working Hours'), 'Comments'];
      const header2 = ['', '', '', '', ...weeks.map(w => `${format(w.start, 'dd/MM/yyyy')} to ${format(w.end, 'dd/MM/yyyy')}`), ''];
      const header3 = ['', '', '', '', ...weeks.map(w => `${w.dayCount} Days`), ''];

      const aoa: any[] = [
        ['Niza Group of Companies'],
        ['Stores Working Hours Details'],
        [`For the month of ${format(start, 'MMM yyyy')} (${format(start, 'dd/MM')} – ${format(end, 'dd/MM/yyyy')})`],
        [],
        header1,
        header2,
        header3,
      ];

      let currentOrg = '';
      let counter = 0;
      rows.forEach(r => {
        if (r.orgName !== currentOrg) {
          if (currentOrg !== '') aoa.push([]);
          currentOrg = r.orgName;
          counter = 0;
        }
        counter += 1;
        aoa.push([counter, r.orgName, r.branchName, r.weeklyTarget, ...r.weekly.map(v => Number(v.toFixed(2))), '']);
      });

      // Grand total weekly target
      const totalTarget = rows.reduce((s, r) => s + r.weeklyTarget, 0);
      aoa.push([]);
      aoa.push(['', '', 'Total', totalTarget]);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, format(start, 'MMM yy'));
      XLSX.writeFile(wb, `Shop_Target_Hours_${format(start, 'MMM_yyyy')}.xlsx`);
    } catch (e: any) {
      toast.error('Failed to export: ' + (e?.message || e));
    }
  };

  // Render grouped
  const grouped: { org: string; items: ShopRow[] }[] = [];
  rows.forEach(r => {
    const last = grouped[grouped.length - 1];
    if (last && last.org === r.orgName) last.items.push(r);
    else grouped.push({ org: r.orgName, items: [r] });
  });
  const totalTarget = rows.reduce((s, r) => s + r.weeklyTarget, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-blue-500/5 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            Shop Target Hours — {format(start, 'MMM yyyy')}
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
            <Button size="sm" variant="outline" onClick={exportXlsx} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-1" /> Export XLSX
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32"><NizaLoaderInline /></div>
        ) : (
          <Table className="text-xs min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={3} className="w-10 text-center">No</TableHead>
                <TableHead rowSpan={3}>Intercompany</TableHead>
                <TableHead rowSpan={3}>Location</TableHead>
                <TableHead rowSpan={3} className="text-right">Weekly Target</TableHead>
                <TableHead colSpan={weeks.length} className="text-center bg-muted/40">Actual Shop Working Hours</TableHead>
                <TableHead rowSpan={3}>Comments</TableHead>
              </TableRow>
              <TableRow>
                {weeks.map((w, i) => (
                  <TableHead key={i} className="text-center text-[10px]">
                    {format(w.start, 'dd/MM/yyyy')}<br />to {format(w.end, 'dd/MM/yyyy')}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                {weeks.map((w, i) => (
                  <TableHead key={i} className="text-center text-[10px] text-muted-foreground">{w.dayCount} Days</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g, gi) => (
                <React.Fragment key={gi}>
                  {g.items.map((r, i) => (
                    <TableRow key={`${gi}-${i}`}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="truncate max-w-[180px]">{r.orgName}</TableCell>
                      <TableCell className="font-medium">{r.branchName}</TableCell>
                      <TableCell className="text-right">{r.weeklyTarget || ''}</TableCell>
                      {r.weekly.map((v, wi) => {
                        const target = r.weeklyTarget * (weeks[wi].dayCount / 7);
                        const over = target > 0 && v > target;
                        return (
                          <TableCell key={wi} className={`text-right ${over ? 'text-amber-700 font-semibold' : ''}`}>{v ? v.toFixed(2) : ''}</TableCell>
                        );
                      })}
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  <TableRow><TableCell colSpan={5 + weeks.length} className="py-1 bg-muted/30" /></TableRow>
                </React.Fragment>
              ))}
              <TableRow className="font-semibold bg-muted/40">
                <TableCell colSpan={3} className="text-right">Total Weekly Target</TableCell>
                <TableCell className="text-right">{totalTarget}</TableCell>
                <TableCell colSpan={weeks.length + 1}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
