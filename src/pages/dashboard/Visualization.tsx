import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';

export default function Visualization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branches } = useOrgBranch();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  const branchList = useMemo(() => {
    return [
      { id: 'all', name: 'All Branches (Overview)', m: 1 },
      ...(branches || []).map((b) => ({
        id: b.id,
        name: b.name,
        m: Math.max(0.2, Number((0.6 / Math.max(1, branches.length)).toFixed(2))),
      })),
    ];
  }, [branches]);

  const fetchLiveMetrics = useCallback(async (targetBranchId: string = 'all') => {
    if (!user) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const isFiltered = targetBranchId !== 'all';

      // 1. Employees: real active employees & branch breakdown
      let empQuery = supabase
        .from('employees')
        .select('id, first_name, last_name, job_title, branch_id, status, branches(id, name)');
      if (isFiltered) empQuery = empQuery.eq('branch_id', targetBranchId);
      const empRes = await empQuery;
      const allEmployees = empRes.data || [];
      const activeEmployees = allEmployees.filter((e: any) => e.status === 'active');
      const totalActiveEmployees = activeEmployees.length;

      // Group active employees by branch for realistic deployment breakdown
      const branchStaffMap: Record<string, number> = {};
      activeEmployees.forEach((e: any) => {
        const bName = e.branches?.name || 'Main Station';
        branchStaffMap[bName] = (branchStaffMap[bName] || 0) + 1;
      });

      const staffRows = isFiltered
        ? activeEmployees.slice(0, 8).map((e: any) => [`${e.first_name} ${e.last_name}`, e.job_title || 'Team Member'])
        : Object.entries(branchStaffMap).map(([name, count]) => [name, `${count} staff`]);

      const finalStaffRows = staffRows.length > 0
        ? staffRows
        : (branches || []).map((b) => [b.name, '0 staff']);

      // 2. Real Active Clock-ins (currently clocked in)
      let clockInQuery = supabase
        .from('clock_ins')
        .select('id, user_id, clock_in_time, branch_id')
        .is('clock_out_time', null);
      if (isFiltered) clockInQuery = clockInQuery.eq('branch_id', targetBranchId);
      const clockInRes = await clockInQuery;
      const activeClockins = clockInRes.data?.length || 0;

      // 3. Real Pending Onboarding
      let onbQuery = supabase
        .from('employees')
        .select('id, branch_id, onboarding:employee_onboarding(contract_approved, contract_submitted_for_approval), contract_approval:contract_approvals(status)')
        .in('status', ['onboarding', 'awaiting_signature', 'awaiting_approval']);
      if (isFiltered) onbQuery = onbQuery.eq('branch_id', targetBranchId);
      const onbRes = await onbQuery;
      const pendingOnboarding = (onbRes.data || []).filter((emp: any) => {
        const onb = emp.onboarding?.[0];
        const ca = emp.contract_approval?.[0];
        if (onb?.contract_approved) return false;
        if (onb?.contract_submitted_for_approval) return false;
        if (ca?.status === 'pending' || ca?.status === 'approved') return false;
        return true;
      }).length;

      // 4. Real Contract Approvals
      let caQuery = supabase
        .from('contract_approvals')
        .select('id, status', { count: 'exact', head: true })
        .eq('status', 'pending');
      const caRes = await caQuery;
      const contractApprovals = caRes.count || 0;

      // 5. Real Drive-Offs: open / unpaid
      let driveOffsQuery = supabase
        .from('drive_offs')
        .select('id, vehicle_registration, amount_drive_off, total_amount_received, payment_received_date');
      if (isFiltered) driveOffsQuery = driveOffsQuery.eq('branch_id', targetBranchId);
      const driveOffsRes = await driveOffsQuery.limit(20);
      const openDriveOffs = (driveOffsRes.data || []).filter(
        (d: any) => !d.payment_received_date && Number(d.total_amount_received || 0) < Number(d.amount_drive_off || 0)
      );
      const driveOffsCount = openDriveOffs.length;
      const driveOffsUnpaid = openDriveOffs.reduce(
        (acc: number, d: any) => acc + (Number(d.amount_drive_off) - Number(d.total_amount_received || 0)),
        0
      );
      const driveOffsPlates = openDriveOffs.map((d: any) => [d.vehicle_registration, Number(d.amount_drive_off) || 45]);

      // 6. Real Lottery: active games & flagged records
      let lotteryGamesQuery = supabase
        .from('lottery_games')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (isFiltered) lotteryGamesQuery = lotteryGamesQuery.eq('branch_id', targetBranchId);
      const lotteryRes = await lotteryGamesQuery;
      const activeLotterySlots = lotteryRes.count || 0;

      let lotteryRecordsQuery = supabase
        .from('lottery_daily_records')
        .select('id, stock_begin, activated_tickets, stock_end, tickets_sold')
        .gte('record_date', todayISO);
      if (isFiltered) lotteryRecordsQuery = lotteryRecordsQuery.eq('branch_id', targetBranchId);
      const lotteryRecsRes = await lotteryRecordsQuery.limit(20);
      const variancesCount = (lotteryRecsRes.data || []).filter((r: any) => {
        const expected = (Number(r.stock_begin) || 0) + (Number(r.activated_tickets) || 0) - (Number(r.tickets_sold) || 0);
        return Math.abs(expected - (Number(r.stock_end) || 0)) > 0;
      }).length;

      // 7. Real Daily Reports
      let repQuery = supabase.from('daily_reports').select('id, status', { count: 'exact' }).gte('created_at', todayISO);
      if (isFiltered) repQuery = repQuery.eq('branch_id', targetBranchId);
      const repRes = await repQuery;
      const reportsReconciled = repRes.count || 0;

      // 8. Real Maintenance Tickets
      let maintQuery = supabase
        .from('maintenance_tickets')
        .select('id, title, priority, status, created_at')
        .in('status', ['open', 'in_progress']);
      if (isFiltered) maintQuery = maintQuery.eq('branch_id', targetBranchId);
      const maintRes = await maintQuery.limit(8);
      const openTickets = maintRes.data || [];
      const maintTicketRows = openTickets.map((t: any) => [
        t.title || 'Equipment maintenance',
        t.priority || 'Normal',
        t.priority === 'urgent' ? 'alert' : 'warn',
      ]);

      // 9. Real Scheduling / Leave requests
      let leaveQuery = supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (isFiltered) leaveQuery = leaveQuery.eq('branch_id', targetBranchId);
      const leaveRes = await leaveQuery;
      const holidayPending = leaveRes.count || 0;

      const hrBanner =
        contractApprovals > 0 || pendingOnboarding > 0
          ? `${contractApprovals} contract approval(s) • ${pendingOnboarding} onboarding pending`
          : 'All staff records and store rosters active';

      const payload = {
        totalEmployees: totalActiveEmployees,
        onShift: totalActiveEmployees,
        activeClockins: activeClockins,
        pendingOnboarding: pendingOnboarding,
        contractApprovals: contractApprovals,
        staffRowsTitle: isFiltered ? 'Branch Staff Roster' : 'Staff Deployment by Branch',
        staffRows: finalStaffRows,
        hrBanner: hrBanner,
        driveoffs: {
          count: driveOffsCount,
          unpaid: driveOffsUnpaid,
          plates: driveOffsPlates,
        },
        lottery: {
          activeSlots: activeLotterySlots,
          variances: variancesCount,
        },
        reports: {
          reconciled: reportsReconciled,
          pending: Math.max(0, (branches?.length || 1) - reportsReconciled),
        },
        maintenance: {
          tickets: openTickets.length,
          overdue: 0,
          ticketRows: maintTicketRows,
        },
        scheduling: {
          holidayPending,
        },
      };

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'SET_LIVE_DATA',
            branches: branchList,
            liveData: payload,
          },
          '*'
        );
      }
    } catch (err) {
      console.error('Error fetching live digital twin telemetry:', err);
    }
  }, [user, branchList, branches]);

  // Initial fetch and message listener
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'NAVIGATE' && e.data.route) {
        navigate(e.data.route);
      }

      if (e.data.type === 'VISUALIZATION_READY') {
        fetchLiveMetrics(selectedBranchId);
      }

      if (e.data.type === 'BRANCH_CHANGED' && e.data.branchId) {
        setSelectedBranchId(e.data.branchId);
        fetchLiveMetrics(e.data.branchId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, fetchLiveMetrics, selectedBranchId]);

  // Periodic polling every 30 seconds for live synchronization
  useEffect(() => {
    fetchLiveMetrics(selectedBranchId);
    const interval = setInterval(() => {
      fetchLiveMetrics(selectedBranchId);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveMetrics, selectedBranchId]);

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] relative overflow-hidden bg-[#050912]">
      <iframe
        ref={iframeRef}
        src="/visualization.html"
        title="NIZA Cloud – 3D Station Visualization"
        className="w-full h-full border-0 block"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        onLoad={() => {
          fetchLiveMetrics(selectedBranchId);
        }}
      />
    </div>
  );
}
