import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, DollarSign, Users, Clock, Settings, Search, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';

const loadLogoAsBase64 = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = nizaLogo;
  });
};

const generatePayslipPDF = async (
  record: any, 
  employee: any, 
  salary: any
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [0, 87, 217];
  const darkColor: [number, number, number] = [30, 41, 59];
  const grayColor: [number, number, number] = [100, 116, 139];
  const lightGray: [number, number, number] = [241, 245, 249];
  
  // Load and add logo
  try {
    const logoBase64 = await loadLogoAsBase64();
    doc.addImage(logoBase64, 'PNG', 15, 10, 45, 15);
  } catch (error) {
    console.error('Failed to load logo:', error);
  }
  
  // Header - Company Info (right side)
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text('Niza Group', pageWidth - 15, 15, { align: 'right' });
  doc.text('United Kingdom', pageWidth - 15, 21, { align: 'right' });
  
  // Title
  doc.setFontSize(22);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', pageWidth / 2, 45, { align: 'center' });
  
  // Month/Period
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'normal');
  const monthYear = format(new Date(record.month), 'MMMM yyyy');
  doc.text(`Pay Period: ${monthYear}`, pageWidth / 2, 53, { align: 'center' });
  
  // Divider line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(15, 60, pageWidth - 15, 60);
  
  // Employee Details Section
  let y = 70;
  
  // Employee info box
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'F');
  
  doc.setFontSize(11);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details', 20, y + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  
  // Left column
  doc.text('Name:', 20, y + 20);
  doc.text('Job Title:', 20, y + 28);
  
  doc.setTextColor(...darkColor);
  doc.text(`${employee?.first_name || ''} ${employee?.last_name || ''}`, 55, y + 20);
  doc.text(employee?.job_title || 'N/A', 55, y + 28);
  
  // Right column
  doc.setTextColor(...grayColor);
  doc.text('Employee ID:', pageWidth / 2 + 10, y + 20);
  doc.text('Department:', pageWidth / 2 + 10, y + 28);
  
  doc.setTextColor(...darkColor);
  doc.text(employee?.id?.slice(0, 8) || 'N/A', pageWidth / 2 + 50, y + 20);
  doc.text(employee?.department || 'N/A', pageWidth / 2 + 50, y + 28);
  
  y += 45;
  
  // Earnings Section
  doc.setFillColor(...primaryColor);
  doc.roundedRect(15, y, (pageWidth - 35) / 2, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('EARNINGS', 20, y + 5.5);
  
  // Deductions Section Header
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(pageWidth / 2 + 2.5, y, (pageWidth - 35) / 2, 8, 2, 2, 'F');
  doc.text('DEDUCTIONS', pageWidth / 2 + 7.5, y + 5.5);
  
  y += 15;
  
  // Earnings details
  const basicSalary = record.basic_salary || 0;
  const hra = salary?.hra || 0;
  const travel = salary?.travel_allowance || 0;
  const other = salary?.other_allowances || 0;
  const totalEarnings = basicSalary + hra + travel + other;
  
  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  const earningsLeft = 20;
  const earningsValueLeft = 75;
  
  doc.text('Basic Salary', earningsLeft, y);
  doc.setTextColor(...darkColor);
  doc.text(`£${basicSalary.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  
  y += 7;
  doc.setTextColor(...grayColor);
  doc.text('HRA', earningsLeft, y);
  doc.setTextColor(...darkColor);
  doc.text(`£${hra.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  
  y += 7;
  doc.setTextColor(...grayColor);
  doc.text('Travel Allowance', earningsLeft, y);
  doc.setTextColor(...darkColor);
  doc.text(`£${travel.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  
  y += 7;
  doc.setTextColor(...grayColor);
  doc.text('Other Allowances', earningsLeft, y);
  doc.setTextColor(...darkColor);
  doc.text(`£${other.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  
  // Deductions details
  const advance = salary?.salary_advance || 0;
  const lateFine = salary?.late_fine || 0;
  const totalDeductions = record.total_deductions || 0;
  
  let yDed = y - 21;
  const dedLeft = pageWidth / 2 + 7.5;
  const dedValueRight = pageWidth - 25;
  
  doc.setTextColor(...grayColor);
  doc.text('Salary Advance', dedLeft, yDed);
  doc.setTextColor(...darkColor);
  doc.text(`£${advance.toFixed(2)}`, dedValueRight, yDed, { align: 'right' });
  
  yDed += 7;
  doc.setTextColor(...grayColor);
  doc.text('Late Fine', dedLeft, yDed);
  doc.setTextColor(...darkColor);
  doc.text(`£${lateFine.toFixed(2)}`, dedValueRight, yDed, { align: 'right' });
  
  y += 15;
  
  // Totals line
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.2);
  doc.line(15, y, pageWidth - 15, y);
  
  y += 8;
  
  // Total Earnings
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74); // Green
  doc.text('Total Earnings:', earningsLeft, y);
  doc.text(`£${totalEarnings.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  
  // Total Deductions
  doc.setTextColor(220, 38, 38); // Red
  doc.text('Total Deductions:', dedLeft, y);
  doc.text(`£${totalDeductions.toFixed(2)}`, dedValueRight, y, { align: 'right' });
  
  y += 20;
  
  // Net Salary Box
  doc.setFillColor(...primaryColor);
  doc.roundedRect(15, y, pageWidth - 30, 25, 4, 4, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('NET SALARY', pageWidth / 2, y + 9, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`£${record.net_salary?.toFixed(2) || '0.00'}`, pageWidth / 2, y + 20, { align: 'center' });
  
  y += 35;
  
  // Payment Info
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, pageWidth - 30, 20, 3, 3, 'F');
  
  doc.setTextColor(...grayColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Date:', 20, y + 8);
  doc.text('Payment Method:', 20, y + 15);
  
  doc.setTextColor(...darkColor);
  const payDate = format(new Date(record.month), 'dd MMMM yyyy');
  doc.text(payDate, 55, y + 8);
  doc.text('Bank Transfer', 55, y + 15);
  
  doc.setTextColor(...grayColor);
  doc.text('Reference:', pageWidth / 2 + 10, y + 8);
  doc.setTextColor(...darkColor);
  doc.text(`PAY-${format(new Date(record.month), 'yyyyMM')}-${employee?.id?.slice(0, 4) || '0000'}`, pageWidth / 2 + 35, y + 8);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.5);
  doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('This is a computer-generated payslip and does not require a signature.', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, footerY + 5, { align: 'center' });
  
  // Save the PDF
  const fileName = `Payslip_${employee?.first_name || 'Employee'}_${employee?.last_name || ''}_${format(new Date(record.month), 'MMM_yyyy')}.pdf`;
  doc.save(fileName);
};

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
  const [isSaving, setIsSaving] = useState(false);
  
  // Filter state for super admin / full HR
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');
  
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
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }
  }, []);

  const fetchOrganizationsAndBranches = async () => {
    const [orgsRes, branchesRes] = await Promise.all([
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('branches').select('id, name, organization_id').order('name')
    ]);
    setOrganizations(orgsRes.data || []);
    setBranches(branchesRes.data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all employees (not just active) for salary setup
      const [employeesRes, salaryRes, payrollRes] = await Promise.all([
        supabase.from('employees').select('*').in('status', ['active', 'onboarding']),
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

    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePayroll = async () => {
    setIsSaving(true);
    try {
      const monthDate = new Date(selectedMonth + '-01');
      let generated = 0;
      
      for (const employee of employees) {
        const salary = salaryStructures.find(s => s.employee_id === employee.id);
        if (!salary) continue;

        // Check if already generated
        const existing = payrollRecords.find(
          p => p.employee_id === employee.id && p.month === monthDate.toISOString().split('T')[0]
        );
        if (existing) continue;

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
        generated++;
      }

      if (generated > 0) {
        toast.success(`Payroll generated for ${generated} employees`);
      } else {
        toast.info('No new payroll to generate');
      }
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate payroll');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateNetSalary = (salary: any) => {
    if (!salary) return 0;
    const totalAllowances = (salary.hra || 0) + (salary.travel_allowance || 0) + (salary.other_allowances || 0);
    const totalDeductions = (salary.salary_advance || 0) + (salary.late_fine || 0);
    return (salary.basic_salary || 0) + totalAllowances - totalDeductions;
  };

  // Apply org/branch filters
  const filteredEmployeesList = canViewFilters && viewMode !== 'all'
    ? employees.filter(e => {
        if (viewMode === 'organization' && selectedOrg) return e.organization_id === selectedOrg;
        if (viewMode === 'branch' && selectedBranch) return e.branch_id === selectedBranch;
        if (viewMode === 'branch' && selectedOrg && !selectedBranch) return e.organization_id === selectedOrg;
        return true;
      })
    : employees;

  // Separate configured and unconfigured employees
  const configuredEmployeeIds = new Set(salaryStructures.map(s => s.employee_id));
  const unconfiguredEmployees = filteredEmployeesList.filter(e => !configuredEmployeeIds.has(e.id));
  const configuredEmployees = filteredEmployeesList.filter(e => configuredEmployeeIds.has(e.id));

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
            {payrollRecords.map(record => {
              const empForRecord = employees.find(e => e.id === record.employee_id);
              const salaryForRecord = salaryStructures.find(s => s.employee_id === record.employee_id);
              return (
                <Card key={record.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{format(new Date(record.month), 'MMMM yyyy')}</h3>
                      <p className="text-sm text-muted-foreground">Net Salary: £{record.net_salary?.toFixed(2)}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => generatePayslipPDF(record, empForRecord, salaryForRecord)}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin/HR View
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Payroll Management</h2>
          <p className="text-muted-foreground mt-1">Salary Setup & Process employee payroll</p>
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
        </div>
      </div>

      {canViewFilters && (
        <OrgBranchFilter
          organizations={organizations}
          branches={branches}
          viewMode={viewMode}
          selectedOrg={selectedOrg}
          selectedBranch={selectedBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setSelectedOrg}
          onBranchChange={setSelectedBranch}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <p className="text-xs text-muted-foreground">Total Employees</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{unconfiguredEmployees.length}</p>
              <p className="text-xs text-amber-600">Unconfigured</p>
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{configuredEmployees.length}</p>
              <p className="text-xs text-muted-foreground">Configured</p>
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
          <TabsTrigger value="setup" className="gap-2">
            <Settings className="h-4 w-4" />
            Salary Setup
            {unconfiguredEmployees.length > 0 && (
              <Badge variant="destructive" className="ml-1">{unconfiguredEmployees.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly">Monthly Payroll</TabsTrigger>
          <TabsTrigger value="history">Payroll History</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-6 space-y-6">
          {/* Unconfigured Employees First */}
          {unconfiguredEmployees.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-lg">Unconfigured Employees ({unconfiguredEmployees.length})</h3>
              </div>
              <Card className="p-3 bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-800">
                  These employees need salary structure configuration before payroll can be generated.
                </p>
              </Card>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unconfiguredEmployees.filter(e => 
                      `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map(employee => (
                      <TableRow key={employee.id} className="bg-amber-50/50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                            <p className="text-sm text-muted-foreground">{employee.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{employee.job_title || '-'}</TableCell>
                        <TableCell>{employee.department || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                            Not Configured
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleEditSalary(employee)} className="gap-1">
                            <Settings className="h-4 w-4" />
                            Configure
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Configured Employees */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-lg">Configured Employees ({configuredEmployees.length})</h3>
            </div>
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
                  {configuredEmployees.filter(e => 
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
                        <TableCell className="text-green-600">+£{totalAllowances.toFixed(2)}</TableCell>
                        <TableCell className="text-red-600">-£{totalDeductions.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">£{netSalary.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEditSalary(employee)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {configuredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No employees with salary configured yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
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
                <Button onClick={handleGeneratePayroll} className="gap-2" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
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
                    const salaryForRecord = salaryStructures.find(s => s.employee_id === record.employee_id);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee?.first_name} {employee?.last_name}</p>
                            <p className="text-sm text-muted-foreground">{employee?.job_title}</p>
                          </div>
                        </TableCell>
                        <TableCell>£{record.basic_salary?.toFixed(2)}</TableCell>
                        <TableCell className="text-green-600">+£{record.total_allowances?.toFixed(2)}</TableCell>
                        <TableCell className="text-red-600">-£{record.total_deductions?.toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">£{record.net_salary?.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => generatePayslipPDF(record, employee, salaryForRecord)}
                          >
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
                      <TableCell className="font-medium">
                        {format(new Date(month), 'MMMM yyyy')}
                      </TableCell>
                      <TableCell>{monthRecords.length}</TableCell>
                      <TableCell className="font-semibold">£{total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">Completed</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {payrollRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No payroll history yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Salary Dialog */}
      <Dialog open={showEditSalary} onOpenChange={setShowEditSalary}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {salaryStructures.find(s => s.employee_id === selectedEmployee?.id) ? 'Edit' : 'Configure'} Salary Structure
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="p-3 bg-muted rounded-lg mb-4">
              <p className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
              <p className="text-sm text-muted-foreground">{selectedEmployee.job_title || 'No job title'}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Basic Salary (£)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={salaryForm.basicSalary}
                onChange={(e) => setSalaryForm(prev => ({ ...prev, basicSalary: e.target.value }))}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-green-600">Allowances</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>HRA (£)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={salaryForm.hra}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, hra: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Travel (£)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={salaryForm.travelAllowance}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, travelAllowance: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Other Allowances (£)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={salaryForm.otherAllowances}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, otherAllowances: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-red-600">Deductions</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Salary Advance (£)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={salaryForm.salaryAdvance}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, salaryAdvance: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Late Fine (£)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={salaryForm.lateFine}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, lateFine: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Unpaid Leave Days</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={salaryForm.unpaidLeaveDays}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, unpaidLeaveDays: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Net Salary Preview */}
            <div className="border-t pt-4">
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Net Salary</p>
                <p className="text-2xl font-bold text-primary">
                  £{(
                    (parseFloat(salaryForm.basicSalary) || 0) +
                    (parseFloat(salaryForm.hra) || 0) +
                    (parseFloat(salaryForm.travelAllowance) || 0) +
                    (parseFloat(salaryForm.otherAllowances) || 0) -
                    (parseFloat(salaryForm.salaryAdvance) || 0) -
                    (parseFloat(salaryForm.lateFine) || 0)
                  ).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSalary(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSalary} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
