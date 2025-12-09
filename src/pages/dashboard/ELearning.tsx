import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, FileText, Calendar, User, CheckCircle, Clock, Send, Download, X, Building, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Training {
  id: string;
  title: string;
  description: string | null;
  training_date: string | null;
  deadline: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  created_by: string | null;
  organization_id: string | null;
  branch_id: string | null;
  status: string | null;
  completed_date: string | null;
  created_at: string | null;
}

interface TrainingDocument {
  id: string;
  training_id: string;
  file_name: string;
  file_path: string;
  document_type: string | null;
}

interface Manager {
  id: string;
  name: string;
  email: string;
  branch_name: string | null;
  organization_name: string | null;
  organization_id: string | null;
  branch_id: string | null;
}

export default function ELearning() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedTrainingDocs, setSelectedTrainingDocs] = useState<TrainingDocument[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [closingFiles, setClosingFiles] = useState<File[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    deadline: '',
    tags: '',
    assignedTo: '',
  });

  const isAdminOrHR = user?.role === 'super_admin' || user?.role === 'hr';
  const isManager = user?.role === 'manager';

  useEffect(() => {
    fetchTrainings();
    if (isAdminOrHR) {
      fetchManagers();
    }
  }, [user]);

  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrainings(data || []);
    } catch (error: any) {
      console.error('Error fetching trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      // Get all users with manager role
      const { data: managerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');

      if (rolesError) throw rolesError;
      if (!managerRoles?.length) return;

      const managerIds = managerRoles.map(r => r.user_id);

      // Get profiles for these managers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          branch_id,
          organization_id
        `)
        .in('id', managerIds);

      if (profilesError) throw profilesError;

      // Get branch and org names
      const branchIds = profiles?.filter(p => p.branch_id).map(p => p.branch_id) || [];
      const orgIds = profiles?.filter(p => p.organization_id).map(p => p.organization_id) || [];

      const [branchesRes, orgsRes] = await Promise.all([
        branchIds.length ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [] },
        orgIds.length ? supabase.from('organizations').select('id, name').in('id', orgIds) : { data: [] }
      ]);

      const branchMap = new Map((branchesRes.data || []).map(b => [b.id, b.name]));
      const orgMap = new Map((orgsRes.data || []).map(o => [o.id, o.name]));

      const managersData: Manager[] = (profiles || []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        branch_name: p.branch_id ? branchMap.get(p.branch_id) || null : null,
        organization_name: p.organization_id ? orgMap.get(p.organization_id) || null : null,
        organization_id: p.organization_id,
        branch_id: p.branch_id,
      }));

      setManagers(managersData);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const fetchTrainingDocuments = async (trainingId: string) => {
    try {
      const { data, error } = await supabase
        .from('training_documents')
        .select('*')
        .eq('training_id', trainingId);

      if (error) throw error;
      setSelectedTrainingDocs(data || []);
    } catch (error) {
      console.error('Error fetching training documents:', error);
    }
  };

  const handleCreateTraining = async () => {
    if (!formData.title || !formData.assignedTo) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      const selectedManager = managers.find(m => m.id === formData.assignedTo);

      const { data: training, error: trainingError } = await supabase
        .from('trainings')
        .insert({
          title: formData.title,
          training_date: formData.date || null,
          deadline: formData.deadline || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
          assigned_to: formData.assignedTo,
          organization_id: selectedManager?.organization_id || null,
          branch_id: selectedManager?.branch_id || null,
          created_by: user?.id,
          status: 'pending'
        })
        .select()
        .single();

      if (trainingError) throw trainingError;

      // Upload files
      if (uploadedFiles.length > 0 && training) {
        for (const file of uploadedFiles) {
          const filePath = `${training.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('training-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          await supabase.from('training_documents').insert({
            training_id: training.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            document_type: 'training',
            uploaded_by: user?.id
          });
        }
      }

      toast({
        title: 'Training Created',
        description: `Training "${formData.title}" has been assigned successfully`,
      });
      setShowCreateDialog(false);
      setFormData({ title: '', date: '', deadline: '', tags: '', assignedTo: '' });
      setUploadedFiles([]);
      fetchTrainings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create training',
        variant: 'destructive'
      });
    }
  };

  const handleCompleteTraining = async () => {
    if (!selectedTraining) return;

    try {
      // Upload completion files
      if (closingFiles.length > 0) {
        for (const file of closingFiles) {
          const filePath = `${selectedTraining.id}/completion/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('training-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          await supabase.from('training_documents').insert({
            training_id: selectedTraining.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            document_type: 'completion',
            uploaded_by: user?.id
          });
        }
      }

      // Update training status
      const { error } = await supabase
        .from('trainings')
        .update({ 
          status: 'completed',
          completed_date: new Date().toISOString()
        })
        .eq('id', selectedTraining.id);

      if (error) throw error;

      toast({
        title: 'Training Completed',
        description: 'Training has been marked as completed',
      });
      setShowDetailsDialog(false);
      setClosingFiles([]);
      fetchTrainings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete training',
        variant: 'destructive'
      });
    }
  };

  const handleDownloadDocument = async (doc: TrainingDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('training-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    const variants = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return variants[status as keyof typeof variants] || variants.pending;
  };

  const filteredTrainings = (status?: string) => {
    let filtered = trainings;
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    return filtered;
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return 'Unassigned';
    const manager = managers.find(m => m.id === managerId);
    return manager?.name || 'Unknown';
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeClosingFile = (index: number) => {
    setClosingFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
            {filteredTrainings().length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No trainings found</p>
              </Card>
            ) : (
              filteredTrainings().map((training) => (
                <TrainingCard
                  key={training.id}
                  training={training}
                  managerName={getManagerName(training.assigned_to)}
                  onView={async () => {
                    setSelectedTraining(training);
                    await fetchTrainingDocuments(training.id);
                    setShowDetailsDialog(true);
                  }}
                  isManager={false}
                />
              ))
            )}
          </TabsContent>
        )}

        <TabsContent value="assigned" className="space-y-4">
          {filteredTrainings('pending').length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No pending trainings</p>
            </Card>
          ) : (
            filteredTrainings('pending').map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                managerName={getManagerName(training.assigned_to)}
                onView={async () => {
                  setSelectedTraining(training);
                  await fetchTrainingDocuments(training.id);
                  setShowDetailsDialog(true);
                }}
                isManager={isManager}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {filteredTrainings('in_progress').length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No trainings in progress</p>
            </Card>
          ) : (
            filteredTrainings('in_progress').map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                managerName={getManagerName(training.assigned_to)}
                onView={async () => {
                  setSelectedTraining(training);
                  await fetchTrainingDocuments(training.id);
                  setShowDetailsDialog(true);
                }}
                isManager={isManager}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {filteredTrainings('completed').length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No completed trainings</p>
            </Card>
          ) : (
            filteredTrainings('completed').map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                managerName={getManagerName(training.assigned_to)}
                onView={async () => {
                  setSelectedTraining(training);
                  await fetchTrainingDocuments(training.id);
                  setShowDetailsDialog(true);
                }}
                isManager={isManager}
              />
            ))
          )}
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
              <Label htmlFor="title">Training Title *</Label>
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
              <Label htmlFor="manager">Assign to Manager *</Label>
              <Select
                value={formData.assignedTo}
                onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      <div className="flex items-center gap-2">
                        <span>{manager.name}</span>
                        {manager.branch_name && (
                          <span className="text-muted-foreground text-xs">
                            ({manager.branch_name})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.assignedTo && (
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  {managers.find(m => m.id === formData.assignedTo)?.organization_name && (
                    <span className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {managers.find(m => m.id === formData.assignedTo)?.organization_name}
                    </span>
                  )}
                  {managers.find(m => m.id === formData.assignedTo)?.branch_name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {managers.find(m => m.id === formData.assignedTo)?.branch_name}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Upload Training Documents</Label>
              <div className="mt-2">
                <label className="flex items-center justify-center w-full h-32 px-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload documents (multiple allowed)
                    </span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setUploadedFiles(prev => [...prev, ...files]);
                    }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  />
                </label>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUploadedFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTraining.title}</DialogTitle>
              <DialogDescription>Training details and completion</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusBadge(selectedTraining.status)}>
                    {(selectedTraining.status || 'pending').replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {getManagerName(selectedTraining.assigned_to)}
                  </p>
                </div>
                {selectedTraining.training_date && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Training Date</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedTraining.training_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {selectedTraining.deadline && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(selectedTraining.deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedTraining.tags && selectedTraining.tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Tags</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTraining.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedTrainingDocs.filter(d => d.document_type === 'training').length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Training Documents</p>
                  <div className="space-y-2">
                    {selectedTrainingDocs
                      .filter(d => d.document_type === 'training')
                      .map((doc) => (
                        <Button
                          key={doc.id}
                          variant="outline"
                          className="w-full justify-start gap-2"
                          onClick={() => handleDownloadDocument(doc)}
                        >
                          <FileText className="h-4 w-4" />
                          {doc.file_name}
                          <Download className="h-4 w-4 ml-auto" />
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              {isManager && selectedTraining.status !== 'completed' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">Complete Training</h4>
                  <div>
                    <Label>Upload Completed Checklist / Evidence</Label>
                    <div className="mt-2">
                      <label className="flex items-center justify-center w-full h-24 px-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                        <div className="flex flex-col items-center">
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-sm text-muted-foreground">
                            Upload completion documents
                          </span>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setClosingFiles(prev => [...prev, ...files]);
                          }}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                      </label>
                    </div>
                    {closingFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {closingFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm truncate flex-1">{file.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeClosingFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedTraining.status === 'completed' && (
                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Completion Documents</p>
                  {selectedTrainingDocs.filter(d => d.document_type === 'completion').length > 0 ? (
                    <div className="space-y-2">
                      {selectedTrainingDocs
                        .filter(d => d.document_type === 'completion')
                        .map((doc) => (
                          <Button
                            key={doc.id}
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => handleDownloadDocument(doc)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {doc.file_name}
                            <Download className="h-4 w-4 ml-auto" />
                          </Button>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No completion documents uploaded</p>
                  )}
                  {selectedTraining.completed_date && (
                    <p className="text-sm text-muted-foreground">
                      Completed on: {new Date(selectedTraining.completed_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
              {isManager && selectedTraining.status !== 'completed' && (
                <Button onClick={handleCompleteTraining} disabled={closingFiles.length === 0}>
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

function TrainingCard({ 
  training, 
  managerName,
  onView, 
  isManager 
}: { 
  training: Training; 
  managerName: string;
  onView: () => void; 
  isManager: boolean;
}) {
  const getStatusBadge = (status: string | null) => {
    const variants = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return variants[status as keyof typeof variants] || variants.pending;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-xl">{training.title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {!isManager && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {managerName}
                </span>
              )}
              {training.deadline && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Due: {new Date(training.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusBadge(training.status)}>
              {(training.status || 'pending').replace('_', ' ').toUpperCase()}
            </Badge>
            <Button variant="outline" size="sm" onClick={onView}>
              View Details
            </Button>
          </div>
        </div>
      </CardHeader>
      {training.tags && training.tags.length > 0 && (
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {training.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
