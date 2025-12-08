import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CheckCircle2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import StartOnboardingDialog from './StartOnboardingDialog';
import OnboardingDetailsDialog from './OnboardingDetailsDialog';

interface OnboardingRequest {
  id: string;
  name: string;
  position: string;
  branch: string;
  status: 'pending' | 'approved' | 'completed';
  startDate?: string;
  lastUpdated?: string;
  progress?: number;
}

const mockRequests: OnboardingRequest[] = [
  {
    id: '1',
    name: 'Amit Sharma',
    position: 'Store Assistant',
    branch: 'Shepherds Bush',
    status: 'pending',
    startDate: '2025-01-15',
    lastUpdated: '2025-01-16',
    progress: 60
  },
  {
    id: '2',
    name: 'Priya Patel',
    position: 'Cashier',
    branch: 'Shepherds Bush',
    status: 'approved',
    startDate: '2025-01-10',
    lastUpdated: '2025-01-15',
    progress: 100
  }
];

export default function OnboardingManagement() {
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);

  const filteredRequests = (status?: string) => {
    if (!status) return mockRequests;
    return mockRequests.filter(r => r.status === status);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Employee Onboarding</h1>
          <p className="text-muted-foreground">Manage new employee onboarding process</p>
        </div>
        <Button onClick={() => setShowStartDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Start New Onboarding
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          {filteredRequests().map(request => (
            <Card key={request.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{request.name}</h3>
                    <Badge className={
                      request.status === 'pending' 
                        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                        : request.status === 'approved'
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    }>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Position</p>
                      <p className="font-medium">{request.position}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Branch</p>
                      <p className="font-medium">{request.branch}</p>
                    </div>
                  </div>
                  {request.startDate && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Started</p>
                        <p className="text-sm">{request.startDate}</p>
                      </div>
                      {request.lastUpdated && (
                        <div>
                          <p className="text-sm text-muted-foreground">Last Updated</p>
                          <p className="text-sm">{request.lastUpdated}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {request.progress !== undefined && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <p className="text-sm font-medium">{request.progress}%</p>
                      </div>
                      <Progress value={request.progress} className="h-2" />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedRequest(request)}
                  className="ml-4"
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {filteredRequests('pending').length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No pending requests</p>
              </div>
            </Card>
          ) : (
            filteredRequests('pending').map(request => (
              <Card key={request.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{request.name}</h3>
                      <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                        Pending
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{request.position}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Branch</p>
                        <p className="font-medium">{request.branch}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRequest(request)}
                    className="ml-4"
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-6">
          {filteredRequests('approved').length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No approved requests</p>
              </div>
            </Card>
          ) : (
            filteredRequests('approved').map(request => (
              <Card key={request.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{request.name}</h3>
                      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">
                        Approved
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{request.position}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Branch</p>
                        <p className="font-medium">{request.branch}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRequest(request)}
                    className="ml-4"
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          {filteredRequests('completed').length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No completed onboarding requests yet</p>
              </div>
            </Card>
          ) : (
            filteredRequests('completed').map(request => (
              <Card key={request.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{request.name}</h3>
                      <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                        Completed
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{request.position}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Branch</p>
                        <p className="font-medium">{request.branch}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRequest(request)}
                    className="ml-4"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <StartOnboardingDialog open={showStartDialog} onOpenChange={setShowStartDialog} />
      
      {selectedRequest && (
        <OnboardingDetailsDialog
          request={{
            ...selectedRequest,
            status: selectedRequest.status === 'completed' ? 'approved' as const : selectedRequest.status as 'pending' | 'approved',
            startDate: selectedRequest.startDate || new Date().toISOString().split('T')[0],
            email: 'employee@example.com',
            phone: '+44 1234 567890',
            address: '123 Example Street',
            salary: '£25,000/year',
            documents: [],
            contractSigned: false,
            contractEntity: 'Niza Group Ltd',
            submittedBy: 'Manager',
            submittedDate: new Date().toISOString().split('T')[0]
          }}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
        />
      )}
    </div>
  );
}
