import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Bell, Briefcase, GraduationCap, Cake, Users, Megaphone, Eye, Calendar, Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
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

  useEffect(() => {
    fetchEvents();
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (newEvent.organizationId) {
      fetchBranches(newEvent.organizationId);
    }
  }, [newEvent.organizationId]);

  const fetchOrganizations = async () => {
    const { data } = await supabase.from('organizations').select('*').order('name');
    if (data) setOrganizations(data);
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('organization_id', orgId).order('name');
    if (data) setBranches(data);
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

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

    // Validate visibility scope
    if (newEvent.visibility === 'organization' && !newEvent.organizationId) {
      toast.error('Please select an organization');
      return;
    }
    if (newEvent.visibility === 'branch' && !newEvent.branchId) {
      toast.error('Please select a branch');
      return;
    }

    try {
      const { error } = await supabase.from('events').insert({
        title: newEvent.title,
        description: newEvent.description || null,
        event_type: newEvent.eventType,
        event_date: newEvent.eventDate || null,
        visibility: newEvent.visibility,
        organization_id: newEvent.visibility !== 'company' ? newEvent.organizationId || null : null,
        branch_id: newEvent.visibility === 'branch' ? newEvent.branchId || null : null,
        is_pinned: newEvent.isPinned,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success('Event created successfully');
      setShowCreate(false);
      setNewEvent({ title: '', description: '', eventType: 'announcement', eventDate: '', visibility: 'company', organizationId: '', branchId: '', isPinned: false });
      fetchEvents();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create event');
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || event.event_type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getCounts = () => {
    const counts: Record<string, number> = { all: events.length };
    events.forEach(e => {
      const type = e.event_type || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  };

  const counts = getCounts();

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
                        <SelectItem value="company">Company Event</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="employee">Employee Event</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <Select value={newEvent.visibility} onValueChange={(v) => setNewEvent({ ...newEvent, visibility: v, organizationId: '', branchId: '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Entire Company</SelectItem>
                        <SelectItem value="organization">Organization Only</SelectItem>
                        <SelectItem value="branch">Branch Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Show organization selector for org/branch visibility */}
                {(newEvent.visibility === 'organization' || newEvent.visibility === 'branch') && (
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

                {/* Show branch selector for branch visibility */}
                {newEvent.visibility === 'branch' && newEvent.organizationId && (
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
        </div>
      </div>

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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">{event.visibility}</Badge>
                      <Badge className={`bg-gradient-to-r ${config.color} text-white border-0`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
