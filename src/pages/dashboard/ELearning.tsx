import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, FileText, Calendar, User, CheckCircle, Clock, Send, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Training {
  id: string;
  title: string;
  date: string;
  deadline: string;
  document: string;
  tags: string[];
  assignedTo: string;
  assignedBy: string;
  branch: string;
  status: 'pending' | 'in_progress' | 'completed';
  closingDocument?: string;
  completedDate?: string;
}

const mockManagers = [
  { id: '1', name: 'Rajesh Murugan', branch: 'Chennai Branch' },
  { id: '2', name: 'Priya Sharma', branch: 'Mumbai Branch' },
  { id: '3', name: 'Arjun Reddy', branch: 'Bangalore Branch' },
];

const mockTrainings: Training[] = [
  {
    id: '1',
    title: 'Fire Safety Training',
    date: '2024-01-15',
    deadline: '2024-01-20',
    document: 'fire-safety-manual.pdf',
    tags: ['Safety', 'Mandatory'],
    assignedTo: 'Rajesh Murugan',
    assignedBy: 'HR Admin',
    branch: 'Chennai Branch',
    status: 'pending',
  },
  {
    id: '2',
    title: 'Customer Service Excellence',
    date: '2024-01-10',
    deadline: '2024-01-18',
    document: 'customer-service.pdf',
    tags: ['Customer Service', 'Retail'],
    assignedTo: 'Priya Sharma',
    assignedBy: 'HR Admin',
    branch: 'Mumbai Branch',
    status: 'in_progress',
  },
  {
    id: '3',
    title: 'Health & Safety Compliance',
    date: '2023-12-20',
    deadline: '2023-12-30',
    document: 'safety-compliance.pdf',
    tags: ['Safety', 'Compliance'],
    assignedTo: 'Arjun Reddy',
    assignedBy: 'HR Admin',
    branch: 'Bangalore Branch',
    status: 'completed',
    closingDocument: 'checklist-completed.pdf',
    completedDate: '2023-12-28',
  },
];

export default function ELearning() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [closingFile, setClosingFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    deadline: '',
    tags: '',
    assignedTo: '',
    branch: '',
  });

  const isAdminOrHR = user?.role === 'super_admin' || user?.role === 'hr';
  const isManager = user?.role === 'manager';

  const handleCreateTraining = () => {
    toast({
      title: 'Training Created',
      description: `Training "${formData.title}" has been assigned to ${formData.assignedTo}`,
    });
    setShowCreateDialog(false);
    setFormData({ title: '', date: '', deadline: '', tags: '', assignedTo: '', branch: '' });
    setUploadedFile(null);
  };

  const handleCompleteTraining = () => {
    toast({
      title: 'Training Completed',
      description: 'Training has been marked as completed and sent to admin',
    });
    setShowDetailsDialog(false);
    setClosingFile(null);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return variants[status as keyof typeof variants] || variants.pending;
  };

  const filteredTrainings = (status?: string) => {
    let trainings = mockTrainings;
    
    if (isManager) {
      trainings = trainings.filter(t => t.assignedTo === 'Rajesh Murugan');
    }
    
    if (status) {
      trainings = trainings.filter(t => t.status === status);
    }
    
    return trainings;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Training Management</h2>
          <p className="text-muted-foreground mt-1">
            {isAdminOrHR ? 'Create and manage training assignments' : 'View and complete assigned trainings'}
          </p>
        </div>
        {isAdminOrHR && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Training
          </Button>
        )}
      </div>

      <Tabs defaultValue={isManager ? 'assigned' : 'all'} className="w-full">
        <TabsList className={isManager ? 'grid w-full grid-cols-2' : 'grid w-full grid-cols-4'}>
          {!isManager && <TabsTrigger value="all">All Trainings</TabsTrigger>}
          <TabsTrigger value="assigned">{isManager ? 'My Trainings' : 'Pending'}</TabsTrigger>
          <TabsTrigger value="progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        {!isManager && (
          <TabsContent value="all" className="space-y-4">
            {filteredTrainings().map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                onView={() => {
                  setSelectedTraining(training);
                  setShowDetailsDialog(true);
                }}
                isManager={false}
              />
            ))}
          </TabsContent>
        )}

        <TabsContent value="assigned" className="space-y-4">
          {filteredTrainings('pending').map((training) => (
            <TrainingCard
              key={training.id}
              training={training}
              onView={() => {
                setSelectedTraining(training);
                setShowDetailsDialog(true);
              }}
              isManager={isManager}
            />
          ))}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {filteredTrainings('in_progress').map((training) => (
            <TrainingCard
              key={training.id}
              training={training}
              onView={() => {
                setSelectedTraining(training);
                setShowDetailsDialog(true);
              }}
              isManager={isManager}
            />
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {filteredTrainings('completed').map((training) => (
            <TrainingCard
              key={training.id}
              training={training}
              onView={() => {
                setSelectedTraining(training);
                setShowDetailsDialog(true);
              }}
              isManager={isManager}
            />
          ))}
        </TabsContent>
      </Tabs>

      {/* Create Training Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Training</DialogTitle>
            <DialogDescription>Assign training to a branch manager</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Training Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Fire Safety Training"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Training Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="deadline">Completion Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., Safety, Mandatory, Compliance"
              />
            </div>

            <div>
              <Label htmlFor="manager">Assign to Manager</Label>
              <Select
                value={formData.assignedTo}
                onValueChange={(value) => {
                  const manager = mockManagers.find(m => m.name === value);
                  setFormData({ ...formData, assignedTo: value, branch: manager?.branch || '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {mockManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.name}>
                      {manager.name} - {manager.branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="document">Upload Training Document</Label>
              <div className="mt-2">
                <label className="flex items-center justify-center w-full h-32 px-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {uploadedFile ? uploadedFile.name : 'Click to upload document'}
                    </span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                  />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTraining} disabled={!formData.title || !formData.assignedTo}>
              <Send className="h-4 w-4 mr-2" />
              Create & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Details Dialog */}
      {selectedTraining && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedTraining.title}</DialogTitle>
              <DialogDescription>Training details and completion</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusBadge(selectedTraining.status)}>
                    {selectedTraining.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Branch</p>
                  <p className="font-medium">{selectedTraining.branch}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Training Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedTraining.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Deadline</p>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {new Date(selectedTraining.deadline).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {selectedTraining.assignedTo}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assigned By</p>
                  <p className="font-medium">{selectedTraining.assignedBy}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Tags</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedTraining.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Training Document</p>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="h-4 w-4" />
                  {selectedTraining.document}
                  <Download className="h-4 w-4 ml-auto" />
                </Button>
              </div>

              {isManager && selectedTraining.status !== 'completed' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">Complete Training</h4>
                  <div>
                    <Label htmlFor="closing-doc">Upload Completed Checklist</Label>
                    <div className="mt-2">
                      <label className="flex items-center justify-center w-full h-24 px-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                        <div className="flex flex-col items-center">
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-sm text-muted-foreground">
                            {closingFile ? closingFile.name : 'Upload completed checklist'}
                          </span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setClosingFile(e.target.files?.[0] || null)}
                          accept=".pdf,.doc,.docx"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {selectedTraining.status === 'completed' && selectedTraining.closingDocument && (
                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Completed Checklist</p>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {selectedTraining.closingDocument}
                    <Download className="h-4 w-4 ml-auto" />
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Completed on: {selectedTraining.completedDate && new Date(selectedTraining.completedDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
              {isManager && selectedTraining.status !== 'completed' && (
                <Button onClick={handleCompleteTraining} disabled={!closingFile}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Training
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TrainingCard({ training, onView, isManager }: { training: Training; onView: () => void; isManager: boolean }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-xl">{training.title}</CardTitle>
            <CardDescription>{training.branch}</CardDescription>
          </div>
          <Badge className={`${training.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : training.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
            {training.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Training: {new Date(training.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Deadline: {new Date(training.deadline).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{isManager ? `By ${training.assignedBy}` : training.assignedTo}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{training.document}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {training.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>

        <Button onClick={onView} className="w-full">
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}