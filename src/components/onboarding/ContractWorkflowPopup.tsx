import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FileSignature,
  FileCheck,
  Upload,
  ArrowRight,
  User,
  Building,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { buildCompleteContractPdf } from '@/lib/onboardingPdfs';
import ContractApprovalDialog from '@/components/onboarding/ContractApprovalDialog';
import PostApprovalOnboarding from '@/components/onboarding/PostApprovalOnboarding';

interface PendingApprovalItem {
  id: string;
  employee_id: string;
  status: string;
  submitted_at: string | null;
  contract_content: any;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    status: string;
    organization?: { name: string } | null;
    branch?: { name: string } | null;
  } | null;
  documents?: any[];
}

interface ApprovedContractItem {
  id: string;
  employee_id: string;
  status: string;
  approved_at: string | null;
  signed_contract_path: string | null;
  employer_signed_date: string | null;
  contract_content: any;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    status: string;
    organization_id?: string;
    branch_id?: string;
    organization?: { name: string } | null;
    branch?: { name: string } | null;
  } | null;
}

export default function ContractWorkflowPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === 'super_admin';
  const isHR = user?.role === 'hr';
  const isManager = user?.role === 'manager';
  const canAccessApprovedContracts = isSuperAdmin || isHR || isManager;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'approvals' | 'approved'>('approvals');
  const [loading, setLoading] = useState(true);

  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [approvedContracts, setApprovedContracts] = useState<ApprovedContractItem[]>([]);

  // Selected approval for Super Admin review dialog
  const [selectedApprovalForSign, setSelectedApprovalForSign] = useState<any>(null);

  // Selected employee for embedded 3-stage activation view
  const [activeActivationEmployeeId, setActiveActivationEmployeeId] = useState<string | null>(null);

  // Session dismissal state
  const [isDismissed, setIsDismissed] = useState(false);

  // 1. Fetch pending contract approvals (Super Admin alone)
  const fetchPendingApprovals = useCallback(async () => {
    if (!isSuperAdmin) {
      setPendingApprovals([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('contract_approvals')
        .select(`
          id,
          employee_id,
          status,
          submitted_at,
          contract_content,
          employee:employees!contract_approvals_employee_id_fkey(
            id,
            first_name,
            last_name,
            job_title,
            status,
            organization:organizations(name),
            branch:branches(name)
          )
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setPendingApprovals((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching pending approvals for popup:', err);
    }
  }, [isSuperAdmin]);

  // 2. Fetch approved contracts awaiting final physical upload & activation
  const fetchApprovedContracts = useCallback(async () => {
    if (!canAccessApprovedContracts) {
      setApprovedContracts([]);
      return;
    }

    try {
      let query = supabase
        .from('contract_approvals')
        .select(`
          id,
          employee_id,
          status,
          approved_at,
          signed_contract_path,
          employer_signed_date,
          contract_content,
          employee:employees!contract_approvals_employee_id_fkey(
            id,
            first_name,
            last_name,
            job_title,
            status,
            organization_id,
            branch_id,
            organization:organizations(name),
            branch:branches(name)
          )
        `)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter for contracts where 3-stage activation is NOT complete (employee status !== 'active')
      let list = ((data as any[]) || []).filter(item => {
        const emp = item.employee;
        if (!emp) return false;
        // Scope restrictions for HR and Manager
        if (isManager && user?.branchId && emp.branch_id !== user.branchId) {
          return false;
        }
        if (isHR) {
          if (user?.hrAccessLevel === 'branch' && user?.branchId && emp.branch_id !== user.branchId) {
            return false;
          }
          if (user?.hrAccessLevel === 'organization' && user?.organizationId && emp.organization_id !== user.organizationId) {
            return false;
          }
        }
        // Exclude already active employees (completed all 3 stages)
        return emp.status !== 'active';
      });

      setApprovedContracts(list);
    } catch (err) {
      console.error('Error fetching approved contracts for popup:', err);
    }
  }, [canAccessApprovedContracts, isHR, isManager, isSuperAdmin, user?.branchId, user?.hrAccessLevel, user?.organizationId]);

  // Combined fetch
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPendingApprovals(), fetchApprovedContracts()]);
    setLoading(false);
  }, [fetchPendingApprovals, fetchApprovedContracts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Real-time Postgres subscriptions to keep counts live
  useEffect(() => {
    const channel = supabase
      .channel('contract-workflow-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contract_approvals' },
        () => {
          refreshAll();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        () => {
          refreshAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAll]);

  // Decide if popup should automatically open
  const totalPendingApprovals = isSuperAdmin ? pendingApprovals.length : 0;
  const totalApprovedAwaitingActivation = canAccessApprovedContracts ? approvedContracts.length : 0;
  const totalWorkflowActionCount = totalPendingApprovals + totalApprovedAwaitingActivation;

  useEffect(() => {
    if (loading) return;

    if (totalWorkflowActionCount > 0 && !isDismissed) {
      setIsOpen(true);
      // Pick initial active tab based on role and pending counts
      if (isSuperAdmin && totalPendingApprovals > 0) {
        setActiveTab('approvals');
      } else if (totalApprovedAwaitingActivation > 0) {
        setActiveTab('approved');
      }
    } else if (totalWorkflowActionCount === 0) {
      // Automatically close if all items completed!
      setIsOpen(false);
      setActiveActivationEmployeeId(null);
    }
  }, [loading, totalWorkflowActionCount, isDismissed, isSuperAdmin, totalPendingApprovals, totalApprovedAwaitingActivation]);

  // Handle Super Admin Approving a Contract
  const handleApproveContract = async (
    signature: string,
    signatureType: string,
    signatureDate: string,
    employerName: string
  ) => {
    if (!selectedApprovalForSign) return;

    try {
      const approvalId = selectedApprovalForSign.id;
      const empId = selectedApprovalForSign.employee_id;

      const { data: existing } = await supabase
        .from('contract_approvals')
        .select('contract_content')
        .eq('id', approvalId)
        .single();

      const existingContent = (existing?.contract_content as any) || {};
      const updatedContent = {
        ...existingContent,
        employer_name: employerName || existingContent.employer_name || user?.name || 'Super Admin',
      };

      const { error: updateError } = await supabase
        .from('contract_approvals')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          employer_signature: signature,
          employer_signature_type: signatureType,
          employer_signed_date: signatureDate,
          contract_content: updatedContent,
        })
        .eq('id', approvalId);

      if (updateError) throw updateError;

      // Update employee status to awaiting_signature for 3-stage physical upload
      await supabase
        .from('employees')
        .update({ status: 'awaiting_signature' })
        .eq('id', empId);

      toast.success('Contract approved and signed successfully!');
      setSelectedApprovalForSign(null);
      await refreshAll();
    } catch (err: any) {
      toast.error('Failed to approve contract: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle Super Admin Rejecting a Contract
  const handleRejectContract = async (reason: string) => {
    if (!selectedApprovalForSign) return;

    try {
      const { error } = await supabase
        .from('contract_approvals')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', selectedApprovalForSign.id);

      if (error) throw error;
      toast.success('Contract rejected');
      setSelectedApprovalForSign(null);
      await refreshAll();
    } catch (err: any) {
      toast.error('Failed to reject contract: ' + (err.message || 'Unknown error'));
    }
  };

  // Download Approved Contract PDF
  const handleDownloadApprovedContract = async (contract: ApprovedContractItem) => {
    try {
      const doc = await buildCompleteContractPdf({
        contractData: contract.contract_content || {},
        employeeData: contract.employee || {},
        organizationData: contract.employee?.organization || {},
        branchData: contract.employee?.branch || {},
        approvalData: contract || {},
      });
      const empName = `${contract.employee?.first_name || ''}_${contract.employee?.last_name || ''}`.trim().replace(/\s+/g, '_') || 'Employee';
      doc.save(`Approved_Employment_Contract_${empName}.pdf`);
      toast.success('Approved contract PDF downloaded');
    } catch (e: any) {
      toast.error('Failed to download contract PDF: ' + (e.message || 'Unknown error'));
    }
  };

  // If user is a regular employee with no elevated onboarding duties, render nothing
  if (!canAccessApprovedContracts) {
    return null;
  }

  // Helper to determine stage details for approved contracts
  const getStageInfo = (contract: ApprovedContractItem) => {
    if (!contract.signed_contract_path) {
      return {
        stage: 1,
        title: 'Stage 1 of 3: Upload Physical Signed Contract',
        badge: 'Stage 1 of 3',
        description: 'Approved by Super Admin. Wet-signature PDF scan pending upload.',
      };
    }
    return {
      stage: 2,
      title: 'Stage 2 & 3: Mandatory Documents & Activation',
      badge: 'Stage 2/3 of 3',
      description: 'Physical signed documents and final profile activation in progress.',
    };
  };

  return (
    <>
      {/* 1. Persistent Top-Bar Notification Banner / Pill if minimized while items still pending */}
      {!isOpen && totalWorkflowActionCount > 0 && (
        <div className="fixed bottom-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-background/95 backdrop-blur-md border border-primary/30 shadow-2xl rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <FileSignature className="h-5 w-5 animate-pulse" />
            </div>
            <div className="text-xs pr-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span>Onboarding Action Required</span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
              </div>
              <div className="text-muted-foreground flex gap-2 mt-0.5">
                {isSuperAdmin && totalPendingApprovals > 0 && (
                  <span>{totalPendingApprovals} Contract Approvals</span>
                )}
                {totalApprovedAwaitingActivation > 0 && (
                  <span>• {totalApprovedAwaitingActivation} Final Activations</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs font-medium rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setIsDismissed(false);
                setIsOpen(true);
              }}
            >
              Open Actions
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 2. Main Executive Workflow Popup Modal */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDismissed(true);
            setActiveActivationEmployeeId(null);
          }
          setIsOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card max-h-[90vh] flex flex-col">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                    <FileSignature className="h-4 w-4" />
                  </div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                    {activeActivationEmployeeId
                      ? 'Final Physical Upload & Activation'
                      : 'Onboarding Action Required'}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-slate-300 text-xs mt-1">
                  {activeActivationEmployeeId
                    ? 'Complete the 3-stage post-approval onboarding process to activate profile.'
                    : 'Action items pending review and completion. This notification remains active until all steps are finalized.'}
                </DialogDescription>
              </div>

              {/* Status Badges */}
              {!activeActivationEmployeeId && (
                <div className="flex items-center gap-2">
                  {isSuperAdmin && totalPendingApprovals > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2.5 py-1">
                      {totalPendingApprovals} Pending Approvals
                    </Badge>
                  )}
                  {totalApprovedAwaitingActivation > 0 && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2.5 py-1">
                      {totalApprovedAwaitingActivation} Final Activations
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Body Section */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* If user clicked to continue 3-stage activation on a specific employee */}
            {activeActivationEmployeeId ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => {
                      setActiveActivationEmployeeId(null);
                      refreshAll();
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Action List
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setIsOpen(false);
                      navigate(`/dashboard/onboarding?employeeId=${activeActivationEmployeeId}&tab=contracts`);
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Full Page
                  </Button>
                </div>

                <PostApprovalOnboarding
                  employeeId={activeActivationEmployeeId}
                  onBack={async () => {
                    setActiveActivationEmployeeId(null);
                    await refreshAll();
                  }}
                />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Tabs selection: Only Super Admin sees 'approvals' tab */}
                {isSuperAdmin && (
                  <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                    <TabsList className="grid grid-cols-2 w-full p-1 bg-muted/60 rounded-xl">
                      <TabsTrigger value="approvals" className="gap-2 text-xs rounded-lg font-medium">
                        <FileSignature className="h-3.5 w-3.5" />
                        Contract Approvals
                        {totalPendingApprovals > 0 && (
                          <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                            {totalPendingApprovals}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="approved" className="gap-2 text-xs rounded-lg font-medium">
                        <FileCheck className="h-3.5 w-3.5" />
                        Approved Contracts
                        {totalApprovedAwaitingActivation > 0 && (
                          <Badge className="ml-1 h-5 min-w-[20px] px-1 text-[10px] bg-emerald-600 text-white">
                            {totalApprovedAwaitingActivation}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}

                {/* ========================================================================= */}
                {/* SECTION 1: CONTRACT APPROVALS (SUPER ADMIN ALONE)                         */}
                {/* ========================================================================= */}
                {(isSuperAdmin && activeTab === 'approvals') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span>Super Admin Approval Required</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            ({totalPendingApprovals} awaiting your signature)
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Only Super Administrators have authorization to review, amend, and sign employment contracts.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8"
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/dashboard/employees?tab=approvals');
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Approvals Hub
                      </Button>
                    </div>

                    {pendingApprovals.length === 0 ? (
                      <Card className="p-8 text-center border-dashed">
                        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
                        <h4 className="text-sm font-semibold">All Contract Approvals Completed!</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          There are currently no contracts waiting for Super Admin review.
                        </p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {pendingApprovals.map((item) => {
                          const emp = item.employee;
                          return (
                            <Card
                              key={item.id}
                              className="p-4 border hover:border-primary/40 hover:shadow-sm transition-all"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-bold shrink-0">
                                      {emp?.first_name?.charAt(0)}{emp?.last_name?.charAt(0)}
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-semibold text-foreground">
                                        {emp?.first_name} {emp?.last_name}
                                      </h4>
                                      <p className="text-xs text-muted-foreground">
                                        {emp?.job_title || 'Position'} • {emp?.branch?.name || emp?.organization?.name || 'General Branch'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pl-10">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3 text-amber-500" />
                                      Submitted: {item.submitted_at ? format(new Date(item.submitted_at), 'dd MMM yyyy') : 'Recent'}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                                      Awaiting Super Admin Signature
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => setSelectedApprovalForSign(item)}
                                  >
                                    <FileSignature className="h-3.5 w-3.5" />
                                    Review & Sign
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================================= */}
                {/* SECTION 2: APPROVED CONTRACTS (FINAL PHYSICAL UPLOAD & ACTIVATION)         */}
                {/* ========================================================================= */}
                {(!isSuperAdmin || activeTab === 'approved') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span>Final Physical Upload & Activation</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            ({totalApprovedAwaitingActivation} contracts pending)
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Contracts approved by Super Admin. Complete all 3 stages: download contract, obtain physical employee signature, upload signed PDF scans & activate employee.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8"
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/dashboard/onboarding?tab=contracts');
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Approved Contracts Hub
                      </Button>
                    </div>

                    {approvedContracts.length === 0 ? (
                      <Card className="p-8 text-center border-dashed">
                        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
                        <h4 className="text-sm font-semibold">All Physical Uploads & Activations Completed!</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          All approved contracts have completed all 3 stages and all employee profiles are active.
                        </p>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {approvedContracts.map((contract) => {
                          const emp = contract.employee;
                          const stageInfo = getStageInfo(contract);

                          return (
                            <Card
                              key={contract.id}
                              className="p-4 border border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/50 hover:shadow-sm transition-all"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                                      {emp?.first_name?.charAt(0)}{emp?.last_name?.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-semibold text-foreground">
                                          {emp?.first_name} {emp?.last_name}
                                        </h4>
                                        <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                                          Contract Approved
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {emp?.job_title || 'Employee'} • {emp?.branch?.name || emp?.organization?.name || 'General Branch'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pl-10.5">
                                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                                      {stageInfo.badge}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs">
                                      {stageInfo.title}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1"
                                    onClick={() => handleDownloadApprovedContract(contract)}
                                    title="Download approved contract PDF to print"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download PDF
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs font-medium gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                    onClick={() => setActiveActivationEmployeeId(contract.employee_id)}
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                    Final Physical Upload & Activation
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Compliant with UK Employment Rights Act & Onboarding Governance</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 px-4 font-semibold rounded-xl border border-border/80 shadow-xs hover:bg-muted/80 text-foreground gap-2 transition-all cursor-pointer"
              onClick={() => {
                setIsDismissed(true);
                setIsOpen(false);
              }}
            >
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Remind Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Embedded Contract Approval & Signature Dialog for Super Admin */}
      {selectedApprovalForSign && (
        <ContractApprovalDialog
          open={!!selectedApprovalForSign}
          onOpenChange={(open) => !open && setSelectedApprovalForSign(null)}
          approval={selectedApprovalForSign}
          onApprove={handleApproveContract}
          onReject={handleRejectContract}
        />
      )}
    </>
  );
}

