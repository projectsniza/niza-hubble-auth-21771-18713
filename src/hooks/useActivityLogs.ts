import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityLog {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  user_id: string;
  user_name: string;
  user_role: string | null;
  activity_type: string;
  activity_category: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export const useActivityLogs = (limit?: number) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', limit],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: user?.role === 'super_admin',
  });

  const unreadCount = activities.filter(a => !a.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('activity_logs')
        .update({ is_read: true })
        .eq('id', activityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('activity_logs')
        .update({ is_read: true })
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
  });

  return {
    activities,
    isLoading,
    unreadCount,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    refetch,
  };
};

// Helper function to log activities from anywhere in the app
export const logActivity = async (params: {
  userId: string;
  userName: string;
  userRole?: string;
  activityType: string;
  activityCategory: string;
  title: string;
  description?: string;
  organizationId?: string;
  branchId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) => {
  const { error } = await supabase.from('activity_logs').insert([{
    user_id: params.userId,
    user_name: params.userName,
    user_role: params.userRole || null,
    activity_type: params.activityType,
    activity_category: params.activityCategory,
    title: params.title,
    description: params.description || null,
    organization_id: params.organizationId || null,
    branch_id: params.branchId || null,
    metadata: params.metadata || {},
  }]);
  
  if (error) console.error('Failed to log activity:', error);
};
