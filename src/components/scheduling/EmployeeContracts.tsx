import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  FileText, Plus, Edit, Search, Loader2, Users, Clock, Calendar
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';

interface EmployeeContract {
  id: string;
  employee_id: string;
  contract_type: string;
  weekly_contracted_hours: number;
  holiday_entitlement_days: number;
  holiday_year_start: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    organization_id: string;
    branch_id: string;
    branch?: { name: string };
  };
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  branch_id: string;
}

export function EmployeeContracts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<EmployeeContract | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    employee_id: '',
    contract_type: 'full-time',
    weekly_contracted_hours: '40',
    holiday_entitlement_days: '28',
    holiday_year_start: '2025-04-01',
    effective_from: format(new Date(), 'yyyy-MM-dd')
  });

  // Filters
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');

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
      const [contractsRes, employeesRes] = await Promise.all([
        supabase
          .from('employee_contracts')
          .select(`
            *,
            employee:employees(
              id, first_name, last_name, organization_id, branch_id,
              branch:branches(name)
            )
          `)
          .is('effective_to', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('id, first_name, last_name, organization_id, branch_id')
          .in('status', ['active', 'onboarding'])
          .order('first_name')
      ]);

      setContracts(contractsRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingContract(null);
    setForm({
      employee_id: '',
      contract_type: 'full-time',
      weekly_contracted_hours: '40',
      holiday_entitlement_days: '28',
      holiday_year_start: '2025-04-01',
      effective_from: format(new Date(), 'yyyy-MM-dd')
    });
    setShowDialog(true);
  };

  const openEditDialog = (contract: EmployeeContract) => {
    setEditingContract(contract);
    setForm({
      employee_id: contract.employee_id,
      contract_type: contract.contract_type,
      weekly_contracted_hours: contract.weekly_contracted_hours.toString(),
      holiday_entitlement_days: contract.holiday_entitlement_days.toString(),
      holiday_year_start: contract.holiday_year_start,
      effective_from: contract.effective_from
    });
    setShowDialog(true);
  };

  const saveContract = async () => {
    if (!form.employee_id) {
      toast.error('Please select an employee');
      return;
    }

    setSaving(true);
    try {
      if (editingContract) {
        // End existing and create new
        await supabase
          .from('employee_contracts')
          .update({ effective_to: format(new Date(), 'yyyy-MM-dd') })
          .eq('id', editingContract.id);
      }

      // Check if employee already has an active contract
      const existing = contracts.find(c => c.employee_id === form.employee_id && !editingContract);
      if (existing) {
        await supabase
          .from('employee_contracts')
          .update({ effective_to: format(new Date(), 'yyyy-MM-dd') })
          .eq('id', existing.id);
      }

      // Create new contract
      const { error } = await supabase.from('employee_contracts').insert({
        employee_id: form.employee_id,
        contract_type: form.contract_type,
        weekly_contracted_hours: parseFloat(form.weekly_contracted_hours),
        holiday_entitlement_days: parseFloat(form.holiday_entitlement_days),
        holiday_year_start: form.holiday_year_start,
        effective_from: form.effective_from,
        created_by: user?.id
      });

      if (error) throw error;

      // Initialize holiday balance
      await supabase.rpc('calculate_holiday_balance', {
        p_employee_id: form.employee_id,
        p_holiday_year_start: form.holiday_year_start
      });

      toast.success('Contract saved successfully');
      setShowDialog(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save contract');
    } finally {
      setSaving(false);
    }
  };

  // Employees without contracts
  const employeesWithoutContract = employees.filter(
    emp => !contracts.some(c => c.employee_id === emp.id)
  );

  const filteredContracts = contracts.filter(c => {
    const emp = c.employee;
    if (!emp) return false;
    
    const matchesSearch = `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (!canViewFilters) return true;
    
    if (viewMode === 'organization' && selectedOrg) {
      return emp.organization_id === selectedOrg;
    }
    if (viewMode === 'branch' && selectedBranch) {
      return emp.branch_id === selectedBranch;
    }
    return true;
  });

  // Stats
  const fullTimeCount = contracts.filter(c => c.contract_type === 'full-time').length;
  const partTimeCount = contracts.filter(c => c.contract_type === 'part-time').length;
  const avgHours = contracts.length > 0 
    ? contracts.reduce((sum, c) => sum + Number(c.weekly_contracted_hours), 0) / contracts.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Employee Contracts</h2>
          <p className="text-muted-foreground">Manage contract hours and holiday entitlements</p>
        </div>
        
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contract
        </Button>
      </div>

      {/* Filters */}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contracts</p>
              <p className="text-2xl font-bold">{contracts.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Full-time</p>
              <p className="text-2xl font-bold">{fullTimeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Part-time</p>
              <p className="text-2xl font-bold">{partTimeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Weekly Hours</p>
              <p className="text-2xl font-bold">{avgHours.toFixed(1)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alert for missing contracts */}
      {employeesWithoutContract.length > 0 && (
        <Card className="p-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <FileText className="h-5 w-5" />
            <span className="font-medium">{employeesWithoutContract.length} employees without contracts</span>
            <span className="text-sm">- Holiday tracking won't work for them</span>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-center">Contract Type</TableHead>
                <TableHead className="text-center">Weekly Hours</TableHead>
                <TableHead className="text-center">Holiday Days</TableHead>
                <TableHead className="text-center">Holiday Year</TableHead>
                <TableHead className="text-center">Effective From</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.employee?.first_name} {contract.employee?.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.employee?.branch?.name || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={contract.contract_type === 'full-time' ? 'default' : 'secondary'} className="capitalize">
                      {contract.contract_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">{contract.weekly_contracted_hours}</TableCell>
                  <TableCell className="text-center">{contract.holiday_entitlement_days}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {format(parseISO(contract.holiday_year_start), 'MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {format(parseISO(contract.effective_from), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(contract)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredContracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No contracts found. Click "Add Contract" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Contract Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Edit Contract' : 'Add New Contract'}</DialogTitle>
            <DialogDescription>
              Set up the employee's contracted hours and holiday entitlement.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {!editingContract && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({...form, employee_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm({...form, contract_type: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="zero-hours">Zero Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weekly Contracted Hours</Label>
                <Input
                  type="number"
                  value={form.weekly_contracted_hours}
                  onChange={(e) => setForm({...form, weekly_contracted_hours: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Holiday Entitlement (days)</Label>
                <Input
                  type="number"
                  value={form.holiday_entitlement_days}
                  onChange={(e) => setForm({...form, holiday_entitlement_days: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Holiday Year Start</Label>
                <Select value={form.holiday_year_start} onValueChange={(v) => setForm({...form, holiday_year_start: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-04-01">April 2024</SelectItem>
                    <SelectItem value="2025-04-01">April 2025</SelectItem>
                    <SelectItem value="2026-04-01">April 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm({...form, effective_from: e.target.value})}
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              UK statutory minimum: 28 days (including bank holidays) for full-time employees.
              Part-time employees accrue pro-rata based on hours worked.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveContract} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
