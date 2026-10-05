import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, CheckCircle2, User, Building, Calendar, 
  FileSignature, FileText, Clock, ShieldAlert, Check, ArrowRight
} from 'lucide-react';
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
  
  const { pendingApprovals, isLoading, approveContract, rejectContract, refetch } = usePendingApprovals();

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
            
            return (
              <Card key={approval.id} className="p-5 border hover:shadow-xs transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
                        {employee.first_name?.[0]}{employee.last_name?.[0]}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {employee.first_name} {employee.last_name}
                          </h3>
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
    </div>
  );
}