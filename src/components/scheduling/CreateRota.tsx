import { useState, useEffect } from 'react';
import { Calendar, Copy, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

type CreateMode = 'new' | 'copy' | null;

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  branch_id: string;
}

interface Shift {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  notes: string;
}

export function CreateRota() {
  const { user } = useAuth();
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingRotas, setExistingRotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [rotaForm, setRotaForm] = useState({
    name: '',
    branchId: '',
    duration: '7',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    copyFromId: ''
  });

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [branchesRes, employeesRes, rotasRes] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('employees').select('id, first_name, last_name, branch_id').eq('status', 'active'),
      supabase.from('rotas').select('id, name, start_date, end_date, branch_id').order('created_at', { ascending: false }).limit(20)
    ]);

    setBranches(branchesRes.data || []);
    setEmployees(employeesRes.data || []);
    setExistingRotas(rotasRes.data || []);
  };

  const filteredEmployees = rotaForm.branchId 
    ? employees.filter(e => e.branch_id === rotaForm.branchId)
    : employees;

  const getDatesArray = () => {
    const dates = [];
    const startDate = new Date(rotaForm.startDate);
    for (let i = 0; i < parseInt(rotaForm.duration); i++) {
      dates.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
    }
    return dates;
  };

  const handleEmployeeToggle = (empId: string) => {
    if (selectedEmployees.includes(empId)) {
      // Remove employee and their shifts
      setSelectedEmployees(prev => prev.filter(id => id !== empId));
      setShifts(prev => prev.filter(s => s.employeeId !== empId));
    } else {
      // Add employee and auto-create shifts for all dates
      setSelectedEmployees(prev => [...prev, empId]);
      const dates = getDatesArray();
      const newShifts = dates.map(date => ({
        employeeId: empId,
        date,
        startTime: '09:00',
        endTime: '17:00',
        breakDuration: 60,
        notes: ''
      }));
      setShifts(prev => [...prev, ...newShifts]);
    }
  };

  const addShift = (employeeId: string, date: string) => {
    setShifts(prev => [...prev, {
      employeeId,
      date,
      startTime: '09:00',
      endTime: '17:00',
      breakDuration: 60,
      notes: ''
    }]);
  };

  const removeShift = (index: number) => {
    setShifts(prev => prev.filter((_, i) => i !== index));
  };

  const updateShift = (index: number, field: keyof Shift, value: string | number) => {
    setShifts(prev => prev.map((shift, i) => 
      i === index ? { ...shift, [field]: value } : shift
    ));
  };

  const handleCreateRota = async () => {
    if (!rotaForm.name || !rotaForm.branchId || !rotaForm.startDate) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      // Get organization_id from branch
      const branch = branches.find(b => b.id === rotaForm.branchId);
      
      const endDate = format(
        addDays(new Date(rotaForm.startDate), parseInt(rotaForm.duration) - 1), 
        'yyyy-MM-dd'
      );

      // Create rota
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .insert({
          name: rotaForm.name,
          branch_id: rotaForm.branchId,
          organization_id: branch?.organization_id,
          start_date: rotaForm.startDate,
          end_date: endDate,
          notes: rotaForm.notes || null,
          status: 'draft',
          created_by: user?.id
        })
        .select()
        .single();

      if (rotaError) throw rotaError;

      // Create shifts if any
      if (shifts.length > 0) {
        const shiftsToInsert = shifts.map(shift => ({
          rota_id: rotaData.id,
          employee_id: shift.employeeId,
          shift_date: shift.date,
          start_time: shift.startTime,
          end_time: shift.endTime,
          break_duration: shift.breakDuration,
          notes: shift.notes || null,
          status: 'assigned'
        }));

        const { error: shiftsError } = await supabase
          .from('rota_shifts')
          .insert(shiftsToInsert);

        if (shiftsError) throw shiftsError;
      }

      toast.success('Rota created successfully');
      setCreateMode(null);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create rota');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRotaForm({
      name: '',
      branchId: '',
      duration: '7',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      copyFromId: ''
    });
    setShifts([]);
    setSelectedEmployees([]);
  };


  if (!createMode) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Create a rota</h2>
          <p className="text-muted-foreground">
            Create and manage staggered shift patterns to support your back to work plans and manage shift rotas for employees who regularly change their hours of work.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">What would you like to do?</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card
              className="p-6 cursor-pointer hover:border-primary transition-all"
              onClick={() => setCreateMode('new')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Create a new rota</h3>
                  <p className="text-muted-foreground text-sm">
                    Create a new bespoke rota for your business. Choose your shift times, assign employees and add notes before publishing.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:border-primary transition-all"
              onClick={() => setCreateMode('copy')}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Copy className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Copy an existing rota</h3>
                  <p className="text-muted-foreground text-sm">
                    Choose to copy a previous rota and pull through existing shifts and rota notes. Then, select a new start date and make any changes you need before publishing.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {createMode === 'new' ? 'Create a new rota' : 'Copy an existing rota'}
        </h2>
        <Button variant="outline" onClick={() => { setCreateMode(null); resetForm(); }}>
          Back
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        {createMode === 'copy' && (
          <div className="space-y-2">
            <Label>Select rota to copy from *</Label>
            <Select value={rotaForm.copyFromId} onValueChange={(v) => setRotaForm({ ...rotaForm, copyFromId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a rota" />
              </SelectTrigger>
              <SelectContent>
                {existingRotas.map(rota => (
                  <SelectItem key={rota.id} value={rota.id}>
                    {rota.name} ({format(new Date(rota.start_date), 'dd MMM')} - {format(new Date(rota.end_date), 'dd MMM yyyy')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="rota-name">
              Rota name <span className="text-destructive">*</span>
            </Label>
            <Input 
              id="rota-name" 
              placeholder="Enter a new rota name"
              value={rotaForm.name}
              onChange={(e) => setRotaForm({ ...rotaForm, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">
              Branch <span className="text-destructive">*</span>
            </Label>
            <Select value={rotaForm.branchId} onValueChange={(v) => setRotaForm({ ...rotaForm, branchId: v })}>
              <SelectTrigger id="branch">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rota-duration" className="flex items-center gap-2">
              Rota duration <span className="text-destructive">*</span>
            </Label>
            <Select value={rotaForm.duration} onValueChange={(v) => setRotaForm({ ...rotaForm, duration: v })}>
              <SelectTrigger id="rota-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="21">21 days</SelectItem>
                <SelectItem value="28">28 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Rota start date *</Label>
            <Input 
              id="start-date" 
              type="date"
              value={rotaForm.startDate}
              onChange={(e) => setRotaForm({ ...rotaForm, startDate: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea 
            placeholder="Add any notes for this rota..."
            value={rotaForm.notes}
            onChange={(e) => setRotaForm({ ...rotaForm, notes: e.target.value })}
          />
        </div>

        {/* Employee Selection */}
        {rotaForm.branchId && (
          <div className="space-y-4">
            <Label>Select Employees</Label>
            <div className="flex flex-wrap gap-2">
              {filteredEmployees.map(emp => (
                <Badge 
                  key={emp.id}
                  variant={selectedEmployees.includes(emp.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleEmployeeToggle(emp.id)}
                >
                  {emp.first_name} {emp.last_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Shift Assignment (Table View) */}
        {selectedEmployees.length > 0 && (
          <div className="space-y-4">
            <Label>Assign Shifts</Label>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Employee</th>
                    {getDatesArray().map(date => (
                      <th key={date} className="border p-2 text-center text-sm">
                        {format(new Date(date), 'EEE dd')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployees.map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    return (
                      <tr key={empId}>
                        <td className="border p-2 font-medium">
                          {emp?.first_name} {emp?.last_name}
                        </td>
                        {getDatesArray().map(date => {
                          const shift = shifts.find(s => s.employeeId === empId && s.date === date);
                          return (
                            <td key={date} className="border p-1 text-center">
                              {shift ? (
                                <div className="bg-primary/10 rounded p-1 text-xs">
                                  {shift.startTime}-{shift.endTime}
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-4 w-4 p-0 ml-1"
                                    onClick={() => removeShift(shifts.indexOf(shift))}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => addShift(empId, date)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <Button variant="outline" onClick={() => { setCreateMode(null); resetForm(); }}>
            Cancel
          </Button>
          <Button onClick={handleCreateRota} disabled={loading}>
            {loading ? 'Creating...' : 'Create Rota'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
