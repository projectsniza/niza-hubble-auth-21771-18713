import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedEmployee {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department?: string;
  date_of_birth?: string;
  join_date?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export default function BulkUploadDialog({ open, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const { organizations } = useOrganizations();
  const { branches } = useBranches();

  const filteredBranches = organizationId 
    ? branches.filter(b => b.organization_id === organizationId)
    : branches;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const parseCSV = (content: string): ParsedEmployee[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const employees: ParsedEmployee[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const employee: any = {};
      
      headers.forEach((header, index) => {
        if (values[index]) {
          employee[header] = values[index];
        }
      });

      if (employee.first_name && employee.last_name && employee.email) {
        employees.push(employee as ParsedEmployee);
      }
    }

    return employees;
  };

  const handleUpload = async () => {
    if (!selectedFile || !organizationId || !branchId) {
      toast.error('Please select a file, organization, and branch');
      return;
    }

    setIsUploading(true);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      const content = await selectedFile.text();
      const employees = parseCSV(content);

      if (employees.length === 0) {
        toast.error('No valid employees found in CSV');
        setIsUploading(false);
        return;
      }

      // Create bulk upload record
      const { data: bulkUpload, error: bulkError } = await supabase
        .from('bulk_uploads')
        .insert({
          file_name: selectedFile.name,
          total_records: employees.length,
          uploaded_by: user?.id,
          organization_id: organizationId,
          branch_id: branchId,
          status: 'processing'
        })
        .select()
        .single();

      if (bulkError) throw bulkError;

      // Check if any bulk upload document settings are enabled
      const { data: enabledDocSettings } = await supabase
        .from('bulk_upload_document_settings')
        .select('id')
        .eq('enabled', true)
        .limit(1);
      
      const docsRequired = (enabledDocSettings && enabledDocSettings.length > 0);
      const employeeStatus = docsRequired ? 'pending' : 'active';

      // Process each employee
      for (const emp of employees) {
        try {
          const { error } = await supabase.from('employees').insert({
            first_name: emp.first_name,
            last_name: emp.last_name,
            email: emp.email,
            phone: emp.phone || null,
            job_title: emp.job_title || null,
            department: emp.department || null,
            date_of_birth: emp.date_of_birth || null,
            join_date: emp.join_date || null,
            emergency_contact_name: emp.emergency_contact_name || null,
            emergency_contact_phone: emp.emergency_contact_phone || null,
            organization_id: organizationId,
            branch_id: branchId,
            bulk_upload_id: bulkUpload.id,
            status: employeeStatus,
            created_by: user?.id
          });

          if (error) {
            errors.push(`${emp.first_name} ${emp.last_name}: ${error.message}`);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${emp.first_name} ${emp.last_name}: ${message}`);
          failedCount++;
        }
      }

      // Update bulk upload record
      await supabase
        .from('bulk_uploads')
        .update({
          processed_records: successCount,
          failed_records: failedCount,
          status: failedCount === employees.length ? 'failed' : 'completed',
          error_log: errors
        })
        .eq('id', bulkUpload.id);

      setUploadResult({ success: successCount, failed: failedCount, errors });
      
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} employees`);
        onSuccess();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Upload failed: ' + message);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'first_name,last_name,email,phone,job_title,department,date_of_birth,join_date,emergency_contact_name,emergency_contact_phone\nJohn,Doe,john.doe@example.com,+44123456789,Software Engineer,IT,1990-01-15,2024-01-01,Jane Doe,+44987654321';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setOrganizationId('');
    setBranchId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Employee Upload</DialogTitle>
          <DialogDescription>
            Import multiple employees from a CSV file. Only basic details will be imported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={organizationId} onValueChange={(v) => {
                setOrganizationId(v);
                setBranchId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId} disabled={!organizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>CSV File</Label>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
            
            <Card 
              className="p-8 border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                {selectedFile ? (
                  <p className="font-medium">{selectedFile.name}</p>
                ) : (
                  <>
                    <p className="font-medium">Click to upload CSV</p>
                    <p className="text-sm text-muted-foreground">
                      Required: first_name, last_name, email
                    </p>
                  </>
                )}
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </Card>
          </div>

          {uploadResult && (
            <Alert variant={uploadResult.failed > 0 ? 'destructive' : 'default'}>
              <div className="flex items-start gap-2">
                {uploadResult.failed > 0 ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <AlertDescription>
                  <p className="font-medium">
                    {uploadResult.success} imported, {uploadResult.failed} failed
                  </p>
                  {uploadResult.errors.length > 0 && (
                    <ul className="mt-2 text-sm list-disc list-inside max-h-32 overflow-auto">
                      {uploadResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <li>...and {uploadResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || !organizationId || !branchId || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}