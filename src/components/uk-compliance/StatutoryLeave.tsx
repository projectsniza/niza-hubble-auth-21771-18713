import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Baby, Stethoscope, Heart, Plus, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface StatutoryLeaveEntitlement {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string | null;
  expected_end_date: string | null;
  weeks_entitled: number;
  weeks_taken: number;
  pay_type: string;
  status: string;
  baby_due_date: string | null;
  kit_days_used: number;
  employees?: { first_name: string; last_name: string };
}

interface SSPRecord {
  id: string;
  employee_id: string;
  absence_start_date: string;
  absence_end_date: string | null;
  waiting_days: number;
  qualifying_days: number;
  days_paid: number;
  weekly_rate: number;
  total_ssp_paid: number;
  fit_note_received: boolean;
  status: string;
  employees?: { first_name: string; last_name: string };
}

const leaveTypes = [
  { value: 'maternity', label: 'Maternity Leave', weeks: 52, icon: Baby },
  { value: 'paternity', label: 'Paternity Leave', weeks: 2, icon: Heart },
  { value: 'adoption', label: 'Adoption Leave', weeks: 52, icon: Heart },
  { value: 'shared_parental', label: 'Shared Parental Leave', weeks: 50, icon: Baby },
  { value: 'bereavement', label: 'Parental Bereavement', weeks: 2, icon: Heart },
];

export function StatutoryLeave() {
  const [entitlements, setEntitlements] = useState<StatutoryLeaveEntitlement[]>([]);
  const [sspRecords, setSspRecords] = useState<SSPRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showSSPDialog, setShowSSPDialog] = useState(false);
  const [newLeave, setNewLeave] = useState({
    employee_id: '',
    leave_type: 'maternity',
    baby_due_date: '',
    pay_type: 'statutory',
    notes: ''
  });
  const [newSSP, setNewSSP] = useState({
    employee_id: '',
    absence_start_date: '',
    reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entitlementsRes, sspRes, employeesRes] = await Promise.all([
        supabase.from('statutory_leave_entitlements').select('*, employees(first_name, last_name)').order('created_at', { ascending: false }).limit(100),
        supabase.from('ssp_records').select('*, employees(first_name, last_name)').order('absence_start_date', { ascending: false }).limit(100),
        supabase.from('employees').select('id, first_name, last_name').eq('status', 'active').limit(500)
      ]);

      if (entitlementsRes.data) setEntitlements(entitlementsRes.data);
      if (sspRes.data) setSspRecords(sspRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching statutory leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeave = async () => {
    try {
      const leaveType = leaveTypes.find(t => t.value === newLeave.leave_type);
      const { error } = await supabase.from('statutory_leave_entitlements').insert({
        employee_id: newLeave.employee_id,
        leave_type: newLeave.leave_type,
        baby_due_date: newLeave.baby_due_date || null,
        pay_type: newLeave.pay_type,
        weeks_entitled: leaveType?.weeks || 0,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Statutory leave request created');
      setShowLeaveDialog(false);
      setNewLeave({ employee_id: '', leave_type: 'maternity', baby_due_date: '', pay_type: 'statutory', notes: '' });
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create leave request';
      toast.error(message);
    }
  };

  const handleAddSSP = async () => {
    try {
      const { error } = await supabase.from('ssp_records').insert({
        employee_id: newSSP.employee_id,
        absence_start_date: newSSP.absence_start_date,
        waiting_days: 3, // First 3 days are waiting days
        weekly_rate: 116.75, // 2024/25 SSP rate
        status: 'active',
        notes: newSSP.reason
      });

      if (error) throw error;

      toast.success('SSP record created');
      setShowSSPDialog(false);
      setNewSSP({ employee_id: '', absence_start_date: '', reason: '' });
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create SSP record';
      toast.error(message);
    }
  };

  const handleApproveLeave = async (id: string) => {
    try {
      const { error } = await supabase.from('statutory_leave_entitlements').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: (await supabase.auth.getUser()).data.user?.id
      }).eq('id', id);

      if (error) throw error;
      toast.success('Leave approved');
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve leave';
      toast.error(message);
    }
  };

  const handleEndSSP = async (id: string, endDate: string) => {
    try {
      const { error } = await supabase.from('ssp_records').update({
        absence_end_date: endDate,
        status: 'completed'
      }).eq('id', id);

      if (error) throw error;
      toast.success('SSP record closed');
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to close SSP record';
      toast.error(message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      active: { variant: 'default', label: 'Active' },
      completed: { variant: 'outline', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Baby className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Statutory Leave</h2>
      </div>

      <Tabs defaultValue="leave" className="w-full">
        <TabsList>
          <TabsTrigger value="leave">
            <Calendar className="h-4 w-4 mr-2" />
            Parental Leave
          </TabsTrigger>
          <TabsTrigger value="ssp">
            <Stethoscope className="h-4 w-4 mr-2" />
            Statutory Sick Pay
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Statutory Leave Entitlements</CardTitle>
                <CardDescription>Maternity, Paternity, Adoption & Shared Parental Leave</CardDescription>
              </div>
              <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Add Leave</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Statutory Leave</DialogTitle>
                    <DialogDescription>Record statutory leave entitlement for an employee</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Employee</Label>
                      <Select value={newLeave.employee_id} onValueChange={(v) => setNewLeave({ ...newLeave, employee_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Leave Type</Label>
                      <Select value={newLeave.leave_type} onValueChange={(v) => setNewLeave({ ...newLeave, leave_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label} ({type.weeks} weeks)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {['maternity', 'paternity', 'adoption', 'shared_parental'].includes(newLeave.leave_type) && (
                      <div>
                        <Label>Expected Due/Placement Date</Label>
                        <Input
                          type="date"
                          value={newLeave.baby_due_date}
                          onChange={(e) => setNewLeave({ ...newLeave, baby_due_date: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <Label>Pay Type</Label>
                      <Select value={newLeave.pay_type} onValueChange={(v) => setNewLeave({ ...newLeave, pay_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="statutory">Statutory Pay Only</SelectItem>
                          <SelectItem value="enhanced">Enhanced Pay</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddLeave} disabled={!newLeave.employee_id}>Add Leave</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Weeks</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlements.map((ent) => (
                    <TableRow key={ent.id}>
                      <TableCell className="font-medium">
                        {ent.employees?.first_name} {ent.employees?.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {leaveTypes.find(t => t.value === ent.leave_type)?.label || ent.leave_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{ent.weeks_taken}/{ent.weeks_entitled}</TableCell>
                      <TableCell>
                        {ent.baby_due_date ? format(new Date(ent.baby_due_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(ent.status)}</TableCell>
                      <TableCell>
                        {ent.status === 'pending' && (
                          <Button size="sm" onClick={() => handleApproveLeave(ent.id)}>Approve</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {entitlements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No statutory leave records.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">UK Statutory Leave Entitlements</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Maternity:</strong> 52 weeks (39 weeks paid - 6 weeks at 90%, 33 weeks at £184.03/week)</li>
                  <li>• <strong>Paternity:</strong> 2 weeks at £184.03/week (must take within 56 days of birth)</li>
                  <li>• <strong>Adoption:</strong> 52 weeks (same pay as maternity)</li>
                  <li>• <strong>Shared Parental:</strong> Up to 50 weeks to share between parents</li>
                  <li>• <strong>Parental Bereavement:</strong> 2 weeks for loss of a child under 18</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ssp" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Statutory Sick Pay Records</CardTitle>
                <CardDescription>Track SSP entitlement (£116.75/week for up to 28 weeks)</CardDescription>
              </div>
              <Dialog open={showSSPDialog} onOpenChange={setShowSSPDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Record Sickness</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Sickness Absence</DialogTitle>
                    <DialogDescription>Start SSP tracking for an employee</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Employee</Label>
                      <Select value={newSSP.employee_id} onValueChange={(v) => setNewSSP({ ...newSSP, employee_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>First Day of Sickness</Label>
                      <Input
                        type="date"
                        value={newSSP.absence_start_date}
                        onChange={(e) => setNewSSP({ ...newSSP, absence_start_date: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">First 3 days are waiting days (unpaid)</p>
                    </div>
                    <div>
                      <Label>Reason (optional)</Label>
                      <Textarea
                        value={newSSP.reason}
                        onChange={(e) => setNewSSP({ ...newSSP, reason: e.target.value })}
                        placeholder="Brief description..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSSPDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddSSP} disabled={!newSSP.employee_id || !newSSP.absence_start_date}>
                      Record Sickness
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days Paid</TableHead>
                    <TableHead>Total SSP</TableHead>
                    <TableHead>Fit Note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sspRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.employees?.first_name} {record.employees?.last_name}
                      </TableCell>
                      <TableCell>{format(new Date(record.absence_start_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        {record.absence_end_date ? format(new Date(record.absence_end_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>{record.days_paid}</TableCell>
                      <TableCell>£{record.total_ssp_paid.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={record.fit_note_received ? 'default' : 'secondary'}>
                          {record.fit_note_received ? 'Received' : 'Required 7+ days'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {record.status === 'active' && (
                          <Button size="sm" variant="outline" onClick={() => handleEndSSP(record.id, format(new Date(), 'yyyy-MM-dd'))}>
                            End Absence
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sspRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No SSP records.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">SSP Eligibility Rules</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Employee must earn at least £123/week (Lower Earnings Limit)</li>
                  <li>• First 3 consecutive days are waiting days (unpaid)</li>
                  <li>• £116.75/week for up to 28 weeks</li>
                  <li>• Fit note required for absences over 7 days</li>
                  <li>• Linked periods: absences within 8 weeks count as one period</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
