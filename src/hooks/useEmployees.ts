import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errorUtils';

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
  
  // Track last fetch params to prevent unnecessary refetches
  const lastFetchParamsRef = useRef<string>('');
  
  const filterKey = useMemo(() => JSON.stringify(filters || {}), [filters]);

  const fetchEmployees = useCallback(async (force = false) => {
    // Prevent duplicate fetches with same params unless forced
    if (!force && lastFetchParamsRef.current === filterKey && employees.length > 0) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      let query = supabase
        .from('employees')
        .select(`
          id, first_name, last_name, email, phone, job_title, department, status, 
          date_of_birth, join_date, national_insurance_number, address,
          emergency_contact_name, emergency_contact_phone, organization_id, branch_id, team_id, manager_id,
          organization:organizations(id, name),
          branch:branches(id, name),
          team:teams(id, name),
          onboarding:employee_onboarding(id, current_step, completed_at, contract_approved),
          contract_approval:contract_approvals(id, status)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

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
      lastFetchParamsRef.current = filterKey;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching employees:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterKey, filters?.organizationId, filters?.branchId, filters?.managerId, filters?.status, filters?.searchQuery, employees.length]);

  const createEmployee = useCallback(async (employeeData: {
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, [user?.id]);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEmployees(prev => prev.filter(emp => emp.id !== id));
      toast.success('Employee deleted');
      return { error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { error: message };
    }
  }, []);

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
  const fetchedRef = useRef(false);

  const fetchPendingApprovals = useCallback(async () => {
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
      
      // Fetch documents for each employee in parallel
      const approvalsWithDocs = await Promise.all((data || []).map(async (approval) => {
        if (approval.employee?.id) {
          const { data: docs } = await supabase
            .from('documents')
            .select('*')
            .eq('employee_id', approval.employee.id)
            .order('created_at', { ascending: false });
          
          return { ...approval, documents: docs || [] };
        }
        return { ...approval, documents: [] };
      }));
      
      setPendingApprovals(approvalsWithDocs);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      console.error('Error fetching pending approvals:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveContract = useCallback(async (approvalId: string, signature: string, signatureType: string, signatureDate: string, employerName?: string) => {
    try {
      // First get existing contract_content to merge employer_name
      const { data: existing } = await supabase
        .from('contract_approvals')
        .select('contract_content')
        .eq('id', approvalId)
        .single();

      const updatedContent = {
        ...((existing?.contract_content as any) || {}),
        employer_name: employerName || ''
      };

      const { data, error } = await supabase
        .from('contract_approvals')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          admin_signature: signature,
          employer_signature: signature,
          employer_signature_type: signatureType,
          employer_signed_date: signatureDate,
          contract_content: updatedContent
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) throw error;

      // Update onboarding status
      const approval = pendingApprovals.find(a => a.id === approvalId);
      if (approval) {
        await Promise.all([
          supabase
            .from('employee_onboarding')
            .update({
              contract_approved: true,
              current_step: 4
            })
            .eq('employee_id', approval.employee_id),
          supabase
            .from('employees')
            .update({ status: 'awaiting_signature' })
            .eq('id', approval.employee_id)
        ]);
      }
      
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      toast.success('Contract approved successfully');
      return { data, error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, [user?.id, pendingApprovals]);

  const rejectContract = useCallback(async (approvalId: string, reason: string) => {
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { data: null, error: message };
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchPendingApprovals();
    }
  }, [user, fetchPendingApprovals]);

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
  const lastEmployeeIdRef = useRef<string | undefined>(undefined);

  const fetchOnboarding = useCallback(async () => {
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
    } catch (err: unknown) {
      console.error('Error fetching onboarding:', err);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  const updateOnboarding = useCallback(async (updates: Partial<EmployeeOnboarding>) => {
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      return { data: null, error: message };
    }
  }, [employeeId]);

  const submitContractForApproval = useCallback(async (contractFilePath: string, contractFileName: string) => {
    if (!employeeId) return { error: 'No employee ID' };
    
    try {
      // Create contract approval and update onboarding in parallel
      const [approvalResult, onboardingResult] = await Promise.all([
        supabase
          .from('contract_approvals')
          .insert({
            employee_id: employeeId,
            contract_file_path: contractFilePath,
            contract_file_name: contractFileName,
            submitted_by: user?.id,
            status: 'pending'
          }),
        supabase
          .from('employee_onboarding')
          .update({
            contract_uploaded: true,
            contract_submitted_for_approval: true,
            current_step: 3
          })
          .eq('employee_id', employeeId)
      ]);

      if (approvalResult.error) throw approvalResult.error;
      if (onboardingResult.error) throw onboardingResult.error;

      toast.success('Contract submitted for approval');
      return { error: null };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return { error: message };
    }
  }, [employeeId, user?.id]);

  useEffect(() => {
    if (employeeId && lastEmployeeIdRef.current !== employeeId) {
      lastEmployeeIdRef.current = employeeId;
      fetchOnboarding();
    }
  }, [employeeId, fetchOnboarding]);

  return {
    onboarding,
    isLoading,
    fetchOnboarding,
    updateOnboarding,
    submitContractForApproval
  };
}