import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, CheckCircle, XCircle, Clock, User, Building, Calendar, FileSignature, Loader2, FileText } from 'lucide-react';
import { usePendingApprovals } from '@/hooks/useEmployees';
import ContractApprovalDialog from './ContractApprovalDialog';

export default function OnboardingApprovals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  
  const { pendingApprovals, isLoading, approveContract, rejectContract } = usePendingApprovals();

  const handleApprove = async (signature: string) => {
    if (selectedApproval) {
      await approveContract(selectedApproval.id, signature);
      setSelectedApproval(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (selectedApproval) {
      await rejectContract(selectedApproval.id, reason);
      setSelectedApproval(null);
    }
  };

  const filteredApprovals = pendingApprovals.filter(approval => {
    const employee = approval.employee;
    if (!employee) return false;
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Contract Approvals</h2>
        <p className="text-muted-foreground">Review and sign employee contracts as Super Admin</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending Approvals</p>
              <p className="text-3xl font-bold">{pendingApprovals.length}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <FileSignature className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Awaiting Signature</p>
              <p className="text-3xl font-bold">{pendingApprovals.length}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {filteredApprovals.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground">No pending contract approvals</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => {
            const employee = approval.employee;
            if (!employee) return null;
            
            return (
              <Card key={approval.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">
                          {employee.first_name} {employee.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{employee.job_title || 'No title'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{employee.organization?.name}</span>
                          <span className="text-muted-foreground"> / {employee.branch?.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Submitted: {new Date(approval.submitted_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{approval.contract_file_name || 'Contract document'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        <FileSignature className="h-3 w-3 mr-1" />
                        Needs Admin Signature
                      </Badge>
                    </div>
                  </div>
                  
                  <Button onClick={() => setSelectedApproval(approval)}>
                    Review & Sign
                  </Button>
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
