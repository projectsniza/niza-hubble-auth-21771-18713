import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, DollarSign, Users, Clock, Plus, Settings, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Payroll() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [salaryForm, setSalaryForm] = useState({
    basicSalary: '',
    hra: '',
    travelAllowance: '',
    otherAllowances: '',
    salaryAdvance: '',
    lateFine: '',
    unpaidLeaveDays: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesRes, salaryRes, payrollRes] = await Promise.all([
        supabase.from('employees').select('*').eq('status', 'active'),
        supabase.from('salary_structures').select('*'),
        supabase.from('payroll_records').select('*').order('month', { ascending: false })
      ]);

      setEmployees(employeesRes.data || []);
      setSalaryStructures(salaryRes.data || []);
      setPayrollRecords(payrollRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSalary = (employee: any) => {
    const existing = salaryStructures.find(s => s.employee_id === employee.id);
    setSelectedEmployee(employee);
    setSalaryForm({
      basicSalary: existing?.basic_salary?.toString() || '',
      hra: existing?.hra?.toString() || '',
      travelAllowance: existing?.travel_allowance?.toString() || '',
      otherAllowances: existing?.other_allowances?.toString() || '',
      salaryAdvance: existing?.salary_advance?.toString() || '',
      lateFine: existing?.late_fine?.toString() || '',
      unpaidLeaveDays: existing?.unpaid_leave_days?.toString() || ''
    });
    setShowEditSalary(true);
  };

  const handleSaveSalary = async () => {
    if (!selectedEmployee) return;

    try {
      const existing = salaryStructures.find(s => s.employee_id === selectedEmployee.id);
      
      const data = {
        employee_id: selectedEmployee.id,
        basic_salary: parseFloat(salaryForm.basicSalary) || 0,
        hra: parseFloat(salaryForm.hra) || 0,
        travel_allowance: parseFloat(salaryForm.travelAllowance) || 0,
        other_allowances: parseFloat(salaryForm.otherAllowances) || 0,
        salary_advance: parseFloat(salaryForm.salaryAdvance) || 0,
        late_fine: parseFloat(salaryForm.lateFine) || 0,
        unpaid_leave_days: parseInt(salaryForm.unpaidLeaveDays) || 0,
        created_by: user?.id
      };

      if (existing) {
        await supabase.from('salary_structures').update(data).eq('id', existing.id);
      } else {
        await supabase.from('salary_structures').insert(data);
      }

      toast.success('Salary structure saved');
      setShowEditSalary(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save salary');
    }
  };

  const handleGeneratePayroll = async () => {
    try {
      const monthDate = new Date(selectedMonth + '-01');
      
      for (const employee of employees) {
        const salary = salaryStructures.find(s => s.employee_id === employee.id);
        if (!salary) continue;

        const totalAllowances = (salary.hra || 0) + (salary.travel_allowance || 0) + (salary.other_allowances || 0);
        const totalDeductions = (salary.salary_advance || 0) + (salary.late_fine || 0);
        const netSalary = (salary.basic_salary || 0) + totalAllowances - totalDeductions;

        await supabase.from('payroll_records').insert({
          employee_id: employee.id,
          month: monthDate.toISOString().split('T')[0],
          basic_salary: salary.basic_salary,
          total_allowances: totalAllowances,
          total_deductions: totalDeductions,
          net_salary: netSalary,
          generated_by: user?.id
        });
      }

      toast.success('Payroll generated successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate payroll');
    }
  };

  const calculateNetSalary = (salary: any) => {
    if (!salary) return 0;
    const totalAllowances = (salary.hra || 0) + (salary.travel_allowance || 0) + (salary.other_allowances || 0);
    const totalDeductions = (salary.salary_advance || 0) + (salary.late_fine || 0);
    return (salary.basic_salary || 0) + totalAllowances - totalDeductions;
  };

  const totalMonthlyPayroll = salaryStructures.reduce((sum, s) => sum + calculateNetSalary(s), 0);
  const payslipsGenerated = payrollRecords.filter(p => 
    p.month === selectedMonth + '-01'
  ).length;

  // Employee View - Their own payslips
  if (user?.role === 'employee') {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">My Payslips</h1>
        
        {payrollRecords.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No payslips available</h3>
                <p className="text-muted-foreground">Your payslips will appear here once processed</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {payrollRecords.map(record => (
              <Card key={record.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{format(new Date(record.month), 'MMMM yyyy')}</h3>
                    <p className="text-sm text-muted-foreground">Net Salary: £{record.net_salary?.toFixed(2)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Admin/HR View
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Payroll Management</h2>
          <p className="text-muted-foreground mt-1">Process and manage employee payroll</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const value = format(date, 'yyyy-MM');
                return (
                  <SelectItem key={value} value={value}>
                    {format(date, 'MMMM yyyy')}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={handleGeneratePayroll}>
            <DollarSign className="h-4 w-4" />
            Generate Payroll
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">£{totalMonthlyPayroll.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Monthly Payroll</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{employees.length}</p>
              <p className="text-xs text-muted-foreground">Employees</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{payslipsGenerated}</p>
              <p className="text-xs text-muted-foreground">Payslips Generated</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{salaryStructures.length}</p>
              <p className="text-xs text-muted-foreground">Salary Profiles</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search employees..." 
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="setup">Salary Setup</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Payroll</TabsTrigger>
          <TabsTrigger value="history">Payroll History</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.filter(e => 
                  `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
                ).map(employee => {
                  const salary = salaryStructures.find(s => s.employee_id === employee.id);
                  const totalAllowances = salary ? (salary.hra || 0) + (salary.travel_allowance || 0) + (salary.other_allowances || 0) : 0;
                  const totalDeductions = salary ? (salary.salary_advance || 0) + (salary.late_fine || 0) : 0;
                  const netSalary = calculateNetSalary(salary);
                  
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-muted-foreground">{employee.job_title}</p>
                        </div>
                      </TableCell>
                      <TableCell>£{salary?.basic_salary?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>£{totalAllowances.toFixed(2)}</TableCell>
                      <TableCell>£{totalDeductions.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">£{netSalary.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleEditSalary(employee)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-6">
          {payrollRecords.filter(p => p.month === selectedMonth + '-01').length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No payroll for {format(new Date(selectedMonth), 'MMMM yyyy')}</h3>
                  <p className="text-muted-foreground mb-4">Generate payroll for this month</p>
                </div>
                <Button onClick={handleGeneratePayroll} className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Generate Payroll
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Salary Slip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.filter(p => p.month === selectedMonth + '-01').map(record => {
                    const employee = employees.find(e => e.id === record.employee_id);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee?.first_name} {employee?.last_name}</p>
                            <p className="text-sm text-muted-foreground">{employee?.job_title}</p>
                          </div>
                        </TableCell>
                        <TableCell>£{record.basic_salary?.toFixed(2)}</TableCell>
                        <TableCell>£{record.total_allowances?.toFixed(2)}</TableCell>
                        <TableCell>£{record.total_deductions?.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">£{record.net_salary?.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="h-4 w-4" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Total Payroll</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(new Set(payrollRecords.map(p => p.month))).map(month => {
                  const monthRecords = payrollRecords.filter(p => p.month === month);
                  const total = monthRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);
                  return (
                    <TableRow key={month}>
                      <TableCell>{format(new Date(month), 'MMMM yyyy')}</TableCell>
                      <TableCell>{monthRecords.length}</TableCell>
                      <TableCell className="font-semibold">£{total.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(monthRecords[0]?.generated_at || month), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Salary Dialog */}
      <Dialog open={showEditSalary} onOpenChange={setShowEditSalary}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit Salary - {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Basic Salary (£)</Label>
              <Input 
                type="number" 
                value={salaryForm.basicSalary}
                onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>HRA (£)</Label>
                <Input 
                  type="number" 
                  value={salaryForm.hra}
                  onChange={(e) => setSalaryForm({ ...salaryForm, hra: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Travel Allowance (£)</Label>
                <Input 
                  type="number" 
                  value={salaryForm.travelAllowance}
                  onChange={(e) => setSalaryForm({ ...salaryForm, travelAllowance: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Other Allowances (£)</Label>
                <Input 
                  type="number" 
                  value={salaryForm.otherAllowances}
                  onChange={(e) => setSalaryForm({ ...salaryForm, otherAllowances: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Advance (£)</Label>
                <Input 
                  type="number" 
                  value={salaryForm.salaryAdvance}
                  onChange={(e) => setSalaryForm({ ...salaryForm, salaryAdvance: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Late Fine (£)</Label>
                <Input 
                  type="number" 
                  value={salaryForm.lateFine}
                  onChange={(e) => setSalaryForm({ ...salaryForm, lateFine: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unpaid Leave Days</Label>
                <Input 
                  type="number" 
                  value={salaryForm.unpaidLeaveDays}
                  onChange={(e) => setSalaryForm({ ...salaryForm, unpaidLeaveDays: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleSaveSalary} className="w-full">Save Salary Structure</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
