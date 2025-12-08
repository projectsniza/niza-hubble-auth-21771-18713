import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, CheckCircle, XCircle, Clock, User, Building, Calendar, FileSignature } from 'lucide-react';
import OnboardingDetailsDialog from './OnboardingDetailsDialog';
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

const mockRequests: OnboardingRequest[] = [
  {
    id: '1',
    name: 'John Smith',
    position: 'Sales Assistant',
    branch: 'Eastbourne Store',
    status: 'pending',
    submittedBy: 'Sarah Johnson (Manager)',
    submittedDate: '2024-03-15',
    email: 'john.smith@example.com',
    phone: '+44 7700 900123',
    address: '123 High Street, Eastbourne, BN21 1AA',
    startDate: '2024-04-01',
    salary: '£11.50/hour',
    documents: [
      { name: 'Right to Work - Passport', uploaded: true },
      { name: 'Starter Checklist', uploaded: true },
      { name: 'Employment Contract', uploaded: false },
      { name: 'Proof of Address', uploaded: true },
      { name: 'Bank Details Form', uploaded: true }
    ],
    contractSigned: false,
    contractEntity: 'Niza Superstores Eastbourne Ltd'
  },
  {
    id: '2',
    name: 'Emma Wilson',
    position: 'Store Supervisor',
    branch: 'Southwater Store',
    status: 'approved',
    submittedBy: 'Mike Davies (Manager)',
    submittedDate: '2024-03-10',
    email: 'emma.wilson@example.com',
    phone: '+44 7700 900456',
    address: '45 Main Road, Southwater, RH13 9XX',
    startDate: '2024-03-20',
    salary: '£13.00/hour',
    documents: [
      { name: 'Right to Work - Passport', uploaded: true },
      { name: 'Starter Checklist', uploaded: true },
      { name: 'Employment Contract', uploaded: true },
      { name: 'Proof of Address', uploaded: true },
      { name: 'Bank Details Form', uploaded: true }
    ],
    contractSigned: true,
    contractEntity: 'Niza Southwater Ltd'
  },
  {
    id: '3',
    name: 'David Brown',
    position: 'Cashier',
    branch: 'Forecourt Store',
    status: 'pending',
    submittedBy: 'Lisa Anderson (Manager)',
    submittedDate: '2024-03-14',
    email: 'david.brown@example.com',
    phone: '+44 7700 900789',
    address: '78 Station Road, Horsham, RH12 1XX',
    startDate: '2024-03-25',
    salary: '£11.00/hour',
    documents: [
      { name: 'Right to Work - Share Code', uploaded: true },
      { name: 'Starter Checklist', uploaded: true },
      { name: 'Employment Contract', uploaded: true },
      { name: 'Proof of Address', uploaded: false },
      { name: 'Bank Details Form', uploaded: true }
    ],
    contractSigned: true,
    contractEntity: 'Niza Forecourt Ltd'
  },
  {
    id: '4',
    name: 'Sophie Taylor',
    position: 'Stock Controller',
    branch: 'Enterprises Store',
    status: 'rejected',
    submittedBy: 'Tom Harris (Manager)',
    submittedDate: '2024-03-08',
    email: 'sophie.taylor@example.com',
    phone: '+44 7700 900321',
    address: '90 Park Lane, Sutton, SM2 5XX',
    startDate: '2024-03-18',
    salary: '£12.00/hour',
    documents: [
      { name: 'Right to Work - Passport', uploaded: false },
      { name: 'Starter Checklist', uploaded: true },
      { name: 'Employment Contract', uploaded: false },
      { name: 'Proof of Address', uploaded: true },
      { name: 'Bank Details Form', uploaded: false }
    ],
    contractSigned: false,
    contractEntity: 'Niza Enterprises Ltd'
  }
];

export default function OnboardingApprovals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  const [requests, setRequests] = useState(mockRequests);

  const handleApprove = (id: string) => {
    setRequests(prev =>
      prev.map(req => req.id === id ? { ...req, status: 'approved' as const } : req)
    );
  };

  const handleReject = (id: string, reason: string) => {
    setRequests(prev =>
      prev.map(req => req.id === id ? { ...req, status: 'rejected' as const } : req)
    );
  };

  const handleSignContract = (id: string) => {
    setRequests(prev =>
      prev.map(req => req.id === id ? { ...req, contractSigned: true } : req)
    );
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || request.branch === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  const awaitingSignatureCount = requests.filter(r => r.status === 'pending' && !r.contractSigned).length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Onboarding Approvals</h1>
        <p className="text-muted-foreground">Review, sign contracts, and approve employee onboarding applications</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending</p>
              <p className="text-3xl font-bold">{pendingCount}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Approved</p>
              <p className="text-3xl font-bold">{approvedCount}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Rejected</p>
              <p className="text-3xl font-bold">{rejectedCount}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Awaiting Signature</p>
              <p className="text-3xl font-bold">{awaitingSignatureCount}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <FileSignature className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
          <TabsTrigger value="all">All Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {filteredRequests.filter(r => r.status === 'pending').length === 0 ? (
            <Card className="p-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No pending applications</p>
            </Card>
          ) : (
            filteredRequests.filter(r => r.status === 'pending').map((request) => (
              <Card key={request.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{request.name}</h3>
                        <p className="text-sm text-muted-foreground">{request.position}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{request.branch}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Starts: {request.startDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>By: {request.submittedBy}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        <Badge
                          variant={request.status === 'pending' ? 'secondary' : 'default'}
                        >
                          {request.status}
                        </Badge>
                        {!request.contractSigned && request.status === 'pending' && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <FileSignature className="h-3 w-3 mr-1" />
                            Needs Signature
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setSelectedRequest(request)}
                    variant="outline"
                    size="sm"
                  >
                    {!request.contractSigned && request.status === 'pending' ? 'Review & Sign' : 'View Details'}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-6">
          {filteredRequests.filter(r => r.status === 'approved').map((request) => (
            <Card key={request.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{request.name}</h3>
                      <p className="text-sm text-muted-foreground">{request.position}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{request.branch}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Starts: {request.startDate}</span>
                    </div>
                    <Badge variant="default" className="w-fit">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approved
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={() => setSelectedRequest(request)}
                  variant="outline"
                  size="sm"
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-6">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      request.status === 'approved' ? 'bg-green-500/10' :
                      request.status === 'rejected' ? 'bg-destructive/10' :
                      'bg-primary/10'
                    }`}>
                      <User className={`h-5 w-5 ${
                        request.status === 'approved' ? 'text-green-500' :
                        request.status === 'rejected' ? 'text-destructive' :
                        'text-primary'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{request.name}</h3>
                      <p className="text-sm text-muted-foreground">{request.position}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{request.branch}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{request.startDate}</span>
                    </div>
                    <Badge variant={
                      request.status === 'approved' ? 'default' :
                      request.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {request.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={() => setSelectedRequest(request)}
                  variant="outline"
                  size="sm"
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <OnboardingDetailsDialog
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        request={selectedRequest}
        onApprove={handleApprove}
        onReject={handleReject}
        onSignContract={handleSignContract}
      />
    </div>
  );
}
