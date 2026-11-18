import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { NizaLoader } from '@/components/ui/niza-loader';

// If the 3D scene never reports its first frame (very slow device / GPU issue), stop showing the
// loader after this long so the page is never stuck behind it.
const LOADER_MAX_MS = 20000;

export default function Visualization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branches } = useOrgBranch();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  // Mount the iframe one frame after the loader has painted, so the loader is on screen
  // before the 3D engine starts its (synchronous) scene build.
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const readyRef = useRef(false); // iframe has registered its message listener
  const inFlightRef = useRef(false); // a fetch is already running
  const pendingBranchRef = useRef<string | null>(null); // branch requested while a fetch was running
  const lastPayloadRef = useRef<unknown>(null);

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

  const postToScene = useCallback(
    (liveData: unknown) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'SET_LIVE_DATA', branches: branchList, liveData }, '*');
    },
    [branchList],
  );

  const fetchLiveMetrics = useCallback(
    async (targetBranchId: string = 'all') => {
      if (!user) return;
      // Never run overlapping fetches; remember the latest request and run it afterwards.
      if (inFlightRef.current) {
        pendingBranchRef.current = targetBranchId;
        return;
      }
      inFlightRef.current = true;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        const isFiltered = targetBranchId !== 'all';
        const byBranch = <T,>(q: T): T => (isFiltered ? (q as any).eq('branch_id', targetBranchId) : q);

        // All queries run in parallel (previously they ran one after another).
        const [empRes, clockInRes, onbRes, caRes, driveOffsRes, lotteryRes, lotteryRecsRes, repRes, maintRes, leaveRes] =
          await Promise.all([
            byBranch(supabase.from('employees').select('id, first_name, last_name, job_title, branch_id, status, branches(id, name)')),
            byBranch(supabase.from('clock_ins').select('id', { count: 'exact', head: true }).is('clock_out_time', null)),
            byBranch(
              supabase
                .from('employees')
                .select('id, branch_id, onboarding:employee_onboarding(contract_approved, contract_submitted_for_approval), contract_approval:contract_approvals(status)')
                .in('status', ['onboarding', 'awaiting_signature', 'awaiting_approval']),
            ),
            supabase.from('contract_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            byBranch(supabase.from('drive_offs').select('id, vehicle_registration, amount_drive_off, total_amount_received, payment_received_date')).limit(20),
            byBranch(supabase.from('lottery_games').select('id', { count: 'exact', head: true }).eq('is_active', true)),
            byBranch(
              supabase.from('lottery_daily_records').select('id, stock_begin, activated_tickets, stock_end, tickets_sold, returned_tickets').gte('record_date', todayISO),
            ).limit(20),
            byBranch(supabase.from('daily_reports').select('id', { count: 'exact', head: true }).gte('created_at', todayISO)),
            byBranch(supabase.from('maintenance_tickets').select('id, title, priority, status, created_at').in('status', ['open', 'in_progress'])).limit(8),
            byBranch(supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
          ]);

        // 1. Employees & branch breakdown
        const activeEmployees = (empRes.data || []).filter((e: any) => e.status === 'active');
        const totalActiveEmployees = activeEmployees.length;
        const branchStaffMap: Record<string, number> = {};
        activeEmployees.forEach((e: any) => {
          const bName = e.branches?.name || 'Main Station';
          branchStaffMap[bName] = (branchStaffMap[bName] || 0) + 1;
        });
        const staffRows = isFiltered
          ? activeEmployees.slice(0, 8).map((e: any) => [`${e.first_name} ${e.last_name}`, e.job_title || 'Team Member'])
          : Object.entries(branchStaffMap).map(([name, count]) => [name, `${count} staff`]);
        const finalStaffRows = staffRows.length > 0 ? staffRows : (branches || []).map((b) => [b.name, '0 staff']);

        // 2. Currently clocked in
        const activeClockins = clockInRes.count || 0;

        // 3. Pending onboarding
        const pendingOnboarding = (onbRes.data || []).filter((emp: any) => {
          const onb = emp.onboarding?.[0];
          const ca = emp.contract_approval?.[0];
          if (onb?.contract_approved) return false;
          if (onb?.contract_submitted_for_approval) return false;
          if (ca?.status === 'pending' || ca?.status === 'approved') return false;
          return true;
        }).length;

        // 4. Contract approvals
        const contractApprovals = caRes.count || 0;

        // 5. Drive-offs: open / unpaid
        const openDriveOffs = (driveOffsRes.data || []).filter(
          (d: any) => !d.payment_received_date && Number(d.total_amount_received || 0) < Number(d.amount_drive_off || 0),
        );
        const driveOffsUnpaid = openDriveOffs.reduce(
          (acc: number, d: any) => acc + (Number(d.amount_drive_off) - Number(d.total_amount_received || 0)),
          0,
        );
        const driveOffsPlates = openDriveOffs.map((d: any) => [d.vehicle_registration, Number(d.amount_drive_off) || 45]);

        // 6. Lottery
        const activeLotterySlots = lotteryRes.count || 0;
        const variancesCount = (lotteryRecsRes.data || []).filter((r: any) => {
          // closing should equal opening + activated - sold - returned/removed (planogram swaps)
          const expected = (Number(r.stock_begin) || 0) + (Number(r.activated_tickets) || 0) - (Number(r.tickets_sold) || 0) - (Number(r.returned_tickets) || 0);
          return Math.abs(expected - (Number(r.stock_end) || 0)) > 0;
        }).length;

        // 7. Daily reports
        const reportsReconciled = repRes.count || 0;

        // 8. Maintenance
        const openTickets = maintRes.data || [];
        const maintTicketRows = openTickets.map((t: any) => [
          t.title || 'Equipment maintenance',
          t.priority || 'Normal',
          t.priority === 'urgent' ? 'alert' : 'warn',
        ]);

        // 9. Leave requests
        const holidayPending = leaveRes.count || 0;

        const hrBanner =
          contractApprovals > 0 || pendingOnboarding > 0
            ? `${contractApprovals} contract approval(s) • ${pendingOnboarding} onboarding pending`
            : 'All staff records and store rosters active';

        const payload = {
          totalEmployees: totalActiveEmployees,
          onShift: totalActiveEmployees,
          activeClockins,
          pendingOnboarding,
          contractApprovals,
          staffRowsTitle: isFiltered ? 'Branch Staff Roster' : 'Staff Deployment by Branch',
          staffRows: finalStaffRows,
          hrBanner,
          driveoffs: { count: openDriveOffs.length, unpaid: driveOffsUnpaid, plates: driveOffsPlates },
          lottery: { activeSlots: activeLotterySlots, variances: variancesCount },
          reports: { reconciled: reportsReconciled, pending: Math.max(0, (branches?.length || 1) - reportsReconciled) },
          maintenance: { tickets: openTickets.length, overdue: 0, ticketRows: maintTicketRows },
          scheduling: { holidayPending },
        };

        lastPayloadRef.current = payload;
        if (readyRef.current) postToScene(payload);
      } catch (err) {
        console.error('Error fetching live digital twin telemetry:', err);
      } finally {
        inFlightRef.current = false;
        const next = pendingBranchRef.current;
        pendingBranchRef.current = null;
        if (next) fetchLiveMetrics(next);
      }
    },
    [user, branches, postToScene],
  );

  // Show the loader first, then start the 3D scene on the next frame.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIframeSrc('/visualization.html'));
    });
    const timeout = window.setTimeout(() => setSceneReady(true), LOADER_MAX_MS);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timeout);
    };
  }, []);

  // Messages from the 3D scene
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'NAVIGATE' && e.data.route) navigate(e.data.route);

      if (e.data.type === 'VISUALIZATION_READY') {
        readyRef.current = true;
        // Send whatever we already have immediately, then refresh.
        if (lastPayloadRef.current) postToScene(lastPayloadRef.current);
        else fetchLiveMetrics(selectedBranchId);
      }

      if (e.data.type === 'VISUALIZATION_RENDERED') setSceneReady(true);

      if (e.data.type === 'BRANCH_CHANGED' && e.data.branchId) {
        setSelectedBranchId(e.data.branchId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, fetchLiveMetrics, postToScene, selectedBranchId]);

  // Fetch now (in parallel with the scene loading) and poll every 30s while the tab is visible.
  useEffect(() => {
    fetchLiveMetrics(selectedBranchId);
    const interval = setInterval(() => {
      if (!document.hidden) fetchLiveMetrics(selectedBranchId);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveMetrics, selectedBranchId]);

  return (
    <div className="w-full h-[calc(100vh-4rem)] md:h-[calc(100vh-5.5rem)] relative overflow-hidden bg-[#050912]">
      {iframeSrc && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="NIZA Cloud – 3D Station Visualization"
          className={`w-full h-full border-0 block transition-opacity duration-700 ${sceneReady ? 'opacity-100' : 'opacity-0'}`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        />
      )}

      {/* Niza logo loader while the 3D scene loads */}
      <div
        aria-live="polite"
        aria-busy={!sceneReady}
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-white via-emerald-50 to-lime-50 transition-opacity duration-700 ${
          sceneReady ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <NizaLoader size="md" />
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Loading 3D station view</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparing live data…</p>
        </div>
      </div>
    </div>
  );
}
