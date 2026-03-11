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
  // Sub-tab counts for Employee Hub
  pending_onboardings: number;
  contract_approvals: number;
  pending_accounts: number;
}

export function useNotificationCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({
    messages: 0,
    employees: 0,
    attendance: 0,
    maintenance: 0,
    events: 0,
    documents: 0,
    drive_offs: 0,
    reminders: 0,
    daily_reports: 0,
    scheduling: 0,
    performance: 0,
    training: 0,
    customer_accounts: 0,
    pending_onboardings: 0,
    contract_approvals: 0,
    pending_accounts: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    try {
      const newCounts: NotificationCounts = {
        messages: 0, employees: 0, attendance: 0, maintenance: 0,
        events: 0, documents: 0, drive_offs: 0, reminders: 0,
        daily_reports: 0, scheduling: 0, performance: 0, training: 0,
        customer_accounts: 0, pending_onboardings: 0, contract_approvals: 0, pending_accounts: 0
      };

      // Run all queries in parallel for speed, each wrapped in try-catch so one failure doesn't block all
      const results = await Promise.allSettled([
        // 0: Unread messages
        (async () => {
          const { data: participations } = await supabase
            .from('conversation_participants')
            .select('conversation_id, last_read_at')
            .eq('user_id', user.id);
          let count = 0;
          if (participations) {
            const msgCounts = await Promise.allSettled(
              participations.map(p =>
                supabase
                  .from('messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('conversation_id', p.conversation_id)
                  .neq('sender_id', user.id)
                  .gt('created_at', p.last_read_at || '1970-01-01')
              )
            );
            for (const r of msgCounts) {
              if (r.status === 'fulfilled') count += r.value.count || 0;
            }
          }
          return count;
        })(),

        // 1: Pending leave
        (user.role !== 'employee'
          ? supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending').then(r => r.count || 0)
          : Promise.resolve(0)),

        // 2: Pending maintenance
        (user.role !== 'employee'
          ? supabase.from('maintenance_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']).then(r => r.count || 0)
          : Promise.resolve(0)),

        // 3: Events last 7 days
        supabase.from('events').select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .then(r => r.count || 0),

        // 4: Onboarding employees
        (['super_admin', 'hr', 'manager'].includes(user.role)
          ? supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'onboarding').then(r => r.count || 0)
          : Promise.resolve(0)),

        // 5: Contract approvals (pending)
        (['super_admin', 'hr', 'manager'].includes(user.role)
          ? supabase.from('contract_approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending').then(r => r.count || 0)
          : Promise.resolve(0)),

        // 6: Pending accounts
        (['super_admin', 'hr'].includes(user.role)
          ? supabase.from('employees').select('*', { count: 'exact', head: true }).eq('account_activated', false).eq('status', 'active').then(r => r.count || 0)
          : Promise.resolve(0)),

        // 7: Pending documents
        (user.role !== 'employee'
          ? supabase.from('documents').select('*', { count: 'exact', head: true }).lte('follow_up_date', new Date().toISOString()).is('verified_at', null).then(r => r.count || 0)
          : Promise.resolve(0)),

        // 8: Drive-offs last 7 days
        (user.role !== 'employee'
          ? supabase.from('drive_offs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).then(r => r.count || 0)
          : Promise.resolve(0)),

        // 9: Pending reminders
        supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending').lte('due_date', new Date().toISOString()).then(r => r.count || 0),

        // 10: Daily reports today
        (user.role !== 'employee'
          ? (() => { const t = new Date(); t.setHours(0,0,0,0); return supabase.from('daily_reports').select('*', { count: 'exact', head: true }).gte('created_at', t.toISOString()).then(r => r.count || 0); })()
          : Promise.resolve(0)),

        // 11: Pending performance reviews
        (user.role !== 'employee'
          ? supabase.from('performance_reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending').then(r => r.count || 0)
          : Promise.resolve(0)),
      ]);

      const val = (idx: number) => results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<number>).value : 0;

      const onboarding = val(4);
      const contractApprovals = val(5);
      const pendingAccounts = val(6);

      setCounts({
        messages: val(0),
        employees: onboarding + contractApprovals + pendingAccounts,
        attendance: val(1),
        maintenance: val(2),
        events: val(3),
        documents: val(7),
        drive_offs: val(8),
        reminders: val(9),
        daily_reports: val(10),
        scheduling: 0,
        performance: val(11),
        training: 0,
        customer_accounts: 0,
        pending_onboardings: onboarding,
        contract_approvals: contractApprovals,
        pending_accounts: pendingAccounts,
      });
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCounts();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return { counts, loading, refetch: fetchCounts };
}
