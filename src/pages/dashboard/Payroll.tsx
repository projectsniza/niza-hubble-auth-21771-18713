import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, DollarSign, Users, Settings, Search, AlertCircle, CheckCircle, Loader2, Plus, Trash2, Edit3, PlusCircle, Minus } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';

interface OrgOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
  organization_id: string;
}

interface PayrollCategory {
  id: string;
  name: string;
  category_type: string;
  description: string | null;
  is_default: boolean;
}

interface PayrollItem {
  id?: string;
  category_id: string;
  amount: number;
  notes: string;
}

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
  salary: any,
  categories: PayrollCategory[],
  items: any[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  const primaryColor: [number, number, number] = [0, 87, 217];
  const darkColor: [number, number, number] = [30, 41, 59];
  const grayColor: [number, number, number] = [100, 116, 139];
  const lightGray: [number, number, number] = [241, 245, 249];
  
  try {
    const logoBase64 = await loadLogoAsBase64();
    doc.addImage(logoBase64, 'PNG', 15, 10, 45, 15);
  } catch (error) {
    console.error('Failed to load logo:', error);
  }
  
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text('Niza Group', pageWidth - 15, 15, { align: 'right' });
  doc.text('United Kingdom', pageWidth - 15, 21, { align: 'right' });
  
  doc.setFontSize(22);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', pageWidth / 2, 45, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'normal');
  const monthYear = format(new Date(record.month), 'MMMM yyyy');
  doc.text(`Pay Period: ${monthYear}`, pageWidth / 2, 53, { align: 'center' });
  
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(15, 60, pageWidth - 15, 60);
  
  let y = 70;
  
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'F');
  
  doc.setFontSize(11);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details', 20, y + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  
  doc.text('Name:', 20, y + 20);
  doc.text('Job Title:', 20, y + 28);
  
  doc.setTextColor(...darkColor);
  doc.text(`${employee?.first_name || ''} ${employee?.last_name || ''}`, 55, y + 20);
  doc.text(employee?.job_title || 'N/A', 55, y + 28);
  
  doc.setTextColor(...grayColor);
  doc.text('Employee ID:', pageWidth / 2 + 10, y + 20);
  doc.text('Department:', pageWidth / 2 + 10, y + 28);
  
  doc.setTextColor(...darkColor);
  doc.text(employee?.id?.slice(0, 8) || 'N/A', pageWidth / 2 + 50, y + 20);
  doc.text(employee?.department || 'N/A', pageWidth / 2 + 50, y + 28);
  
  y += 45;
  
  // Earnings & Deductions from items
  const additionItems = items.filter(i => {
    const cat = categories.find(c => c.id === i.category_id);
    return cat?.category_type === 'addition';
  });
  const deductionItems = items.filter(i => {
    const cat = categories.find(c => c.id === i.category_id);
    return cat?.category_type === 'deduction';
  });
  
  doc.setFillColor(...primaryColor);
  doc.roundedRect(15, y, (pageWidth - 35) / 2, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('EARNINGS', 20, y + 5.5);
  
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(pageWidth / 2 + 2.5, y, (pageWidth - 35) / 2, 8, 2, 2, 'F');
  doc.text('DEDUCTIONS', pageWidth / 2 + 7.5, y + 5.5);
  
  y += 15;
  
  const basicSalary = record.basic_salary || 0;
  let totalEarnings = basicSalary;
  
  const earningsLeft = 20;
  const earningsValueLeft = 75;
  
  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Basic Salary', earningsLeft, y);
  doc.setTextColor(...darkColor);
  doc.text(`£${basicSalary.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  y += 7;
  
  additionItems.forEach(item => {
    const cat = categories.find(c => c.id === item.category_id);
    doc.setTextColor(...grayColor);
    doc.text(cat?.name || 'Allowance', earningsLeft, y);
    doc.setTextColor(...darkColor);
    doc.text(`£${(item.amount || 0).toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
    totalEarnings += (item.amount || 0);
    y += 7;
  });
  
  let yDed = y - 7 - (additionItems.length * 7);
  const dedLeft = pageWidth / 2 + 7.5;
  const dedValueRight = pageWidth - 25;
  let totalDeductions = 0;
  
  deductionItems.forEach(item => {
    const cat = categories.find(c => c.id === item.category_id);
    doc.setTextColor(...grayColor);
    doc.text(cat?.name || 'Deduction', dedLeft, yDed);
    doc.setTextColor(...darkColor);
    doc.text(`£${(item.amount || 0).toFixed(2)}`, dedValueRight, yDed, { align: 'right' });
    totalDeductions += (item.amount || 0);
    yDed += 7;
  });
  
  y = Math.max(y, yDed) + 10;
  
  doc.setDrawColor(...grayColor);
  doc.setLineWidth(0.2);
  doc.line(15, y, pageWidth - 15, y);
  
  y += 8;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74);
  doc.text('Total Earnings:', earningsLeft, y);
  doc.text(`£${totalEarnings.toFixed(2)}`, earningsValueLeft, y, { align: 'right' });
  
  doc.setTextColor(220, 38, 38);
  doc.text('Total Deductions:', dedLeft, y);
  doc.text(`£${totalDeductions.toFixed(2)}`, dedValueRight, y, { align: 'right' });
  
  y += 20;
  
  const netSalary = totalEarnings - totalDeductions;
  
  doc.setFillColor(...primaryColor);
  doc.roundedRect(15, y, pageWidth - 30, 25, 4, 4, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('NET SALARY', pageWidth / 2, y + 9, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`£${netSalary.toFixed(2)}`, pageWidth / 2, y + 20, { align: 'center' });
  
  y += 35;
  
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
  
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.5);
  doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('This is a computer-generated payslip and does not require a signature.', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, footerY + 5, { align: 'center' });
  
  const fileName = `Payslip_${employee?.first_name || 'Employee'}_${employee?.last_name || ''}_${format(new Date(record.month), 'MMM_yyyy')}.pdf`;
  doc.save(fileName);
};

export default function Payroll() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [categories, setCategories] = useState<PayrollCategory[]>([]);
  const [payrollItems, setPayrollItems] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  
  // Category management
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PayrollCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', category_type: 'addition' as 'addition' | 'deduction', description: '' });
  
  // Monthly adjustments panel
  const [showAdjustmentsPanel, setShowAdjustmentsPanel] = useState(false);
  const [adjustingEmployee, setAdjustingEmployee] = useState<any>(null);
  const [employeeItems, setEmployeeItems] = useState<PayrollItem[]>([]);
  
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');
  
  const [salaryForm, setSalaryForm] = useState({
    basicSalary: ''
  });

  useEffect(() => {
    fetchData();
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }
  }, []);

  useEffect(() => {
    fetchPayrollItems();
  }, [selectedMonth]);

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
      const [employeesRes, salaryRes, payrollRes, categoriesRes] = await Promise.all([
        supabase.from('employees').select('*').in('status', ['active', 'onboarding']),
        supabase.from('salary_structures').select('*'),
        supabase.from('payroll_records').select('*').order('month', { ascending: false }),
        supabase.from('payroll_categories').select('*').order('name')
      ]);

      setEmployees(employeesRes.data || []);
      setSalaryStructures(salaryRes.data || []);
      setPayrollRecords(payrollRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollItems = async () => {
    const monthDate = selectedMonth + '-01';
    const { data } = await supabase
      .from('payroll_items')
      .select('*')
      .eq('month', monthDate);
    setPayrollItems(data || []);
  };

  const handleEditSalary = (employee: any) => {
    const existing = salaryStructures.find(s => s.employee_id === employee.id);
    setSelectedEmployee(employee);
    setSalaryForm({
      basicSalary: existing?.basic_salary?.toString() || ''
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save salary';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAdjustments = async (employee: any) => {
    setAdjustingEmployee(employee);
    const monthDate = selectedMonth + '-01';
    const { data } = await supabase
      .from('payroll_items')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('month', monthDate);
    
    const items: PayrollItem[] = (data || []).map(d => ({
      id: d.id,
      category_id: d.category_id,
      amount: d.amount || 0,
      notes: d.notes || ''
    }));
    setEmployeeItems(items);
    setShowAdjustmentsPanel(true);
  };

  const handleAddItem = (categoryType: 'addition' | 'deduction') => {
    const firstCat = categories.find(c => c.category_type === categoryType);
    if (firstCat) {
      setEmployeeItems([...employeeItems, { category_id: firstCat.id, amount: 0, notes: '' }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setEmployeeItems(employeeItems.filter((_, i) => i !== index));
  };

  const handleSaveAdjustments = async () => {
    if (!adjustingEmployee) return;
    setIsSaving(true);
    try {
      const monthDate = selectedMonth + '-01';
      
      // Delete existing items for this employee/month
      await supabase
        .from('payroll_items')
        .delete()
        .eq('employee_id', adjustingEmployee.id)
        .eq('month', monthDate);
      
      // Insert new items
      if (employeeItems.length > 0) {
        const itemsToInsert = employeeItems.map(item => ({
          employee_id: adjustingEmployee.id,
          month: monthDate,
          category_id: item.category_id,
          amount: item.amount,
          notes: item.notes,
          created_by: user?.id
        }));
        await supabase.from('payroll_items').insert(itemsToInsert);
      }
      
      toast.success('Monthly adjustments saved');
      setShowAdjustmentsPanel(false);
      fetchPayrollItems();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save adjustments');
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

        const existing = payrollRecords.find(
          p => p.employee_id === employee.id && p.month === monthDate.toISOString().split('T')[0]
        );
        if (existing) continue;

        // Calculate from items
        const empItems = payrollItems.filter(i => i.employee_id === employee.id);
        let totalAllowances = 0;
        let totalDeductions = 0;
        
        empItems.forEach(item => {
          const cat = categories.find(c => c.id === item.category_id);
          if (cat?.category_type === 'addition') {
            totalAllowances += (item.amount || 0);
          } else {
            totalDeductions += (item.amount || 0);
          }
        });
        
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate payroll';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      if (deleteTarget.type === 'salary') {
        await supabase.from('salary_structures').delete().eq('id', deleteTarget.id);
        toast.success('Salary structure deleted');
      } else if (deleteTarget.type === 'payroll') {
        await supabase.from('payroll_records').delete().eq('id', deleteTarget.id);
        toast.success('Payroll record deleted');
      } else if (deleteTarget.type === 'category') {
        await supabase.from('payroll_categories').delete().eq('id', deleteTarget.id);
        toast.success('Category deleted');
      }
      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingCategory) {
        await supabase.from('payroll_categories').update({
          name: categoryForm.name,
          category_type: categoryForm.category_type,
          description: categoryForm.description || null
        }).eq('id', editingCategory.id);
        toast.success('Category updated');
      } else {
        await supabase.from('payroll_categories').insert({
          name: categoryForm.name,
          category_type: categoryForm.category_type,
          description: categoryForm.description || null,
          created_by: user?.id
        });
        toast.success('Category created');
      }
      setShowCategoryDialog(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', category_type: 'addition', description: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditCategory = (cat: PayrollCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, category_type: cat.category_type as 'addition' | 'deduction', description: cat.description || '' });
    setShowCategoryDialog(true);
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', category_type: 'addition', description: '' });
    setShowCategoryDialog(true);
  };

  const calculateTotals = (employeeId: string) => {
    const empItems = payrollItems.filter(i => i.employee_id === employeeId);
    let totalAllowances = 0;
    let totalDeductions = 0;
    
    empItems.forEach(item => {
      const cat = categories.find(c => c.id === item.category_id);
      if (cat?.category_type === 'addition') {
        totalAllowances += (item.amount || 0);
      } else {
        totalDeductions += (item.amount || 0);
      }
    });
    
    return { totalAllowances, totalDeductions };
  };

  const filteredEmployeesList = canViewFilters && viewMode !== 'all'
    ? employees.filter(e => {
        if (viewMode === 'organization' && selectedOrg) return e.organization_id === selectedOrg;
        if (viewMode === 'branch' && selectedBranch) return e.branch_id === selectedBranch;
        if (viewMode === 'branch' && selectedOrg && !selectedBranch) return e.organization_id === selectedOrg;
        return true;
      })
    : employees;

  const configuredEmployeeIds = new Set(salaryStructures.map(s => s.employee_id));
  const unconfiguredEmployees = filteredEmployeesList.filter(e => !configuredEmployeeIds.has(e.id));
  const configuredEmployees = filteredEmployeesList.filter(e => configuredEmployeeIds.has(e.id));

  const totalMonthlyPayroll = configuredEmployees.reduce((sum, emp) => {
    const salary = salaryStructures.find(s => s.employee_id === emp.id);
    const { totalAllowances, totalDeductions } = calculateTotals(emp.id);
    return sum + (salary?.basic_salary || 0) + totalAllowances - totalDeductions;
  }, 0);

  const payslipsGenerated = payrollRecords.filter(p => p.month === selectedMonth + '-01').length;

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
              const items = payrollItems.filter(i => i.employee_id === record.employee_id && i.month === record.month);
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
                      onClick={() => generatePayslipPDF(record, empForRecord, null, categories, items)}
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
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Payroll Management</h2>
          <p className="text-muted-foreground mt-1">Salary Setup, Monthly Adjustments & Process Payroll</p>
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

        <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{unconfiguredEmployees.length}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">Unconfigured</p>
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
          <TabsTrigger value="categories" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-6 space-y-6">
          {unconfiguredEmployees.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-lg">Unconfigured Employees ({unconfiguredEmployees.length})</h3>
              </div>
              <Card className="p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                <p className="text-sm text-amber-800 dark:text-amber-300">
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
                      <TableRow key={employee.id} className="bg-amber-50/50 dark:bg-amber-950/10">
                        <TableCell>
                          <div>
                            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                            <p className="text-sm text-muted-foreground">{employee.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{employee.job_title || '-'}</TableCell>
                        <TableCell>{employee.department || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
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
                    const { totalAllowances, totalDeductions } = calculateTotals(employee.id);
                    const netSalary = (salary?.basic_salary || 0) + totalAllowances - totalDeductions;
                    
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
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditSalary(employee)} title="Edit Basic Salary">
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenAdjustments(employee)} title="Monthly Adjustments">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: 'salary', id: salary?.id, name: `${employee.first_name} ${employee.last_name}` })}
                              title="Delete Salary Structure"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.filter(p => p.month === selectedMonth + '-01').map(record => {
                    const employee = employees.find(e => e.id === record.employee_id);
                    const items = payrollItems.filter(i => i.employee_id === record.employee_id && i.month === record.month);
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
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-1"
                              onClick={() => generatePayslipPDF(record, employee, null, categories, items)}
                            >
                              <Download className="h-4 w-4" />
                              PDF
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: 'payroll', id: record.id, name: `${employee?.first_name} ${employee?.last_name} - ${format(new Date(record.month), 'MMM yyyy')}` })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

        <TabsContent value="categories" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Payroll Categories</h3>
            <Button onClick={openNewCategory} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Additions */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h4 className="font-semibold text-green-700 dark:text-green-400">Addition Categories</h4>
              </div>
              <div className="space-y-2">
                {categories.filter(c => c.category_type === 'addition').map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div>
                      <p className="font-medium">{cat.name}</p>
                      {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                      {cat.is_default && <Badge variant="secondary" className="mt-1 text-xs">Default</Badge>}
                    </div>
                    {!cat.is_default && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Deductions */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <h4 className="font-semibold text-red-700 dark:text-red-400">Deduction Categories</h4>
              </div>
              <div className="space-y-2">
                {categories.filter(c => c.category_type === 'deduction').map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div>
                      <p className="font-medium">{cat.name}</p>
                      {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                      {cat.is_default && <Badge variant="secondary" className="mt-1 text-xs">Default</Badge>}
                    </div>
                    {!cat.is_default && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Basic Salary Dialog */}
      <Dialog open={showEditSalary} onOpenChange={setShowEditSalary}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {salaryStructures.find(s => s.employee_id === selectedEmployee?.id) ? 'Edit' : 'Configure'} Basic Salary
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
                step="0.01"
                placeholder="0.00"
                value={salaryForm.basicSalary}
                onChange={(e) => setSalaryForm({ basicSalary: e.target.value })}
              />
            </div>
            
            <p className="text-sm text-muted-foreground">
              💡 Use the "Monthly Adjustments" button to add allowances and deductions for each month.
            </p>
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

      {/* Monthly Adjustments Panel */}
      <Sheet open={showAdjustmentsPanel} onOpenChange={setShowAdjustmentsPanel}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Monthly Adjustments - {format(new Date(selectedMonth), 'MMMM yyyy')}</SheetTitle>
          </SheetHeader>
          
          {adjustingEmployee && (
            <div className="p-3 bg-muted rounded-lg mt-4 mb-6">
              <p className="font-medium">{adjustingEmployee.first_name} {adjustingEmployee.last_name}</p>
              <p className="text-sm text-muted-foreground">{adjustingEmployee.job_title || 'No job title'}</p>
            </div>
          )}

          <ScrollArea className="h-[calc(100vh-300px)] pr-4">
            <div className="space-y-6">
              {/* Additions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-600" />
                    <h4 className="font-semibold text-green-700 dark:text-green-400">Additions</h4>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleAddItem('addition')} className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {employeeItems
                    .map((item, idx) => ({ item, idx }))
                    .filter(({ item }) => {
                      const cat = categories.find(c => c.id === item.category_id);
                      return cat?.category_type === 'addition';
                    })
                    .map(({ item, idx }) => (
                      <div key={idx} className="flex gap-2 items-start p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <Select 
                            value={item.category_id} 
                            onValueChange={(v) => {
                              const updated = [...employeeItems];
                              updated[idx].category_id = v;
                              setEmployeeItems(updated);
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.filter(c => c.category_type === 'addition').map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => {
                              const updated = [...employeeItems];
                              updated[idx].amount = parseFloat(e.target.value) || 0;
                              setEmployeeItems(updated);
                            }}
                            className="h-9"
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleRemoveItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  {employeeItems.filter(i => categories.find(c => c.id === i.category_id)?.category_type === 'addition').length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No additions added</p>
                  )}
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4 text-red-600" />
                    <h4 className="font-semibold text-red-700 dark:text-red-400">Deductions</h4>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleAddItem('deduction')} className="gap-1">
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {employeeItems
                    .map((item, idx) => ({ item, idx }))
                    .filter(({ item }) => {
                      const cat = categories.find(c => c.id === item.category_id);
                      return cat?.category_type === 'deduction';
                    })
                    .map(({ item, idx }) => (
                      <div key={idx} className="flex gap-2 items-start p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <Select 
                            value={item.category_id} 
                            onValueChange={(v) => {
                              const updated = [...employeeItems];
                              updated[idx].category_id = v;
                              setEmployeeItems(updated);
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.filter(c => c.category_type === 'deduction').map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => {
                              const updated = [...employeeItems];
                              updated[idx].amount = parseFloat(e.target.value) || 0;
                              setEmployeeItems(updated);
                            }}
                            className="h-9"
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleRemoveItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  {employeeItems.filter(i => categories.find(c => c.id === i.category_id)?.category_type === 'deduction').length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No deductions added</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowAdjustmentsPanel(false)}>Cancel</Button>
            <Button onClick={handleSaveAdjustments} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Adjustments
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit' : 'Add'} Category</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                placeholder="e.g., Performance Bonus"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Type</Label>
              <Select 
                value={categoryForm.category_type} 
                onValueChange={(v: 'addition' | 'deduction') => setCategoryForm(prev => ({ ...prev, category_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="addition">Addition (Allowance)</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Brief description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
