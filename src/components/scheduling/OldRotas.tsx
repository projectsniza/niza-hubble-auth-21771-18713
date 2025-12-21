import { useState, useEffect } from 'react';
import { Calendar, Download, Eye, FileText, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface Rota {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string | null;
  notes: string | null;
  branch_id: string;
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

interface EmployeeHoursSummary {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  totalShifts: number;
}

export function OldRotas() {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('start-date');
  const [viewRota, setViewRota] = useState<Rota | null>(null);
  const [rotaShifts, setRotaShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [reportDateRange, setReportDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchRotas();
  }, []);

  const fetchRotas = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('rotas')
        .select('*, branch:branches(name)')
        .lt('end_date', today)
        .order('end_date', { ascending: false });

      if (error) throw error;
      setRotas(data || []);
    } catch (error) {
      console.error('Error fetching old rotas:', error);
    } finally {
      setLoading(false);
    }
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

  const calculateShiftHours = (startTime: string, endTime: string, breakDuration: number | null): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const totalMinutes = endMinutes - startMinutes - (breakDuration || 0);
    return Math.max(0, totalMinutes / 60);
  };

  const getTotalRotaHours = (): number => {
    return rotaShifts.reduce((total, shift) => {
      return total + calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
    }, 0);
  };

  const getEmployeeHoursSummary = (): EmployeeHoursSummary[] => {
    const summaryMap = new Map<string, EmployeeHoursSummary>();
    
    rotaShifts.forEach(shift => {
      const hours = calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
      const existing = summaryMap.get(shift.employee_id);
      
      if (existing) {
        existing.totalHours += hours;
        existing.totalShifts += 1;
      } else {
        summaryMap.set(shift.employee_id, {
          employeeId: shift.employee_id,
          employeeName: shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : 'Unknown',
          totalHours: hours,
          totalShifts: 1
        });
      }
    });

    return Array.from(summaryMap.values()).sort((a, b) => b.totalHours - a.totalHours);
  };

  const handleDownloadRotaReport = async (rota: Rota) => {
    const { data: shifts } = await supabase
      .from('rota_shifts')
      .select('*, employee:employees(first_name, last_name)')
      .eq('rota_id', rota.id)
      .order('shift_date', { ascending: true });

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Rota Report', 20, 20);
    
    doc.setFontSize(14);
    doc.text(rota.name, 20, 32);
    
    doc.setFontSize(11);
    doc.text(`Branch: ${rota.branch?.name || 'N/A'}`, 20, 42);
    doc.text(`Period: ${format(new Date(rota.start_date), 'dd MMM yyyy')} - ${format(new Date(rota.end_date), 'dd MMM yyyy')}`, 20, 50);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 20, 58);
    
    let yPos = 70;

    if (shifts && shifts.length > 0) {
      // Calculate employee summary
      const employeeSummary = new Map<string, { name: string; hours: number; shifts: number }>();
      let totalHours = 0;

      shifts.forEach((shift: any) => {
        const hours = calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
        totalHours += hours;
        const empId = shift.employee_id;
        const empName = shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : 'Unknown';
        
        if (employeeSummary.has(empId)) {
          const existing = employeeSummary.get(empId)!;
          existing.hours += hours;
          existing.shifts += 1;
        } else {
          employeeSummary.set(empId, { name: empName, hours, shifts: 1 });
        }
      });

      // Summary Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Shifts: ${shifts.length}`, 20, yPos);
      yPos += 7;
      doc.text(`Total Hours: ${totalHours.toFixed(2)}h`, 20, yPos);
      yPos += 7;
      doc.text(`Employees: ${employeeSummary.size}`, 20, yPos);
      yPos += 15;

      // Employee Hours Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Hours by Employee', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee', 20, yPos);
      doc.text('Shifts', 100, yPos);
      doc.text('Total Hours', 140, yPos);
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      Array.from(employeeSummary.values())
        .sort((a, b) => b.hours - a.hours)
        .forEach(emp => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(emp.name, 20, yPos);
          doc.text(emp.shifts.toString(), 100, yPos);
          doc.text(`${emp.hours.toFixed(2)}h`, 140, yPos);
          yPos += 6;
        });

      yPos += 10;

      // Detailed Shifts
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Shift Details', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee', 20, yPos);
      doc.text('Date', 65, yPos);
      doc.text('Time', 100, yPos);
      doc.text('Break', 135, yPos);
      doc.text('Hours', 160, yPos);
      doc.text('Status', 180, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      shifts.forEach((shift: any) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        const empName = shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : 'N/A';
        const hours = calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
        
        doc.text(empName.substring(0, 18), 20, yPos);
        doc.text(format(new Date(shift.shift_date), 'dd MMM'), 65, yPos);
        doc.text(`${shift.start_time}-${shift.end_time}`, 100, yPos);
        doc.text(`${shift.break_duration || 0}m`, 135, yPos);
        doc.text(`${hours.toFixed(2)}h`, 160, yPos);
        doc.text(shift.status || 'assigned', 180, yPos);
        yPos += 5;
      });
    } else {
      doc.text('No shifts found for this rota.', 20, yPos);
    }

    doc.save(`${rota.name.replace(/\s+/g, '_')}_report.pdf`);
    toast.success('Report downloaded');
  };

  const handleDownloadPeriodReport = async () => {
    // Fetch all shifts in the date range
    const { data: shifts, error } = await supabase
      .from('rota_shifts')
      .select('*, employee:employees(first_name, last_name), rota:rotas(name, branch:branches(name))')
      .gte('shift_date', reportDateRange.start)
      .lte('shift_date', reportDateRange.end)
      .order('shift_date', { ascending: true });

    if (error) {
      toast.error('Failed to fetch data');
      return;
    }

    if (!shifts || shifts.length === 0) {
      toast.error('No shifts found in this period');
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Payroll Hours Report', 20, 20);
    
    doc.setFontSize(11);
    doc.text(`Period: ${format(new Date(reportDateRange.start), 'dd MMM yyyy')} - ${format(new Date(reportDateRange.end), 'dd MMM yyyy')}`, 20, 32);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 20, 40);
    
    let yPos = 55;

    // Calculate employee summary
    const employeeSummary = new Map<string, { name: string; hours: number; shifts: number }>();
    let totalHours = 0;

    shifts.forEach((shift: any) => {
      const hours = calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration);
      totalHours += hours;
      const empId = shift.employee_id;
      const empName = shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : 'Unknown';
      
      if (employeeSummary.has(empId)) {
        const existing = employeeSummary.get(empId)!;
        existing.hours += hours;
        existing.shifts += 1;
      } else {
        employeeSummary.set(empId, { name: empName, hours, shifts: 1 });
      }
    });

    // Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Shifts: ${shifts.length}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Hours: ${totalHours.toFixed(2)}h`, 20, yPos);
    yPos += 7;
    doc.text(`Employees: ${employeeSummary.size}`, 20, yPos);
    yPos += 15;

    // Employee Hours Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Hours by Employee', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee', 20, yPos);
    doc.text('Total Shifts', 90, yPos);
    doc.text('Total Hours', 130, yPos);
    doc.text('Avg Hours/Shift', 165, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    Array.from(employeeSummary.values())
      .sort((a, b) => b.hours - a.hours)
      .forEach(emp => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(emp.name, 20, yPos);
        doc.text(emp.shifts.toString(), 90, yPos);
        doc.text(`${emp.hours.toFixed(2)}h`, 130, yPos);
        doc.text(`${(emp.hours / emp.shifts).toFixed(2)}h`, 165, yPos);
        yPos += 6;
      });

    doc.save(`payroll_report_${reportDateRange.start}_to_${reportDateRange.end}.pdf`);
    toast.success('Payroll report downloaded');
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Old Rotas</h2>
          <p className="text-muted-foreground">Completed rotas for payroll and reporting.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input 
              placeholder="Search rotas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
        <Card className="p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-16 h-16 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">No rotas to see here yet...</h3>
            <p className="text-muted-foreground mb-4">
              Old rotas that have finished will appear here for your reference.
            </p>
          </div>
        </Card>
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
                    <Badge variant="secondary">Completed</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleView(rota)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadRotaReport(rota)}>
                        <Download className="h-4 w-4 mr-1" />
                        Report
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Payroll Report Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Payroll Hours Report</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Generate a comprehensive report of all hours worked across rotas for a specific period. 
              Perfect for payroll processing and oversight.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-sm">From</Label>
                <Input 
                  type="date"
                  value={reportDateRange.start}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, start: e.target.value })}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">To</Label>
                <Input 
                  type="date"
                  value={reportDateRange.end}
                  onChange={(e) => setReportDateRange({ ...reportDateRange, end: e.target.value })}
                  className="w-40"
                />
              </div>
            </div>
          </div>
          <Button onClick={handleDownloadPeriodReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
        </div>
      </Card>

      {/* View Rota Dialog */}
      <Dialog open={!!viewRota} onOpenChange={() => setViewRota(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {viewRota?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Rota Details */}
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
                <Badge variant="secondary">Completed</Badge>
              </div>
            </div>

            {/* Hours Summary */}
            <Card className="p-4 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-sm">Total Hours Worked</span>
                  <p className="text-3xl font-bold text-primary">{getTotalRotaHours().toFixed(2)}h</p>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-sm">Total Shifts</span>
                  <p className="text-2xl font-bold">{rotaShifts.length}</p>
                </div>
              </div>
            </Card>

            {/* Employee Summary */}
            {rotaShifts.length > 0 && (
              <div>
                <Label className="text-muted-foreground mb-2 block">Hours by Employee</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {getEmployeeHoursSummary().map(emp => (
                    <Card key={emp.employeeId} className="p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{emp.employeeName}</p>
                          <p className="text-sm text-muted-foreground">{emp.totalShifts} shifts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{emp.totalHours.toFixed(2)}h</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Shifts */}
            <div>
              <Label className="text-muted-foreground mb-2 block">All Shifts</Label>
              {shiftsLoading ? (
                <div className="text-center py-4">Loading shifts...</div>
              ) : rotaShifts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No shifts found</p>
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
                        <TableCell className="font-medium">
                          {shift.employee?.first_name} {shift.employee?.last_name}
                        </TableCell>
                        <TableCell>{format(new Date(shift.shift_date), 'EEE dd MMM')}</TableCell>
                        <TableCell>{shift.start_time} - {shift.end_time}</TableCell>
                        <TableCell>{shift.break_duration || 0} min</TableCell>
                        <TableCell className="font-bold text-primary">
                          {calculateShiftHours(shift.start_time, shift.end_time, shift.break_duration).toFixed(2)}h
                        </TableCell>
                        <TableCell>
                          <Badge variant={shift.status === 'completed' ? 'default' : 'secondary'}>
                            {shift.status || 'completed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Download Button */}
            <div className="flex justify-end">
              <Button onClick={() => viewRota && handleDownloadRotaReport(viewRota)}>
                <Download className="mr-2 h-4 w-4" />
                Download Full Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
