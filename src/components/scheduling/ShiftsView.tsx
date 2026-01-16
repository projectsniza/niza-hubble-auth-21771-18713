import { useState, useEffect } from 'react';
import { Calendar, Users, Monitor, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_duration: number | null;
  status: string | null;
  notes: string | null;
  employee_response: string | null;
  employee_id: string | null;
  rota_id: string | null;
  employee?: { first_name: string; last_name: string };
  rota?: { name: string };
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  branch_id: string;
}

interface Rota {
  id: string;
  name: string;
  branch_id: string;
}

export function ShiftsView() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    start: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
    end: format(endOfWeek(new Date()), 'yyyy-MM-dd')
  });

  const [shiftForm, setShiftForm] = useState({
    employee_id: '',
    rota_id: '',
    shift_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '17:00',
    break_duration: 60,
    notes: ''
  });

  useEffect(() => {
    fetchShifts();
    fetchEmployees();
    fetchRotas();
  }, [dateRange]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rota_shifts')
        .select(`
          *,
          employee:employees(first_name, last_name),
          rota:rotas(name)
        `)
        .gte('shift_date', dateRange.start)
        .lte('shift_date', dateRange.end)
        .order('shift_date', { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, branch_id')
      .eq('status', 'active')
      .order('first_name');
    setEmployees(data || []);
  };

  const fetchRotas = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('rotas')
      .select('id, name, branch_id')
      .gte('end_date', today)
      .order('name');
    setRotas(data || []);
  };

  const handleCreateShift = async () => {
    if (!shiftForm.employee_id || !shiftForm.rota_id || !shiftForm.shift_date) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('rota_shifts')
        .insert({
          employee_id: shiftForm.employee_id,
          rota_id: shiftForm.rota_id,
          shift_date: shiftForm.shift_date,
          start_time: shiftForm.start_time,
          end_time: shiftForm.end_time,
          break_duration: shiftForm.break_duration,
          notes: shiftForm.notes || null,
          status: 'assigned'
        });

      if (error) throw error;

      toast.success('Shift created successfully');
      setShowCreateDialog(false);
      setShiftForm({
        employee_id: '',
        rota_id: '',
        shift_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60,
        notes: ''
      });
      fetchShifts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredShifts = shifts.filter(s => {
    const employeeName = `${s.employee?.first_name || ''} ${s.employee?.last_name || ''}`.toLowerCase();
    const rotaName = s.rota?.name?.toLowerCase() || '';
    return employeeName.includes(searchQuery.toLowerCase()) || rotaName.includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shifts</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 items-center">
            <Label>From</Label>
            <Input 
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Label>To</Label>
            <Input 
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-40"
            />
          </div>
          <Input 
            placeholder="Search by name or rota..." 
            className="max-w-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button variant="ghost" className="text-primary" onClick={() => {
            setSearchQuery('');
            setDateRange({
              start: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
              end: format(endOfWeek(new Date()), 'yyyy-MM-dd')
            });
          }}>
            Clear filters
          </Button>
        </div>
      </Card>

      {filteredShifts.length === 0 ? (
        <>
          <Card className="p-12 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-center mb-6">
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-16 h-16 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No shifts to see here yet...</h3>
              <p className="text-muted-foreground mb-4">
                All your upcoming shifts will appear here once you create them.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Shift
              </Button>
            </div>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Create & manage</h3>
                  <p className="text-muted-foreground text-sm">
                    Create, plan and manage shifts all in one place.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Assign employees</h3>
                  <p className="text-muted-foreground text-sm">
                    Easily assign shifts to your team members.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Monitor className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Track everything</h3>
                  <p className="text-muted-foreground text-sm">
                    Keep track of all shifts in one place.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShifts.map(shift => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">
                    {shift.employee?.first_name} {shift.employee?.last_name}
                  </TableCell>
                  <TableCell>{shift.rota?.name || 'N/A'}</TableCell>
                  <TableCell>{format(new Date(shift.shift_date), 'EEE dd MMM')}</TableCell>
                  <TableCell>{shift.start_time}</TableCell>
                  <TableCell>{shift.end_time}</TableCell>
                  <TableCell>{shift.break_duration ? `${shift.break_duration} min` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={
                      shift.status === 'completed' ? 'default' : 
                      shift.status === 'declined' ? 'destructive' : 
                      'secondary'
                    }>
                      {shift.status || 'assigned'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Shift Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rota *</Label>
              <Select value={shiftForm.rota_id} onValueChange={(v) => setShiftForm({ ...shiftForm, rota_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rota" />
                </SelectTrigger>
                <SelectContent>
                  {rotas.map(rota => (
                    <SelectItem key={rota.id} value={rota.id}>{rota.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={shiftForm.employee_id} onValueChange={(v) => setShiftForm({ ...shiftForm, employee_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={shiftForm.shift_date}
                onChange={(e) => setShiftForm({ ...shiftForm, shift_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={shiftForm.start_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input
                  type="time"
                  value={shiftForm.end_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Break Duration (minutes)</Label>
              <Input
                type="number"
                value={shiftForm.break_duration}
                onChange={(e) => setShiftForm({ ...shiftForm, break_duration: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={shiftForm.notes}
                onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateShift}>Create Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}