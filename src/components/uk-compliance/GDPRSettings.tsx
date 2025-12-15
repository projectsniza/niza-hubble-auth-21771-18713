import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Clock, FileText, UserX, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface RetentionPolicy {
  id: string;
  data_category: string;
  retention_period_months: number;
  legal_basis: string;
  description: string;
  is_active: boolean;
}

interface DataRequest {
  id: string;
  request_type: string;
  requester_name: string;
  requester_email: string;
  status: string;
  due_date: string;
  created_at: string;
  employee_id: string;
}

const dataCategories = [
  { value: 'employee_records', label: 'Employee Records' },
  { value: 'payroll', label: 'Payroll Data' },
  { value: 'recruitment', label: 'Recruitment Data' },
  { value: 'performance', label: 'Performance Reviews' },
  { value: 'disciplinary', label: 'Disciplinary Records' },
  { value: 'training', label: 'Training Records' },
  { value: 'health_safety', label: 'Health & Safety' },
];

const legalBases = [
  { value: 'legal_obligation', label: 'Legal Obligation' },
  { value: 'legitimate_interest', label: 'Legitimate Interest' },
  { value: 'consent', label: 'Consent' },
  { value: 'contract', label: 'Contractual Necessity' },
];

export function GDPRSettings() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    data_category: '',
    retention_period_months: 84,
    legal_basis: 'legal_obligation',
    description: ''
  });
  const [newRequest, setNewRequest] = useState({
    request_type: 'access',
    requester_name: '',
    requester_email: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [policiesRes, requestsRes] = await Promise.all([
        supabase.from('gdpr_retention_policies').select('*').order('data_category'),
        supabase.from('gdpr_data_requests').select('*').order('created_at', { ascending: false })
      ]);

      if (policiesRes.data) setPolicies(policiesRes.data);
      if (requestsRes.data) setDataRequests(requestsRes.data);
    } catch (error) {
      console.error('Error fetching GDPR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPolicy = async () => {
    try {
      const { error } = await supabase.from('gdpr_retention_policies').insert({
        ...newPolicy,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;

      toast.success('Retention policy added');
      setShowPolicyDialog(false);
      setNewPolicy({ data_category: '', retention_period_months: 84, legal_basis: 'legal_obligation', description: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddRequest = async () => {
    try {
      const dueDate = addDays(new Date(), 30); // GDPR requires 30 day response
      const { error } = await supabase.from('gdpr_data_requests').insert({
        ...newRequest,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Data request logged');
      setShowRequestDialog(false);
      setNewRequest({ request_type: 'access', requester_name: '', requester_email: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateRequestStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = (await supabase.auth.getUser()).data.user?.id;
      }

      const { error } = await supabase.from('gdpr_data_requests').update(updates).eq('id', id);
      if (error) throw error;

      toast.success('Request updated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      in_progress: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'outline', label: 'Completed' },
      rejected: { variant: 'destructive', label: 'Rejected' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRequestTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      access: 'Data Access',
      erasure: 'Right to Erasure',
      rectification: 'Rectification',
      portability: 'Data Portability'
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">GDPR Compliance</h2>
      </div>

      <Tabs defaultValue="retention" className="w-full">
        <TabsList>
          <TabsTrigger value="retention">
            <Clock className="h-4 w-4 mr-2" />
            Data Retention
          </TabsTrigger>
          <TabsTrigger value="requests">
            <FileText className="h-4 w-4 mr-2" />
            Data Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Retention Policies</CardTitle>
                <CardDescription>Define how long different types of data should be retained</CardDescription>
              </div>
              <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Retention Policy</DialogTitle>
                    <DialogDescription>Define data retention rules for GDPR compliance</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Data Category</Label>
                      <Select value={newPolicy.data_category} onValueChange={(v) => setNewPolicy({ ...newPolicy, data_category: v })}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {dataCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Retention Period (months)</Label>
                      <Input
                        type="number"
                        value={newPolicy.retention_period_months}
                        onChange={(e) => setNewPolicy({ ...newPolicy, retention_period_months: parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">UK default: 84 months (7 years) for employment records</p>
                    </div>
                    <div>
                      <Label>Legal Basis</Label>
                      <Select value={newPolicy.legal_basis} onValueChange={(v) => setNewPolicy({ ...newPolicy, legal_basis: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {legalBases.map((basis) => (
                            <SelectItem key={basis.value} value={basis.value}>{basis.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newPolicy.description}
                        onChange={(e) => setNewPolicy({ ...newPolicy, description: e.target.value })}
                        placeholder="Describe the policy and any exceptions..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddPolicy} disabled={!newPolicy.data_category}>Save Policy</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Category</TableHead>
                    <TableHead>Retention Period</TableHead>
                    <TableHead>Legal Basis</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">
                        {dataCategories.find(c => c.value === policy.data_category)?.label || policy.data_category}
                      </TableCell>
                      <TableCell>{policy.retention_period_months} months ({Math.round(policy.retention_period_months / 12)} years)</TableCell>
                      <TableCell>
                        {legalBases.find(b => b.value === policy.legal_basis)?.label || policy.legal_basis}
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.is_active ? 'default' : 'secondary'}>
                          {policy.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {policies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No retention policies defined. Add your first policy to ensure GDPR compliance.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Data Subject Requests</CardTitle>
                <CardDescription>Track and manage GDPR data requests (30-day response required)</CardDescription>
              </div>
              <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Log Request</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Data Request</DialogTitle>
                    <DialogDescription>Record a data subject access request</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Request Type</Label>
                      <Select value={newRequest.request_type} onValueChange={(v) => setNewRequest({ ...newRequest, request_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="access">Data Access Request</SelectItem>
                          <SelectItem value="erasure">Right to Erasure</SelectItem>
                          <SelectItem value="rectification">Rectification</SelectItem>
                          <SelectItem value="portability">Data Portability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Requester Name</Label>
                      <Input
                        value={newRequest.requester_name}
                        onChange={(e) => setNewRequest({ ...newRequest, requester_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Requester Email</Label>
                      <Input
                        type="email"
                        value={newRequest.requester_email}
                        onChange={(e) => setNewRequest({ ...newRequest, requester_email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={newRequest.notes}
                        onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                        placeholder="Additional details about the request..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddRequest} disabled={!newRequest.requester_name || !newRequest.requester_email}>
                      Log Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataRequests.map((request) => {
                    const isOverdue = new Date(request.due_date) < new Date() && request.status !== 'completed';
                    return (
                      <TableRow key={request.id}>
                        <TableCell>{getRequestTypeBadge(request.request_type)}</TableCell>
                        <TableCell>
                          <div>{request.requester_name}</div>
                          <div className="text-xs text-muted-foreground">{request.requester_email}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            <span className={isOverdue ? 'text-destructive' : ''}>
                              {format(new Date(request.due_date), 'dd MMM yyyy')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {request.status !== 'completed' && (
                            <div className="flex gap-2">
                              {request.status === 'pending' && (
                                <Button size="sm" variant="outline" onClick={() => handleUpdateRequestStatus(request.id, 'in_progress')}>
                                  Start
                                </Button>
                              )}
                              <Button size="sm" onClick={() => handleUpdateRequestStatus(request.id, 'completed')}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {dataRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No data requests logged.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
