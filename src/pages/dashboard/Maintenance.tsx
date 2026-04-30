import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, AlertCircle, Clock, CheckCircle, Upload, Image as ImageIcon, X, Building2, MapPin, User, Eye, Download, Trash2 } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface MaintenanceTicket {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  images: any;
  reported_by: string;
  assigned_to: string | null;
  branch_id: string;
  organization_id: string;
  created_at: string | null;
  resolved_at: string | null;
  branch?: { name: string } | null;
  organization?: { name: string } | null;
  reporter?: { name: string; display_name: string | null } | null;
}

export default function Maintenance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [images, setImages] = useState<File[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewingTicket, setViewingTicket] = useState<MaintenanceTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<MaintenanceTicket | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [closureFiles, setClosureFiles] = useState<File[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Use centralized org/branch data
  const { organizations, branches } = useOrgBranch();
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || user?.role === 'hr';

  // Debounce ref to prevent excessive refetches
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFetchTickets = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTickets();
    }, 300);
  }, []);

  useEffect(() => {
    fetchTickets();

    // Real-time subscription with debounce
    const channel = supabase
      .channel('maintenance-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_tickets' },
        debouncedFetchTickets
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, debouncedFetchTickets]);

  const fetchTickets = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_tickets')
        .select(`
          *,
          branch:branches(name),
          organization:organizations(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Filter based on role and access level
      if (user.role === 'manager') {
        // Managers see all tickets in their branch (so they can act on them)
        if (user.branchId) {
          query = query.eq('branch_id', user.branchId);
        } else {
          query = query.eq('reported_by', user.id);
        }
      } else if (user.role === 'hr') {
        // HR scoped by org/branch if assigned, otherwise full access
        if (user.organizationId && user.branchId) {
          query = query.eq('branch_id', user.branchId);
        } else if (user.organizationId) {
          query = query.eq('organization_id', user.organizationId);
        }
        // HR with no org/branch sees all tickets (same as super admin)
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch reporter profiles
      if (data && data.length > 0) {
        const reporterIds = [...new Set(data.map(t => t.reported_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name')
          .in('id', reporterIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const ticketsWithReporters = data.map(ticket => ({
          ...ticket,
          reporter: profileMap.get(ticket.reported_by) || null
        }));
        setTickets(ticketsWithReporters);
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // For HR users without a branch, allow selecting one
  const [selectedSubmitOrg, setSelectedSubmitOrg] = useState('');
  const [selectedSubmitBranch, setSelectedSubmitBranch] = useState('');

  const needsBranchSelection = (user?.role === 'super_admin' || user?.role === 'hr') && !user?.branchId;
  const submitOrgId = user?.organizationId || selectedSubmitOrg;
  const submitBranchId = user?.branchId || selectedSubmitBranch;
  const submitBranchOptions = branches.filter(b => submitOrgId ? b.organization_id === submitOrgId : true);

  const handleSubmit = async () => {
    if (!title || !description || !priority) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!submitOrgId || !submitBranchId) {
      toast({
        title: "Error",
        description: "Please select an organization and branch",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload images if any
      const uploadedImages: any[] = [];
      for (const image of images) {
        const fileName = `${Date.now()}-${image.name}`;
        const filePath = `maintenance/${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        uploadedImages.push({
          name: image.name,
          path: filePath,
          size: image.size,
          type: image.type
        });
      }

      const { error } = await supabase.from('maintenance_tickets').insert({
        title,
        description,
        priority,
        status: 'pending',
        images: uploadedImages,
        reported_by: user.id,
        organization_id: submitOrgId,
        branch_id: submitBranchId
      });

      if (error) throw error;

      toast({
        title: "Ticket Created",
        description: "Your maintenance request has been submitted to the admin",
      });

      setTitle('');
      setDescription('');
      setPriority('medium');
      setImages([]);
      setShowCreateTicket(false);
      fetchTickets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create ticket';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('maintenance_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Ticket status changed to ${newStatus}`,
      });
      fetchTickets();
      setViewingTicket(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update status';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleResolveTicket = async () => {
    if (!viewingTicket || !user) return;
    if (closureFiles.length === 0) {
      toast({
        title: "Attachment Required",
        description: "Please upload at least one file as proof of resolution.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingStatus(true);
    try {
      const uploaded: any[] = [];
      for (const file of closureFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `maintenance/${user.id}/closure/${fileName}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file);
        if (upErr) throw upErr;
        uploaded.push({ name: file.name, path: filePath, size: file.size, type: file.type });
      }

      const { error } = await supabase
        .from('maintenance_tickets')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          closure_attachments: uploaded as any,
          closure_notes: closureNotes || null,
          closed_by: user.id,
        } as any)
        .eq('id', viewingTicket.id);
      if (error) throw error;

      toast({ title: "Resolved", description: "Ticket marked as resolved." });
      setResolveOpen(false);
      setClosureFiles([]);
      setClosureNotes('');
      setViewingTicket(null);
      fetchTickets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to resolve ticket';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDownloadImage = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download image",
        variant: "destructive",
      });
    }
  };

  const canDeleteTicket = useCallback((ticket: MaintenanceTicket) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'hr') return true;
    if (user.role === 'manager' && ticket.reported_by === user.id) return true;
    return false;
  }, [user]);

  const handleDeleteTicket = async (ticket: MaintenanceTicket) => {
    try {
      const { error } = await supabase.from('maintenance_tickets').delete().eq('id', ticket.id);
      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Maintenance ticket deleted successfully.',
      });

      setViewingTicket((prev) => (prev?.id === ticket.id ? null : prev));
      setTicketToDelete(null);
      fetchTickets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete ticket';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-warning';
      case 'in_progress': return 'text-primary';
      case 'resolved': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  // Memoized filtering for better performance
  const filteredTickets = useMemo(() => tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Apply date filter
    if (dateFilter && ticket.created_at) {
      const ticketDate = format(new Date(ticket.created_at), 'yyyy-MM-dd');
      if (ticketDate !== dateFilter) return false;
    }
    
    // Apply org/branch filters for super admin / full HR
    if (canViewFilters && viewMode !== 'all') {
      if (viewMode === 'organization' && selectedOrg) {
        return matchesSearch && ticket.organization_id === selectedOrg;
      }
      if (viewMode === 'branch' && selectedBranch) {
        return matchesSearch && ticket.branch_id === selectedBranch;
      }
      if (viewMode === 'organization' && !selectedOrg) {
        return matchesSearch;
      }
      if (viewMode === 'branch' && selectedOrg && !selectedBranch) {
        return matchesSearch && ticket.organization_id === selectedOrg;
      }
    }
    
    return matchesSearch;
  }), [tickets, searchQuery, dateFilter, canViewFilters, viewMode, selectedOrg, selectedBranch]);

  const canCreateTicket = user?.role === 'manager' || user?.role === 'hr' || user?.role === 'super_admin';
  const canUpdateStatus = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Maintenance</h1>
          <p className="text-muted-foreground mt-1">
            {canCreateTicket ? 'Create and track maintenance requests' : 'View and manage all maintenance tickets'}
          </p>
        </div>
        {canCreateTicket && (
          <Dialog open={showCreateTicket} onOpenChange={setShowCreateTicket}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Raise Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Maintenance Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {needsBranchSelection && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Organization *</Label>
                      <Select value={selectedSubmitOrg} onValueChange={(v) => { setSelectedSubmitOrg(v); setSelectedSubmitBranch(''); }}>
                        <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                        <SelectContent>
                          {organizations.map(org => (
                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Branch *</Label>
                      <Select value={selectedSubmitBranch} onValueChange={setSelectedSubmitBranch}>
                        <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                        <SelectContent>
                          {submitBranchOptions.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="title">Issue Title *</Label>
                  <Input
                    id="title"
                    placeholder="Brief description of the issue"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Detailed Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide detailed explanation of the maintenance issue..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="images">Supporting Documents/Images</Label>
                  <div className="flex items-center gap-4">
                    <label htmlFor="images" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">Upload Files</span>
                      </div>
                      <input
                        id="images"
                        type="file"
                        multiple
                        accept="*/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {images.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {images.length} file(s) selected
                      </span>
                    )}
                  </div>
                  {images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {images.map((img, idx) => (
                        <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                          <ImageIcon className="h-3 w-3" />
                          <span className="max-w-[100px] truncate">{img.name}</span>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => removeImage(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canViewFilters && (
        <OrgBranchFilter
          organizations={organizations}
          branches={branches}
          viewMode={viewMode}
          selectedOrg={selectedOrg}
          selectedBranch={selectedBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setSelectedOrg}
          onBranchChange={setSelectedBranch}
        />
      )}

      {/* Search and Date Filter */}
      <div className="flex flex-wrap gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search maintenance tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter by date:</Label>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Tickets Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <NizaLoaderInline />
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No maintenance tickets</h3>
              <p className="text-muted-foreground mb-4">
                {canCreateTicket ? 'Create your first maintenance ticket' : 'No tickets have been submitted yet'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <h3 className="font-semibold text-lg text-foreground">{ticket.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                  </div>
                  <Badge className={getPriorityColor(ticket.priority || 'medium')}>
                    {ticket.priority}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={getStatusColor(ticket.status || 'pending')}>
                      {getStatusIcon(ticket.status || 'pending')}
                    </span>
                    <span className="text-muted-foreground capitalize">
                      {(ticket.status || 'pending').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ticket.reporter?.display_name || ticket.reporter?.name || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {ticket.branch?.name || 'N/A'}
                  </div>
                  <div>
                    Created: {ticket.created_at ? format(new Date(ticket.created_at), 'dd/MM/yyyy') : 'N/A'}
                  </div>
                  {ticket.resolved_at && (
                    <div className="text-green-600">
                      Resolved: {format(new Date(ticket.resolved_at), 'dd/MM/yyyy')}
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => setViewingTicket(ticket)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the maintenance ticket record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => ticketToDelete && handleDeleteTicket(ticketToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Ticket Dialog */}
      <Dialog open={!!viewingTicket} onOpenChange={() => setViewingTicket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingTicket?.title}</DialogTitle>
          </DialogHeader>
          {viewingTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <Badge className={getPriorityColor(viewingTicket.priority || 'medium')}>
                    {viewingTicket.priority}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2">
                    <span className={getStatusColor(viewingTicket.status || 'pending')}>
                      {getStatusIcon(viewingTicket.status || 'pending')}
                    </span>
                    <span className="capitalize">{(viewingTicket.status || 'pending').replace('_', ' ')}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reported By</Label>
                  <p>{viewingTicket.reporter?.display_name || viewingTicket.reporter?.name || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Branch</Label>
                  <p>{viewingTicket.branch?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Organization</Label>
                  <p>{viewingTicket.organization?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{viewingTicket.created_at ? format(new Date(viewingTicket.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                </div>
                {viewingTicket.resolved_at && (
                  <div>
                    <Label className="text-muted-foreground">Resolved</Label>
                    <p className="text-green-600">{format(new Date(viewingTicket.resolved_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
              
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1">{viewingTicket.description || 'No description'}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Attached Files</Label>
                <div className="mt-2 space-y-2">
                  {Array.isArray(viewingTicket.images) && viewingTicket.images.length > 0 ? (
                    viewingTicket.images.map((file: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadImage(file.path, file.name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No files attached</p>
                  )}
                </div>
              </div>

              {canUpdateStatus && viewingTicket.status !== 'resolved' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Label className="text-muted-foreground self-center">Update Status:</Label>
                  {viewingTicket.status === 'pending' && (
                    <Button size="sm" onClick={() => handleUpdateStatus(viewingTicket.id, 'in_progress')}>
                      Mark In Progress
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(viewingTicket.id, 'resolved')}>
                    Mark Resolved
                  </Button>
                </div>
              )}

              {canDeleteTicket(viewingTicket) && (
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setTicketToDelete(viewingTicket)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Ticket
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
