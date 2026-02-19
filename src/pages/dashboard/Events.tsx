import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Bell, Briefcase, GraduationCap, Cake, Users, Megaphone, Eye, Calendar, Pin, Trash2 } from "lucide-react";
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  event_date: string | null;
  visibility: string | null;
  is_pinned: boolean | null;
  views_count: number | null;
  attending_count: number | null;
  created_at: string | null;
  organization_id: string | null;
  branch_id: string | null;
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const { organizations, branches, getBranchesByOrg } = useOrgBranch();
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  
  // Filter state for super admin / full HR
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || user?.role === 'hr';
  const canCreateEvent = user?.role !== 'employee';
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventType: 'announcement',
    eventDate: '',
    visibility: 'company',
    organizationId: '',
    branchId: '',
    isPinned: false
  });

  const categoryConfig = {
    all: { label: "All", icon: Bell, color: "from-primary to-accent" },
    announcement: { label: "Announcements", icon: Megaphone, color: "from-orange-500 to-orange-600" },
    company: { label: "Company Events", icon: Briefcase, color: "from-blue-500 to-blue-600" },
    training: { label: "Training", icon: GraduationCap, color: "from-purple-500 to-purple-600" },
    birthday: { label: "Birthdays", icon: Cake, color: "from-pink-500 to-pink-600" },
    employee: { label: "Employee Events", icon: Users, color: "from-green-500 to-green-600" },
    urgent: { label: "Urgent", icon: Bell, color: "from-red-500 to-red-600" },
  };

  // Get branches for dialog based on selected org
  const dialogBranches = useMemo(() => 
    newEvent.organizationId ? getBranchesByOrg(newEvent.organizationId) : [],
    [newEvent.organizationId, getBranchesByOrg]
  );

  useEffect(() => {
    fetchEvents();
  }, []);

  // dialogBranches is now computed from centralized context via getBranchesByOrg

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('events')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      // Filter by scope for HR/Manager
      if (user?.role === 'hr' || user?.role === 'manager') {
        // Get events that are company-wide, OR match their organization, OR match their branch
        query = query.or(
          `visibility.eq.company,and(visibility.eq.organization,organization_id.eq.${user.organizationId}),and(visibility.eq.branch,branch_id.eq.${user.branchId})`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title) {
      toast.error('Please enter a title');
      return;
    }

    // For managers, force branch visibility and their own branch/org
    const isManager = user?.role === 'manager';
    const effectiveVisibility = isManager ? 'branch' : newEvent.visibility;
    const effectiveOrgId = isManager ? user?.organizationId : (effectiveVisibility !== 'company' ? newEvent.organizationId : null);
    const effectiveBranchId = isManager ? user?.branchId : (effectiveVisibility === 'branch' ? newEvent.branchId : null);

    // Validate visibility scope for non-managers
    if (!isManager) {
      if (newEvent.visibility === 'organization' && !newEvent.organizationId) {
        toast.error('Please select an organization');
        return;
      }
      if (newEvent.visibility === 'branch' && !newEvent.branchId) {
        toast.error('Please select a branch');
        return;
      }
    }

    try {
      // For managers, always include their organization_id alongside branch_id
      const insertData = {
        title: newEvent.title,
        description: newEvent.description || null,
        event_type: newEvent.eventType,
        event_date: newEvent.eventDate || null,
        visibility: effectiveVisibility,
        is_pinned: newEvent.isPinned,
        created_by: user?.id,
        organization_id: isManager ? user?.organizationId : (effectiveOrgId || null),
        branch_id: isManager ? user?.branchId : (effectiveBranchId || null)
      };

      const { error } = await supabase.from('events').insert(insertData);

      if (error) throw error;

      toast.success('Event created successfully');
      setShowCreate(false);
      setNewEvent({ title: '', description: '', eventType: 'announcement', eventDate: '', visibility: 'company', organizationId: '', branchId: '', isPinned: false });
      fetchEvents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create event';
      toast.error(message);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;
    
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteEventId);

      if (error) throw error;

      toast.success('Event deleted successfully');
      setDeleteEventId(null);
      fetchEvents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete event';
      toast.error(message);
    }
  };

  // Memoized filtering for better performance
  const filteredEvents = useMemo(() => events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || event.event_type === activeFilter;
    
    // Apply org/branch filters for super admin / full HR
    if (canViewFilters && viewMode !== 'all') {
      if (viewMode === 'organization' && selectedOrg) {
        return matchesSearch && matchesFilter && event.organization_id === selectedOrg;
      }
      if (viewMode === 'branch' && selectedBranch) {
        return matchesSearch && matchesFilter && event.branch_id === selectedBranch;
      }
      if (viewMode === 'branch' && selectedOrg && !selectedBranch) {
        return matchesSearch && matchesFilter && event.organization_id === selectedOrg;
      }
    }
    
    return matchesSearch && matchesFilter;
  }), [events, searchQuery, activeFilter, canViewFilters, viewMode, selectedOrg, selectedBranch]);

  // Memoized counts
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: events.length };
    events.forEach(e => {
      const type = e.event_type || 'other';
      result[type] = (result[type] || 0) + 1;
    });
    return result;
  }, [events]);

  const QuickFilterButton = ({ category, count }: { category: string; count: number }) => {
    const config = categoryConfig[category as keyof typeof categoryConfig];
    if (!config) return null;
    const isActive = activeFilter === category;

    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveFilter(category)}
        className={`gap-2 ${isActive ? `bg-gradient-to-r ${config.color} text-white border-0 shadow-lg` : ''}`}
      >
        <config.icon className="h-4 w-4" />
        {config.label}
        <Badge variant="secondary" className="ml-1">{count}</Badge>
      </Button>
    );
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Events & Announcements</h1>
          <p className="text-muted-foreground">Stay updated with all company activities and important news</p>
        </div>
        <div className="flex gap-2">
          {canCreateEvent && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Event / Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Event description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newEvent.eventType} onValueChange={(v) => setNewEvent({ ...newEvent, eventType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="company_event">Company Event</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="employee_event">Employee Event</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    {user?.role === 'manager' ? (
                      <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                        Branch Only (Your branch: {user?.branchId ? 'Assigned' : 'None'})
                      </div>
                    ) : (
                      <Select value={newEvent.visibility} onValueChange={(v) => setNewEvent({ ...newEvent, visibility: v, organizationId: '', branchId: '' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company">Entire Company</SelectItem>
                          <SelectItem value="organization">Organization Only</SelectItem>
                          <SelectItem value="branch">Branch Only</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                
                {/* Show organization selector for org/branch visibility - not for managers */}
                {user?.role !== 'manager' && (newEvent.visibility === 'organization' || newEvent.visibility === 'branch') && (
                  <div className="space-y-2">
                    <Label>Organization *</Label>
                    <Select value={newEvent.organizationId} onValueChange={(v) => setNewEvent({ ...newEvent, organizationId: v, branchId: '' })}>
                      <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                      <SelectContent>
                        {organizations.map(org => (
                          <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Show branch selector for branch visibility - not for managers */}
                {user?.role !== 'manager' && newEvent.visibility === 'branch' && newEvent.organizationId && (
                  <div className="space-y-2">
                    <Label>Branch *</Label>
                    <Select value={newEvent.branchId} onValueChange={(v) => setNewEvent({ ...newEvent, branchId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Input 
                    type="datetime-local"
                    value={newEvent.eventDate}
                    onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="pinned"
                    checked={newEvent.isPinned}
                    onChange={(e) => setNewEvent({ ...newEvent, isPinned: e.target.checked })}
                  />
                  <Label htmlFor="pinned">Pin this event</Label>
                </div>
                <Button onClick={handleCreateEvent} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
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

      <Card className="mb-6 p-4 border-primary/20 bg-gradient-to-r from-card to-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events, announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">QUICK FILTERS</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(categoryConfig).map(category => (
            <QuickFilterButton key={category} category={category} count={counts[category] || 0} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">
          {activeFilter === "all" ? "All Updates" : categoryConfig[activeFilter as keyof typeof categoryConfig]?.label}
        </h2>
        
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <NizaLoaderInline />
          </div>
        ) : filteredEvents.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No events or announcements</h3>
                <p className="text-muted-foreground mb-4">Create your first event or announcement to get started</p>
              </div>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map(event => {
              const config = categoryConfig[event.event_type as keyof typeof categoryConfig] || categoryConfig.announcement;
              return (
                <Card key={event.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                        <config.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {event.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                          <h3 className="font-semibold text-foreground">{event.title}</h3>
                        </div>
                        {event.description && (
                          <p className="text-muted-foreground text-sm mb-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {event.event_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(event.event_date), 'dd MMM yyyy, HH:mm')}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {event.views_count || 0} views
                          </span>
                          {event.attending_count !== null && event.attending_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {event.attending_count} attending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{event.visibility}</Badge>
                      <Badge className={`bg-gradient-to-r ${config.color} text-white border-0`}>
                        {config.label}
                      </Badge>
                      {(user?.role === 'super_admin' || user?.role === 'hr') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteEventId(event.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEventId} onOpenChange={(open) => !open && setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
