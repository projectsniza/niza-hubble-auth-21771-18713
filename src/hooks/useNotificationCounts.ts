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
      // Fetch unread messages count
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      let unreadMessages = 0;
      if (participations) {
        for (const p of participations) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', p.conversation_id)
            .neq('sender_id', user.id)
            .gt('created_at', p.last_read_at || '1970-01-01');
          unreadMessages += count || 0;
        }
      }

      // Fetch pending leave requests count (for HR/admin)
      let pendingLeave = 0;
      if (user.role === 'super_admin' || user.role === 'hr' || user.role === 'manager') {
        const { count } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        pendingLeave = count || 0;
      }

      // Fetch pending maintenance tickets
      let pendingMaintenance = 0;
      if (user.role !== 'employee') {
        const { count } = await supabase
          .from('maintenance_tickets')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress']);
        pendingMaintenance = count || 0;
      }

      // Fetch new events in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: newEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      // Fetch onboarding employees count (for HR/admin)
      let onboardingEmployees = 0;
      let pendingOnboardings = 0;
      let contractApprovalCount = 0;
      let pendingAccountsCount = 0;
      if (user.role === 'super_admin' || user.role === 'hr' || user.role === 'manager') {
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'onboarding');
        onboardingEmployees = count || 0;
        pendingOnboardings = count || 0;

        // Pending contract approvals
        const { count: caCount } = await supabase
          .from('contract_approvals')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        contractApprovalCount = caCount || 0;

        // Pending accounts (employees awaiting activation)
        const { count: paCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('account_activated', false)
          .eq('status', 'active');
        pendingAccountsCount = paCount || 0;
      }

      // Fetch documents pending follow-up
      let pendingDocs = 0;
      if (user.role !== 'employee') {
        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .lte('follow_up_date', new Date().toISOString())
          .is('verified_at', null);
        pendingDocs = count || 0;
      }

      // Drive-offs in last 7 days
      let driveOffs = 0;
      if (user.role !== 'employee') {
        const { count } = await supabase
          .from('drive_offs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo.toISOString());
        driveOffs = count || 0;
      }

      // Pending reminders (due today or overdue)
      let pendingReminders = 0;
      const { count: reminderCount } = await (supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true }) as any)
        .eq('status', 'pending')
        .lte('due_date', new Date().toISOString());
      pendingReminders = (reminderCount as number) || 0;

      // Daily reports submitted today
      let dailyReports = 0;
      if (user.role !== 'employee') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('daily_reports')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString());
        dailyReports = count || 0;
      }

      // Pending performance reviews
      let pendingPerformance = 0;
      if (user.role !== 'employee') {
        const { count } = await supabase
          .from('performance_reviews')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        pendingPerformance = count || 0;
      }

      setCounts({
        messages: unreadMessages,
        employees: onboardingEmployees + contractApprovalCount + pendingAccountsCount,
        attendance: pendingLeave,
        maintenance: pendingMaintenance,
        events: newEvents || 0,
        documents: pendingDocs,
        drive_offs: driveOffs,
        reminders: pendingReminders,
        daily_reports: dailyReports,
        scheduling: 0,
        performance: pendingPerformance,
        training: 0,
        customer_accounts: 0,
        pending_onboardings: pendingOnboardings,
        contract_approvals: contractApprovalCount,
        pending_accounts: pendingAccountsCount
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
