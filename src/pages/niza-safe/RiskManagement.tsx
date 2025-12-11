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
import { FileText, AlertTriangle, AlertCircle, Clipboard, Plus, Search, Eye, Edit, Trash2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function RiskManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('risk-assessments');
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  const [coshhAssessments, setCoshhAssessments] = useState<any[]>([]);
  const [hazardReports, setHazardReports] = useState<any[]>([]);
  const [methodStatements, setMethodStatements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'risk' | 'coshh' | 'hazard' | 'method'>('risk');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Organizations and branches for Super Admin
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
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

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [riskRes, coshhRes, hazardRes, methodRes] = await Promise.all([
        supabase.from('risk_assessments').select('*').order('created_at', { ascending: false }),
        supabase.from('coshh_assessments').select('*').order('created_at', { ascending: false }),
        supabase.from('hazard_reports').select('*').order('created_at', { ascending: false }),
        supabase.from('method_statements').select('*').order('created_at', { ascending: false }),
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
    setSelectedOrg('');
    setSelectedBranch('');
    setShowCreateDialog(true);
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

      let error;
      switch (dialogType) {
        case 'risk':
          ({ error } = await supabase.from('risk_assessments').insert({
            title: formData.title,
            description: formData.description,
            hazard_description: formData.hazard_description,
            control_measures: formData.control_measures,
            risk_level: formData.risk_level,
            organization_id: orgId,
            branch_id: branchId,
            created_by: authUser?.id,
          }));
          break;
        case 'coshh':
          ({ error } = await supabase.from('coshh_assessments').insert({
            chemical_name: formData.chemical_name,
            storage_requirements: formData.storage_requirements,
            exposure_limits: formData.exposure_limits,
            organization_id: orgId,
            branch_id: branchId,
            created_by: authUser?.id,
          }));
          break;
        case 'hazard':
          ({ error } = await supabase.from('hazard_reports').insert({
            title: formData.title,
            description: formData.description,
            location_details: formData.location_details,
            priority: formData.priority,
            organization_id: orgId,
            branch_id: branchId,
            reported_by: authUser?.id,
          }));
          break;
        case 'method':
          ({ error } = await supabase.from('method_statements').insert({
            title: formData.title,
            responsibilities: formData.responsibilities,
            organization_id: orgId,
            branch_id: branchId,
            created_by: authUser?.id,
          }));
          break;
      }

      if (error) throw error;

      toast({ title: "Success", description: "Created successfully" });
      setShowCreateDialog(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create",
        variant: "destructive",
      });
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

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Risk Management</h1>
        <p className="text-muted-foreground">Identify, assess, and control workplace risks</p>
      </div>
      
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
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={() => openCreateDialog(activeTab === 'risk-assessments' ? 'risk' : activeTab === 'coshh' ? 'coshh' : activeTab === 'hazards' ? 'hazard' : 'method')}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New
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
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No risk assessments found
                    </TableCell>
                  </TableRow>
                ) : (
                  riskAssessments.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge className={getRiskBadgeColor(item.risk_level)}>{item.risk_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{item.review_date ? format(new Date(item.review_date), 'PPP') : '-'}</TableCell>
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

        <TabsContent value="coshh">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chemical Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SDS Expiry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coshhAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No COSHH assessments found
                    </TableCell>
                  </TableRow>
                ) : (
                  coshhAssessments.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.chemical_name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{item.sds_expiry_date ? format(new Date(item.sds_expiry_date), 'PPP') : '-'}</TableCell>
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

        <TabsContent value="hazards">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hazardReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hazard reports found
                    </TableCell>
                  </TableRow>
                ) : (
                  hazardReports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge className={getRiskBadgeColor(item.priority)}>{item.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(item.created_at), 'PPP')}</TableCell>
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

        <TabsContent value="methods">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methodStatements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No method statements found
                    </TableCell>
                  </TableRow>
                ) : (
                  methodStatements.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(item.created_at), 'PPP')}</TableCell>
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
            <DialogTitle>
              Create {dialogType === 'risk' ? 'Risk Assessment' : dialogType === 'coshh' ? 'COSHH Assessment' : dialogType === 'hazard' ? 'Hazard Report' : 'Method Statement'}
            </DialogTitle>
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

            {dialogType === 'coshh' ? (
              <>
                <div className="space-y-2">
                  <Label>Chemical Name</Label>
                  <Input
                    value={formData.chemical_name}
                    onChange={(e) => setFormData({ ...formData, chemical_name: e.target.value })}
                    placeholder="Enter chemical name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Storage Requirements</Label>
                  <Textarea
                    value={formData.storage_requirements}
                    onChange={(e) => setFormData({ ...formData, storage_requirements: e.target.value })}
                    placeholder="Enter storage requirements"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exposure Limits</Label>
                  <Input
                    value={formData.exposure_limits}
                    onChange={(e) => setFormData({ ...formData, exposure_limits: e.target.value })}
                    placeholder="Enter exposure limits"
                  />
                </div>
              </>
            ) : dialogType === 'hazard' ? (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter hazard title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the hazard"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location Details</Label>
                  <Input
                    value={formData.location_details}
                    onChange={(e) => setFormData({ ...formData, location_details: e.target.value })}
                    placeholder="Where is the hazard?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : dialogType === 'method' ? (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter method statement title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsibilities</Label>
                  <Textarea
                    value={formData.responsibilities}
                    onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                    placeholder="Enter responsibilities"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter risk assessment title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hazard Description</Label>
                  <Textarea
                    value={formData.hazard_description}
                    onChange={(e) => setFormData({ ...formData, hazard_description: e.target.value })}
                    placeholder="Describe the hazards"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Control Measures</Label>
                  <Textarea
                    value={formData.control_measures}
                    onChange={(e) => setFormData({ ...formData, control_measures: e.target.value })}
                    placeholder="Enter control measures"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Risk Level</Label>
                  <Select value={formData.risk_level} onValueChange={(v) => setFormData({ ...formData, risk_level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}