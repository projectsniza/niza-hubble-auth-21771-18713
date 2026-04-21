import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Info, Plus, Search, Eye, Edit, Calendar, Paperclip, Download, Printer } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { FileAttachment, FileViewer } from '@/components/shared/FileAttachment';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { isAdminOrHR } from '@/lib/roles';

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

  // Organizations and branches for filter + create dialog
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  
  // Page-level filter
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const canFilter = isAdminOrHR(user);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    incident_type: 'accident',
    incident_date: new Date(),
    incident_time: '',
    reported_datetime: '',
    location_details: '',
    // Person injured
    person_type: 'employee', // employee | visitor | other
    person_type_other: '',
    victim_name: '',
    victim_address: '',
    victim_phone: '',
    victim_email: '',
    victim_job_title: '',
    // Injury
    injury_type: '',
    body_part_injured: '',
    severity: 'minor',
    nature_of_injuries: '',
    // Action taken
    action_first_aid: false,
    action_ambulance: false,
    action_hospital: false,
    action_police: false,
    action_other: false,
    action_other_text: '',
    // Witnesses (up to 2)
    witness1_name: '',
    witness1_contact: '',
    witness2_name: '',
    witness2_contact: '',
    // Prevention & approval
    prevention_actions: '',
    immediate_action: '',
    completed_by: '',
    completed_signature: '',
    completed_date: '',
    approved_by_name: '',
    approved_by_position: '',
    approved_date: '',
    // Legacy fields
    first_aid_given: false,
    first_aider_name: '',
    hospital_attended: false,
    reported_to_riddor: false,
    witness_names: '',
  });

  const [attachedFiles, setAttachedFiles] = useState<FileInfo[]>([]);

  useEffect(() => {
    if (canFilter) fetchOrganizations();
    if (user?.role === 'manager') {
      setViewMode('branch');
      if (user.organizationId) setFilterOrg(user.organizationId);
      if (user.branchId) setFilterBranch(user.branchId);
    }
  }, [user]);

  useEffect(() => {
    fetchIncidents();
  }, [user, viewMode, filterOrg, filterBranch]);

  useEffect(() => {
    if (selectedOrg) {
      fetchBranches(selectedOrg);
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    if (user?.role === 'hr' && user.organizationId) {
      const { data } = await supabase.from('organizations').select('id, name').eq('id', user.organizationId);
      setOrganizations(data || []);
    } else {
      const { data } = await supabase.from('organizations').select('id, name').order('name');
      setOrganizations(data || []);
    }
  };

  const fetchBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('id, name, organization_id').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  };

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(100);

      // Apply scope filter
      if (user?.role === 'manager' && user.branchId) {
        query = query.eq('branch_id', user.branchId);
      } else if (viewMode === 'branch' && filterBranch) {
        query = query.eq('branch_id', filterBranch);
      } else if (viewMode === 'organization' && filterOrg) {
        query = query.eq('organization_id', filterOrg);
      } else if (user?.role === 'hr') {
        if (user.hrAccessLevel === 'branch' && user.branchId) {
          query = query.eq('branch_id', user.branchId);
        } else if (user.organizationId) {
          query = query.eq('organization_id', user.organizationId);
        }
      }

      const { data, error } = await query;
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

      // For Super Admin or HR, use selected values or profile
      if (user?.role === 'super_admin' || user?.role === 'hr') {
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
          // HR user
          if (selectedOrg && selectedBranch) {
            orgId = selectedOrg;
            branchId = selectedBranch;
          } else if (user.organizationId && user.branchId) {
            orgId = user.organizationId;
            branchId = user.branchId;
          } else if (user.organizationId && selectedBranch) {
            orgId = user.organizationId;
            branchId = selectedBranch;
          } else {
            toast({
              title: "Error",
              description: "Please select organization and branch",
              variant: "destructive",
            });
            return;
          }
        }
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

      const incidentPayload = {
        title: formData.title,
        description: formData.description,
        incident_type: formData.incident_type,
        incident_date: formData.incident_date.toISOString(),
        location_details: formData.location_details,
        victim_name: formData.victim_name,
        injury_type: formData.injury_type,
        organization_id: orgId,
        branch_id: branchId,
        reported_by: authUser?.id ?? '',
        images: attachedFiles as unknown as null,
        medical_documents: {
          incident_time: formData.incident_time,
          reported_datetime: formData.reported_datetime,
          person_type: formData.person_type,
          person_type_other: formData.person_type_other,
          victim_address: formData.victim_address,
          victim_phone: formData.victim_phone,
          victim_email: formData.victim_email,
          victim_job_title: formData.victim_job_title,
          body_part_injured: formData.body_part_injured,
          severity: formData.severity,
          nature_of_injuries: formData.nature_of_injuries,
          immediate_action: formData.immediate_action,
          action_first_aid: formData.action_first_aid,
          action_ambulance: formData.action_ambulance,
          action_hospital: formData.action_hospital,
          action_police: formData.action_police,
          action_other: formData.action_other,
          action_other_text: formData.action_other_text,
          witness1_name: formData.witness1_name,
          witness1_contact: formData.witness1_contact,
          witness2_name: formData.witness2_name,
          witness2_contact: formData.witness2_contact,
          prevention_actions: formData.prevention_actions,
          completed_by: formData.completed_by,
          completed_signature: formData.completed_signature,
          completed_date: formData.completed_date,
          approved_by_name: formData.approved_by_name,
          approved_by_position: formData.approved_by_position,
          approved_date: formData.approved_date,
          witness_names: formData.witness_names,
          first_aid_given: formData.first_aid_given,
          first_aider_name: formData.first_aider_name,
          hospital_attended: formData.hospital_attended,
          reported_to_riddor: formData.reported_to_riddor,
        } as unknown as null,
      };

      let error;
      if (selectedIncident) {
        // Update existing
        ({ error } = await supabase.from('incidents').update(incidentPayload).eq('id', selectedIncident.id));
      } else {
        // Create new
        ({ error } = await supabase.from('incidents').insert([incidentPayload]));
      }

      if (error) throw error;

      toast({ title: "Success", description: selectedIncident ? "Incident updated successfully" : "Incident reported successfully" });
      setShowCreateDialog(false);
      setAttachedFiles([]);
      setSelectedIncident(null);
      fetchIncidents();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to report incident';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const buildEmptyForm = (defaultType: string) => ({
    title: '',
    description: '',
    incident_type: defaultType,
    incident_date: new Date(),
    incident_time: '',
    reported_datetime: '',
    location_details: '',
    person_type: 'employee',
    person_type_other: '',
    victim_name: '',
    victim_address: '',
    victim_phone: '',
    victim_email: '',
    victim_job_title: '',
    injury_type: '',
    body_part_injured: '',
    severity: 'minor',
    nature_of_injuries: '',
    action_first_aid: false,
    action_ambulance: false,
    action_hospital: false,
    action_police: false,
    action_other: false,
    action_other_text: '',
    witness1_name: '',
    witness1_contact: '',
    witness2_name: '',
    witness2_contact: '',
    prevention_actions: '',
    immediate_action: '',
    completed_by: '',
    completed_signature: '',
    completed_date: '',
    approved_by_name: '',
    approved_by_position: '',
    approved_date: '',
    first_aid_given: false,
    first_aider_name: '',
    hospital_attended: false,
    reported_to_riddor: false,
    witness_names: '',
  });

  const openCreateDialog = () => {
    setFormData(buildEmptyForm(activeTab === 'accidents' ? 'accident' : 'near_miss'));
    setAttachedFiles([]);
    setSelectedOrg('');
    setSelectedBranch('');
    setSelectedIncident(null);
    setShowCreateDialog(true);
  };

  const openViewDialog = (incident: any) => {
    setSelectedIncident(incident);
    setShowViewDialog(true);
  };

  const printIncident = (incident: any) => {
    if (!incident) return;
    const md = (incident.medical_documents || {}) as any;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      toast({ title: 'Pop-up blocked', description: 'Please allow pop-ups to print.', variant: 'destructive' });
      return;
    }
    const row = (label: string, value: any) => value ? `<tr><td style="padding:6px 10px;border:1px solid #ddd;background:#f7f7f7;width:35%"><b>${label}</b></td><td style="padding:6px 10px;border:1px solid #ddd">${value}</td></tr>` : '';
    win.document.write(`<!doctype html><html><head><title>${incident.incident_type === 'accident' ? 'Accident' : 'Incident'} Report - ${incident.title || ''}</title>
      <style>body{font-family:Arial,sans-serif;color:#222;padding:24px;max-width:800px;margin:auto}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;color:#666;margin:0 0 18px;font-weight:normal}table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px}.badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#fee;color:#c00;font-size:12px;font-weight:600}</style>
      </head><body>
      <h1>${incident.incident_type === 'accident' ? 'Accident' : 'Incident'} Report</h1>
      <h2>Reference: ${incident.id?.slice(0, 8) || '-'} • Generated: ${format(new Date(), 'PPP p')}</h2>
      <table>
        ${row('Title', incident.title)}
        ${row('Type', incident.incident_type)}
        ${row('Status', incident.status)}
        ${row('Date', incident.incident_date ? format(new Date(incident.incident_date), 'PPP') : '-')}
        ${row('Time', md.incident_time)}
        ${row('Location', incident.location_details)}
        ${row('Description', incident.description)}
        ${row('Victim Name', incident.victim_name)}
        ${row('Job Title', md.victim_job_title)}
        ${row('Injury Type', incident.injury_type)}
        ${row('Body Part Injured', md.body_part_injured)}
        ${row('Severity', md.severity)}
        ${row('Witnesses', md.witness_names)}
        ${row('Immediate Action', md.immediate_action)}
        ${row('First Aid Given', md.first_aid_given ? `Yes${md.first_aider_name ? ' — by ' + md.first_aider_name : ''}` : '')}
        ${row('Hospital Attended', md.hospital_attended ? 'Yes' : '')}
        ${row('RIDDOR Reportable', md.reported_to_riddor ? '<span class="badge">RIDDOR</span>' : '')}
      </table>
      <p style="font-size:11px;color:#888;margin-top:24px">This report was generated from Niza Safe Incident Management.</p>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
      </body></html>`);
    win.document.close();
  };

  const openEditDialog = (incident: any) => {
    const md: any = incident.medical_documents || {};
    setFormData({
      ...buildEmptyForm(incident.incident_type || 'accident'),
      title: incident.title || '',
      description: incident.description || '',
      incident_type: incident.incident_type || 'accident',
      incident_date: new Date(incident.incident_date),
      incident_time: md.incident_time || '',
      reported_datetime: md.reported_datetime || '',
      location_details: incident.location_details || '',
      person_type: md.person_type || 'employee',
      person_type_other: md.person_type_other || '',
      victim_name: incident.victim_name || '',
      victim_address: md.victim_address || '',
      victim_phone: md.victim_phone || '',
      victim_email: md.victim_email || '',
      victim_job_title: md.victim_job_title || '',
      injury_type: incident.injury_type || '',
      body_part_injured: md.body_part_injured || '',
      severity: md.severity || 'minor',
      nature_of_injuries: md.nature_of_injuries || '',
      action_first_aid: !!md.action_first_aid,
      action_ambulance: !!md.action_ambulance,
      action_hospital: !!md.action_hospital,
      action_police: !!md.action_police,
      action_other: !!md.action_other,
      action_other_text: md.action_other_text || '',
      witness1_name: md.witness1_name || '',
      witness1_contact: md.witness1_contact || '',
      witness2_name: md.witness2_name || '',
      witness2_contact: md.witness2_contact || '',
      prevention_actions: md.prevention_actions || '',
      immediate_action: md.immediate_action || '',
      completed_by: md.completed_by || '',
      completed_signature: md.completed_signature || '',
      completed_date: md.completed_date || '',
      approved_by_name: md.approved_by_name || '',
      approved_by_position: md.approved_by_position || '',
      approved_date: md.approved_date || '',
      first_aid_given: !!md.first_aid_given,
      first_aider_name: md.first_aider_name || '',
      hospital_attended: !!md.hospital_attended,
      reported_to_riddor: !!md.reported_to_riddor,
      witness_names: md.witness_names || '',
    });
    setAttachedFiles(getFilesFromIncident(incident));
    setSelectedIncident(incident);
    setShowCreateDialog(true);
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

      {canFilter && user?.role !== 'manager' && (
        <OrgBranchFilter
          organizations={organizations}
          branches={branches}
          viewMode={viewMode}
          selectedOrg={filterOrg}
          selectedBranch={filterBranch}
          onViewModeChange={setViewMode}
          onOrgChange={setFilterOrg}
          onBranchChange={setFilterBranch}
          className="mb-6"
        />
      )}
      
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
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}><Edit className="h-4 w-4" /></Button>
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
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}><Edit className="h-4 w-4" /></Button>
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
            {/* Organization and Branch selection for Super Admin and HR */}
            {(user?.role === 'super_admin' || (user?.role === 'hr' && !user?.branchId)) && (
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
            {/* Time of Incident */}
            <div className="space-y-2">
              <Label>Time of Incident</Label>
              <Input
                type="time"
                value={formData.incident_time}
                onChange={(e) => setFormData({ ...formData, incident_time: e.target.value })}
              />
            </div>

            {formData.incident_type === 'accident' && (
              <>
                {/* Injured Person Details */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="font-medium text-sm">Injured Person Details</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        value={formData.victim_name}
                        onChange={(e) => setFormData({ ...formData, victim_name: e.target.value })}
                        placeholder="Enter injured person's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Job Title</Label>
                      <Input
                        value={formData.victim_job_title}
                        onChange={(e) => setFormData({ ...formData, victim_job_title: e.target.value })}
                        placeholder="e.g., Sales Assistant"
                      />
                    </div>
                  </div>
                </div>

                {/* Injury Details */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="font-medium text-sm">Injury Details</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type of Injury *</Label>
                      <Select value={formData.injury_type} onValueChange={(v) => setFormData({ ...formData, injury_type: v })}>
                        <SelectTrigger><SelectValue placeholder="Select injury type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cut">Cut / Laceration</SelectItem>
                          <SelectItem value="bruise">Bruise / Contusion</SelectItem>
                          <SelectItem value="burn">Burn / Scald</SelectItem>
                          <SelectItem value="sprain">Sprain / Strain</SelectItem>
                          <SelectItem value="fracture">Fracture</SelectItem>
                          <SelectItem value="dislocation">Dislocation</SelectItem>
                          <SelectItem value="concussion">Concussion</SelectItem>
                          <SelectItem value="electric_shock">Electric Shock</SelectItem>
                          <SelectItem value="poisoning">Poisoning</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Body Part Injured</Label>
                      <Select value={formData.body_part_injured} onValueChange={(v) => setFormData({ ...formData, body_part_injured: v })}>
                        <SelectTrigger><SelectValue placeholder="Select body part" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="head">Head</SelectItem>
                          <SelectItem value="face">Face</SelectItem>
                          <SelectItem value="eye">Eye</SelectItem>
                          <SelectItem value="neck">Neck</SelectItem>
                          <SelectItem value="shoulder">Shoulder</SelectItem>
                          <SelectItem value="arm">Arm</SelectItem>
                          <SelectItem value="hand">Hand / Wrist</SelectItem>
                          <SelectItem value="finger">Finger</SelectItem>
                          <SelectItem value="back">Back</SelectItem>
                          <SelectItem value="chest">Chest</SelectItem>
                          <SelectItem value="leg">Leg</SelectItem>
                          <SelectItem value="knee">Knee</SelectItem>
                          <SelectItem value="ankle">Ankle</SelectItem>
                          <SelectItem value="foot">Foot</SelectItem>
                          <SelectItem value="multiple">Multiple Areas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minor">Minor - First aid only</SelectItem>
                        <SelectItem value="moderate">Moderate - Medical attention required</SelectItem>
                        <SelectItem value="major">Major - Hospital treatment required</SelectItem>
                        <SelectItem value="fatal">Fatal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* First Aid & Medical */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <h4 className="font-medium text-sm">First Aid & Medical Treatment</h4>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="first_aid_given"
                      checked={formData.first_aid_given}
                      onCheckedChange={(checked) => setFormData({ ...formData, first_aid_given: !!checked })}
                    />
                    <Label htmlFor="first_aid_given" className="cursor-pointer">First aid was administered</Label>
                  </div>

                  {formData.first_aid_given && (
                    <div className="space-y-2">
                      <Label>First Aider Name</Label>
                      <Input
                        value={formData.first_aider_name}
                        onChange={(e) => setFormData({ ...formData, first_aider_name: e.target.value })}
                        placeholder="Name of person who provided first aid"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hospital_attended"
                      checked={formData.hospital_attended}
                      onCheckedChange={(checked) => setFormData({ ...formData, hospital_attended: !!checked })}
                    />
                    <Label htmlFor="hospital_attended" className="cursor-pointer">Hospital / A&E attended</Label>
                  </div>
                </div>

                {/* Immediate Action & Witnesses */}
                <div className="space-y-2">
                  <Label>Immediate Action Taken</Label>
                  <Textarea
                    value={formData.immediate_action}
                    onChange={(e) => setFormData({ ...formData, immediate_action: e.target.value })}
                    placeholder="Describe what immediate actions were taken..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Witness Names</Label>
                  <Input
                    value={formData.witness_names}
                    onChange={(e) => setFormData({ ...formData, witness_names: e.target.value })}
                    placeholder="Separate multiple names with commas"
                  />
                </div>

                {/* RIDDOR */}
                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <Checkbox
                    id="reported_to_riddor"
                    checked={formData.reported_to_riddor}
                    onCheckedChange={(checked) => setFormData({ ...formData, reported_to_riddor: !!checked })}
                  />
                  <Label htmlFor="reported_to_riddor" className="cursor-pointer text-amber-800 dark:text-amber-200">
                    Reportable under RIDDOR (Reporting of Injuries, Diseases and Dangerous Occurrences Regulations)
                  </Label>
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
              label="Attach Evidence (Photos, Videos, Documents)"
              accept="*/*"
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
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>{selectedIncident?.incident_type === 'accident' ? 'Accident' : 'Incident'} Details</DialogTitle>
              <Button variant="outline" size="sm" onClick={() => printIncident(selectedIncident)} className="mr-6">
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Victim Name</Label>
                      <p>{selectedIncident.victim_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Injury Type</Label>
                      <p>{selectedIncident.injury_type || '-'}</p>
                    </div>
                  </div>
                  {/* Show additional UK format details from medical_documents */}
                  {selectedIncident.medical_documents && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <h4 className="font-medium text-sm">Additional Details</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {(selectedIncident.medical_documents as any).incident_time && (
                          <div>
                            <span className="text-muted-foreground">Time: </span>
                            {(selectedIncident.medical_documents as any).incident_time}
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).victim_job_title && (
                          <div>
                            <span className="text-muted-foreground">Job Title: </span>
                            {(selectedIncident.medical_documents as any).victim_job_title}
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).body_part_injured && (
                          <div>
                            <span className="text-muted-foreground">Body Part: </span>
                            {(selectedIncident.medical_documents as any).body_part_injured}
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).severity && (
                          <div>
                            <span className="text-muted-foreground">Severity: </span>
                            {(selectedIncident.medical_documents as any).severity}
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).witness_names && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Witnesses: </span>
                            {(selectedIncident.medical_documents as any).witness_names}
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).first_aid_given && (
                          <div className="col-span-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                              First Aid Given
                              {(selectedIncident.medical_documents as any).first_aider_name && 
                                ` by ${(selectedIncident.medical_documents as any).first_aider_name}`}
                            </Badge>
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).hospital_attended && (
                          <div className="col-span-2">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Hospital/A&E Attended
                            </Badge>
                          </div>
                        )}
                        {(selectedIncident.medical_documents as any).reported_to_riddor && (
                          <div className="col-span-2">
                            <Badge variant="destructive">
                              RIDDOR Reportable
                            </Badge>
                          </div>
                        )}
                      </div>
                      {(selectedIncident.medical_documents as any).immediate_action && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Immediate Action Taken</Label>
                          <p className="text-sm">{(selectedIncident.medical_documents as any).immediate_action}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* View Attached Files with Video Support */}
              <FileViewer
                files={getFilesFromIncident(selectedIncident)}
                bucket="documents"
                label="Attached Evidence"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
