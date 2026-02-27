import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Info, UserCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { isAdminOrHR } from '@/lib/roles';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  status: string;
  branch_id: string;
  organization_id: string;
  user_id: string | null;
  branch?: { name: string };
  user_role?: string;
}

export default function SafeEmployees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Filter state
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  const canFilter = isAdminOrHR(user);

  useEffect(() => {
    if (canFilter) fetchOrganizations();
    if (user?.role === 'manager') {
      setViewMode('branch');
      if (user.organizationId) setFilterOrg(user.organizationId);
      if (user.branchId) setFilterBranch(user.branchId);
    }
  }, [user]);

  useEffect(() => {
    fetchEmployees();
  }, [filterOrg, filterBranch, viewMode, user]);

  useEffect(() => {
    if (filterOrg) fetchBranches(filterOrg);
  }, [filterOrg]);

  const fetchOrganizations = async () => {
    if (user?.role === 'hr' && user.organizationId) {
      const { data } = await supabase.from('organizations').select('id, name').eq('id', user.organizationId);
      setOrganizations(data || []);
    } else {
      const { data } = await supabase.from('organizations').select('id, name').order('name');
      setOrganizations(data || []);
    }
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('id, name, organization_id').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  };

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('employees').select('*, branch:branches(name)').order('first_name');

      // Apply scope
      if (user?.role === 'manager' && user.branchId) {
        query = query.eq('branch_id', user.branchId);
      } else if (viewMode === 'branch' && filterBranch) {
        query = query.eq('branch_id', filterBranch);
      } else if (viewMode === 'organization' && filterOrg) {
        query = query.eq('organization_id', filterOrg);
      } else if (user?.role === 'hr') {
        if (user.hrAccessLevel === 'branch' && user.branchId) {
          query = query.eq('branch_id', user.branchId);
        } else if (user.organizationId) {
          query = query.eq('organization_id', user.organizationId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const employeesWithRoles = await Promise.all(
        (data || []).map(async (emp) => {
          if (emp.user_id) {
            const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', emp.user_id).single();
            return { ...emp, user_role: roleData?.role };
          }
          return emp;
        })
      );

      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.branch?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = employees.filter(e => e.status === 'active').length;

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin': return <Badge className="bg-primary text-primary-foreground">Super Admin</Badge>;
      case 'hr': return <Badge className="bg-accent text-accent-foreground">HR</Badge>;
      case 'manager': return <Badge className="bg-blue-500 text-white">Store Account</Badge>;
      case 'employee': return <Badge variant="outline">Employee</Badge>;
      default: return <Badge variant="secondary">Unassigned</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Employees ({filteredEmployees.length})</h1>
        <p className="text-muted-foreground">Manage employee safety records and assignments</p>
      </div>

      {canFilter && user?.role !== 'manager' && (
        <OrgBranchFilter
          organizations={organizations}
          branches={branches}
          viewMode={viewMode}
          selectedOrg={filterOrg}
          selectedBranch={filterBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setFilterOrg}
          onBranchChange={setFilterBranch}
          className="mb-6"
        />
      )}

      <Card className="p-4 mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">
            To use Niza Safe, employees should be assigned to a place of work. Employees must have a branch assigned to access safety features.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm font-semibold mb-2 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Name, Site, Job Title, Role" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold mb-2 block">Filter by status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active ({activeCount})</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="all">All ({employees.length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Full name</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Site</TableHead>
              <TableHead><div className="flex items-center gap-1">Role<Info className="h-4 w-4 text-muted-foreground" /></div></TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <UserCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No employees found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-accent/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <span className="text-white text-sm font-medium">{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</span>
                      </div>
                      <div>
                        <span className="font-medium text-primary">{emp.first_name} {emp.last_name}</span>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{emp.job_title || 'Not specified'}</TableCell>
                  <TableCell>{emp.branch?.name ? <span className="text-foreground">{emp.branch.name}</span> : <span className="text-destructive font-medium">Unassigned</span>}</TableCell>
                  <TableCell>{getRoleBadge(emp.user_role)}</TableCell>
                  <TableCell>
                    <Badge variant={emp.status === 'active' ? 'default' : 'secondary'} className={emp.status === 'active' ? 'bg-green-500 text-white' : ''}>
                      {emp.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
