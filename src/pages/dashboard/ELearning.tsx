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
import { Plus, Upload, FileText, Calendar, User, CheckCircle, Clock, Send, Download, X, Building, MapPin, Search, Eye, Filter, Trash2 } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, isValid } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
  const [trainingToDelete, setTrainingToDelete] = useState<Training | null>(null);
  const [selectedTrainingDocs, setSelectedTrainingDocs] = useState<TrainingDocument[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [closingFiles, setClosingFiles] = useState<File[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  // NOTE: Radix Select does not allow Select.Item with empty string values.
  // We use "all" as a sentinel value instead of "".
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');

  const [formData, setFormData] = useState(() => ({
    title: '',
    date: '',
    deadline: '',
    tags: '',
    assignedTo: [] as string[],
    description: '',
  }));

  const isAdminOrHR = user?.role === 'super_admin' || user?.role === 'hr';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const canCreateTraining = isAdminOrHR || isManager;

  useEffect(() => {
    if (user) {
      fetchTrainings();
      fetchOrganizations();
      if (isAdminOrHR) {
        fetchManagers();
      }
    } else {
      setLoading(false);
    }
  }, [user, isAdminOrHR]);

  useEffect(() => {
    if (filterOrg && filterOrg !== 'all') {
      fetchBranches(filterOrg);
    } else {
      setBranches([]);
      setFilterBranch('all');
    }
  }, [filterOrg]);

  const fetchOrganizations = async () => {
    const { data } = await supabase.from('organizations').select('*').order('name');
    if (data) setOrganizations(data);
  };

  const safeFormatDate = (value: string | null | undefined, fmt: string) => {
    if (!value) return null;
    const d = new Date(value);
    return isValid(d) ? format(d, fmt) : null;
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('organization_id', orgId).order('name');
    if (data) setBranches(data);
  };

  const fetchTrainings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let query = supabase
        .from('trainings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // For employees, fetch trainings assigned to their branch (via manager's branch)
      if (isEmployee && user?.branchId) {
        query = query.eq('branch_id', user.branchId);
      }
      
      // For managers, show trainings for their branch
      if (isManager && user?.branchId) {
        query = query.eq('branch_id', user.branchId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching trainings:', error);
        setTrainings([]);
      } else {
        setTrainings(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching trainings:', error);
      setTrainings([]);
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
    if (!formData.title) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a training title',
        variant: 'destructive'
      });
      return;
    }

    // For managers, they create for their own branch without selecting a manager
    if (isManager && (!user?.branchId || !user?.organizationId)) {
      toast({
        title: 'Error',
        description: 'You must be assigned to a branch to create trainings',
        variant: 'destructive'
      });
      return;
    }

    // For admin/HR, they need to select at least one store account
    if (isAdminOrHR && formData.assignedTo.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one Store Account to assign the training',
        variant: 'destructive'
      });
      return;
    }

    try {
      let trainingData: any = {
        title: formData.title,
        description: formData.description || null,
        training_date: formData.date || null,
        deadline: formData.deadline || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        created_by: user?.id,
        status: 'pending'
      };

      let insertedTrainings: any[] = [];

      if (isManager) {
        // Manager creates for their own branch, assigned to themselves
        trainingData.assigned_to = user?.id;
        trainingData.organization_id = user?.organizationId;
        trainingData.branch_id = user?.branchId;

        const { data: insertedTraining, error: trainingError } = await supabase
          .from('trainings')
          .insert(trainingData)
          .select('id')
          .single();

        if (trainingError) throw trainingError;
        insertedTrainings = [insertedTraining];
      } else {
        // Admin/HR assigns to multiple selected managers
        for (const managerId of formData.assignedTo) {
          const selectedManager = managers.find(m => m.id === managerId);
          const managerTrainingData = {
            ...trainingData,
            assigned_to: managerId,
            organization_id: selectedManager?.organization_id || null,
            branch_id: selectedManager?.branch_id || null,
          };

          const { data: insertedTraining, error: trainingError } = await supabase
            .from('trainings')
            .insert(managerTrainingData)
            .select('id')
            .single();

          if (trainingError) throw trainingError;
          insertedTrainings.push(insertedTraining);
        }
      }

      // Upload files if trainings were created successfully
      if (uploadedFiles.length > 0 && insertedTrainings.length > 0) {
        for (const insertedTraining of insertedTrainings) {
          for (const file of uploadedFiles) {
            const filePath = `${insertedTraining.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from('training-documents')
              .upload(filePath, file);

            if (uploadError) {
              console.error('File upload error:', uploadError);
              throw uploadError;
            }

            const { error: docError } = await supabase.from('training_documents').insert({
              training_id: insertedTraining.id,
              file_name: file.name,
              file_path: filePath,
              file_type: file.type,
              file_size: file.size,
              document_type: 'training',
              uploaded_by: user?.id
            });

            if (docError) {
              console.error('Training document insert error:', docError);
              throw docError;
            }
          }
        }
      }

      const assignedCount = isManager ? 1 : formData.assignedTo.length;
      toast({
        title: 'Training Created',
        description: `Training "${formData.title}" has been assigned to ${assignedCount} store account${assignedCount > 1 ? 's' : ''}`,
      });
      setShowCreateDialog(false);
      setFormData({ title: '', date: '', deadline: '', tags: '', assignedTo: [], description: '' });
      setUploadedFiles([]);
      fetchTrainings();
    } catch (error: any) {
      console.error('Create training error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create training',
        variant: 'destructive'
      });
    }
  };

  const handleStartTraining = async () => {
    if (!selectedTraining || !isManager) return;

    try {
      const { error } = await supabase
        .from('trainings')
        .update({ status: 'in_progress' })
        .eq('id', selectedTraining.id);

      if (error) throw error;

      toast({
        title: 'Training Started',
        description: 'Training is now in progress',
      });
      setSelectedTraining({ ...selectedTraining, status: 'in_progress' });
      fetchTrainings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start training',
        variant: 'destructive'
      });
    }
  };

  const handleCompleteTraining = async () => {
    if (!selectedTraining || !isManager) return;

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

  const canDeleteTraining = (training: Training) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.role === 'hr') return true;
    if (user.role === 'manager' && user.branchId && training.branch_id === user.branchId) return true;
    return false;
  };

  const handleDeleteTraining = async (training: Training) => {
    try {
      const { error } = await supabase.from('trainings').delete().eq('id', training.id);
      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Training record deleted successfully.',
      });

      setTrainingToDelete(null);
      setShowDetailsDialog(false);
      setSelectedTraining(null);
      fetchTrainings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete training',
        variant: 'destructive',
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

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <FileText className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending': return 'text-yellow-500';
      case 'in_progress': return 'text-blue-500';
      case 'completed': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const filteredTrainings = (status?: string) => {
    let filtered = trainings;
    
    // Apply status filter
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply org filter
    if (filterOrg && filterOrg !== 'all') {
      filtered = filtered.filter(t => t.organization_id === filterOrg);
    }

    // Apply branch filter
    if (filterBranch && filterBranch !== 'all') {
      filtered = filtered.filter(t => t.branch_id === filterBranch);
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

  const getCounts = () => ({
    all: trainings.length,
    pending: trainings.filter(t => t.status === 'pending').length,
    in_progress: trainings.filter(t => t.status === 'in_progress').length,
    completed: trainings.filter(t => t.status === 'completed').length,
  });

  const counts = getCounts();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <NizaLoaderInline />
      </div>
    );
  }

  const TrainingGrid = ({ trainings: displayTrainings }: { trainings: Training[] }) => (
    displayTrainings.length === 0 ? (
      <Card className="p-12 text-center border-dashed">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No trainings found</h3>
            <p className="text-muted-foreground mb-4">
              {canCreateTraining ? 'Create your first training to get started' : 'No trainings have been assigned yet'}
            </p>
          </div>
        </div>
      </Card>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayTrainings.map((training) => (
          <Card key={training.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <h3 className="font-semibold text-lg text-foreground">{training.title}</h3>
                  {training.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{training.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(training.status)}>
                    {getStatusIcon(training.status)}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {(training.status || 'pending').replace('_', ' ')}
                  </span>
                </div>
                <Badge className={getStatusBadge(training.status)}>
                  {(training.status || 'pending').replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                {!(isManager || isEmployee) && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {getManagerName(training.assigned_to)}
                  </div>
                )}
                {training.deadline && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due: {safeFormatDate(training.deadline, 'dd/MM/yyyy') || 'N/A'}
                  </div>
                )}
                {training.created_at && (
                  <div>
                    Created: {safeFormatDate(training.created_at, 'dd/MM/yyyy') || 'N/A'}
                  </div>
                )}
              </div>

              {training.tags && training.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {training.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                  {training.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">+{training.tags.length - 3}</Badge>
                  )}
                </div>
              )}

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  setSelectedTraining(training);
                  setShowDetailsDialog(true);
                  fetchTrainingDocuments(training.id);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Details
              </Button>
            </div>
          </Card>
        ))}
      </div>
    )
  );

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Training Management</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {isAdminOrHR ? 'Create and manage training assignments' : isManager ? 'Create and complete trainings' : 'View training assignments'}
          </p>
        </div>
        {canCreateTraining && (
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2 w-fit">
            <Plus className="h-4 w-4" />
            Create Training
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trainings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {isAdminOrHR && (
            <>
              <Select
                value={filterOrg}
                onValueChange={(v) => {
                  setFilterOrg(v);
                  setFilterBranch('all');
                }}
              >
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filterOrg !== 'all' && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-48">
                    <MapPin className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full overflow-x-auto flex md:grid md:grid-cols-4 no-scrollbar">
          <TabsTrigger value="all" className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
            All
            <Badge variant="secondary" className="text-xs">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
            Pending
            <Badge variant="secondary" className="text-xs">{counts.pending}</Badge>
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
            In Progress
            <Badge variant="secondary" className="text-xs">{counts.in_progress}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1 md:gap-2 text-xs md:text-sm whitespace-nowrap">
            Completed
            <Badge variant="secondary" className="text-xs">{counts.completed}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <TrainingGrid trainings={filteredTrainings()} />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <TrainingGrid trainings={filteredTrainings('pending')} />
        </TabsContent>

        <TabsContent value="in_progress" className="mt-6">
          <TrainingGrid trainings={filteredTrainings('in_progress')} />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <TrainingGrid trainings={filteredTrainings('completed')} />
        </TabsContent>
      </Tabs>

      {/* Create Training Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Training</DialogTitle>
            <DialogDescription>
              {isManager ? 'Create a training for your branch' : 'Assign training to a Store Account'}
            </DialogDescription>
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

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the training"
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

            {/* Only show store account selector for Admin/HR */}
            {isAdminOrHR && (
              <div>
                <Label>Assign to Store Account(s) *</Label>
                <p className="text-xs text-muted-foreground mb-2">Select multiple stores to assign this training</p>
                <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-2">
                  {managers.map((manager) => {
                    const isSelected = formData.assignedTo.includes(manager.id);
                    return (
                      <label 
                        key={manager.id} 
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted ${isSelected ? 'bg-primary/10 border border-primary/30' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assignedTo: [...formData.assignedTo, manager.id] });
                            } else {
                              setFormData({ ...formData, assignedTo: formData.assignedTo.filter(id => id !== manager.id) });
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{manager.name}</span>
                          {manager.branch_name && (
                            <span className="text-muted-foreground text-xs ml-2">
                              ({manager.branch_name})
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {formData.assignedTo.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {formData.assignedTo.length} store account{formData.assignedTo.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {/* Show branch info for managers */}
            {isManager && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This training will be created for your branch and assigned to you.
                </p>
              </div>
            )}

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
                    accept="*/*"
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
            <Button onClick={handleCreateTraining} disabled={!formData.title || (isAdminOrHR && !formData.assignedTo)}>
              <Send className="h-4 w-4 mr-2" />
              Create Training
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

              {isManager && selectedTraining.status === 'pending' && selectedTraining.assigned_to === user?.id && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">Start Training</h4>
                  <p className="text-sm text-muted-foreground">
                    Click the button below to start this training. The status will change to "In Progress".
                  </p>
                </div>
              )}

              {isManager && selectedTraining.status === 'in_progress' && selectedTraining.assigned_to === user?.id && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">Complete Training</h4>
                  <div>
                    <Label>Upload Completed Checklist / Evidence (Optional)</Label>
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
                          accept="*/*"
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

              {isEmployee && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground italic">
                    This training is managed by your branch manager. You can view the training details but cannot start or complete it.
                  </p>
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

              {canDeleteTraining(selectedTraining) && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setTrainingToDelete(selectedTraining)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}

              {isManager && selectedTraining.status === 'pending' && selectedTraining.assigned_to === user?.id && (
                <Button onClick={handleStartTraining}>
                  <Clock className="h-4 w-4 mr-2" />
                  Start Training
                </Button>
              )}
              {isManager && selectedTraining.status === 'in_progress' && selectedTraining.assigned_to === user?.id && (
                <Button onClick={handleCompleteTraining}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Completed
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!trainingToDelete} onOpenChange={(open) => !open && setTrainingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete training?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the training record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => trainingToDelete && handleDeleteTraining(trainingToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
