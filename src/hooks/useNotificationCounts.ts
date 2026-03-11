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
      const today = new Date(); today.setHours(0,0,0,0);

      // Messages
      let messages = 0;
      try {
        const { data: participations } = await supabase
          .from('conversation_participants')
          .select('conversation_id, last_read_at')
          .eq('user_id', user.id);
        if (participations?.length) {
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
            if (r.status === 'fulfilled') messages += r.value.count || 0;
          }
        }
      } catch { /* ignore */ }

      // All other counts - run in parallel, each in try-catch
      let pendingLeave = 0, pendingMaintenance = 0, newEvents = 0;
      let onboardingCount = 0, contractApprovalsCount = 0, pendingAccountsCount = 0;
      let pendingDocs = 0, driveOffsCount = 0, pendingReminders = 0;
      let dailyReportsCount = 0, pendingPerformance = 0;

      const promises: Promise<void>[] = [];

      if (isAdmin) {
        promises.push((async () => { try { const r = await supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'); pendingLeave = r.count || 0; } catch {} })());
        promises.push((async () => { try { const r = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'onboarding'); onboardingCount = r.count || 0; } catch {} })());
        promises.push((async () => { try { const r = await supabase.from('contract_approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'); contractApprovalsCount = r.count || 0; } catch {} })());
      }

      if (['super_admin', 'hr'].includes(user.role)) {
        promises.push((async () => { try { const r = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('account_activated', false).eq('status', 'active'); pendingAccountsCount = r.count || 0; } catch {} })());
      }

      if (notEmployee) {
        promises.push((async () => { try { const r = await supabase.from('maintenance_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']); pendingMaintenance = r.count || 0; } catch {} })());
        promises.push((async () => { try { const r = await supabase.from('documents').select('*', { count: 'exact', head: true }).lte('follow_up_date', new Date().toISOString()).is('verified_at', null); pendingDocs = r.count || 0; } catch {} })());
        promises.push((async () => { try { const r = await supabase.from('drive_offs').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo); driveOffsCount = r.count || 0; } catch {} })());
        promises.push((async () => { try { const r = await supabase.from('daily_reports').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()); dailyReportsCount = r.count || 0; } catch {} })());
        promises.push((async () => { try { const r = await supabase.from('performance_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'); pendingPerformance = r.count || 0; } catch {} })());
      }

      promises.push((async () => { try { const r = await supabase.from('events').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo); newEvents = r.count || 0; } catch {} })());
      promises.push((async () => { try { const r = await (supabase.from('reminders').select('*', { count: 'exact', head: true }) as any).eq('status', 'pending').lte('due_date', new Date().toISOString()); pendingReminders = r.count || 0; } catch {} })());

      await Promise.allSettled(promises);

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
