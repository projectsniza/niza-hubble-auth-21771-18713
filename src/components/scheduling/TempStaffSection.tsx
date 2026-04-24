import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, UserPlus, Trash2, X, Lock, Calendar } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface TempEmployee {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  branch_id: string;
  organization_id: string;
}

interface TempEntry {
  id?: string;
  temporary_employee_id: string;
  branch_id: string;
  week_start_date: string;
  entry_date: string;
  day_of_week: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  actual_hours: number;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface Props {
  branchId: string | null;
  organizationId: string | null;
  weekStart: Date;
  weekDays: Date[];
  isLocked: boolean;
  isDateInPayroll: (d: Date) => boolean;
}

export function TempStaffSection({ branchId, organizationId, weekStart, weekDays, isLocked, isDateInPayroll }: Props) {
  const { user } = useAuth();
  const [temps, setTemps] = useState<TempEmployee[]>([]);
  const [entries, setEntries] = useState<TempEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTemp, setNewTemp] = useState({ first_name: '', last_name: '', role: '', start_date: format(weekStart, 'yyyy-MM-dd'), end_date: '' });
  const [editingCell, setEditingCell] = useState<Record<string, { start: string; end: string }>>({});

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!branchId) { setTemps([]); setEntries([]); return; }

    // Active temps overlapping this week
    const { data: tempsData } = await supabase
      .from('temporary_employees')
      .select('*')
      .eq('branch_id', branchId)
      .lte('start_date', weekEndStr)
      .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

    const list = (tempsData || []) as TempEmployee[];
    setTemps(list);

    if (list.length > 0) {
      const { data: entriesData } = await supabase
        .from('temporary_timesheet_entries')
        .select('*')
        .in('temporary_employee_id', list.map(t => t.id))
        .eq('week_start_date', weekStartStr);
      setEntries((entriesData || []) as TempEntry[]);
    } else {
      setEntries([]);
    }
  }, [branchId, weekStartStr, weekEndStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddTemp = async () => {
    if (!newTemp.first_name.trim() || !branchId || !organizationId) {
      toast.error('First name, branch and organization are required');
      return;
    }
    const { error } = await supabase.from('temporary_employees').insert({
      first_name: newTemp.first_name.trim(),
      last_name: newTemp.last_name.trim(),
      role: newTemp.role.trim() || null,
      start_date: newTemp.start_date,
      end_date: newTemp.end_date || null,
      branch_id: branchId,
      organization_id: organizationId,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Temporary employee added');
    setShowAdd(false);
    setNewTemp({ first_name: '', last_name: '', role: '', start_date: format(weekStart, 'yyyy-MM-dd'), end_date: '' });
    fetchData();
  };

  const endTemp = async (temp: TempEmployee) => {
    const { error } = await supabase
      .from('temporary_employees')
      .update({ end_date: format(new Date(), 'yyyy-MM-dd'), is_active: false })
      .eq('id', temp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Ended ${temp.first_name}'s temp engagement`);
    fetchData();
  };

  const computeHours = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return Math.round(mins / 60 * 100) / 100;
  };

  const saveCell = async (temp: TempEmployee, day: Date, dayOfWeek: string, key: string, opts?: { clear?: boolean }) => {
    if (isLocked) { toast.error('This payroll period is locked.'); return; }
    const edit = editingCell[key];
    const dateStr = format(day, 'yyyy-MM-dd');
    const existing = entries.find(e => e.temporary_employee_id === temp.id && e.entry_date === dateStr);

    let startTime: string | null = opts?.clear ? null : (edit?.start || existing?.shift_start_time || null);
    let endTime: string | null = opts?.clear ? null : (edit?.end || existing?.shift_end_time || null);
    if (startTime === '') startTime = null;
    if (endTime === '') endTime = null;
    const hours = computeHours(startTime, endTime);

    if (existing?.id) {
      await supabase.from('temporary_timesheet_entries').update({
        shift_start_time: startTime, shift_end_time: endTime, actual_hours: hours,
      }).eq('id', existing.id);
    } else {
      await supabase.from('temporary_timesheet_entries').insert({
        temporary_employee_id: temp.id,
        branch_id: temp.branch_id,
        week_start_date: weekStartStr,
        entry_date: dateStr,
        day_of_week: dayOfWeek,
        shift_start_time: startTime,
        shift_end_time: endTime,
        actual_hours: hours,
      });
    }
    setEditingCell(prev => { const c = { ...prev }; delete c[key]; return c; });
    fetchData();
  };

  const formatTime = (t: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  if (!branchId) return null;

  const totalHours = entries.reduce((s, e) => s + (Number(e.actual_hours) || 0), 0);

  return (
    <Card className="border-dashed border-2 border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10 mt-4">
      <CardHeader className="py-3 px-4 border-b border-amber-200/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <UserPlus className="h-4 w-4" />
            TEMPORARY STAFF — WEEK
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
              {temps.length} temp{temps.length === 1 ? '' : 's'}
            </Badge>
            {totalHours > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                {totalHours.toFixed(1)}h
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} disabled={isLocked} className="h-7 text-xs">
            {isLocked ? <Lock className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Add Temp Employee
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {temps.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No temporary employees this week. Use “Add Temp Employee” to add ad-hoc staff.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-amber-100/40 dark:bg-amber-900/20">
                  <th className="text-left px-3 py-2 w-44 font-semibold">NAME</th>
                  {weekDays.map((d, i) => (
                    <th key={i} className="text-center px-2 py-2 border-x border-amber-200/40 min-w-[110px]">
                      <div className="font-bold">{DAYS_SHORT[i]}</div>
                      <div className="text-[10px] text-muted-foreground">{format(d, 'dd/MM')}</div>
                    </th>
                  ))}
                  <th className="text-center px-2 py-2 font-bold bg-emerald-100/50 min-w-[60px]">TOTAL</th>
                  <th className="text-center px-2 py-2 min-w-[60px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {temps.map((temp, idx) => {
                  const empEntries = entries.filter(e => e.temporary_employee_id === temp.id);
                  const empTotal = empEntries.reduce((s, e) => s + (Number(e.actual_hours) || 0), 0);
                  return (
                    <tr key={temp.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-amber-50/30'}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-800 text-[9px] px-1.5 py-0">TEMP</Badge>
                          <div>
                            <div className="font-medium">{temp.first_name} {temp.last_name}</div>
                            {temp.role && <div className="text-[10px] text-muted-foreground">{temp.role}</div>}
                            {temp.end_date && <div className="text-[10px] text-muted-foreground">Until {format(parseISO(temp.end_date), 'dd MMM')}</div>}
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day, dayIdx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const entry = empEntries.find(e => e.entry_date === dateStr);
                        const inPayroll = isDateInPayroll(day);
                        const inRange = dateStr >= temp.start_date && (!temp.end_date || dateStr <= temp.end_date);
                        const cellKey = `${temp.id}-${dayIdx}`;
                        const editing = editingCell[cellKey];
                        const disabled = isLocked || !inPayroll || !inRange;

                        if (!inPayroll || !inRange) {
                          return <td key={dayIdx} className="text-center text-muted-foreground bg-muted/40 opacity-50 px-1">—</td>;
                        }

                        return (
                          <td key={dayIdx} className="text-center px-1 border-x border-amber-200/30 text-[10px]">
                            {editing ? (
                              <div className="flex flex-col gap-0.5">
                                <Input
                                  type="time"
                                  value={editing.start}
                                  onChange={(e) => setEditingCell(p => ({ ...p, [cellKey]: { ...p[cellKey], start: e.target.value } }))}
                                  className="h-6 text-[10px] p-1"
                                />
                                <div className="flex items-center gap-0.5">
                                  <Input
                                    type="time"
                                    value={editing.end}
                                    onChange={(e) => setEditingCell(p => ({ ...p, [cellKey]: { ...p[cellKey], end: e.target.value } }))}
                                    className="h-6 text-[10px] p-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveCell(temp, day, DAYS_OF_WEEK[dayIdx], cellKey)}
                                    className="h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground text-[10px]"
                                  >✓</button>
                                  {entry && (
                                    <button
                                      type="button"
                                      onClick={() => saveCell(temp, day, DAYS_OF_WEEK[dayIdx], cellKey, { clear: true })}
                                      className="h-5 w-5 flex items-center justify-center rounded text-destructive hover:bg-destructive/10"
                                    ><X className="h-3 w-3" /></button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => setEditingCell(p => ({ ...p, [cellKey]: { start: entry?.shift_start_time || '', end: entry?.shift_end_time || '' } }))}
                                className="block w-full px-1 py-0.5 rounded hover:bg-amber-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={disabled && isLocked ? 'Period is locked' : ''}
                              >
                                {entry?.shift_start_time && entry?.shift_end_time ? (
                                  <div>
                                    <div>{formatTime(entry.shift_start_time)}</div>
                                    <div className="text-muted-foreground">{formatTime(entry.shift_end_time)}</div>
                                    <div className="text-[9px] font-bold text-emerald-600">{entry.actual_hours}h</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center font-bold bg-emerald-50/50 text-emerald-700">{empTotal.toFixed(1)}</td>
                      <td className="text-center">
                        {!temp.end_date && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => endTemp(temp)} title="End engagement">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Temporary Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={newTemp.first_name} onChange={(e) => setNewTemp({ ...newTemp, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={newTemp.last_name} onChange={(e) => setNewTemp({ ...newTemp, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Role / Position</Label>
              <Input placeholder="e.g. Cashier, Stock cover" value={newTemp.role} onChange={(e) => setNewTemp({ ...newTemp, role: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date *</Label>
                <Input type="date" value={newTemp.start_date} onChange={(e) => setNewTemp({ ...newTemp, start_date: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</Label>
                <Input type="date" value={newTemp.end_date} onChange={(e) => setNewTemp({ ...newTemp, end_date: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave End Date blank to keep the temp active. Use “End engagement” later to close them.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddTemp}>Add Temporary Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
