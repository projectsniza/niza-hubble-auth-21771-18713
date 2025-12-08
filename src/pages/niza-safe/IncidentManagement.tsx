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
import { AlertTriangle, Info, Plus, Search, Eye, Edit, Calendar } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';

export default function IncidentManagement() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('accidents');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    incident_type: 'accident',
    incident_date: new Date(),
    location_details: '',
    victim_name: '',
    injury_type: '',
  });

  useEffect(() => {
    fetchIncidents();
  }, []);

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
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, branch_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.organization_id || !profile?.branch_id) {
        toast({
          title: "Error",
          description: "Organization or branch not configured",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from('incidents').insert({
        title: formData.title,
        description: formData.description,
        incident_type: formData.incident_type,
        incident_date: formData.incident_date.toISOString(),
        location_details: formData.location_details,
        victim_name: formData.victim_name,
        injury_type: formData.injury_type,
        organization_id: profile.organization_id,
        branch_id: profile.branch_id,
        reported_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Incident reported successfully" });
      setShowCreateDialog(false);
      fetchIncidents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to report incident",
        variant: "destructive",
      });
    }
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
      title: "Near Misses",
      description: "Track and analyze near miss incidents to prevent future accidents",
      gradient: "from-accent to-primary",
      count: nearMisses.length,
      key: 'near-misses'
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
          onClick={() => {
            setFormData({
              ...formData,
              incident_type: activeTab === 'accidents' ? 'accident' : 'near_miss'
            });
            setShowCreateDialog(true);
          }}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Report Incident
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="accidents">Accidents ({accidents.length})</TabsTrigger>
          <TabsTrigger value="near-misses">Near Misses ({nearMisses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="accidents">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Victim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
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

        <TabsContent value="near-misses">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearMisses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No near misses reported
                    </TableCell>
                  </TableRow>
                ) : (
                  nearMisses.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{format(new Date(item.incident_date), 'PPP')}</TableCell>
                      <TableCell>{item.location_details || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Report {formData.incident_type === 'accident' ? 'Accident' : 'Near Miss'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Incident Type</Label>
              <Select value={formData.incident_type} onValueChange={(v) => setFormData({ ...formData, incident_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="near_miss">Near Miss</SelectItem>
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
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Report Incident</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
