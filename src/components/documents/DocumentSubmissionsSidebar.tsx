import { useState, useEffect } from 'react';
import { Upload, User, Calendar, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentSubmissions } from '@/hooks/useDocumentSubmissions';
import { toast } from 'sonner';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  organization_id: string;
  branch_id: string;
  branch?: { name: string };
  organization?: { name: string };
}

interface DocumentSubmissionsSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function DocumentSubmissionsSidebar({ open, onClose }: DocumentSubmissionsSidebarProps) {
  const { user } = useAuth();
  const { submitDocument } = useDocumentSubmissions();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [documentName, setDocumentName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  const fetchEmployees = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // Get user's profile to determine scope
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, branch_id, hr_access_level')
        .eq('id', user.id)
        .single();

      let query = supabase
        .from('employees')
        .select(`
          id, first_name, last_name, email, organization_id, branch_id,
          branch:branches(name),
          organization:organizations(name)
        `)
        .neq('status', 'terminated')
        .order('first_name');

      // Apply scope based on role
      if (user.role === 'manager') {
        // Store accounts can only see their branch
        if (profile?.branch_id) {
          query = query.eq('branch_id', profile.branch_id);
        }
      } else if (user.role === 'hr' && profile?.hr_access_level !== 'full') {
        // HR with limited access sees their organization
        if (profile?.organization_id) {
          query = query.eq('organization_id', profile.organization_id);
        }
      }
      // HR with full access and super_admin see all

      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee || !documentName || !file || !user) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const employee = employees.find(e => e.id === selectedEmployee);
      if (!employee) throw new Error('Employee not found');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${documentName.replace(/\s+/g, '-')}.${fileExt}`;
      const filePath = `submissions/${employee.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Submit document for approval
      submitDocument({
        employeeId: selectedEmployee,
        documentName,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
        organizationId: employee.organization_id,
        branchId: employee.branch_id,
      });

      // Reset form
      setSelectedEmployee('');
      setDocumentName('');
      setExpiryDate('');
      setNotes('');
      setFile(null);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error('File size must be less than 20MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Submit Document for Approval
          </SheetTitle>
          <SheetDescription>
            Upload a document for an employee. It will be reviewed by a Super Admin before being added to their folder.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Select Employee *
            </Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees...
              </div>
            ) : (
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex flex-col">
                        <span>{emp.first_name} {emp.last_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {emp.branch?.name || 'No branch'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="documentName" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Name *
            </Label>
            <Input
              id="documentName"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g., Right to Work, ID Card, Certificate"
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label htmlFor="expiryDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expiry Date (Optional)
            </Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload File *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              {file ? (
                <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max file size: 20MB
                  </p>
                  <Input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                    accept="*/*"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes for the reviewer..."
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedEmployee || !documentName || !file}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit for Approval
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
