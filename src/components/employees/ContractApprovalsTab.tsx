import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, CheckCircle2, User, Building, Calendar, 
  FileSignature, FileText, Clock, ShieldAlert, Check, ArrowRight,
  AlertTriangle, Trash2, Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { usePendingApprovals } from '@/hooks/useEmployees';
import ContractApprovalDialog from '@/components/onboarding/ContractApprovalDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function ContractApprovalsTab() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [approvalToDismiss, setApprovalToDismiss] = useState<any>(null);
  const [dismissing, setDismissing] = useState(false);
  
  const { pendingApprovals, isLoading, approveContract, rejectContract, dismissDuplicateApproval, refetch } = usePendingApprovals();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { count: awaiting } = await supabase
        .from('contract_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .is('signed_contract_path', null);

      const { count: completed } = await supabase
        .from('contract_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .not('signed_contract_path', 'is', null);

      setAwaitingCount(awaiting || 0);
      setCompletedCount(completed || 0);
    } catch (e) {
      console.error('Error fetching approval stats:', e);
    }
  };

  const handleApprove = async (signature: string, signatureType: string, signatureDate: string, employerName: string) => {
    if (selectedApproval) {
      await approveContract(selectedApproval.id, signature, signatureType, signatureDate, employerName);
      setSelectedApproval(null);
      fetchStats();
      refetch?.();
    }
  };

  const handleReject = async (reason: string) => {
    if (selectedApproval) {
      await rejectContract(selectedApproval.id, reason);
      setSelectedApproval(null);
      fetchStats();
      refetch?.();
    }
  };

  const handleDismissDuplicate = async () => {
    if (!approvalToDismiss) return;
    setDismissing(true);
    try {
      await dismissDuplicateApproval(approvalToDismiss.id);
      setApprovalToDismiss(null);
      fetchStats();
    } finally {
      setDismissing(false);
    }
  };

  const duplicateApprovalIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < pendingApprovals.length; i++) {
      for (let j = i + 1; j < pendingApprovals.length; j++) {
        const a = pendingApprovals[i];
        const b = pendingApprovals[j];
        const aFirst = (a.employee?.first_name || '').trim().toLowerCase();
        const aLast = (a.employee?.last_name || '').trim().toLowerCase();
        const bFirst = (b.employee?.first_name || '').trim().toLowerCase();
        const bLast = (b.employee?.last_name || '').trim().toLowerCase();

        const exactNameMatch = aFirst && bFirst && aFirst === bFirst && aLast && bLast && aLast === bLast;
        const matchingLastNameAndBranch = Boolean(
          aLast && bLast && aLast === bLast && 
          a.employee?.branch?.name && b.employee?.branch?.name && 
          a.employee.branch.name === b.employee.branch.name
        );
        const nameContained = Boolean(
          (aLast.includes(bLast) || bLast.includes(aLast)) &&
          a.employee?.branch?.name && b.employee?.branch?.name &&
          a.employee.branch.name === b.employee.branch.name
        );

        if (exactNameMatch || matchingLastNameAndBranch || nameContained) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [pendingApprovals]);

  const filteredApprovals = pendingApprovals.filter(approval => {
    const employee = approval.employee;
    if (!employee) return false;
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Only Super Admin can see this tab
  if (user?.role !== 'super_admin') {
    return (
      <Card className="p-12 text-center border">
        <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-1">Access Restricted</h3>
        <p className="text-sm text-muted-foreground">Only Super Administrator accounts have authorization to review and sign contracts.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Review</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{pendingApprovals.length}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5 border shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approved & Awaiting Upload</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{awaitingCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <FileSignature className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5 border shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fully Executed</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{completedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidate name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <Card className="p-12 text-center border">
          <Check className="h-10 w-10 mx-auto text-emerald-600 mb-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-full p-2" />
          <h3 className="text-base font-semibold mb-1">All Approvals Clear</h3>
          <p className="text-xs text-muted-foreground">There are currently no employment contracts pending Super Admin signature.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredApprovals.map((approval) => {
            const employee = approval.employee;
            if (!employee) return null;
            const isDuplicate = duplicateApprovalIds.has(approval.id);
            
            return (
              <Card 
                key={approval.id} 
                className={`p-5 border transition-all ${
                  isDuplicate 
                    ? 'border-amber-400/60 bg-amber-500/[0.02] hover:border-amber-500/80' 
                    : 'hover:shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold text-sm ${
                        isDuplicate ? 'bg-amber-500/20 text-amber-700' : 'bg-primary/10 text-primary'
                      }`}>
                        {employee.first_name?.[0] || ''}{employee.last_name?.[0] || 'E'}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {employee.first_name ? `${employee.first_name} ` : ''}{employee.last_name}
                          </h3>
                          {isDuplicate && (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400 gap-1 font-semibold">
                              <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                              Possible Duplicate
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-300">
                            Awaiting Admin Signature
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{employee.job_title || 'Unassigned Role'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{employee.organization?.name} • {employee.branch?.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Submitted {new Date(approval.submitted_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{approval.contract_file_name || 'Standard Employment Contract'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isDuplicate && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 px-2.5"
                        onClick={() => setApprovalToDismiss(approval)}
                        title="Dismiss duplicate approval"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </Button>
                    )}
                    <Button onClick={() => setSelectedApproval(approval)} size="sm" className="h-8 text-xs gap-1.5">
                      <span>Review & Sign</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ContractApprovalDialog
        open={!!selectedApproval}
        onOpenChange={() => setSelectedApproval(null)}
        approval={selectedApproval}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* Dismiss Duplicate Submission Dialog */}
      <AlertDialog open={!!approvalToDismiss} onOpenChange={(open) => !open && setApprovalToDismiss(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              <AlertDialogTitle>Dismiss Duplicate Submission?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-1 text-left text-xs">
              <p className="text-foreground font-medium">
                Are you sure you want to dismiss this contract approval submission for{' '}
                <strong>
                  {approvalToDismiss?.employee?.first_name ? `${approvalToDismiss.employee.first_name} ` : ''}
                  {approvalToDismiss?.employee?.last_name || 'Employee'}
                </strong>
                ?
              </p>
              <p className="text-muted-foreground">
                This will delete the redundant approval request. The candidate's primary profile and active submissions will not be affected.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dismissing} onClick={() => setApprovalToDismiss(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={dismissing}
              className="bg-destructive hover:bg-destructive/90 text-white font-medium"
              onClick={handleDismissDuplicate}
            >
              {dismissing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Dismissing...
                </>
              ) : (
                'Yes, Dismiss Duplicate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}