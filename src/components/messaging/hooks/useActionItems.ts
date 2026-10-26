import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ActionItem {
  id: string;
  conversation_id: string;
  message_id: string | null;
  raised_by: string;
  assigned_to: string;
  title: string;
  details: string | null;
  module_key: string;
  module_label: string;
  module_route: string;
  reference_date: string | null;
  due_date: string | null;
  status: 'open' | 'acknowledged' | 'completed' | 'closed';
  acknowledged_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_note: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionModule {
  key: string;
  label: string;
  route: string;
}

export const ACTION_MODULES: ActionModule[] = [
  { key: 'general', label: 'General', route: '/dashboard' },
  { key: 'daily-reports', label: 'Daily Reports', route: '/dashboard/daily-reports' },
  { key: 'daily-sales-upload', label: 'Daily Sales Upload (Invoices/CSV)', route: '/dashboard/daily-sales-upload' },
  { key: 'documents', label: 'Documents', route: '/dashboard/documents' },
  { key: 'documents-submit', label: 'Submit Documents', route: '/dashboard/documents/submit' },
  { key: 'employees', label: 'Employee Hub', route: '/dashboard/employees' },
  { key: 'onboarding', label: 'Onboarding', route: '/dashboard/onboarding' },
  { key: 'scheduling', label: 'Scheduling', route: '/dashboard/scheduling' },
  { key: 'attendance', label: 'Leave & Attendance', route: '/dashboard/attendance' },
  { key: 'lottery', label: 'Lottery', route: '/dashboard/lottery' },
  { key: 'customer-accounts', label: 'Customer Accounts', route: '/dashboard/customer-accounts' },
  { key: 'drive-offs', label: 'Drive Offs', route: '/dashboard/drive-offs' },
  { key: 'maintenance', label: 'Maintenance', route: '/dashboard/maintenance' },
  { key: 'safety-tasks', label: 'Safety Tasks', route: '/dashboard/safety-tasks' },
  { key: 'daily-summary', label: 'Sales Analysis / Daily Summary', route: '/dashboard/daily-summary' },
  { key: 'clock-ins', label: 'Clock-ins', route: '/dashboard/clock-ins' },
  { key: 'payroll', label: 'Payroll', route: '/dashboard/payroll' },
  { key: 'training', label: 'Training / E-Learning', route: '/dashboard/elearning' },
  { key: 'settings', label: 'Settings', route: '/dashboard/settings' },
];

export const getActionModuleByKey = (key: string): ActionModule => {
  return ACTION_MODULES.find(m => m.key === key) || ACTION_MODULES[0];
};

// The generated Supabase types may not yet include this table.
const table = () => (supabase as unknown as { from: (t: string) => any }).from('message_action_items');

export function useActionItems(conversationId: string | null) {
  const { user } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [myOpenItems, setMyOpenItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [convoRes, mineRes] = await Promise.all([
        conversationId
          ? table().select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        table()
          .select('*')
          .eq('assigned_to', user.id)
          .in('status', ['open', 'acknowledged'])
          .order('created_at', { ascending: false }),
      ]);
      setItems((convoRes.data || []) as ActionItem[]);
      setMyOpenItems((mineRes.data || []) as ActionItem[]);
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime updates for action items
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`action-items-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_action_items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchItems]);

  const createActionItem = useCallback(
    async (payload: {
      conversation_id: string;
      message_id?: string | null;
      assigned_to: string;
      title: string;
      details?: string;
      module: ActionModule;
      reference_date?: string | null;
      due_date?: string | null;
    }) => {
      if (!user?.id) return false;
      const { error } = await table().insert({
        conversation_id: payload.conversation_id,
        message_id: payload.message_id ?? null,
        raised_by: user.id,
        assigned_to: payload.assigned_to,
        title: payload.title,
        details: payload.details || null,
        module_key: payload.module.key,
        module_label: payload.module.label,
        module_route: payload.module.route,
        reference_date: payload.reference_date || null,
        due_date: payload.due_date || null,
      });
      if (error) {
        toast.error(error.message || 'Failed to raise action item');
        return false;
      }
      toast.success('Action item raised');
      fetchItems();
      return true;
    },
    [user?.id, fetchItems]
  );

  const updateStatus = useCallback(
    async (
      id: string,
      status: ActionItem['status'],
      extra: { completion_note?: string } = {}
    ) => {
      if (!user?.id) return false;
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status };
      if (status === 'acknowledged') patch.acknowledged_at = now;
      if (status === 'completed') {
        patch.completed_at = now;
        patch.completed_by = user.id;
        if (extra.completion_note) patch.completion_note = extra.completion_note;
      }
      if (status === 'closed') {
        patch.closed_at = now;
        patch.closed_by = user.id;
      }

      const { error } = await table().update(patch).eq('id', id);
      if (error) {
        toast.error(error.message || 'Failed to update action item');
        return false;
      }
      fetchItems();
      return true;
    },
    [user?.id, fetchItems]
  );

  return { items, myOpenItems, loading, fetchItems, createActionItem, updateStatus };
}
