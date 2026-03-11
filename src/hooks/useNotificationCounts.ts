import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationCounts {
  messages: number;
  employees: number;
  attendance: number;
  maintenance: number;
  events: number;
  documents: number;
  drive_offs: number;
  reminders: number;
  daily_reports: number;
  scheduling: number;
  performance: number;
  training: number;
  customer_accounts: number;
  pending_onboardings: number;
  contract_approvals: number;
  pending_accounts: number;
}

const ZERO_COUNTS: NotificationCounts = {
  messages: 0, employees: 0, attendance: 0, maintenance: 0,
  events: 0, documents: 0, drive_offs: 0, reminders: 0,
  daily_reports: 0, scheduling: 0, performance: 0, training: 0,
  customer_accounts: 0, pending_onboardings: 0, contract_approvals: 0, pending_accounts: 0
};

async function safeCount(queryFn: () => Promise<{ count: number | null; error: any }>): Promise<number> {
  try {
    const { count, error } = await queryFn();
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export function useNotificationCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ ...ZERO_COUNTS });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    try {
      const isAdmin = ['super_admin', 'hr', 'manager'].includes(user.role);
      const notEmployee = user.role !== 'employee';
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      // Run all counts in parallel
      const [
        messages,
        pendingLeave,
        pendingMaintenance,
        newEvents,
        onboardingCount,
        contractApprovalsCount,
        pendingAccountsCount,
        pendingDocs,
        driveOffsCount,
        pendingReminders,
        dailyReportsCount,
        pendingPerformance
      ] = await Promise.all([
        // Messages
        (async () => {
          try {
            const { data: participations } = await supabase
              .from('conversation_participants')
              .select('conversation_id, last_read_at')
              .eq('user_id', user.id);
            if (!participations?.length) return 0;
            let total = 0;
            const results = await Promise.allSettled(
              participations.map(p =>
                supabase
                  .from('messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('conversation_id', p.conversation_id)
                  .neq('sender_id', user.id)
                  .gt('created_at', p.last_read_at || '1970-01-01')
              )
            );
            for (const r of results) {
              if (r.status === 'fulfilled') total += r.value.count || 0;
            }
            return total;
          } catch { return 0; }
        })(),

        // Pending leave
        isAdmin
          ? safeCount(() => supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'))
          : 0,

        // Maintenance
        notEmployee
          ? safeCount(() => supabase.from('maintenance_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']))
          : 0,

        // Events
        safeCount(() => supabase.from('events').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)),

        // Onboarding
        isAdmin
          ? safeCount(() => supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'onboarding'))
          : 0,

        // Contract approvals
        isAdmin
          ? safeCount(() => supabase.from('contract_approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'))
          : 0,

        // Pending accounts
        ['super_admin', 'hr'].includes(user.role)
          ? safeCount(() => supabase.from('employees').select('*', { count: 'exact', head: true }).eq('account_activated', false).eq('status', 'active'))
          : 0,

        // Documents
        notEmployee
          ? safeCount(() => supabase.from('documents').select('*', { count: 'exact', head: true }).lte('follow_up_date', new Date().toISOString()).is('verified_at', null))
          : 0,

        // Drive-offs
        notEmployee
          ? safeCount(() => supabase.from('drive_offs').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo))
          : 0,

        // Reminders
        safeCount(() => (supabase.from('reminders').select('*', { count: 'exact', head: true }) as any).eq('status', 'pending').lte('due_date', new Date().toISOString())),

        // Daily reports
        notEmployee
          ? (async () => { const t = new Date(); t.setHours(0,0,0,0); return safeCount(() => supabase.from('daily_reports').select('*', { count: 'exact', head: true }).gte('created_at', t.toISOString())); })()
          : 0,

        // Performance
        notEmployee
          ? safeCount(() => supabase.from('performance_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'))
          : 0,
      ]);

      setCounts({
        messages,
        employees: onboardingCount + contractApprovalsCount + pendingAccountsCount,
        attendance: pendingLeave,
        maintenance: pendingMaintenance,
        events: newEvents,
        documents: pendingDocs,
        drive_offs: driveOffsCount,
        reminders: pendingReminders,
        daily_reports: dailyReportsCount,
        scheduling: 0,
        performance: pendingPerformance,
        training: 0,
        customer_accounts: 0,
        pending_onboardings: onboardingCount,
        contract_approvals: contractApprovalsCount,
        pending_accounts: pendingAccountsCount,
      });
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return { counts, loading, refetch: fetchCounts };
}
