import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, AlertTriangle, AlertCircle, Clipboard, Plus, Search, Eye, Edit, Trash2, X, Paperclip } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FileAttachment, FileViewer } from '@/components/shared/FileAttachment';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { isAdminOrHR } from '@/lib/roles';

interface FileInfo {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

interface OrgOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
  organization_id: string;
}

export default function RiskManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('risk-assessments');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [coshhAssessments, setCoshhAssessments] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hazardReports, setHazardReports] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [methodStatements, setMethodStatements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [dialogType, setDialogType] = useState<'risk' | 'coshh' | 'hazard' | 'method'>('risk');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Page-level filter
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  // Create dialog org/branch selection
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    hazard_description: '',
    control_measures: '',
    risk_level: 'medium',
    chemical_name: '',
    storage_requirements: '',
    exposure_limits: '',
    location_details: '',
    priority: 'medium',
    responsibilities: '',
  });

  const [attachedFiles, setAttachedFiles] = useState<FileInfo[]>([]);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';
  const canFilter = isAdminOrHR(user);

  useEffect(() => {
    if (canFilter) {
      fetchOrganizations();
    }
    // Store accounts: auto-scope
    if (user?.role === 'manager') {
      setViewMode('branch');
      if (user.organizationId) setFilterOrg(user.organizationId);
      if (user.branchId) setFilterBranch(user.branchId);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [user, filterOrg, filterBranch, viewMode]);

  useEffect(() => {
    if (filterOrg) {
      fetchFilterBranches(filterOrg);
    }
  }, [filterOrg]);

  const fetchOrganizations = async () => {
    if (user?.role === 'hr' && user.organizationId) {
      const { data } = await supabase.from('organizations').select('id, name').eq('id', user.organizationId);
      setOrganizations(data || []);
    } else {
      const { data } = await supabase.from('organizations').select('id, name').order('name');
      setOrganizations(data || []);
    }
  };

  const fetchFilterBranches = async (orgId: string) => {
    const { data } = await supabase.from('branches').select('id, name, organization_id').eq('organization_id', orgId).order('name');
    setBranches(data || []);
  };

  const applyFilter = (query: any) => {
    if (user?.role === 'manager' && user.branchId) {
      return query.eq('branch_id', user.branchId);
    }
    if (viewMode === 'branch' && filterBranch) {
      return query.eq('branch_id', filterBranch);
    }
    if (viewMode === 'organization' && filterOrg) {
      return query.eq('organization_id', filterOrg);
    }
    if (user?.role === 'hr') {
      if (user.hrAccessLevel === 'branch' && user.branchId) {
        return query.eq('branch_id', user.branchId);
      }
      if (user.organizationId) {
        return query.eq('organization_id', user.organizationId);
      }
    }
    return query;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let riskQuery = supabase.from('risk_assessments').select('*').order('created_at', { ascending: false });
      let coshhQuery = supabase.from('coshh_assessments').select('*').order('created_at', { ascending: false });
      let hazardQuery = supabase.from('hazard_reports').select('*').order('created_at', { ascending: false });
      let methodQuery = supabase.from('method_statements').select('*').order('created_at', { ascending: false });

      riskQuery = applyFilter(riskQuery);
      coshhQuery = applyFilter(coshhQuery);
      hazardQuery = applyFilter(hazardQuery);
      methodQuery = applyFilter(methodQuery);

      const [riskRes, coshhRes, hazardRes, methodRes] = await Promise.all([
        riskQuery, coshhQuery, hazardQuery, methodQuery
      ]);

      if (riskRes.data) setRiskAssessments(riskRes.data);
      if (coshhRes.data) setCoshhAssessments(coshhRes.data);
      if (hazardRes.data) setHazardReports(hazardRes.data);
      if (methodRes.data) setMethodStatements(methodRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilesColumn = (item: any, type: 'risk' | 'coshh' | 'hazard' | 'method'): FileInfo[] => {
    if (type === 'risk') {
      return Array.isArray(item.evidence_files) ? item.evidence_files : [];
    }
    if (type === 'hazard') {
      return Array.isArray(item.images) ? item.images : [];
    }
    if (type === 'coshh') {
      if (item.sds_file_path) {
        return [{ name: 'SDS Document', path: item.sds_file_path }];
      }
      return [];
    }
    if (type === 'method') {
      return Array.isArray(item.attachments) ? item.attachments : [];
    }
    return [];
  };

  const openCreateDialog = (type: 'risk' | 'coshh' | 'hazard' | 'method') => {
    setDialogType(type);
    setFormData({
      title: '',
      description: '',
      hazard_description: '',
      control_measures: '',
      risk_level: 'medium',
      chemical_name: '',
      storage_requirements: '',
      exposure_limits: '',
      location_details: '',
      priority: 'medium',
      responsibilities: '',
    });
    setAttachedFiles([]);
    setSelectedOrg('');
    setSelectedBranch('');
    setShowCreateDialog(true);
  };

  const openViewDialog = (item: any, type: 'risk' | 'coshh' | 'hazard' | 'method') => {
    setDialogType(type);
    setSelectedItem(item);
    setShowViewDialog(true);
  };

  const openEditDialog = (item: any, type: 'risk' | 'coshh' | 'hazard' | 'method') => {
    setDialogType(type);
    setSelectedItem(item);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      hazard_description: item.hazard_description || '',
      control_measures: item.control_measures || '',
      risk_level: item.risk_level || 'medium',
      chemical_name: item.chemical_name || '',
      storage_requirements: item.storage_requirements || '',
      exposure_limits: item.exposure_limits || '',
      location_details: item.location_details || '',
      priority: item.priority || 'medium',
      responsibilities: item.responsibilities || '',
    });
    setAttachedFiles(getFilesColumn(item, type));
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;
    try {
      let error;
      switch (dialogType) {
        case 'risk':
          ({ error } = await supabase.from('risk_assessments').update({
            title: formData.title,
            description: formData.description,
            hazard_description: formData.hazard_description,
            control_measures: formData.control_measures,
            risk_level: formData.risk_level,
            evidence_files: attachedFiles as any,
          }).eq('id', selectedItem.id));
          break;
        case 'coshh':
          ({ error } = await supabase.from('coshh_assessments').update({
            chemical_name: formData.chemical_name,
            storage_requirements: formData.storage_requirements,
            exposure_limits: formData.exposure_limits,
            sds_file_path: attachedFiles[0]?.path || null,
          }).eq('id', selectedItem.id));
          break;
        case 'hazard':
          ({ error } = await supabase.from('hazard_reports').update({
            title: formData.title,
            description: formData.description,
            location_details: formData.location_details,
            priority: formData.priority,
            images: attachedFiles as any,
          }).eq('id', selectedItem.id));
          break;
        case 'method':
          ({ error } = await supabase.from('method_statements').update({
            title: formData.title,
            responsibilities: formData.responsibilities,
            attachments: attachedFiles as any,
          }).eq('id', selectedItem.id));
          break;
      }
      if (error) throw error;
      toast({ title: "Success", description: "Updated successfully" });
      setShowEditDialog(false);
      setSelectedItem(null);
      setAttachedFiles([]);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const tableName = deleteConfirm.type === 'risk' ? 'risk_assessments' 
        : deleteConfirm.type === 'coshh' ? 'coshh_assessments'
        : deleteConfirm.type === 'hazard' ? 'hazard_reports'
        : 'method_statements';
      
      const { error } = await supabase.from(tableName).delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast({ title: "Success", description: "Deleted successfully" });
      setDeleteConfirm(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const updateStatus = async (id: string, type: string, newStatus: string) => {
    try {
      const tableName = type === 'risk' ? 'risk_assessments' 
        : type === 'coshh' ? 'coshh_assessments'
        : type === 'hazard' ? 'hazard_reports'
        : 'method_statements';
      
      const { error } = await supabase.from(tableName).update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast({ title: "Success", description: "Status updated" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      let orgId: string | null = null;
      let branchId: string | null = null;

      if (user?.role === 'super_admin') {
        if (!selectedOrg || !selectedBranch) {
          toast({ title: "Error", description: "Please select organization and branch", variant: "destructive" });
          return;
        }
        orgId = selectedOrg;
        branchId = selectedBranch;
      } else if (user?.role === 'hr') {
        orgId = selectedOrg || user.organizationId || null;
        branchId = selectedBranch || user.branchId || null;
        if (!orgId || !branchId) {
          toast({ title: "Error", description: "Please select organization and branch", variant: "destructive" });
          return;
        }
      } else {
        const { data: profile } = await supabase.from('profiles').select('organization_id, branch_id').eq('id', authUser?.id).single();
        if (!profile?.organization_id || !profile?.branch_id) {
          toast({ title: "Error", description: "Organization or branch not configured", variant: "destructive" });
          return;
        }
        orgId = profile.organization_id;
        branchId = profile.branch_id;
      }

      let error;
      switch (dialogType) {
        case 'risk':
          ({ error } = await supabase.from('risk_assessments').insert({
            title: formData.title, description: formData.description,
            hazard_description: formData.hazard_description, control_measures: formData.control_measures,
            risk_level: formData.risk_level, organization_id: orgId!, branch_id: branchId!,
            created_by: authUser?.id, evidence_files: attachedFiles as any,
          }));
          break;
        case 'coshh':
          ({ error } = await supabase.from('coshh_assessments').insert({
            chemical_name: formData.chemical_name, storage_requirements: formData.storage_requirements,
            exposure_limits: formData.exposure_limits, organization_id: orgId!, branch_id: branchId!,
            created_by: authUser?.id, sds_file_path: attachedFiles[0]?.path || null,
          }));
          break;
        case 'hazard':
          ({ error } = await supabase.from('hazard_reports').insert({
            title: formData.title, description: formData.description,
            location_details: formData.location_details, priority: formData.priority,
            organization_id: orgId!, branch_id: branchId!, reported_by: authUser?.id!,
            images: attachedFiles as any,
          }));
          break;
        case 'method':
          ({ error } = await supabase.from('method_statements').insert({
            title: formData.title, responsibilities: formData.responsibilities,
            organization_id: orgId!, branch_id: branchId!, created_by: authUser?.id,
            attachments: attachedFiles as any,
          }));
          break;
      }
      if (error) throw error;
      toast({ title: "Success", description: "Created successfully" });
      setShowCreateDialog(false);
      setAttachedFiles([]);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create", variant: "destructive" });
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500 text-white';
      case 'pending': return 'bg-amber-500 text-white';
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'resolved': return 'bg-green-500 text-white';
      case 'reported': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const riskModules = [
    { icon: FileText, title: "Risk Assessments", key: 'risk-assessments', count: riskAssessments.length, gradient: "from-primary to-accent" },
    { icon: AlertTriangle, title: "COSHH Assessments", key: 'coshh', count: coshhAssessments.length, gradient: "from-accent to-primary" },
    { icon: AlertCircle, title: "Hazard Reports", key: 'hazards', count: hazardReports.length, gradient: "from-primary/80 to-accent/80" },
    { icon: Clipboard, title: "Method Statements", key: 'methods', count: methodStatements.length, gradient: "from-accent/80 to-primary/80" }
  ];

  const renderFileAttachmentForm = () => {
    const labels: Record<string, string> = {
      risk: 'Evidence Files',
      coshh: 'Safety Data Sheet (SDS)',
      hazard: 'Photos/Evidence',
      method: 'Supporting Documents',
    };
    return (
      <FileAttachment
        files={attachedFiles}
        onFilesChange={setAttachedFiles}
        bucket="documents"
        folderPath={`safety/${dialogType}`}
        maxFiles={dialogType === 'coshh' ? 1 : 10}
        label={labels[dialogType]}
        accept="*/*"
      />
    );
  };

  const createDialogBranches = selectedOrg ? branches.filter(b => b.organization_id === selectedOrg) : branches;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Risk Management</h1>
        <p className="text-muted-foreground">Identify, assess, and control workplace risks</p>
      </div>

      {/* Org/Branch Filter - visible to super_admin and HR only */}
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
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {riskModules.map((module) => (
          <Card 
            key={module.key}
            className={`p-4 cursor-pointer group border-border hover:border-primary/50 transition-all ${activeTab === module.key ? 'border-primary' : ''}`}
            onClick={() => setActiveTab(module.key)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <module.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{module.title}</h3>
                <p className="text-2xl font-bold text-primary">{module.count}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => openCreateDialog(activeTab === 'risk-assessments' ? 'risk' : activeTab === 'coshh' ? 'coshh' : activeTab === 'hazards' ? 'hazard' : 'method')} className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />Create New
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="risk-assessments">Risk Assessments</TabsTrigger>
          <TabsTrigger value="coshh">COSHH</TabsTrigger>
          <TabsTrigger value="hazards">Hazards</TabsTrigger>
          <TabsTrigger value="methods">Method Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="risk-assessments">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Risk Level</TableHead><TableHead>Status</TableHead><TableHead>Files</TableHead><TableHead>Review Date</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {riskAssessments.filter(item => !searchTerm || item.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No risk assessments found</TableCell></TableRow>
                ) : (
                  riskAssessments.filter(item => !searchTerm || item.title.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell><Badge className={getRiskBadgeColor(item.risk_level)}>{item.risk_level}</Badge></TableCell>
                      <TableCell><Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge></TableCell>
                      <TableCell>{getFilesColumn(item, 'risk').length > 0 && (<div className="flex items-center gap-1 text-muted-foreground"><Paperclip className="h-4 w-4" /><span className="text-sm">{getFilesColumn(item, 'risk').length}</span></div>)}</TableCell>
                      <TableCell>{item.review_date ? format(new Date(item.review_date), 'PPP') : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(item, 'risk')}><Eye className="h-4 w-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditDialog(item, 'risk')}><Edit className="h-4 w-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'risk', id: item.id })}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="coshh">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Chemical Name</TableHead><TableHead>Status</TableHead><TableHead>SDS</TableHead><TableHead>SDS Expiry</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {coshhAssessments.filter(item => !searchTerm || item.chemical_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No COSHH assessments found</TableCell></TableRow>
                ) : (
                  coshhAssessments.filter(item => !searchTerm || item.chemical_name.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.chemical_name}</TableCell>
                      <TableCell><Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge></TableCell>
                      <TableCell>{item.sds_file_path && (<div className="flex items-center gap-1 text-muted-foreground"><Paperclip className="h-4 w-4" /><span className="text-sm">1</span></div>)}</TableCell>
                      <TableCell>{item.sds_expiry_date ? format(new Date(item.sds_expiry_date), 'PPP') : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(item, 'coshh')}><Eye className="h-4 w-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditDialog(item, 'coshh')}><Edit className="h-4 w-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'coshh', id: item.id })}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hazards">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Photos</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {hazardReports.filter(item => !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hazard reports found</TableCell></TableRow>
                ) : (
                  hazardReports.filter(item => !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell><Badge className={getRiskBadgeColor(item.priority)}>{item.priority}</Badge></TableCell>
                      <TableCell><Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge></TableCell>
                      <TableCell>{getFilesColumn(item, 'hazard').length > 0 && (<div className="flex items-center gap-1 text-muted-foreground"><Paperclip className="h-4 w-4" /><span className="text-sm">{getFilesColumn(item, 'hazard').length}</span></div>)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(item, 'hazard')}><Eye className="h-4 w-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditDialog(item, 'hazard')}><Edit className="h-4 w-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'hazard', id: item.id })}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="methods">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Files</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {methodStatements.filter(item => !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No method statements found</TableCell></TableRow>
                ) : (
                  methodStatements.filter(item => !searchTerm || item.title?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell><Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge></TableCell>
                      <TableCell>{getFilesColumn(item, 'method').length > 0 && (<div className="flex items-center gap-1 text-muted-foreground"><Paperclip className="h-4 w-4" /><span className="text-sm">{getFilesColumn(item, 'method').length}</span></div>)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openViewDialog(item, 'method')}><Eye className="h-4 w-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEditDialog(item, 'method')}><Edit className="h-4 w-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'method', id: item.id })}><Trash2 className="h-4 w-4" /></Button>}
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
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New {dialogType === 'risk' ? 'Risk Assessment' : dialogType === 'coshh' ? 'COSHH Assessment' : dialogType === 'hazard' ? 'Hazard Report' : 'Method Statement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Org/Branch for super admin and HR */}
            {(user?.role === 'super_admin' || (user?.role === 'hr' && !user?.branchId)) && (
              <>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); setSelectedBranch(''); fetchFilterBranches(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>{organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!selectedOrg}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{createDialogBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}

            {dialogType === 'risk' && (
              <>
                <div className="space-y-2"><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="Risk assessment title" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea rows={6} className="min-h-[120px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Hazard Description</Label><Textarea rows={6} className="min-h-[120px]" value={formData.hazard_description} onChange={(e) => setFormData({...formData, hazard_description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Control Measures</Label><Textarea rows={6} className="min-h-[120px]" value={formData.control_measures} onChange={(e) => setFormData({...formData, control_measures: e.target.value})} /></div>
                <div className="space-y-2"><Label>Risk Level</Label>
                  <Select value={formData.risk_level} onValueChange={(v) => setFormData({...formData, risk_level: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}

            {dialogType === 'coshh' && (
              <>
                <div className="space-y-2"><Label>Chemical Name</Label><Input value={formData.chemical_name} onChange={(e) => setFormData({...formData, chemical_name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Storage Requirements</Label><Textarea rows={6} className="min-h-[120px]" value={formData.storage_requirements} onChange={(e) => setFormData({...formData, storage_requirements: e.target.value})} /></div>
                <div className="space-y-2"><Label>Exposure Limits</Label><Input value={formData.exposure_limits} onChange={(e) => setFormData({...formData, exposure_limits: e.target.value})} /></div>
              </>
            )}

            {dialogType === 'hazard' && (
              <>
                <div className="space-y-2"><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea rows={6} className="min-h-[120px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Location</Label><Input value={formData.location_details} onChange={(e) => setFormData({...formData, location_details: e.target.value})} /></div>
                <div className="space-y-2"><Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}

            {dialogType === 'method' && (
              <>
                <div className="space-y-2"><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Responsibilities</Label><Textarea rows={6} className="min-h-[120px]" value={formData.responsibilities} onChange={(e) => setFormData({...formData, responsibilities: e.target.value})} /></div>
              </>
            )}

            {renderFileAttachmentForm()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              {dialogType === 'risk' && (
                <>
                  <div><Label className="text-muted-foreground">Title</Label><p className="mt-1 font-medium">{selectedItem.title}</p></div>
                  <div><Label className="text-muted-foreground">Description</Label><p className="mt-1">{selectedItem.description || '-'}</p></div>
                  <div><Label className="text-muted-foreground">Hazard</Label><p className="mt-1">{selectedItem.hazard_description || '-'}</p></div>
                  <div><Label className="text-muted-foreground">Control Measures</Label><p className="mt-1">{selectedItem.control_measures || '-'}</p></div>
                  <div className="flex gap-4">
                    <div><Label className="text-muted-foreground">Risk Level</Label><Badge className={`mt-1 ${getRiskBadgeColor(selectedItem.risk_level)}`}>{selectedItem.risk_level}</Badge></div>
                    <div><Label className="text-muted-foreground">Status</Label><Badge className={`mt-1 ${getStatusBadgeColor(selectedItem.status)}`}>{selectedItem.status}</Badge></div>
                  </div>
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label>Update Status</Label>
                      <Select value={selectedItem.status} onValueChange={(v) => { updateStatus(selectedItem.id, 'risk', v); setShowViewDialog(false); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem></SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
              {dialogType === 'coshh' && (
                <>
                  <div><Label className="text-muted-foreground">Chemical Name</Label><p className="mt-1 font-medium">{selectedItem.chemical_name}</p></div>
                  <div><Label className="text-muted-foreground">Storage</Label><p className="mt-1">{selectedItem.storage_requirements || '-'}</p></div>
                  <div><Label className="text-muted-foreground">Exposure Limits</Label><p className="mt-1">{selectedItem.exposure_limits || '-'}</p></div>
                  <div><Label className="text-muted-foreground">Status</Label><Badge className={`mt-1 ${getStatusBadgeColor(selectedItem.status)}`}>{selectedItem.status}</Badge></div>
                </>
              )}
              {dialogType === 'hazard' && (
                <>
                  <div><Label className="text-muted-foreground">Title</Label><p className="mt-1 font-medium">{selectedItem.title}</p></div>
                  <div><Label className="text-muted-foreground">Description</Label><p className="mt-1">{selectedItem.description || '-'}</p></div>
                  <div><Label className="text-muted-foreground">Location</Label><p className="mt-1">{selectedItem.location_details || '-'}</p></div>
                  <div className="flex gap-4">
                    <div><Label className="text-muted-foreground">Priority</Label><Badge className={`mt-1 ${getRiskBadgeColor(selectedItem.priority)}`}>{selectedItem.priority}</Badge></div>
                    <div><Label className="text-muted-foreground">Status</Label><Badge className={`mt-1 ${getStatusBadgeColor(selectedItem.status)}`}>{selectedItem.status}</Badge></div>
                  </div>
                </>
              )}
              {dialogType === 'method' && (
                <>
                  <div><Label className="text-muted-foreground">Title</Label><p className="mt-1 font-medium">{selectedItem.title}</p></div>
                  <div><Label className="text-muted-foreground">Responsibilities</Label><p className="mt-1">{selectedItem.responsibilities || '-'}</p></div>
                  <div><Label className="text-muted-foreground">Status</Label><Badge className={`mt-1 ${getStatusBadgeColor(selectedItem.status)}`}>{selectedItem.status}</Badge></div>
                </>
              )}
              {/* Files */}
              {getFilesColumn(selectedItem, dialogType).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Attached Files</Label>
                  <div className="mt-2 space-y-2">
                    <FileViewer files={getFilesColumn(selectedItem, dialogType)} bucket="documents" />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {dialogType === 'risk' && (
              <>
                <div className="space-y-2"><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea rows={6} className="min-h-[120px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Hazard Description</Label><Textarea rows={6} className="min-h-[120px]" value={formData.hazard_description} onChange={(e) => setFormData({...formData, hazard_description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Control Measures</Label><Textarea rows={6} className="min-h-[120px]" value={formData.control_measures} onChange={(e) => setFormData({...formData, control_measures: e.target.value})} /></div>
                <div className="space-y-2"><Label>Risk Level</Label>
                  <Select value={formData.risk_level} onValueChange={(v) => setFormData({...formData, risk_level: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            {dialogType === 'coshh' && (
              <>
                <div className="space-y-2"><Label>Chemical Name</Label><Input value={formData.chemical_name} onChange={(e) => setFormData({...formData, chemical_name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Storage Requirements</Label><Textarea rows={6} className="min-h-[120px]" value={formData.storage_requirements} onChange={(e) => setFormData({...formData, storage_requirements: e.target.value})} /></div>
                <div className="space-y-2"><Label>Exposure Limits</Label><Input value={formData.exposure_limits} onChange={(e) => setFormData({...formData, exposure_limits: e.target.value})} /></div>
              </>
            )}
            {dialogType === 'hazard' && (
              <>
                <div className="space-y-2"><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea rows={6} className="min-h-[120px]" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
                <div className="space-y-2"><Label>Location</Label><Input value={formData.location_details} onChange={(e) => setFormData({...formData, location_details: e.target.value})} /></div>
                <div className="space-y-2"><Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            {dialogType === 'method' && (
              <>
                <div className="space-y-2"><Label>Title</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Responsibilities</Label><Textarea rows={6} className="min-h-[120px]" value={formData.responsibilities} onChange={(e) => setFormData({...formData, responsibilities: e.target.value})} /></div>
              </>
            )}
            {renderFileAttachmentForm()}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
