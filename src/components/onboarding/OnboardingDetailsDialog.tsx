import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, Mail, Phone, MapPin, Calendar, Building, 
  FileText, CreditCard, Hash, Check, X, FileSignature,
  Download, Printer
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';

interface OnboardingRequest {
  id: string;
  name: string;
  position: string;
  branch: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  submittedDate: string;
  email: string;
  phone: string;
  address: string;
  startDate: string;
  salary: string;
  documents: { name: string; uploaded: boolean }[];
  contractSigned: boolean;
  contractEntity: string;
}

interface OnboardingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: OnboardingRequest | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  onSignContract?: (id: string) => void;
}

export default function OnboardingDetailsDialog({
  open,
  onOpenChange,
  request,
  onApprove,
  onReject,
  onSignContract
}: OnboardingDetailsDialogProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  if (!request) return null;

  const handleApprove = () => {
    if (onApprove) {
      onApprove(request.id);
      toast.success('Application approved successfully');
      onOpenChange(false);
    }
  };

  const handleReject = () => {
    if (rejectReason.trim() && onReject) {
      onReject(request.id, rejectReason);
      toast.success('Application rejected');
      setRejectReason('');
      setIsRejecting(false);
      onOpenChange(false);
    } else {
      toast.error('Please provide a reason for rejection');
    }
  };

  const handleSignContract = () => {
    if (onSignContract) {
      onSignContract(request.id);
      toast.success('Contract signed and sent back to manager');
      onOpenChange(false);
    }
  };

  const handleDownloadContract = () => {
    toast.info('Downloading contract...');
    // In a real app, this would download the actual contract PDF
  };

  const handlePrintContract = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">Onboarding Application Review</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Submitted by {request.submittedBy} on {request.submittedDate}
              </p>
            </div>
            <Badge
              variant={
                request.status === 'approved' ? 'default' :
                request.status === 'rejected' ? 'destructive' :
                'secondary'
              }
            >
              {request.status}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Employee Details</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="contract">Contract Review</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{request.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{request.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{request.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{request.address}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Position</p>
                    <p className="font-medium">{request.position}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Branch</p>
                    <p className="font-medium">{request.branch}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{request.startDate}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Salary</p>
                    <p className="font-medium">{request.salary}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Employment Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Contract Entity</p>
                  <p className="font-medium">{request.contractEntity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted By</p>
                  <p className="font-medium">{request.submittedBy}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-6">
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Uploaded Documents
              </h3>
              <div className="space-y-3">
                {request.documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{doc.name}</span>
                    </div>
                    {doc.uploaded ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          Uploaded
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary">
                        <X className="h-3 w-3 mr-1" />
                        Missing
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {request.documents.some(doc => !doc.uploaded) && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Some required documents are missing. Application cannot be approved until all documents are uploaded.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contract" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Employment Contract
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadContract}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintContract}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-6 bg-muted/30 space-y-4">
              <div className="text-center space-y-2">
                <Hash className="h-12 w-12 mx-auto text-muted-foreground" />
                <h4 className="font-semibold">Contract Preview</h4>
                <p className="text-sm text-muted-foreground">
                  Employment contract for {request.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Entity: {request.contractEntity}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Contract Status:</span>
                  <Badge variant={request.contractSigned ? 'default' : 'secondary'}>
                    {request.contractSigned ? 'Signed by Super Admin' : 'Awaiting Signature'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-medium">{request.position}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Start Date:</span>
                  <span className="font-medium">{request.startDate}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Salary:</span>
                  <span className="font-medium">{request.salary}</span>
                </div>
              </div>

              {!request.contractSigned && request.status === 'pending' && (
                <div className="pt-4">
                  <Button onClick={handleSignContract} className="w-full">
                    <FileSignature className="h-4 w-4 mr-2" />
                    Sign Contract & Send to Manager
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    This will digitally sign the contract and forward it to the manager for employee signature
                  </p>
                </div>
              )}

              {request.contractSigned && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-sm text-primary font-medium text-center">
                    ✓ Contract signed by Super Admin. Awaiting employee signature from manager.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-6 mt-6">
            {request.status === 'pending' && (
              <>
                {!isRejecting ? (
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h3 className="font-semibold mb-2">Review Checklist</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          {request.documents.every(d => d.uploaded) ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-destructive" />
                          )}
                          <span>All required documents uploaded</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {request.contractSigned ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-destructive" />
                          )}
                          <span>Contract reviewed and signed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span>Employee details verified</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleApprove}
                        className="flex-1"
                        disabled={!request.documents.every(d => d.uploaded) || !request.contractSigned}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve Application
                      </Button>
                      <Button
                        onClick={() => setIsRejecting(true)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject Application
                      </Button>
                    </div>

                    {(!request.documents.every(d => d.uploaded) || !request.contractSigned) && (
                      <p className="text-xs text-center text-muted-foreground">
                        Complete all requirements before approving
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="rejectReason">Reason for Rejection *</Label>
                      <Textarea
                        id="rejectReason"
                        placeholder="Please provide a detailed reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                        className="mt-2"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleReject} variant="destructive" className="flex-1">
                        Confirm Rejection
                      </Button>
                      <Button onClick={() => setIsRejecting(false)} variant="outline" className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {request.status === 'approved' && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                <Check className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  Application Approved
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  This onboarding application has been approved and the employee can now start work.
                </p>
              </div>
            )}

            {request.status === 'rejected' && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                <X className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                  Application Rejected
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  This onboarding application has been rejected.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
