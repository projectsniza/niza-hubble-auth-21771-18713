import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface CustomerAccount {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  organization_id: string | null;
  branch_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  branches?: { name: string } | null;
  organizations?: { name: string } | null;
}

export interface MonthlyAccount {
  id: string;
  customer_id: string;
  month_date: string;
  total_due: number;
  is_paid: boolean;
  paid_date: string | null;
  marked_paid_by: string | null;
  notes: string | null;
  branch_id: string;
  organization_id: string | null;
  created_at: string;
  items?: AccountItem[];
}

export interface AccountItem {
  id: string;
  monthly_account_id: string;
  description: string;
  amount: number;
  purchased_date: string | null;
  tax: number | null;
  discount: number | null;
  created_at: string;
}

export interface CreateCustomerData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  organization_id?: string;
  branch_id: string;
  notes?: string;
}

export interface CreateMonthlyData {
  customer_id: string;
  month_date: string;
  total_due: number;
  notes?: string;
  organization_id?: string;
  branch_id: string;
}

export function useCustomerAccounts(selectedOrg: string, selectedBranch: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customer-accounts', selectedOrg, selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from('customer_accounts')
        .select('*, branches(name), organizations(name)')
        .order('created_at', { ascending: false });

      if (selectedOrg) query = query.eq('organization_id', selectedOrg);
      if (selectedBranch) query = query.eq('branch_id', selectedBranch);

      const { data, error } = await query;
      if (error) throw error;
      return data as CustomerAccount[];
    },
    enabled: !!user,
  });

  const createCustomer = useMutation({
    mutationFn: async (data: CreateCustomerData) => {
      const { error } = await supabase.from('customer_accounts').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-accounts'] });
      toast({ title: 'Customer created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create customer', description: error.message, variant: 'destructive' });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CustomerAccount> & { id: string }) => {
      const { error } = await supabase.from('customer_accounts').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-accounts'] });
      toast({ title: 'Customer updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update customer', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-accounts'] });
      toast({ title: 'Customer deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete customer', description: error.message, variant: 'destructive' });
    },
  });

  return { customers, isLoading, createCustomer, updateCustomer, deleteCustomer };
}

export function useMonthlyAccounts(customerId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: monthlyAccounts = [], isLoading } = useQuery({
    queryKey: ['monthly-accounts', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_monthly_accounts')
        .select('*')
        .eq('customer_id', customerId)
        .order('month_date', { ascending: false });
      if (error) throw error;

      // Fetch items for each monthly account
      const monthlyIds = (data || []).map(m => m.id);
      let items: AccountItem[] = [];
      if (monthlyIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('customer_account_items')
          .select('*')
          .in('monthly_account_id', monthlyIds)
          .order('created_at', { ascending: true });
        items = (itemsData || []) as AccountItem[];
      }

      return (data || []).map(m => ({
        ...m,
        total_due: Number(m.total_due),
        items: items.filter(i => i.monthly_account_id === m.id),
      })) as MonthlyAccount[];
    },
    enabled: !!customerId && !!user,
  });

  const createMonthly = useMutation({
    mutationFn: async (data: CreateMonthlyData) => {
      const { error } = await supabase.from('customer_monthly_accounts').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-accounts'] });
      toast({ title: 'Monthly record added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add monthly record', description: error.message, variant: 'destructive' });
    },
  });

  const updateMonthly = useMutation({
    mutationFn: async ({ id, ...data }: Partial<MonthlyAccount> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.total_due !== undefined) updateData.total_due = data.total_due;
      if (data.is_paid !== undefined) updateData.is_paid = data.is_paid;
      if (data.paid_date !== undefined) updateData.paid_date = data.paid_date;
      if (data.marked_paid_by !== undefined) updateData.marked_paid_by = data.marked_paid_by;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const { error } = await supabase.from('customer_monthly_accounts').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-accounts'] });
      toast({ title: 'Monthly record updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });

  const addItem = useMutation({
    mutationFn: async (data: { monthly_account_id: string; description: string; amount: number; purchased_date?: string; tax?: number; discount?: number }) => {
      const { error } = await supabase.from('customer_account_items').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-accounts'] });
      toast({ title: 'Item added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add item', description: error.message, variant: 'destructive' });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_account_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-accounts'] });
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({ id, isPaid }: { id: string; isPaid: boolean }) => {
      const { error } = await supabase.from('customer_monthly_accounts').update({
        is_paid: isPaid,
        paid_date: isPaid ? new Date().toISOString().split('T')[0] : null,
        marked_paid_by: isPaid ? user?.id : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-accounts'] });
      toast({ title: 'Payment status updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update payment', description: error.message, variant: 'destructive' });
    },
  });

  return { monthlyAccounts, isLoading, createMonthly, updateMonthly, addItem, deleteItem, markPaid };
}
