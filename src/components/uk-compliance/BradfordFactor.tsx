import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calculator, TrendingUp, Plus, Users, Settings, Pencil, Trash2, Eye } from 'lucide-react';
import { format, subMonths, differenceInDays } from 'date-fns';

interface AbsenceRecord {
  id: string;
  employee_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  return_to_work_completed: boolean;
  reason: string;
  notes: string;
  employees?: { first_name: string; last_name: string };
}

interface BradfordThreshold {
  id: string;
  threshold_score: number;
  action_required: string;
  description: string;
  color: string;
  is_active: boolean;
}

interface EmployeeBradford {
  employee_id: string;
  employee_name: string;
  spells: number;
  days: number;
  score: number;
  action: string | null;
  color: string;
}

export function BradfordFactor() {
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [thresholds, setThresholds] = useState<BradfordThreshold[]>([]);
  const [bradfordScores, setBradfordScores] = useState<EmployeeBradford[]>([]);
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAbsenceDialog, setShowAbsenceDialog] = useState(false);
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [showViewAbsenceDialog, setShowViewAbsenceDialog] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<AbsenceRecord | null>(null);
  const [editingThreshold, setEditingThreshold] = useState<BradfordThreshold | null>(null);
  const [viewingAbsence, setViewingAbsence] = useState<AbsenceRecord | null>(null);

  const [newAbsence, setNewAbsence] = useState({
    employee_id: '',
    absence_type: 'sickness',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [newThreshold, setNewThreshold] = useState({
    threshold_score: 100,
    action_required: 'informal_discussion',
    description: '',
    color: '#FCD34D'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const twelveMonthsAgo = subMonths(new Date(), 12);
      const [absencesRes, thresholdsRes, employeesRes] = await Promise.all([
        supabase.from('absence_records').select('*, employees(first_name, last_name)')
          .gte('start_date', format(twelveMonthsAgo, 'yyyy-MM-dd'))
          .order('start_date', { ascending: false }),
        supabase.from('bradford_thresholds').select('*').eq('is_active', true).order('threshold_score'),
        supabase.from('employees').select('id, first_name, last_name').eq('status', 'active')
      ]);

      if (absencesRes.data) setAbsences(absencesRes.data);
      if (thresholdsRes.data) setThresholds(thresholdsRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);

      if (absencesRes.data && thresholdsRes.data && employeesRes.data) {
        calculateBradfordScores(absencesRes.data, thresholdsRes.data, employeesRes.data);
      }
    } catch (error) {
      console.error('Error fetching Bradford data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBradfordScores = (
    absenceData: AbsenceRecord[],
    thresholdData: BradfordThreshold[],
    employeeData: { id: string; first_name: string; last_name: string }[]
  ) => {
    const employeeAbsences: Record<string, { spells: number; days: number; name: string }> = {};
    employeeData.forEach(emp => {
      employeeAbsences[emp.id] = { spells: 0, days: 0, name: `${emp.first_name} ${emp.last_name}` };
    });
    absenceData.forEach(absence => {
      if (employeeAbsences[absence.employee_id]) {
        employeeAbsences[absence.employee_id].spells += 1;
        employeeAbsences[absence.employee_id].days += absence.days_count;
      }
    });

    const scores: EmployeeBradford[] = Object.entries(employeeAbsences)
      .map(([employeeId, data]) => {
        const score = Math.pow(data.spells, 2) * data.days;
        let action: string | null = null;
        let color = '#10B981';
        for (const threshold of thresholdData.sort((a, b) => b.threshold_score - a.threshold_score)) {
          if (score >= threshold.threshold_score) {
            action = threshold.action_required;
            color = threshold.color;
            break;
          }
        }
        return { employee_id: employeeId, employee_name: data.name, spells: data.spells, days: data.days, score, action, color };
      })
      .sort((a, b) => b.score - a.score);

    setBradfordScores(scores);
  };

  // === Absence CRUD ===
  const resetAbsenceForm = () => {
    setEditingAbsence(null);
    setNewAbsence({ employee_id: '', absence_type: 'sickness', start_date: '', end_date: '', reason: '' });
    setShowAbsenceDialog(false);
  };

  const openEditAbsence = (absence: AbsenceRecord) => {
    setEditingAbsence(absence);
    setNewAbsence({
      employee_id: absence.employee_id,
      absence_type: absence.absence_type,
      start_date: absence.start_date,
      end_date: absence.end_date,
      reason: absence.reason || ''
    });
    setShowAbsenceDialog(true);
  };

  const handleSaveAbsence = async () => {
    try {
      const daysCount = differenceInDays(new Date(newAbsence.end_date), new Date(newAbsence.start_date)) + 1;
      if (editingAbsence) {
        const { error } = await supabase.from('absence_records').update({
          employee_id: newAbsence.employee_id,
          absence_type: newAbsence.absence_type,
          start_date: newAbsence.start_date,
          end_date: newAbsence.end_date,
          days_count: daysCount,
          reason: newAbsence.reason
        }).eq('id', editingAbsence.id);
        if (error) throw error;
        toast.success('Absence updated');
      } else {
        const { error } = await supabase.from('absence_records').insert({
          employee_id: newAbsence.employee_id,
          absence_type: newAbsence.absence_type,
          start_date: newAbsence.start_date,
          end_date: newAbsence.end_date,
          days_count: daysCount,
          reason: newAbsence.reason,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });
        if (error) throw error;
        toast.success('Absence recorded');
      }
      resetAbsenceForm();
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save absence');
    }
  };

  const handleRTW = async (id: string) => {
    try {
      const { error } = await supabase.from('absence_records').update({
        return_to_work_completed: true,
        return_to_work_date: format(new Date(), 'yyyy-MM-dd'),
        return_to_work_by: (await supabase.auth.getUser()).data.user?.id
      }).eq('id', id);
      if (error) throw error;
      toast.success('Return to work recorded');
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to record return to work');
    }
  };

  // === Threshold CRUD ===
  const resetThresholdForm = () => {
    setEditingThreshold(null);
    setNewThreshold({ threshold_score: 100, action_required: 'informal_discussion', description: '', color: '#FCD34D' });
    setShowThresholdDialog(false);
  };

  const openEditThreshold = (threshold: BradfordThreshold) => {
    setEditingThreshold(threshold);
    setNewThreshold({
      threshold_score: threshold.threshold_score,
      action_required: threshold.action_required,
      description: threshold.description || '',
      color: threshold.color || '#FCD34D'
    });
    setShowThresholdDialog(true);
  };

  const handleSaveThreshold = async () => {
    try {
      if (editingThreshold) {
        const { error } = await supabase.from('bradford_thresholds').update({
          threshold_score: newThreshold.threshold_score,
          action_required: newThreshold.action_required,
          description: newThreshold.description,
          color: newThreshold.color
        }).eq('id', editingThreshold.id);
        if (error) throw error;
        toast.success('Threshold updated');
      } else {
        const { error } = await supabase.from('bradford_thresholds').insert({
          ...newThreshold,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });
        if (error) throw error;
        toast.success('Threshold added');
      }
      resetThresholdForm();
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save threshold');
    }
  };

  const handleDeactivateThreshold = async (id: string) => {
    try {
      const { error } = await supabase.from('bradford_thresholds').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast.success('Threshold deactivated');
      fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to deactivate threshold');
    }
  };

  const getActionBadge = (action: string | null) => {
    if (!action) return <Badge variant="outline" className="bg-green-100 text-green-800">No Action</Badge>;
    const labels: Record<string, string> = {
      informal_discussion: 'Informal Discussion',
      verbal_warning: 'Verbal Warning',
      written_warning: 'Written Warning',
      final_warning: 'Final Warning',
      dismissal: 'Dismissal Review'
    };
    return <Badge variant="destructive">{labels[action] || action}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const highRiskCount = bradfordScores.filter(s => s.score >= 150).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Bradford Factor</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Absences (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absences.length}</div>
            <p className="text-xs text-muted-foreground">Across all employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Risk Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highRiskCount}</div>
            <p className="text-xs text-muted-foreground">Bradford score ≥ 150</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bradfordScores.length > 0
                ? Math.round(bradfordScores.reduce((sum, s) => sum + s.score, 0) / bradfordScores.length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Company average</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="scores" className="w-full">
        <TabsList>
          <TabsTrigger value="scores">
            <TrendingUp className="h-4 w-4 mr-2" />
            Bradford Scores
          </TabsTrigger>
          <TabsTrigger value="absences">
            <Users className="h-4 w-4 mr-2" />
            Absence Records
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <Settings className="h-4 w-4 mr-2" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Bradford Scores</CardTitle>
              <CardDescription>Rolling 12-month calculation: Score = S² × D (Spells² × Days)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Spells (S)</TableHead>
                    <TableHead>Days (D)</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Action Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bradfordScores.filter(s => s.score > 0).map((emp) => (
                    <TableRow key={emp.employee_id}>
                      <TableCell className="font-medium">{emp.employee_name}</TableCell>
                      <TableCell>{emp.spells}</TableCell>
                      <TableCell>{emp.days}</TableCell>
                      <TableCell>
                        <span className="font-bold" style={{ color: emp.color }}>{emp.score}</span>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={Math.min((emp.score / 600) * 100, 100)} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(emp.action)}</TableCell>
                    </TableRow>
                  ))}
                  {bradfordScores.filter(s => s.score > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No absence data in the last 12 months.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Understanding Bradford Factor</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  The Bradford Factor highlights frequent short-term absences, which are more disruptive than longer planned absences.
                </p>
                <div className="text-sm space-y-1">
                  <p><strong>Formula:</strong> S² × D = Bradford Score</p>
                  <p>• 1 absence of 10 days = 1² × 10 = <strong>10</strong></p>
                  <p>• 5 absences of 2 days = 5² × 10 = <strong>250</strong></p>
                  <p>• 10 absences of 1 day = 10² × 10 = <strong>1000</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Absence Records</CardTitle>
                <CardDescription>All absences in the last 12 months</CardDescription>
              </div>
              <Button onClick={() => { resetAbsenceForm(); setShowAbsenceDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />Record Absence
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>RTW Interview</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((absence) => (
                    <TableRow key={absence.id}>
                      <TableCell className="font-medium">
                        {absence.employees?.first_name} {absence.employees?.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{absence.absence_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(absence.start_date), 'dd MMM')} - {format(new Date(absence.end_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>{absence.days_count}</TableCell>
                      <TableCell>
                        <Badge variant={absence.return_to_work_completed ? 'default' : 'secondary'}>
                          {absence.return_to_work_completed ? 'Completed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setViewingAbsence(absence); setShowViewAbsenceDialog(true); }} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEditAbsence(absence)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!absence.return_to_work_completed && (
                            <Button size="sm" variant="outline" onClick={() => handleRTW(absence.id)}>
                              Complete RTW
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {absences.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No absence records.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bradford Thresholds</CardTitle>
                <CardDescription>Define trigger points for management action</CardDescription>
              </div>
              <Button onClick={() => { resetThresholdForm(); setShowThresholdDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />Add Threshold
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score Threshold</TableHead>
                    <TableHead>Action Required</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thresholds.map((threshold) => (
                    <TableRow key={threshold.id}>
                      <TableCell className="font-bold">≥ {threshold.threshold_score}</TableCell>
                      <TableCell className="capitalize">{threshold.action_required.replace('_', ' ')}</TableCell>
                      <TableCell className="text-muted-foreground">{threshold.description}</TableCell>
                      <TableCell>
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: threshold.color }} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditThreshold(threshold)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeactivateThreshold(threshold.id)} title="Deactivate">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {thresholds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No thresholds configured. Add thresholds to trigger management actions.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Absence Dialog (Add/Edit) */}
      <Dialog open={showAbsenceDialog} onOpenChange={(open) => { if (!open) resetAbsenceForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAbsence ? 'Edit Absence' : 'Record Absence'}</DialogTitle>
            <DialogDescription>Log an employee absence for Bradford calculation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={newAbsence.employee_id} onValueChange={(v) => setNewAbsence({ ...newAbsence, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Absence Type</Label>
              <Select value={newAbsence.absence_type} onValueChange={(v) => setNewAbsence({ ...newAbsence, absence_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sickness">Sickness</SelectItem>
                  <SelectItem value="unauthorised">Unauthorised</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={newAbsence.start_date} onChange={(e) => setNewAbsence({ ...newAbsence, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={newAbsence.end_date} onChange={(e) => setNewAbsence({ ...newAbsence, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={newAbsence.reason} onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAbsenceForm}>Cancel</Button>
            <Button onClick={handleSaveAbsence} disabled={!newAbsence.employee_id || !newAbsence.start_date || !newAbsence.end_date}>
              {editingAbsence ? 'Update Absence' : 'Record Absence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Threshold Dialog (Add/Edit) */}
      <Dialog open={showThresholdDialog} onOpenChange={(open) => { if (!open) resetThresholdForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingThreshold ? 'Edit Threshold' : 'Add Bradford Threshold'}</DialogTitle>
            <DialogDescription>Define when management action is required</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Threshold Score</Label>
              <Input type="number" value={newThreshold.threshold_score} onChange={(e) => setNewThreshold({ ...newThreshold, threshold_score: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>Action Required</Label>
              <Select value={newThreshold.action_required} onValueChange={(v) => setNewThreshold({ ...newThreshold, action_required: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="informal_discussion">Informal Discussion</SelectItem>
                  <SelectItem value="verbal_warning">Verbal Warning</SelectItem>
                  <SelectItem value="written_warning">Written Warning</SelectItem>
                  <SelectItem value="final_warning">Final Warning</SelectItem>
                  <SelectItem value="dismissal">Dismissal Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newThreshold.description} onChange={(e) => setNewThreshold({ ...newThreshold, description: e.target.value })} placeholder="What action should be taken..." />
            </div>
            <div>
              <Label>Color (for display)</Label>
              <Input type="color" value={newThreshold.color} onChange={(e) => setNewThreshold({ ...newThreshold, color: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetThresholdForm}>Cancel</Button>
            <Button onClick={handleSaveThreshold}>
              {editingThreshold ? 'Update Threshold' : 'Add Threshold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Absence Dialog */}
      <Dialog open={showViewAbsenceDialog} onOpenChange={setShowViewAbsenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Absence Details</DialogTitle>
          </DialogHeader>
          {viewingAbsence && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Employee</Label>
                  <p className="font-medium">{viewingAbsence.employees?.first_name} {viewingAbsence.employees?.last_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p><Badge variant="outline" className="capitalize">{viewingAbsence.absence_type}</Badge></p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Dates</Label>
                  <p className="font-medium">{format(new Date(viewingAbsence.start_date), 'dd MMM yyyy')} – {format(new Date(viewingAbsence.end_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Days</Label>
                  <p className="font-medium">{viewingAbsence.days_count}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">RTW Interview</Label>
                  <p>
                    <Badge variant={viewingAbsence.return_to_work_completed ? 'default' : 'secondary'}>
                      {viewingAbsence.return_to_work_completed ? 'Completed' : 'Pending'}
                    </Badge>
                  </p>
                </div>
              </div>
              {viewingAbsence.reason && (
                <div>
                  <Label className="text-muted-foreground text-xs">Reason</Label>
                  <p className="text-sm">{viewingAbsence.reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
