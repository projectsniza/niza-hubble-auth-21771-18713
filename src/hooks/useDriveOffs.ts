import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DriveOff {
  id: string;
  organization_id: string | null;
  branch_id: string;
  drive_off_date: string;
  vehicle_registration: string;
  vehicle_model: string | null;
  fuel_type: string;
  pump_number: number;
  cashier_name: string;
  total_liters: number;
  amount_drive_off: number;
  till_1_amount: number;
  till_2_amount: number;
  till_3_amount: number;
  till_4_amount: number;
  till_5_amount: number;
  total_amount_received: number;
  payment_received_date: string | null;
  payment_till_1: number;
  payment_till_2: number;
  tracking_status: 'fuel_guardian' | 'police_complaint' | 'payment' | null;
  tracking_reference: string | null;
  date_handed_to_guardian: string | null;
  head_office_notes: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  branches?: { name: string };
}

export interface DriveOffFormData {
  branch_id: string;
  organization_id?: string;
  drive_off_date: string;
  vehicle_registration: string;
  vehicle_model?: string;
  fuel_type: string;
  pump_number: number;
  cashier_name: string;
  total_liters: number;
  amount_drive_off: number;
  till_1_amount?: number;
  till_2_amount?: number;
  till_3_amount?: number;
  till_4_amount?: number;
  till_5_amount?: number;
  total_amount_received?: number;
  payment_received_date?: string;
  payment_till_1?: number;
  payment_till_2?: number;
  tracking_status?: 'fuel_guardian' | 'police_complaint' | 'payment' | null;
  tracking_reference?: string;
  date_handed_to_guardian?: string;
  head_office_notes?: string;
  remarks?: string;
}

export function useDriveOffs(month?: Date, selectedOrg?: string, selectedBranch?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: driveOffs = [], isLoading, refetch } = useQuery({
    queryKey: ['drive-offs', selectedOrg, selectedBranch, month?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('drive_offs')
        .select('*, branches(name)')
        .order('drive_off_date', { ascending: false });

      // Apply org/branch filters based on user role
      if (user?.role === 'super_admin') {
        if (selectedOrg && selectedOrg !== 'all') {
          query = query.eq('organization_id', selectedOrg);
        }
        if (selectedBranch && selectedBranch !== 'all') {
          query = query.eq('branch_id', selectedBranch);
        }
      } else if (user?.role === 'hr') {
        if (user.organizationId) {
          query = query.eq('organization_id', user.organizationId);
        }
        if (user.branchId) {
          query = query.eq('branch_id', user.branchId);
        }
      } else if (user?.role === 'manager' && user.branchId) {
        query = query.eq('branch_id', user.branchId);
      }

      // Filter by month if provided
      if (month) {
        const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
        const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        query = query
          .gte('drive_off_date', startOfMonth.toISOString().split('T')[0])
          .lte('drive_off_date', endOfMonth.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DriveOff[];
    },
    enabled: !!user,
  });

  const createDriveOff = useMutation({
    mutationFn: async (formData: DriveOffFormData) => {
      const { data, error } = await supabase
        .from('drive_offs')
        .insert({
          ...formData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-offs'] });
      toast.success('Drive-off recorded successfully');
    },
    onError: (error) => {
      toast.error('Failed to record drive-off: ' + error.message);
    },
  });

  const updateDriveOff = useMutation({
    mutationFn: async ({ id, ...formData }: DriveOffFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('drive_offs')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-offs'] });
      toast.success('Drive-off updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update drive-off: ' + error.message);
    },
  });

  const deleteDriveOff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('drive_offs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-offs'] });
      toast.success('Drive-off deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete drive-off: ' + error.message);
    },
  });

  return {
    driveOffs,
    isLoading,
    refetch,
    createDriveOff,
    updateDriveOff,
    deleteDriveOff,
  };
}
