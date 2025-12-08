import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Use any for database types to avoid strict type conflicts with Supabase
type Employee = any;
type EmployeeOnboarding = any;
type ContractApproval = any;

export function useEmployees(filters?: {
  organizationId?: string;
  branchId?: string;
  managerId?: string;
  status?: string;
  searchQuery?: string;
}) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('employees')
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*),
          team:teams(*),
          onboarding:employee_onboarding(*),
          contract_approval:contract_approvals(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.organizationId) {
        query = query.eq('organization_id', filters.organizationId);
      }
      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }
      if (filters?.managerId) {
        query = query.eq('manager_id', filters.managerId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.searchQuery) {
        query = query.or(`first_name.ilike.%${filters.searchQuery}%,last_name.ilike.%${filters.searchQuery}%,email.ilike.%${filters.searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching employees:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters?.organizationId, filters?.branchId, filters?.managerId, filters?.status, filters?.searchQuery]);

  const createEmployee = async (employeeData: {
    organization_id: string;
    branch_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    job_title?: string;
    department?: string;
    date_of_birth?: string;
    join_date?: string;
    national_insurance_number?: string;
    address?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    manager_id?: string;
    team_id?: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert({
          ...employeeData,
          status: 'onboarding',
          created_by: user?.id
        })
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*),
          onboarding:employee_onboarding(*)
        `)
        .single();

      if (error) throw error;
      
      setEmployees(prev => [data, ...prev]);
      toast.success('Employee created successfully');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, ...data } : emp));
      toast.success('Employee updated successfully');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      toast.success('Employee deleted');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user, fetchEmployees]);

  return {
    employees,
    isLoading,
    error,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
  };
}

export function usePendingApprovals() {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<ContractApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingApprovals = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contract_approvals')
        .select(`
          *,
          employee:employees(
            *,
            organization:organizations(*),
            branch:branches(*)
          )
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setPendingApprovals(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching pending approvals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const approveContract = async (approvalId: string, adminSignature: string) => {
    try {
      const { data, error } = await supabase
        .from('contract_approvals')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          admin_signature: adminSignature
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) throw error;

      // Update onboarding status
      const approval = pendingApprovals.find(a => a.id === approvalId);
      if (approval) {
        await supabase
          .from('employee_onboarding')
          .update({
            contract_approved: true,
            current_step: 4
          })
          .eq('employee_id', approval.employee_id);
      }
      
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      toast.success('Contract approved successfully');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  const rejectContract = async (approvalId: string, reason: string) => {
    try {
      const { data, error } = await supabase
        .from('contract_approvals')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) throw error;
      
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      toast.success('Contract rejected');
      return { data, error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { data: null, error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchPendingApprovals();
    }
  }, [user]);

  return {
    pendingApprovals,
    isLoading,
    error,
    fetchPendingApprovals,
    approveContract,
    rejectContract
  };
}

export function useOnboarding(employeeId?: string) {
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<EmployeeOnboarding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOnboarding = async () => {
    if (!employeeId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('employee_onboarding')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error) throw error;
      setOnboarding(data);
    } catch (err: any) {
      console.error('Error fetching onboarding:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOnboarding = async (updates: Partial<EmployeeOnboarding>) => {
    if (!employeeId) return { error: 'No employee ID' };
    
    try {
      const { data, error } = await supabase
        .from('employee_onboarding')
        .update(updates)
        .eq('employee_id', employeeId)
        .select()
        .single();

      if (error) throw error;
      setOnboarding(data);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  const submitContractForApproval = async (contractFilePath: string, contractFileName: string) => {
    if (!employeeId) return { error: 'No employee ID' };
    
    try {
      // Create contract approval record
      const { error: approvalError } = await supabase
        .from('contract_approvals')
        .insert({
          employee_id: employeeId,
          contract_file_path: contractFilePath,
          contract_file_name: contractFileName,
          submitted_by: user?.id,
          status: 'pending'
        });

      if (approvalError) throw approvalError;

      // Update onboarding status
      const { error: onboardingError } = await supabase
        .from('employee_onboarding')
        .update({
          contract_uploaded: true,
          contract_submitted_for_approval: true,
          current_step: 3
        })
        .eq('employee_id', employeeId);

      if (onboardingError) throw onboardingError;

      toast.success('Contract submitted for approval');
      return { error: null };
    } catch (err: any) {
      toast.error(err.message);
      return { error: err.message };
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchOnboarding();
    }
  }, [employeeId]);

  return {
    onboarding,
    isLoading,
    fetchOnboarding,
    updateOnboarding,
    submitContractForApproval
  };
}
