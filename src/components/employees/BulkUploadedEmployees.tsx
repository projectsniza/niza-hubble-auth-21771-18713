import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Upload, FileText, Check, X, Loader2, User, Building, MapPin, 
  Calendar, AlertCircle, CheckCircle2, Trash2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BulkEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  status: string;
  bulk_upload_id: string;
  created_at: string;
  branch: {
    name: string;
  } | null;
  organization: {
    name: string;
  } | null;
}

interface DocumentRequirement {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  enabled: boolean;
}

interface UploadedDoc {
  requirement_id: string;
  file: File | null;
  uploaded: boolean;
  document_id?: string;
  expiry_date: string;
  follow_up_date: string;
}

export default function BulkUploadedEmployees() {
  const [employees, setEmployees] = useState<BulkEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<BulkEmployee | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isActivatingAll, setIsActivatingAll] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch bulk uploaded employees with pending status
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select(`
          id, first_name, last_name, email, job_title, department, status, 
          bulk_upload_id, created_at,
          branch:branches(name),
          organization:organizations(name)
        `)
        .not('bulk_upload_id', 'is', null)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (empError) throw empError;
      setEmployees(empData || []);

      // Fetch document requirements from bulk upload settings
      const { data: docReqs, error: docError } = await supabase
        .from('bulk_upload_document_settings')
        .select('*')
        .eq('enabled', true)
        .order('doc_order');

      if (docError) throw docError;
      setDocumentRequirements(docReqs?.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        is_mandatory: d.is_mandatory,
        enabled: d.enabled
      })) || []);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateAll = async () => {
    if (employees.length === 0) return;
    setIsActivatingAll(true);
    try {
      const ids = employees.map(e => e.id);
      const { error } = await supabase
        .from('employees')
        .update({ status: 'active' })
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} employees activated and moved to Pending Accounts`);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to activate: ' + error.message);
    } finally {
      setIsActivatingAll(false);
    }
  };

  const handleActivateSingle = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'active' })
        .eq('id', employeeId);
      if (error) throw error;
      toast.success('Employee activated and moved to Pending Accounts');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to activate: ' + error.message);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteId) return;
    try {
      const { data: docs } = await supabase.from('documents').select('id').eq('employee_id', deleteId);
      if (docs && docs.length > 0) {
        await supabase.from('documents').delete().eq('employee_id', deleteId);
      }
      const { error } = await supabase.from('employees').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Employee deleted');
      setDeleteId(null);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const openUploadDialog = async (employee: BulkEmployee) => {
    setSelectedEmployee(employee);
    
    // Fetch existing documents for this employee
    const { data: existingDocuments } = await supabase
      .from('documents')
      .select('*')
      .eq('employee_id', employee.id);
    
    setExistingDocs(existingDocuments || []);
    
    // Initialize upload state
    setUploadedDocs(documentRequirements.map(req => {
      const existing = existingDocuments?.find(d => d.title === req.name);
      return {
        requirement_id: req.id,
        file: null,
        uploaded: !!existing,
        document_id: existing?.id,
        expiry_date: existing?.expiry_date || '',
        follow_up_date: existing?.follow_up_date || ''
      };
    }));
    
    setIsDialogOpen(true);
  };

  const handleFileSelect = (requirementId: string, file: File | null) => {
    setUploadedDocs(prev => prev.map(doc => 
      doc.requirement_id === requirementId ? { ...doc, file } : doc
    ));
  };

  const handleDateChange = (requirementId: string, value: string) => {
    setUploadedDocs(prev => prev.map(doc => 
      doc.requirement_id === requirementId ? { ...doc, expiry_date: value } : doc
    ));
  };

  const handleUploadDocuments = async () => {
    if (!selectedEmployee) return;
    
    const filesToUpload = uploadedDocs.filter(d => d.file && !d.uploaded);
    if (filesToUpload.length === 0) {
      toast.info('No new files to upload');
      return;
    }

    setIsUploading(true);
    try {
      // Find the employee's folder
      const { data: folderData } = await supabase
        .from('folders')
        .select('id')
        .eq('employee_id', selectedEmployee.id)
        .eq('folder_type', 'employee')
        .maybeSingle();

      const folderId = folderData?.id || null;

      for (const doc of filesToUpload) {
        if (!doc.file) continue;
        
        const requirement = documentRequirements.find(r => r.id === doc.requirement_id);
        if (!requirement) continue;

        // Upload file to storage
        const fileExt = doc.file.name.split('.').pop();
        const filePath = `employees/${selectedEmployee.id}/documents/${requirement.name.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, doc.file);

        if (uploadError) throw uploadError;

        // Create document record linked to employee folder
        const { error: docError } = await supabase
          .from('documents')
          .insert({
            title: requirement.name,
            file_name: doc.file.name,
            file_path: filePath,
            file_type: doc.file.type,
            file_size: doc.file.size,
            employee_id: selectedEmployee.id,
            folder_id: folderId,
            expiry_date: doc.expiry_date || null
          });

        if (docError) throw docError;
      }

      toast.success('Documents uploaded successfully');
      
      // Check if all mandatory docs are uploaded
      const mandatoryReqs = documentRequirements.filter(r => r.is_mandatory);
      const { data: allDocs } = await supabase
        .from('documents')
        .select('title')
        .eq('employee_id', selectedEmployee.id);
      
      const uploadedTitles = new Set(allDocs?.map(d => d.title) || []);
      const allMandatoryUploaded = mandatoryReqs.every(r => uploadedTitles.has(r.name));
      
      if (allMandatoryUploaded) {
        // Update employee status to active
        await supabase
          .from('employees')
          .update({ status: 'active' })
          .eq('id', selectedEmployee.id);
        
        toast.success('All mandatory documents uploaded. Employee is now active!');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const getDocStatus = (requirement: DocumentRequirement) => {
    const docState = uploadedDocs.find(d => d.requirement_id === requirement.id);
    if (docState?.uploaded) return 'uploaded';
    if (docState?.file) return 'selected';
    return 'pending';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Uploaded Employees
          </CardTitle>
          <CardDescription>
            Employees added via bulk upload who need their documents uploaded before activation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No pending bulk uploads</p>
              <p className="text-sm">All bulk uploaded employees have been processed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Uploaded On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {employee.first_name[0]}{employee.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.job_title || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {employee.branch?.name || 'Unassigned'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-muted-foreground" />
                        {employee.organization?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(employee.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending Documents
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => openUploadDialog(employee)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Docs
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(employee.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Documents Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Upload Documents for {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {documentRequirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No document requirements configured</p>
                <p className="text-sm">Configure documents in Onboarding Settings</p>
              </div>
            ) : (
              documentRequirements.map((requirement) => {
                const status = getDocStatus(requirement);
                const docState = uploadedDocs.find(d => d.requirement_id === requirement.id);
                
                return (
                  <Card key={requirement.id} className={status === 'uploaded' ? 'border-green-200 bg-green-50/50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{requirement.name}</h4>
                            {requirement.is_mandatory && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                            {status === 'uploaded' && (
                              <Badge variant="default" className="bg-green-500 text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Uploaded
                              </Badge>
                            )}
                          </div>
                          {requirement.description && (
                            <p className="text-sm text-muted-foreground mt-1">{requirement.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {status === 'uploaded' ? (
                            <Button variant="outline" size="sm" disabled>
                              <Check className="h-4 w-4 mr-1" />
                              Done
                            </Button>
                          ) : (
                            <div className="flex flex-col gap-3 w-full">
                              <div className="flex items-center gap-2 justify-end">
                                <Input
                                  type="file"
                                  id={`file-${requirement.id}`}
                                  className="hidden"
                                  onChange={(e) => handleFileSelect(requirement.id, e.target.files?.[0] || null)}
                                  accept="*/*"
                                />
                                <Label 
                                  htmlFor={`file-${requirement.id}`}
                                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Select File
                                </Label>
                              </div>
                              {docState?.file && (
                                <span className="text-xs text-muted-foreground text-right truncate">
                                  {docState.file.name}
                                </span>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label htmlFor={`expiry-${requirement.id}`} className="text-xs text-muted-foreground">
                                    Expiry Date
                                  </Label>
                                  <Input
                                    id={`expiry-${requirement.id}`}
                                    type="date"
                                    value={docState?.expiry_date || ''}
                                    onChange={(e) => handleDateChange(requirement.id, e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUploadDocuments} 
              disabled={isUploading || uploadedDocs.every(d => d.uploaded || !d.file)}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Selected
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this bulk uploaded employee and any uploaded documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
