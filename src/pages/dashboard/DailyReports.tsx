import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, Calendar, User, Upload, Paperclip, Building2, MapPin, Eye, Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';

interface DailyReport {
  id: string;
  title: string;
  report_type: string | null;
  files: any;
  submitted_by: string;
  submitted_at: string | null;
  created_at: string | null;
  branch_id: string;
  organization_id: string;
  branch?: { name: string } | null;
  organization?: { name: string } | null;
  submitter?: { name: string; display_name: string | null } | null;
}

export default function DailyReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState('report');
  const [files, setFiles] = useState<File[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);
  
  // Filter state for super admin / full HR
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');
  
  useEffect(() => {
    fetchReports();
    if (canViewFilters) {
      fetchOrganizationsAndBranches();
    }

    // Real-time subscription
    const channel = supabase
      .channel('daily-reports-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reports' },
        () => fetchReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchOrganizationsAndBranches = async () => {
    const [orgsRes, branchesRes] = await Promise.all([
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('branches').select('id, name, organization_id').order('name')
    ]);
    setOrganizations(orgsRes.data || []);
    setBranches(branchesRes.data || []);
  };

  const fetchReports = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('daily_reports')
        .select(`
          *,
          branch:branches(name),
          organization:organizations(name)
        `)
        .order('submitted_at', { ascending: false });

      // Filter based on role and access level
      if (user.role === 'manager') {
        query = query.eq('submitted_by', user.id);
      } else if (user.role === 'hr') {
        // HR access depends on their access level
        if (user.hrAccessLevel === 'organization' && user.organizationId) {
          query = query.eq('organization_id', user.organizationId);
        } else if (user.hrAccessLevel === 'branch' && user.branchId) {
          query = query.eq('branch_id', user.branchId);
        }
        // full_workspace HR sees all reports (no filter)
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch submitter profiles
      if (data && data.length > 0) {
        const submitterIds = [...new Set(data.map(r => r.submitted_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name')
          .in('id', submitterIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const reportsWithSubmitters = data.map(report => ({
          ...report,
          submitter: profileMap.get(report.submitted_by) || null
        }));
        setReports(reportsWithSubmitters);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async () => {
    if (!reportTitle || files.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and attach at least one file",
        variant: "destructive",
      });
      return;
    }

    if (!user?.organizationId || !user?.branchId) {
      toast({
        title: "Error",
        description: "You must be assigned to a branch to submit reports",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload files to storage
      const uploadedFiles: any[] = [];
      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `daily-reports/${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type
        });
      }

      // Insert report record
      const { error } = await supabase.from('daily_reports').insert({
        title: reportTitle,
        report_type: reportType,
        files: uploadedFiles,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        organization_id: user.organizationId,
        branch_id: user.branchId
      });

      if (error) throw error;

      toast({
        title: "Report Submitted",
        description: `Your ${reportType} has been sent to the admin`,
      });

      setReportTitle('');
      setReportType('report');
      setFiles([]);
      setShowUploadDialog(false);
      fetchReports();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Apply org/branch filters for super admin / full HR
    if (canViewFilters && viewMode !== 'all') {
      if (viewMode === 'organization' && selectedOrg) {
        return matchesSearch && report.organization_id === selectedOrg;
      }
      if (viewMode === 'branch' && selectedBranch) {
        return matchesSearch && report.branch_id === selectedBranch;
      }
      if (viewMode === 'organization' && !selectedOrg) {
        return matchesSearch;
      }
      if (viewMode === 'branch' && selectedOrg && !selectedBranch) {
        return matchesSearch && report.organization_id === selectedOrg;
      }
    }
    
    return matchesSearch;
  });

  const canCreateReport = user?.role === 'manager' || user?.role === 'hr';

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Daily Reports</h2>
          <p className="text-muted-foreground mt-1">
            {canCreateReport 
              ? 'Upload and submit reports and invoices to admin' 
              : 'View all submitted reports and invoices'}
          </p>
        </div>
        
        {canCreateReport && (
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Report/Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Report or Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reportTitle">Title *</Label>
                  <Input 
                    id="reportTitle" 
                    placeholder="Enter custom report name..." 
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="files">Attach Files * (Multiple allowed)</Label>
                  <div className="flex items-center gap-4">
                    <label htmlFor="files" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-sm">Choose Files</span>
                      </div>
                      <input
                        id="files"
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {files.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {files.length} file(s) selected
                      </span>
                    )}
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2 justify-between bg-muted p-2 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            {file.name}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeFile(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleSubmitReport} className="w-full" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit to Admin'}
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

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search reports..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No reports found</h3>
              <p className="text-muted-foreground mb-4">
                {canCreateReport ? 'Upload your first report or invoice' : 'No reports have been submitted yet'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{report.title}</h3>
                      <Badge variant="secondary" className="capitalize">
                        {report.report_type || 'report'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {report.submitted_at ? format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {report.submitter?.display_name || report.submitter?.name || 'Unknown'}
                      </div>
                      {report.organization?.name && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          {report.organization.name}
                        </div>
                      )}
                      {report.branch?.name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {report.branch.name}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Paperclip className="h-4 w-4" />
                        {Array.isArray(report.files) ? report.files.length : 0} file(s)
                      </div>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewingReport(report)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Report Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={() => setViewingReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingReport?.title}</DialogTitle>
          </DialogHeader>
          {viewingReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="capitalize">{viewingReport.report_type || 'Report'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted By</Label>
                  <p>{viewingReport.submitter?.display_name || viewingReport.submitter?.name || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Organization</Label>
                  <p>{viewingReport.organization?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Branch</Label>
                  <p>{viewingReport.branch?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted At</Label>
                  <p>{viewingReport.submitted_at ? format(new Date(viewingReport.submitted_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Attached Files</Label>
                <div className="mt-2 space-y-2">
                  {Array.isArray(viewingReport.files) && viewingReport.files.length > 0 ? (
                    viewingReport.files.map((file: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadFile(file.path, file.name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No files attached</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
