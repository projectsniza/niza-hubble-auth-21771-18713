import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, FileText, Calendar, User, Upload, Paperclip, Building2, MapPin, Eye, Download, X, Trash2, FolderOpen, ChevronRight, ArrowLeft, Store, Settings as SettingsIcon } from 'lucide-react';
import VendorManagementDialog, { Vendor } from '@/components/vendors/VendorManagementDialog';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { OrgBranchFilter } from '@/components/filters/OrgBranchFilter';
import { logActivity } from '@/hooks/useActivityLogs';

interface DailyReport {
  id: string;
  title: string;
  report_type: string | null;
  files: any;
  vendor_ids?: any;
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
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState('report');
  const [customTypeName, setCustomTypeName] = useState('');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const reportMonthYear = reportDate.slice(0, 7);
  const [files, setFiles] = useState<File[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);
  const [reportToDelete, setReportToDelete] = useState<DailyReport | null>(null);
  
  // Use centralized org/branch data
  const { organizations, branches } = useOrgBranch();
  const [viewMode, setViewMode] = useState<'all' | 'organization' | 'branch'>('all');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  const canViewFilters = user?.role === 'super_admin' || user?.role === 'hr';
  
  // Debounce ref to prevent excessive refetches
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFetchReports = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchReports();
    }, 300);
  }, []);

  useEffect(() => {
    fetchReports();

    // Real-time subscription with debounce
    const channel = supabase
      .channel('daily-reports-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reports' },
        debouncedFetchReports
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, debouncedFetchReports]);

  const fetchReports = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Paginate to bypass Supabase's 1000-row default and fetch ALL reports
      // so super admin / HR see the full history (not just the latest 100).
      const PAGE_SIZE = 1000;
      const all: any[] = [];
      let from = 0;
      // Cap at 20k rows as a safety net
      while (from < 20000) {
        let query = supabase
          .from('daily_reports')
          .select(`
            *,
            branch:branches(name),
            organization:organizations(name)
          `)
          .order('submitted_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (user.role === 'manager') {
          query = query.eq('submitted_by', user.id);
        } else if (user.role === 'hr') {
          if (user.organizationId && user.branchId) {
            query = query.eq('branch_id', user.branchId);
          } else if (user.organizationId) {
            query = query.eq('organization_id', user.organizationId);
          }
        }

        const { data: page, error } = await query;
        if (error) throw error;
        if (!page || page.length === 0) break;
        all.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const data = all;
      const error = null as any;
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

  // For HR users without a branch, allow selecting one
  const [selectedSubmitOrg, setSelectedSubmitOrg] = useState('');
  const [selectedSubmitBranch, setSelectedSubmitBranch] = useState('');

  const needsBranchSelection = (user?.role === 'super_admin' || user?.role === 'hr') && !user?.branchId;
  const submitOrgId = user?.organizationId || selectedSubmitOrg;
  const submitBranchId = user?.branchId || selectedSubmitBranch;

  // Vendor selection (only for invoice type)
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [showVendorManager, setShowVendorManager] = useState(false);
  const [vendorMap, setVendorMap] = useState<Record<string, string>>({});

  const fetchVendorsForBranch = useCallback(async (branchId: string | undefined) => {
    if (!branchId) { setVendorList([]); return; }
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name');
    setVendorList((data as any) || []);
  }, []);

  useEffect(() => {
    if (showUploadDialog && reportType === 'invoice' && submitBranchId) {
      fetchVendorsForBranch(submitBranchId);
    }
  }, [showUploadDialog, reportType, submitBranchId, fetchVendorsForBranch]);

  // Build a global vendor map for displaying tags on report cards.
  // Use union of branches across all loaded reports + ids referenced directly,
  // so tags resolve even when scope filters change.
  useEffect(() => {
    const branchIds = Array.from(new Set(reports.map(r => r.branch_id).filter(Boolean)));
    const vendorIds = Array.from(new Set(
      reports.flatMap(r => Array.isArray(r.vendor_ids) ? r.vendor_ids : []).filter(Boolean)
    ));
    if (branchIds.length === 0 && vendorIds.length === 0) { setVendorMap({}); return; }
    const run = async () => {
      const map: Record<string, string> = {};
      if (branchIds.length > 0) {
        const { data } = await supabase
          .from('vendors')
          .select('id,name')
          .in('branch_id', branchIds);
        (data || []).forEach((v: any) => { map[v.id] = v.name; });
      }
      // Resolve any referenced vendor ids that weren't in branch lookup
      const missing = vendorIds.filter(id => !map[id]);
      if (missing.length > 0) {
        const { data } = await supabase
          .from('vendors')
          .select('id,name')
          .in('id', missing);
        (data || []).forEach((v: any) => { map[v.id] = v.name; });
      }
      setVendorMap(map);
    };
    run();
  }, [reports]);

  const toggleVendor = (id: string) => {
    setSelectedVendorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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

    // Validate custom type name when "other" is selected
    if (reportType === 'other' && !customTypeName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a custom type name",
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
      // Upload files to storage
      const uploadedFiles: any[] = [];
      for (const file of files) {
        // Sanitize file name — Supabase storage keys must avoid special chars,
        // emojis, slashes, repeated dots etc. Some store till exports include
        // names like "01/05" or contain spaces/quotes that break uploads.
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const base = file.name.slice(0, file.name.length - ext.length)
          .replace(/[^a-zA-Z0-9._-]+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^[._-]+|[._-]+$/g, '')
          .slice(0, 80) || 'file';
        const safeExt = ext.replace(/[^a-zA-Z0-9.]+/g, '').slice(0, 12);
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${safeExt}`;
        const filePath = `daily-reports/${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type
        });
      }

      // Insert report record
      const finalReportType = reportType === 'other' && customTypeName ? customTypeName : reportType;
      const { error } = await supabase.from('daily_reports').insert({
        title: reportTitle,
        report_type: finalReportType,
        report_month: reportMonthYear,
        report_date: reportDate,
        files: uploadedFiles,
        vendor_ids: finalReportType === 'invoice' ? selectedVendorIds : [],
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        organization_id: submitOrgId,
        branch_id: submitBranchId
      } as any);

      if (error) throw error;

      // Log activity for super admin notification
      await logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        activityType: 'report_submission',
        activityCategory: 'reports',
        title: 'New Daily Report',
        description: `${user.name} submitted "${reportTitle}" report`,
        organizationId: submitOrgId,
        branchId: submitBranchId,
      });

      toast({
        title: "Report Submitted",
        description: `Your ${reportType} has been sent to the admin`,
      });

      setReportTitle('');
      setReportType('report');
      setCustomTypeName('');
      setReportDate(format(new Date(), 'yyyy-MM-dd'));
      setFiles([]);
      setSelectedVendorIds([]);
      setShowUploadDialog(false);
      fetchReports();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit report';
      toast({
        title: "Error",
        description: message,
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const canDeleteReport = useCallback((report: DailyReport) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'hr') return true;
    if (user.role === 'manager' && report.submitted_by === user.id) return true;
    return false;
  }, [user]);

  const handleDeleteReport = async (report: DailyReport) => {
    try {
      const { error } = await supabase.from('daily_reports').delete().eq('id', report.id);
      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Daily report deleted successfully.',
      });

      setViewingReport((prev) => (prev?.id === report.id ? null : prev));
      setReportToDelete(null);
      fetchReports();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete report';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  // Memoized filtering for better performance
  const filteredReports = useMemo(() => reports.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase());

    // Use report_date (the day work happened); fallback to report_month or submitted_at
    const reportDateStr = (report as any).report_date
      || ((report as any).report_month ? `${(report as any).report_month}-01` : null)
      || (report.submitted_at ? format(new Date(report.submitted_at), 'yyyy-MM-dd') : null);
    const reportMonth = reportDateStr ? reportDateStr.slice(0, 7) : null;

    const matchesMonth = !monthFilter || reportMonth === monthFilter;
    const matchesDate = !dateFilter || reportDateStr === dateFilter;

    // Apply org/branch filters for super admin / full HR
    if (canViewFilters && viewMode !== 'all') {
      if (viewMode === 'organization' && selectedOrg) {
        return matchesSearch && matchesMonth && matchesDate && report.organization_id === selectedOrg;
      }
      if (viewMode === 'branch' && selectedBranch) {
        return matchesSearch && matchesMonth && matchesDate && report.branch_id === selectedBranch;
      }
      if (viewMode === 'organization' && !selectedOrg) {
        return matchesSearch && matchesMonth && matchesDate;
      }
      if (viewMode === 'branch' && selectedOrg && !selectedBranch) {
        return matchesSearch && matchesMonth && matchesDate && report.organization_id === selectedOrg;
      }
    }

    return matchesSearch && matchesMonth && matchesDate;
  }), [reports, searchQuery, dateFilter, monthFilter, canViewFilters, viewMode, selectedOrg, selectedBranch]);

  const canCreateReport = user?.role === 'super_admin' || user?.role === 'manager' || user?.role === 'hr';

  // Folder view state
  const [folderBranch, setFolderBranch] = useState<string | null>(null);
  const [folderType, setFolderType] = useState<string | null>(null);
  const [folderMonth, setFolderMonth] = useState<string | null>(null);
  const [folderDateFilter, setFolderDateFilter] = useState<string>('');

  const REPORT_CATEGORIES = ['report', 'invoice', 'receipt', 'letter', 'other'] as const;
  const categoryLabel = (cat: string) => cat.charAt(0).toUpperCase() + cat.slice(1) + 's';

  // Group reports by branch
  const reportsByBranch = useMemo(() => {
    const map: Record<string, { name: string; reports: DailyReport[] }> = {};
    reports.forEach(r => {
      if (!map[r.branch_id]) {
        map[r.branch_id] = { name: r.branch?.name || 'Unknown Branch', reports: [] };
      }
      map[r.branch_id].reports.push(r);
    });
    return map;
  }, [reports]);

  // Get unique months for a branch/type — based on report_date
  const getMonthsForType = (branchId: string, type: string) => {
    const branchReports = reportsByBranch[branchId]?.reports || [];
    const typeReports = branchReports.filter(r => {
      const rt = (r.report_type || 'report').toLowerCase();
      if (type === 'other') return !['report', 'invoice', 'receipt', 'letter'].includes(rt);
      return rt === type;
    });
    const months = new Set<string>();
    typeReports.forEach(r => {
      const rd = (r as any).report_date as string | null;
      const rm = rd ? rd.slice(0, 7)
        : ((r as any).report_month || (r.submitted_at ? format(new Date(r.submitted_at), 'yyyy-MM') : null));
      if (rm) months.add(rm);
    });
    return [...months].sort().reverse();
  };

  // Get reports for a specific branch/type/month — match on report_date
  const getReportsForFolder = (branchId: string, type: string, month: string) => {
    const branchReports = reportsByBranch[branchId]?.reports || [];
    return branchReports.filter(r => {
      const rt = (r.report_type || 'report').toLowerCase();
      const isTypeMatch = type === 'other' ? !['report', 'invoice', 'receipt', 'letter'].includes(rt) : rt === type;
      const rd = (r as any).report_date as string | null;
      const rm = rd ? rd.slice(0, 7)
        : ((r as any).report_month || (r.submitted_at ? format(new Date(r.submitted_at), 'yyyy-MM') : null));
      return isTypeMatch && rm === month;
    });
  };

  const formatMonthLabel = (m: string) => {
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy');
  };

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
                          {branches.filter(b => selectedSubmitOrg ? b.organization_id === selectedSubmitOrg : (user?.organizationId ? b.organization_id === user.organizationId : true)).map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
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
                  <Select value={reportType} onValueChange={(v) => { setReportType(v); if (v !== 'other') setCustomTypeName(''); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="letter">Letters</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {reportType === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="customType">Custom Type Name *</Label>
                    <Input 
                      id="customType" 
                      placeholder="Enter custom type name..." 
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                    />
                  </div>
                )}
                {reportType === 'invoice' && (
                  <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Store className="h-4 w-4" /> Tag Vendors (optional)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!submitBranchId}
                        onClick={() => setShowVendorManager(true)}
                      >
                        <SettingsIcon className="h-3.5 w-3.5 mr-1" />
                        Manage Vendors
                      </Button>
                    </div>
                    {!submitBranchId ? (
                      <p className="text-xs text-muted-foreground">Select a branch first to load vendors.</p>
                    ) : vendorList.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No vendors yet for this branch. Click "Manage Vendors" to add one.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {vendorList.map((v) => {
                            const checked = selectedVendorIds.includes(v.id);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => toggleVendor(v.id)}
                                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                                  checked
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-border'
                                }`}
                              >
                                {v.name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedVendorIds.length} vendor(s) selected. Tap to toggle.
                        </p>
                      </>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Report Date *</Label>
                  <Input 
                    type="date" 
                    value={reportDate} 
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pick the date the work happened. The report will be filed under{' '}
                    <span className="font-medium">{format(new Date(reportDate), 'MMMM yyyy')}</span> in the folder view.
                  </p>
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
                        accept="*/*"
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

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="folders">
            <FolderOpen className="h-4 w-4 mr-1" />
            Folder View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
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

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search reports..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Report month:</Label>
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-auto"
          />
          {monthFilter && (
            <Button variant="ghost" size="sm" onClick={() => setMonthFilter('')}>
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Report date:</Label>
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

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <NizaLoaderInline />
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
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{report.title}</h3>
                      <Badge variant="secondary" className="capitalize">
                        {report.report_type || 'report'}
                      </Badge>
                      {Array.isArray(report.vendor_ids) && report.vendor_ids.length > 0 && (
                        report.vendor_ids.slice(0, 4).map((vid: string) => (
                          <Badge key={vid} className="gap-1 text-xs bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                            <Store className="h-3 w-3" />
                            {vendorMap[vid] || 'Vendor'}
                          </Badge>
                        ))
                      )}
                      {Array.isArray(report.vendor_ids) && report.vendor_ids.length > 4 && (
                        <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700">+{report.vendor_ids.length - 4} more</Badge>
                      )}
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <MapPin className="h-4 w-4" />
                          <span>{report.branch.name}</span>
                          {Array.isArray(report.vendor_ids) && report.vendor_ids.length > 0 && (
                            <>
                              {report.vendor_ids.slice(0, 3).map((vid: string) => (
                                <Badge key={vid} className="gap-1 text-[10px] py-0 px-1.5 bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                                  <Store className="h-2.5 w-2.5" />
                                  {vendorMap[vid] || 'Vendor'}
                                </Badge>
                              ))}
                              {report.vendor_ids.length > 3 && (
                                <Badge className="text-[10px] py-0 px-1.5 bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700">+{report.vendor_ids.length - 3}</Badge>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Paperclip className="h-4 w-4" />
                        {Array.isArray(report.files) ? report.files.length : 0} file(s)
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canDeleteReport(report) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setReportToDelete(report)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setViewingReport(report)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

        </TabsContent>

        <TabsContent value="folders" className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" className={!folderBranch ? 'font-bold' : ''} onClick={() => { setFolderBranch(null); setFolderType(null); setFolderMonth(null); }}>All Stores</Button>
            {folderBranch && (<><ChevronRight className="h-4 w-4 text-muted-foreground" /><Button variant="ghost" size="sm" className={!folderType ? 'font-bold' : ''} onClick={() => { setFolderType(null); setFolderMonth(null); }}>{reportsByBranch[folderBranch]?.name || 'Branch'}</Button></>)}
            {folderType && (<><ChevronRight className="h-4 w-4 text-muted-foreground" /><Button variant="ghost" size="sm" className={!folderMonth ? 'font-bold' : ''} onClick={() => setFolderMonth(null)}>{categoryLabel(folderType)}</Button></>)}
            {folderMonth && (<><ChevronRight className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{formatMonthLabel(folderMonth)}</span></>)}
          </div>

          {!folderBranch && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(reportsByBranch).map(([branchId, data]) => (
                <Card key={branchId} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFolderBranch(branchId)}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10"><FolderOpen className="h-6 w-6 text-primary" /></div>
                    <div><p className="font-semibold">{data.name}</p><p className="text-xs text-muted-foreground">{data.reports.length} report(s)</p></div>
                  </div>
                </Card>
              ))}
              {Object.keys(reportsByBranch).length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">No reports found</p>}
            </div>
          )}

          {folderBranch && !folderType && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {REPORT_CATEGORIES.map(cat => {
                const count = (reportsByBranch[folderBranch]?.reports || []).filter(r => { const rt = (r.report_type || 'report').toLowerCase(); return cat === 'other' ? !['report','invoice','receipt','letter'].includes(rt) : rt === cat; }).length;
                return (
                  <Card key={cat} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFolderType(cat)}>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-accent/10"><FolderOpen className="h-6 w-6 text-accent-foreground" /></div>
                      <div><p className="font-semibold">{categoryLabel(cat)}</p><p className="text-xs text-muted-foreground">{count} file(s)</p></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {folderBranch && folderType && !folderMonth && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {getMonthsForType(folderBranch, folderType).map(month => (
                <Card key={month} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFolderMonth(month)}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-muted"><Calendar className="h-6 w-6 text-muted-foreground" /></div>
                    <div><p className="font-semibold">{formatMonthLabel(month)}</p><p className="text-xs text-muted-foreground">{getReportsForFolder(folderBranch, folderType, month).length} file(s)</p></div>
                  </div>
                </Card>
              ))}
              {getMonthsForType(folderBranch, folderType).length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">No reports in this category</p>}
            </div>
          )}

          {folderBranch && folderType && folderMonth && (
            <div className="space-y-4">
              {(() => {
                const monthReports = getReportsForFolder(folderBranch, folderType, folderMonth);
                const getRD = (r: any) => (r.report_date as string | null)
                  || (r.submitted_at ? format(new Date(r.submitted_at), 'yyyy-MM-dd') : null);

                const availableDates = Array.from(new Set(
                  monthReports.map(r => getRD(r)).filter((d): d is string => Boolean(d))
                )).sort().reverse();

                const filtered = folderDateFilter
                  ? monthReports.filter(r => getRD(r) === folderDateFilter)
                  : monthReports;

                const [year, month] = folderMonth.split('-').map(Number);
                const monthStart = `${folderMonth}-01`;
                const monthEnd = format(new Date(year, month, 0), 'yyyy-MM-dd');

                return (
                  <>
                    <Card className="p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter by report date:</Label>
                        <Input
                          type="date"
                          value={folderDateFilter}
                          min={monthStart}
                          max={monthEnd}
                          onChange={(e) => setFolderDateFilter(e.target.value)}
                          className="w-auto"
                        />
                        {availableDates.length > 0 && (
                          <Select value={folderDateFilter || 'all'} onValueChange={(v) => setFolderDateFilter(v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="All dates" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All dates ({monthReports.length})</SelectItem>
                              {availableDates.map(d => {
                                const cnt = monthReports.filter(r => getRD(r) === d).length;
                                return <SelectItem key={d} value={d}>{format(new Date(d), 'dd MMM yyyy')} ({cnt})</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        )}
                        {folderDateFilter && (
                          <Button variant="ghost" size="sm" onClick={() => setFolderDateFilter('')}>
                            Clear
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          Showing {filtered.length} of {monthReports.length}
                        </span>
                      </div>
                    </Card>

                    <div className="grid gap-4">
                      {filtered.map(report => (
                        <Card key={report.id} className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-3 flex-1">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
                              <div><h3 className="font-semibold">{report.title}</h3><p className="text-xs text-muted-foreground mt-1">{report.submitted_at ? format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm') : 'N/A'} · {Array.isArray(report.files) ? report.files.length : 0} file(s)</p></div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setViewingReport(report)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                          </div>
                        </Card>
                      ))}
                      {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">No reports for this period</p>}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the report record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => reportToDelete && handleDeleteReport(reportToDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

              {Array.isArray(viewingReport.vendor_ids) && viewingReport.vendor_ids.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Tagged Vendors</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewingReport.vendor_ids.map((vid: string) => (
                      <Badge key={vid} variant="outline" className="gap-1">
                        <Store className="h-3 w-3" />
                        {vendorMap[vid] || 'Vendor'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

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

      <VendorManagementDialog
        open={showVendorManager}
        onOpenChange={setShowVendorManager}
        branchId={submitBranchId || ''}
        organizationId={submitOrgId || null}
        branchName={branches.find(b => b.id === submitBranchId)?.name}
        onChanged={() => fetchVendorsForBranch(submitBranchId)}
      />
    </div>
  );
}
