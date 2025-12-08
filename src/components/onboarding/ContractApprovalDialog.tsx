import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building, User, FileText, CheckCircle, XCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ContractApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: any;
  onApprove: (signature: string) => void;
  onReject: (reason: string) => void;
}

export default function ContractApprovalDialog({
  open,
  onOpenChange,
  approval,
  onApprove,
  onReject,
}: ContractApprovalDialogProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [signature, setSignature] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!approval) return null;

  const employee = approval.employee;
  if (!employee) return null;

  const handleDownloadContract = async () => {
    if (approval.contract_file_path) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(approval.contract_file_path, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const handleApprove = async () => {
    if (!signature.trim()) return;
    setIsSubmitting(true);
    await onApprove(signature);
    setIsSubmitting(false);
    setSignature('');
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    await onReject(rejectReason);
    setIsSubmitting(false);
    setRejectReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contract Approval</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Employee Details</TabsTrigger>
            <TabsTrigger value="contract">Contract</TabsTrigger>
            <TabsTrigger value="action">Approve/Reject</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Employee Name</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{employee.first_name} {employee.last_name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{employee.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Job Title</Label>
                <p className="font-medium">{employee.job_title || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Department</Label>
                <p className="font-medium">{employee.department || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Organization</Label>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  <span className="font-medium">{employee.organization?.name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Branch</Label>
                <p className="font-medium">{employee.branch?.name}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contract" className="space-y-4 pt-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{approval.contract_file_name || 'Contract Document'}</p>
                  <p className="text-sm text-muted-foreground">
                    Submitted: {new Date(approval.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDownloadContract} disabled={!approval.contract_file_path}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Review the contract document before approving
              </p>
            </div>
          </TabsContent>

          <TabsContent value="action" className="space-y-6 pt-4">
            <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Approve Contract</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signature">Admin Signature (Type your name)</Label>
                <Input
                  id="signature"
                  placeholder="Enter your full name as signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleApprove} 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!signature.trim() || isSubmitting}
              >
                {isSubmitting ? 'Approving...' : 'Approve & Sign Contract'}
              </Button>
            </div>

            <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <h3 className="font-semibold">Reject Contract</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Rejection Reason</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Explain why the contract is being rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                variant="destructive" 
                onClick={handleReject}
                className="w-full"
                disabled={!rejectReason.trim() || isSubmitting}
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Contract'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
