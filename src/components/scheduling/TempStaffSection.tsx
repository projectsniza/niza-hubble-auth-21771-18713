import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, UserPlus, Trash2, X, Lock, Calendar, Building2, Edit2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { snapToHalfHour, isHalfHourAligned, HALF_HOUR_TIME_STEP } from '@/lib/timeSnap';

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
  source_branch_id: string | null;
  source_name: string | null;
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

interface BranchOption {
  id: string;
  name: string;
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
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTemp, setNewTemp] = useState({
    first_name: '',
    last_name: '',
    role: '',
    start_date: format(weekStart, 'yyyy-MM-dd'),
    end_date: '',
    source_branch_id: '' as string, // '' | branchId | '__OTHER__'
    source_name: '',
  });
  const [editingCell, setEditingCell] = useState<Record<string, { start: string; end: string }>>({});

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!branchId) { setTemps([]); setEntries([]); return; }

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

  // Fetch branches for the source-branch dropdown
  const fetchBranches = useCallback(async () => {
    let q = supabase.from('branches').select('id, name').order('name');
    if (organizationId) q = q.eq('organization_id', organizationId);
    const { data } = await q;
    setBranches((data || []) as BranchOption[]);
  }, [organizationId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (showAdd) {
      fetchBranches();
      // Reset start_date to the currently viewed week so the temp is in-range
      // for the week the user is editing (not the week at initial mount).
      setNewTemp(prev => ({ ...prev, start_date: format(weekStart, 'yyyy-MM-dd') }));
    }
  }, [showAdd, fetchBranches, weekStart]);

  const branchNameById = useMemo(() => {
    const m: Record<string, string> = {};
    branches.forEach(b => { m[b.id] = b.name; });
    return m;
  }, [branches]);

  const handleAddTemp = async () => {
    if (!newTemp.first_name.trim() || !branchId || !organizationId) {
      toast.error('First name, branch and organization are required');
      return;
    }
    const isOther = newTemp.source_branch_id === '__OTHER__';
    const sourceBranchId = isOther || !newTemp.source_branch_id ? null : newTemp.source_branch_id;
    const sourceName = isOther ? newTemp.source_name.trim() || null : null;

    if (isOther && !sourceName) {
      toast.error('Please enter the source name for "Other"');
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
      source_branch_id: sourceBranchId,
      source_name: sourceName,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Temporary employee added');
    setShowAdd(false);
    setNewTemp({
      first_name: '', last_name: '', role: '',
      start_date: format(weekStart, 'yyyy-MM-dd'), end_date: '',
      source_branch_id: '', source_name: '',
    });
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

  // Edit
  const [editingTemp, setEditingTemp] = useState<TempEmployee | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', role: '',
    start_date: '', end_date: '',
    source_branch_id: '', source_name: '',
  });

  const openEditTemp = (t: TempEmployee) => {
    setEditingTemp(t);
    setEditForm({
      first_name: t.first_name || '',
      last_name: t.last_name || '',
      role: t.role || '',
      start_date: t.start_date,
      end_date: t.end_date || '',
      source_branch_id: t.source_branch_id || (t.source_name ? '__OTHER__' : ''),
      source_name: t.source_name || '',
    });
    fetchBranches();
  };

  const saveEditTemp = async () => {
    if (!editingTemp) return;
    if (!editForm.first_name.trim()) { toast.error('First name is required'); return; }
    const isOther = editForm.source_branch_id === '__OTHER__';
    const sourceBranchId = isOther || !editForm.source_branch_id ? null : editForm.source_branch_id;
    const sourceName = isOther ? (editForm.source_name.trim() || null) : null;
    if (isOther && !sourceName) { toast.error('Please enter the source name for "Other"'); return; }

    const { error } = await supabase
      .from('temporary_employees')
      .update({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        role: editForm.role.trim() || null,
        start_date: editForm.start_date,
        end_date: editForm.end_date || null,
        source_branch_id: sourceBranchId,
        source_name: sourceName,
      })
      .eq('id', editingTemp.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Temporary employee updated');
    setEditingTemp(null);
    fetchData();
  };

  // Archive (preserve history). Historical shift/timing data must NEVER be
  // removed when a temp employee is "deleted" — Super Admin can soft-archive
  // instead so monthly/weekly timesheet history remains intact.
  const deleteTemp = async (temp: TempEmployee) => {
    const { error } = await supabase
      .from('temporary_employees')
      .update({ is_active: false, end_date: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', temp.id);
    if (error) { toast.error(`Could not archive: ${error.message}`); return; }
    toast.success(`${temp.first_name} archived. Past timesheet entries preserved.`);
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
    if (isLocked) { toast.error('This payroll period is locked — unlock it in Lock Status before editing.'); return; }
    const edit = editingCell[key];
    const dateStr = format(day, 'yyyy-MM-dd');
    const inRange = dateStr >= temp.start_date && (!temp.end_date || dateStr <= temp.end_date);
    if (!inRange) {
      toast.error(`${temp.first_name}'s engagement does not cover ${format(day, 'dd MMM yyyy')}. Edit their start/end date first.`);
      return;
    }
    const existing = entries.find(e => e.temporary_employee_id === temp.id && e.entry_date === dateStr);

    let startTime: string | null = opts?.clear ? null : (edit?.start || existing?.shift_start_time || null);
    let endTime: string | null = opts?.clear ? null : (edit?.end || existing?.shift_end_time || null);
    if (startTime === '') startTime = null;
    if (endTime === '') endTime = null;
    const hours = computeHours(startTime, endTime);

    if (existing?.id) {
      const { error } = await supabase.from('temporary_timesheet_entries').update({
        shift_start_time: startTime, shift_end_time: endTime, actual_hours: hours,
      }).eq('id', existing.id);
      if (error) { toast.error(`Save failed: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from('temporary_timesheet_entries').insert({
        temporary_employee_id: temp.id,
        branch_id: temp.branch_id,
        week_start_date: weekStartStr,
        entry_date: dateStr,
        day_of_week: dayOfWeek,
        shift_start_time: startTime,
        shift_end_time: endTime,
        actual_hours: hours,
      });
      if (error) { toast.error(`Save failed: ${error.message}`); return; }
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

  const sourceLabel = (t: TempEmployee) => {
    if (t.source_branch_id && branchNameById[t.source_branch_id]) return `from ${branchNameById[t.source_branch_id]}`;
    if (t.source_name) return `from ${t.source_name}`;
    return null;
  };

  if (!branchId) return null;

  const totalHours = entries.reduce((s, e) => s + (Number(e.actual_hours) || 0), 0);

  return (
    <Card className="border-amber-300/60 mt-4 overflow-hidden shadow-sm">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20 border-b border-amber-200/50">
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
            Add Temporary Employee
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {temps.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No temporary employees this week. Use “Add Temporary Employee” to add ad-hoc staff.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Layout matches regular employees: each day is two cells (start | end). Amber accents distinguish temp staff. */}
            <table className="w-full text-xs min-w-[1400px] border-collapse">
              <thead>
                <tr className="bg-amber-50/60 dark:bg-amber-950/30 border-b border-amber-200/60">
                  <th className="text-left px-3 py-2 w-40 font-bold sticky left-0 bg-amber-50/60 dark:bg-amber-950/30 z-10">NAME</th>
                  {weekDays.map((d, i) => {
                    const inPayroll = isDateInPayroll(d);
                    return (
                      <th
                        key={i}
                        colSpan={2}
                        className={`text-center border-x border-amber-200/40 min-w-[100px] py-1 ${inPayroll ? '' : 'bg-muted/40 opacity-60'}`}
                      >
                        <div className="font-bold">{DAYS_SHORT[i]}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{format(d, 'dd/MM')}</div>
                      </th>
                    );
                  })}
                  <th className="text-center px-2 py-2 font-bold bg-blue-50 dark:bg-blue-950/50 min-w-[60px]">HOURS</th>
                  <th className="text-center px-2 py-2 font-bold bg-amber-50 dark:bg-amber-950/50 min-w-[60px]">HOLIDAY</th>
                  <th className="text-center px-2 py-2 font-bold bg-rose-50 dark:bg-rose-950/50 min-w-[60px]">SICK</th>
                  <th className="text-center px-2 py-2 font-bold bg-purple-50 dark:bg-purple-950/50 min-w-[60px]">ADJ+/-</th>
                  <th className="text-center px-2 py-2 font-bold bg-emerald-50 dark:bg-emerald-950/50 min-w-[60px]">TOTAL</th>
                  <th className="text-center px-2 py-2 min-w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {temps.map((temp, idx) => {
                  const empEntries = entries.filter(e => e.temporary_employee_id === temp.id);
                  const empHours = empEntries.reduce((s, e) => s + (Number(e.actual_hours) || 0), 0);
                  const holiday = 0, sick = 0, adj = 0;
                  const empTotal = empHours + holiday + sick + adj;
                  const src = sourceLabel(temp);
                  return (
                    <tr key={temp.id} className={`border-b border-amber-200/30 ${idx % 2 === 0 ? 'bg-background' : 'bg-amber-50/20 dark:bg-amber-950/10'}`}>
                      <td className="px-3 py-2 sticky left-0 bg-inherit z-10 font-medium">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-800 text-[9px] px-1.5 py-0 mt-0.5">TEMP</Badge>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{temp.first_name?.toUpperCase()} {temp.last_name?.toUpperCase()}</div>
                            {src && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <Building2 className="h-2.5 w-2.5" />{src}
                              </div>
                            )}
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
                          return (
                            <React.Fragment key={dayIdx}>
                              <td className="text-center text-muted-foreground bg-muted/50 opacity-50 px-1 border-l border-amber-200/30">—</td>
                              <td className="text-center text-muted-foreground bg-muted/50 opacity-50 px-1 border-r border-amber-200/30">—</td>
                            </React.Fragment>
                          );
                        }

                        const startVal = editing?.start ?? entry?.shift_start_time ?? '';
                        const endVal = editing?.end ?? entry?.shift_end_time ?? '';
                        const isEditing = !!editing;

                        return (
                          <React.Fragment key={dayIdx}>
                            <td className="text-center px-1 border-l border-amber-200/30 text-[10px]">
                              {isEditing ? (
                                <Input
                                  type="time"
                                  step={HALF_HOUR_TIME_STEP}
                                  value={startVal}
                                  disabled={disabled}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    /* time alignment warning removed - any minute allowed by default */
                                    const snapped = snapToHalfHour(v);
                                    setEditingCell(p => ({ ...p, [cellKey]: { start: snapped, end: p[cellKey]?.end ?? endVal } }));
                                  }}
                                  className="h-6 text-[10px] p-1 w-full"
                                  data-temp-cell={cellKey}
                                  onBlur={(e) => {
                                    const next = e.relatedTarget as HTMLElement | null;
                                    if (next?.getAttribute?.('data-temp-cell') === cellKey) return;
                                    if (next?.getAttribute?.('data-temp-reset') === cellKey) return;
                                    saveCell(temp, day, DAYS_OF_WEEK[dayIdx], cellKey);
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setEditingCell(p => ({ ...p, [cellKey]: { start: entry?.shift_start_time || '', end: entry?.shift_end_time || '' } }))}
                                  className="cursor-pointer hover:bg-amber-100/40 dark:hover:bg-amber-900/30 px-1 py-0.5 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={disabled && isLocked ? 'Period is locked' : ''}
                                >
                                  {entry?.shift_start_time ? formatTime(entry.shift_start_time) : <span className="text-muted-foreground">-</span>}
                                </button>
                              )}
                            </td>
                            <td className="text-center px-1 border-r border-amber-200/30 text-[10px]">
                              {isEditing ? (
                                <div className="flex items-center gap-0.5">
                                  <Input
                                    type="time"
                                    step={HALF_HOUR_TIME_STEP}
                                    value={endVal}
                                    disabled={disabled}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      /* time alignment warning removed - any minute allowed by default */
                                      const snapped = snapToHalfHour(v);
                                      setEditingCell(p => ({ ...p, [cellKey]: { start: p[cellKey]?.start ?? startVal, end: snapped } }));
                                    }}
                                    className="h-6 text-[10px] p-1 w-full"
                                    data-temp-cell={cellKey}
                                    onBlur={(e) => {
                                      const next = e.relatedTarget as HTMLElement | null;
                                      if (next?.getAttribute?.('data-temp-cell') === cellKey) return;
                                      if (next?.getAttribute?.('data-temp-reset') === cellKey) return;
                                      saveCell(temp, day, DAYS_OF_WEEK[dayIdx], cellKey);
                                    }}
                                  />
                                  {entry && (
                                    <button
                                      type="button"
                                      data-temp-reset={cellKey}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => saveCell(temp, day, DAYS_OF_WEEK[dayIdx], cellKey, { clear: true })}
                                      className="h-5 w-5 flex items-center justify-center rounded text-destructive hover:bg-destructive/10 shrink-0"
                                      title="Clear shift"
                                    ><X className="h-3 w-3" /></button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setEditingCell(p => ({ ...p, [cellKey]: { start: entry?.shift_start_time || '', end: entry?.shift_end_time || '' } }))}
                                  className="cursor-pointer hover:bg-amber-100/40 dark:hover:bg-amber-900/30 px-1 py-0.5 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={disabled && isLocked ? 'Period is locked' : ''}
                                >
                                  {entry?.shift_end_time ? formatTime(entry.shift_end_time) : <span className="text-muted-foreground">-</span>}
                                </button>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="text-center font-bold bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">{empHours > 0 ? empHours.toFixed(1) : 0}</td>
                      <td className="text-center text-muted-foreground bg-amber-50/40 dark:bg-amber-950/20">-</td>
                      <td className="text-center text-muted-foreground bg-rose-50/40 dark:bg-rose-950/20">-</td>
                      <td className="text-center text-muted-foreground bg-purple-50/40 dark:bg-purple-950/20">-</td>
                      <td className="text-center font-bold bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700">{empTotal.toFixed(1)}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => openEditTemp(temp)} title="Edit">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          {!temp.end_date && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600" onClick={() => endTemp(temp)} title="End engagement">
                              <Lock className="h-3 w-3" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Archive (history preserved)">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archive temporary employee?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {temp.first_name} {temp.last_name} will be marked inactive and removed from the live roster.
                                  All past timesheet entries (hours, shift times, weekly &amp; monthly totals) are preserved unchanged.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTemp(temp)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Archive</AlertDialogAction>
                              </AlertDialogFooter>

                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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

            <div>
              <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Borrowed From *</Label>
              <Select
                value={newTemp.source_branch_id}
                onValueChange={(v) => setNewTemp({ ...newTemp, source_branch_id: v, source_name: v === '__OTHER__' ? newTemp.source_name : '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                  <SelectItem value="__OTHER__">Other (external / agency)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newTemp.source_branch_id === '__OTHER__' && (
              <div>
                <Label>Source Name *</Label>
                <Input
                  placeholder="e.g. ABC Agency, Friend, External"
                  value={newTemp.source_name}
                  onChange={(e) => setNewTemp({ ...newTemp, source_name: e.target.value })}
                />
              </div>
            )}

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

      {/* Edit Temporary Employee */}
      <Dialog open={!!editingTemp} onOpenChange={(o) => !o && setEditingTemp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="h-4 w-4" /> Edit Temporary Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Role / Position</Label>
              <Input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Borrowed From</Label>
              <Select
                value={editForm.source_branch_id}
                onValueChange={(v) => setEditForm({ ...editForm, source_branch_id: v, source_name: v === '__OTHER__' ? editForm.source_name : '' })}
              >
                <SelectTrigger><SelectValue placeholder="Select source branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  <SelectItem value="__OTHER__">Other (external / agency)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.source_branch_id === '__OTHER__' && (
              <div>
                <Label>Source Name *</Label>
                <Input value={editForm.source_name} onChange={(e) => setEditForm({ ...editForm, source_name: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date *</Label>
                <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</Label>
                <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemp(null)}>Cancel</Button>
            <Button onClick={saveEditTemp}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
