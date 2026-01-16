import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Info, Plus, Search, Eye, Edit, Calendar, Paperclip } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { FileAttachment, FileViewer } from '@/components/shared/FileAttachment';

interface FileInfo {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export default function IncidentManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('accidents');
  const [searchTerm, setSearchTerm] = useState('');

  // Organizations and branches for Super Admin
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    incident_type: 'accident',
    incident_date: new Date(),
    location_details: '',
    victim_name: '',
    injury_type: '',
  });

  const [attachedFiles, setAttachedFiles] = useState<FileInfo[]>([]);

  useEffect(() => {
    fetchIncidents();
    if (user?.role === 'super_admin') {
      fetchOrganizations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      fetchBranches(selectedOrg);
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    const { data } = await supabase.from('organizations').select('*').order('name');
    setOrganizations(data || []);
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  };

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      let orgId: string | null = null;
      let branchId: string | null = null;

      // For Super Admin, use selected values
      if (user?.role === 'super_admin') {
        if (!selectedOrg || !selectedBranch) {
          toast({
            title: "Error",
            description: "Please select organization and branch",
            variant: "destructive",
          });
          return;
        }
        orgId = selectedOrg;
        branchId = selectedBranch;
      } else {
        // For other roles, get from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id, branch_id')
          .eq('id', authUser?.id)
          .single();

        if (!profile?.organization_id || !profile?.branch_id) {
          toast({
            title: "Error",
            description: "Organization or branch not configured for your profile",
            variant: "destructive",
          });
          return;
        }
        orgId = profile.organization_id;
        branchId = profile.branch_id;
      }

      const { error } = await supabase.from('incidents').insert({
        title: formData.title,
        description: formData.description,
        incident_type: formData.incident_type,
        incident_date: formData.incident_date.toISOString(),
        location_details: formData.location_details,
        victim_name: formData.victim_name,
        injury_type: formData.injury_type,
        organization_id: orgId,
        branch_id: branchId,
        reported_by: authUser?.id!,
        images: attachedFiles as any,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Incident reported successfully" });
      setShowCreateDialog(false);
      setAttachedFiles([]);
      fetchIncidents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to report incident",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setFormData({
      title: '',
      description: '',
      incident_type: activeTab === 'accidents' ? 'accident' : 'near_miss',
      incident_date: new Date(),
      location_details: '',
      victim_name: '',
      injury_type: '',
    });
    setAttachedFiles([]);
    setSelectedOrg('');
    setSelectedBranch('');
    setShowCreateDialog(true);
  };

  const openViewDialog = (incident: any) => {
    setSelectedIncident(incident);
    setShowViewDialog(true);
  };

  const accidents = incidents.filter(i => i.incident_type === 'accident');
  const nearMisses = incidents.filter(i => i.incident_type === 'near_miss');

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'closed': return 'bg-green-500 text-white';
      case 'investigating': return 'bg-amber-500 text-white';
      case 'reported': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getFilesFromIncident = (incident: any): FileInfo[] => {
    if (!incident?.images) return [];
    if (Array.isArray(incident.images)) return incident.images as FileInfo[];
    return [];
  };

  const incidentTypes = [
    {
      icon: AlertTriangle,
      title: "Accidents",
      description: "Record and investigate workplace accidents thoroughly",
      gradient: "from-destructive to-destructive/70",
      count: accidents.length,
      key: 'accidents'
    },
    {
      icon: Info,
      title: "Incidents",
      description: "Track and analyze incidents to prevent future accidents",
      gradient: "from-accent to-primary",
      count: nearMisses.length,
      key: 'incidents'
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Incident Management</h1>
        <p className="text-muted-foreground">Record, investigate, and learn from workplace incidents</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {incidentTypes.map((incident) => (
          <Card 
            key={incident.key}
            className={`p-6 cursor-pointer group border-border hover:border-primary/50 transition-all ${activeTab === incident.key ? 'border-primary' : ''}`}
            onClick={() => setActiveTab(incident.key)}
          >
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${incident.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <incident.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                    {incident.title}
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {incident.count}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {incident.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={openCreateDialog}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Report Incident
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="accidents">Accidents ({accidents.length})</TabsTrigger>
          <TabsTrigger value="incidents">Incidents ({nearMisses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="accidents">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Victim</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No accidents reported
                    </TableCell>
                  </TableRow>
                ) : (
                  accidents.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{format(new Date(item.incident_date), 'PPP')}</TableCell>
                      <TableCell>{item.victim_name || '-'}</TableCell>
                      <TableCell>
                        {getFilesFromIncident(item).length > 0 && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">{getFilesFromIncident(item).length}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(item)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearMisses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No incidents reported
                    </TableCell>
                  </TableRow>
                ) : (
                  nearMisses.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{format(new Date(item.incident_date), 'PPP')}</TableCell>
                      <TableCell>{item.location_details || '-'}</TableCell>
                      <TableCell>
                        {getFilesFromIncident(item).length > 0 && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">{getFilesFromIncident(item).length}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(item)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Report {formData.incident_type === 'accident' ? 'Accident' : 'Incident'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Organization and Branch selection for Super Admin */}
            {user?.role === 'super_admin' && (
              <>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!selectedOrg}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Incident Type</Label>
              <Select value={formData.incident_type} onValueChange={(v) => setFormData({ ...formData, incident_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="near_miss">Incident</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter incident title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what happened"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(formData.incident_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={formData.incident_date}
                    onSelect={(date) => date && setFormData({ ...formData, incident_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Location Details</Label>
              <Input
                value={formData.location_details}
                onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
                placeholder="Where did it happen?"
              />
            </div>
            {formData.incident_type === 'accident' && (
              <>
                <div className="space-y-2">
                  <Label>Victim Name (if applicable)</Label>
                  <Input
                    value={formData.victim_name}
                    onChange={(e) => setFormData({ ...formData, victim_name: e.target.value })}
                    placeholder="Enter victim's name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Injury Type</Label>
                  <Input
                    value={formData.injury_type}
                    onChange={(e) => setFormData({ ...formData, injury_type: e.target.value })}
                    placeholder="Type of injury"
                  />
                </div>
              </>
            )}

            {/* File Attachments */}
            <FileAttachment
              files={attachedFiles}
              onFilesChange={setAttachedFiles}
              bucket="documents"
              folderPath="incidents"
              maxFiles={10}
              label="Attach Evidence/Documents"
              accept="image/*,.pdf,.doc,.docx"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Report Incident</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedIncident?.incident_type === 'accident' ? 'Accident' : 'Incident'} Details</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="font-medium">{selectedIncident.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{selectedIncident.description || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p>{format(new Date(selectedIncident.incident_date), 'PPP')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusBadgeColor(selectedIncident.status)}>{selectedIncident.status}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p>{selectedIncident.location_details || '-'}</p>
              </div>
              {selectedIncident.incident_type === 'accident' && (
                <>
                  <div>
                    <Label className="text-muted-foreground">Victim Name</Label>
                    <p>{selectedIncident.victim_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Injury Type</Label>
                    <p>{selectedIncident.injury_type || '-'}</p>
                  </div>
                </>
              )}

              {/* View Attached Files */}
              <FileViewer
                files={getFilesFromIncident(selectedIncident)}
                bucket="documents"
                label="Attached Files"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
