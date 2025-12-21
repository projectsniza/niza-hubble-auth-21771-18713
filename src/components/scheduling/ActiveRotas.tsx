import { useState, useEffect } from 'react';
import { Calendar, Users, Download, Eye, Edit, MoreHorizontal, X, Trash2, Save, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface Rota {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string | null;
  branch_id: string;
  organization_id: string;
  notes: string | null;
  created_by: string | null;
  branch?: { name: string };
}

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_duration: number | null;
  status: string | null;
  employee_id: string;
  employee?: { first_name: string; last_name: string };
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export function ActiveRotas() {
  const { user } = useAuth();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('start-date');
  const [viewRota, setViewRota] = useState<Rota | null>(null);
  const [editRota, setEditRota] = useState<Rota | null>(null);
  const [rotaShifts, setRotaShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShift, setNewShift] = useState({
    employee_id: '',
    shift_date: '',
    start_time: '09:00',
    end_time: '17:00',
    break_duration: 60
  });

  useEffect(() => {
    fetchRotas();
    fetchEmployees();
  }, []);

  const fetchRotas = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('rotas')
        .select('*, branch:branches(name)')
        .gte('end_date', today)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setRotas(data || []);
    } catch (error) {
      console.error('Error fetching rotas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('status', 'active')
      .order('first_name');
    setEmployees(data || []);
  };

  const fetchRotaShifts = async (rotaId: string) => {
    setShiftsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rota_shifts')
        .select('*, employee:employees(first_name, last_name)')
        .eq('rota_id', rotaId)
        .order('shift_date', { ascending: true });

      if (error) throw error;
      setRotaShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setShiftsLoading(false);
    }
  };

  const handleView = async (rota: Rota) => {
    setViewRota(rota);
    await fetchRotaShifts(rota.id);
  };

  const handleEdit = async (rota: Rota) => {
    setEditRota(rota);
    setNewShift({
      employee_id: '',
      shift_date: rota.start_date,
      start_time: '09:00',
      end_time: '17:00',
      break_duration: 60
    });
    await fetchRotaShifts(rota.id);
  };

  const handleUpdateRota = async () => {
    if (!editRota) return;
    try {
      const { error } = await supabase
        .from('rotas')
        .update({
          name: editRota.name,
          status: editRota.status,
          notes: editRota.notes
        })
        .eq('id', editRota.id);

      if (error) throw error;
      toast.success('Rota updated successfully');
      setEditRota(null);
      fetchRotas();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from('rota_shifts')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;
      setRotaShifts(prev => prev.filter(s => s.id !== shiftId));
      toast.success('Shift deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateShift = async (shift: Shift) => {
    try {
      const { error } = await supabase
        .from('rota_shifts')
        .update({
          start_time: shift.start_time,
          end_time: shift.end_time,
          break_duration: shift.break_duration,
          status: shift.status
        })
        .eq('id', shift.id);

      if (error) throw error;
      
      setRotaShifts(prev => prev.map(s => s.id === shift.id ? shift : s));
      setEditingShift(null);
      toast.success('Shift updated');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddShift = async () => {
    if (!editRota || !newShift.employee_id || !newShift.shift_date) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rota_shifts')
        .insert({
          rota_id: editRota.id,
          employee_id: newShift.employee_id,
          shift_date: newShift.shift_date,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          break_duration: newShift.break_duration,
          status: 'assigned'
        })
        .select('*, employee:employees(first_name, last_name)')
        .single();

      if (error) throw error;
      
      setRotaShifts(prev => [...prev, data]);
      setShowAddShift(false);
      setNewShift({
        employee_id: '',
        shift_date: editRota.start_date,
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60
      });
      toast.success('Shift added');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const calculateShiftHours = (startTime: string, endTime: string, breakDuration: number | null): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const totalMinutes = endMinutes - startMinutes - (breakDuration || 0);
    return Math.max(0, totalMinutes / 60);
  };

  const handleDownload = async (rota: Rota) => {
    const { data: shifts } = await supabase
      .from('rota_shifts')
      .select('*, employee:employees(first_name, last_name)')
      .eq('rota_id', rota.id)
      .order('shift_date', { ascending: true });

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(rota.name, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Branch: ${rota.branch?.name || 'N/A'}`, 20, 35);
    doc.text(`Period: ${format(new Date(rota.start_date), 'dd MMM yyyy')} - ${format(new Date(rota.end_date), 'dd MMM yyyy')}`, 20, 45);
    doc.text(`Status: ${rota.status || 'draft'}`, 20, 55);
    
    let yPos = 65;
    if (rota.notes) {
      doc.text(`Notes: ${rota.notes}`, 20, yPos);
      yPos += 15;
    }

    if (shifts && shifts.length > 0) {
      doc.setFontSize(14);
      doc.text('Shifts', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee', 20, yPos);
      doc.text('Date', 70, yPos);
      doc.text('Time', 110, yPos);
      doc.text('Break', 145, yPos);
      doc.text('Hours', 170, yPos);
      yPos += 7;
      
      let totalHours = 0;
      doc.setFont('helvetica', 'normal');
      shifts.forEach((shift: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const empName = shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : 'N/A';
        const hours = calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
        totalHours += hours;
        
        doc.text(empName.substring(0, 20), 20, yPos);
        doc.text(format(new Date(shift.shift_date), 'EEE dd MMM'), 70, yPos);
        doc.text(`${shift.start_time} - ${shift.end_time}`, 110, yPos);
        doc.text(`${shift.break_duration || 0}min`, 145, yPos);
        doc.text(`${hours.toFixed(2)}h`, 170, yPos);
        yPos += 6;
      });

      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Hours: ${totalHours.toFixed(2)}h`, 20, yPos);
    } else {
      doc.text('No shifts assigned', 20, yPos);
    }

    doc.save(`${rota.name.replace(/\s+/g, '_')}_rota.pdf`);
    toast.success('Rota exported');
  };

  const filteredRotas = rotas
    .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'start-date':
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        case 'start-date-old':
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  const getTotalRotaHours = (): number => {
    return rotaShifts.reduce((total, shift) => {
      return total + calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <Input 
            placeholder="Search rotas..." 
            className="max-w-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button variant="ghost" className="text-primary" onClick={() => setSearchQuery('')}>
            Clear all filters
          </Button>
        </div>
        <div className="mt-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start-date">Start date (Newest first)</SelectItem>
              <SelectItem value="start-date-old">Start date (Oldest first)</SelectItem>
              <SelectItem value="name">Rota name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Rota name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filteredRotas.length === 0 ? (
        <>
          <Card className="p-12 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-16 h-16 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">No rotas to see here yet...</h3>
                <p className="text-muted-foreground">
                  Active rotas that are currently running are shown here. Create your first rota to get started!
                </p>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Create & manage</h3>
                  <p className="text-muted-foreground text-sm">
                    Create, plan and manage rotas all in one place. Add multiple staff to shifts, edit ongoing shifts and get an up-to-date view of who's working when.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Share with employees</h3>
                  <p className="text-muted-foreground text-sm">
                    We'll automatically share published rotas with your staff so they always know when they work.
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
                <TableHead>Rota Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRotas.map(rota => (
                <TableRow key={rota.id}>
                  <TableCell className="font-medium">{rota.name}</TableCell>
                  <TableCell>{rota.branch?.name || 'N/A'}</TableCell>
                  <TableCell>{format(new Date(rota.start_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{format(new Date(rota.end_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={rota.status === 'published' ? 'default' : 'secondary'}>
                      {rota.status || 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleView(rota)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(rota)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(rota)}>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* View Rota Dialog */}
      <Dialog open={!!viewRota} onOpenChange={() => setViewRota(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewRota?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Branch</Label>
                <p className="font-medium">{viewRota?.branch?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Start Date</Label>
                <p className="font-medium">{viewRota && format(new Date(viewRota.start_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">End Date</Label>
                <p className="font-medium">{viewRota && format(new Date(viewRota.end_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Badge variant={viewRota?.status === 'published' ? 'default' : 'secondary'}>
                  {viewRota?.status || 'draft'}
                </Badge>
              </div>
            </div>
            {viewRota?.notes && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p>{viewRota.notes}</p>
              </div>
            )}

            {/* Total Hours Summary */}
            <Card className="p-4 bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Scheduled Hours</span>
                <span className="text-2xl font-bold text-primary">{getTotalRotaHours().toFixed(2)}h</span>
              </div>
            </Card>

            <div>
              <Label className="text-muted-foreground mb-2 block">Shifts</Label>
              {shiftsLoading ? (
                <div className="text-center py-4">Loading shifts...</div>
              ) : rotaShifts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No shifts assigned</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Break</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rotaShifts.map(shift => (
                      <TableRow key={shift.id}>
                        <TableCell>{shift.employee?.first_name} {shift.employee?.last_name}</TableCell>
                        <TableCell>{format(new Date(shift.shift_date), 'EEE dd MMM')}</TableCell>
                        <TableCell>{shift.start_time} - {shift.end_time}</TableCell>
                        <TableCell>{shift.break_duration || 0} min</TableCell>
                        <TableCell className="font-medium">
                          {calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration).toFixed(2)}h
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{shift.status || 'assigned'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Rota Dialog */}
      <Dialog open={!!editRota} onOpenChange={() => { setEditRota(null); setEditingShift(null); setShowAddShift(false); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rota</DialogTitle>
          </DialogHeader>
          {editRota && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rota Name</Label>
                  <Input
                    value={editRota.name}
                    onChange={(e) => setEditRota({ ...editRota, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editRota.status || 'draft'} 
                    onValueChange={(v) => setEditRota({ ...editRota, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Total Hours Summary */}
              <Card className="p-4 bg-primary/5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Scheduled Hours</span>
                  <span className="text-2xl font-bold text-primary">{getTotalRotaHours().toFixed(2)}h</span>
                </div>
              </Card>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Shifts</Label>
                  <Button size="sm" variant="outline" onClick={() => setShowAddShift(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Shift
                  </Button>
                </div>

                {/* Add Shift Form */}
                {showAddShift && (
                  <Card className="p-4 mb-4 border-dashed">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Employee</Label>
                        <Select value={newShift.employee_id} onValueChange={(v) => setNewShift({ ...newShift, employee_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={newShift.shift_date}
                          onChange={(e) => setNewShift({ ...newShift, shift_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input
                          type="time"
                          value={newShift.start_time}
                          onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Input
                          type="time"
                          value={newShift.end_time}
                          onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button size="sm" onClick={handleAddShift}>Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddShift(false)}>Cancel</Button>
                      </div>
                    </div>
                  </Card>
                )}

                {shiftsLoading ? (
                  <div className="text-center py-4">Loading shifts...</div>
                ) : rotaShifts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No shifts assigned</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Break (min)</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rotaShifts.map(shift => (
                        <TableRow key={shift.id}>
                          <TableCell>{shift.employee?.first_name} {shift.employee?.last_name}</TableCell>
                          <TableCell>{format(new Date(shift.shift_date), 'EEE dd MMM')}</TableCell>
                          {editingShift?.id === shift.id ? (
                            <>
                              <TableCell>
                                <Input
                                  type="time"
                                  value={editingShift.start_time}
                                  onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                                  className="w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="time"
                                  value={editingShift.end_time}
                                  onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                                  className="w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={editingShift.break_duration || 0}
                                  onChange={(e) => setEditingShift({ ...editingShift, break_duration: parseInt(e.target.value) || 0 })}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {calculateShiftHours(editingShift.start_time, editingShift.end_time, editingShift.break_duration).toFixed(2)}h
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={editingShift.status || 'assigned'} 
                                  onValueChange={(v) => setEditingShift({ ...editingShift, status: v })}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="assigned">Assigned</SelectItem>
                                    <SelectItem value="confirmed">Confirmed</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="declined">Declined</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleUpdateShift(editingShift)}
                                  >
                                    <Save className="h-4 w-4 text-primary" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setEditingShift(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{shift.start_time}</TableCell>
                              <TableCell>{shift.end_time}</TableCell>
                              <TableCell>{shift.break_duration || 0}</TableCell>
                              <TableCell className="font-medium">
                                {calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration).toFixed(2)}h
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{shift.status || 'assigned'}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setEditingShift(shift)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleDeleteShift(shift.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditRota(null); setEditingShift(null); }}>Cancel</Button>
                <Button onClick={handleUpdateRota}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
