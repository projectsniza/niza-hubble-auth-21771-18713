import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';
import { useAuth } from '@/contexts/AuthContext';
import { DriveOff, DriveOffFormData } from '@/hooks/useDriveOffs';
import { Loader2, Upload, X, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FUEL_TYPES = ['UNLEADED', 'DIESEL', 'SUPER UNLEADED', 'PREMIUM DIESEL', 'LPG'];
const PUMP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TILL_NUMBERS = [1, 2, 3, 4, 5];

const formSchema = z.object({
  branch_id: z.string().min(1, 'Branch is required'),
  drive_off_date: z.string().min(1, 'Date is required'),
  vehicle_registration: z.string().min(1, 'Vehicle registration is required'),
  vehicle_model: z.string().optional(),
  fuel_type: z.string().min(1, 'Fuel type is required'),
  pump_number: z.coerce.number().min(1, 'Pump number is required'),
  cashier_name: z.string().min(1, 'Cashier name is required'),
  total_liters: z.coerce.number().min(0, 'Total liters is required'),
  amount_drive_off: z.coerce.number().min(0, 'Amount is required'),
  till_1_amount: z.coerce.number().optional(),
  till_2_amount: z.coerce.number().optional(),
  till_3_amount: z.coerce.number().optional(),
  till_4_amount: z.coerce.number().optional(),
  till_5_amount: z.coerce.number().optional(),
  total_amount_received: z.coerce.number().optional(),
  payment_received_date: z.string().optional(),
  payment_till_1: z.coerce.number().optional(),
  payment_till_2: z.coerce.number().optional(),
  tracking_status: z.enum(['fuel_guardian', 'police_complaint', 'payment']).nullable().optional(),
  tracking_reference: z.string().optional(),
  date_handed_to_guardian: z.string().optional(),
  head_office_notes: z.string().optional(),
  remarks: z.string().optional(),
});

interface SupportingFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface DriveOffFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DriveOffFormData) => Promise<void>;
  editingDriveOff?: DriveOff | null;
  isLoading?: boolean;
}

export function DriveOffFormDialog({
  open,
  onClose,
  onSubmit,
  editingDriveOff,
  isLoading,
}: DriveOffFormDialogProps) {
  const { user } = useAuth();
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [supportingFiles, setSupportingFiles] = useState<SupportingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      branch_id: '',
      drive_off_date: new Date().toISOString().split('T')[0],
      vehicle_registration: '',
      vehicle_model: '',
      fuel_type: '',
      pump_number: 1,
      cashier_name: '',
      total_liters: undefined as unknown as number,
      amount_drive_off: undefined as unknown as number,
      till_1_amount: undefined as unknown as number,
      till_2_amount: undefined as unknown as number,
      till_3_amount: undefined as unknown as number,
      till_4_amount: undefined as unknown as number,
      till_5_amount: undefined as unknown as number,
      total_amount_received: undefined as unknown as number,
      payment_received_date: '',
      payment_till_1: 0,
      payment_till_2: 0,
      tracking_status: null,
      tracking_reference: '',
      date_handed_to_guardian: '',
      head_office_notes: '',
      remarks: '',
    },
  });

  const trackingStatus = form.watch('tracking_status');

  // Filter branches based on selected organization or user's access
  const filteredBranches = branches.filter((branch) => {
    if (user?.role === 'manager' && user.branchId) {
      return branch.id === user.branchId;
    }
    if (user?.role === 'hr') {
      if (user.branchId) return branch.id === user.branchId;
      if (user.organizationId) return branch.organization_id === user.organizationId;
    }
    if (selectedOrgId) {
      return branch.organization_id === selectedOrgId;
    }
    return true;
  });

  useEffect(() => {
    if (editingDriveOff) {
      const orgId = branches.find(b => b.id === editingDriveOff.branch_id)?.organization_id;
      if (orgId) setSelectedOrgId(orgId);
      
      form.reset({
        branch_id: editingDriveOff.branch_id,
        drive_off_date: editingDriveOff.drive_off_date,
        vehicle_registration: editingDriveOff.vehicle_registration,
        vehicle_model: editingDriveOff.vehicle_model || '',
        fuel_type: editingDriveOff.fuel_type,
        pump_number: editingDriveOff.pump_number,
        cashier_name: editingDriveOff.cashier_name,
        total_liters: editingDriveOff.total_liters,
        amount_drive_off: editingDriveOff.amount_drive_off,
        till_1_amount: editingDriveOff.till_1_amount || 0,
        till_2_amount: editingDriveOff.till_2_amount || 0,
        till_3_amount: editingDriveOff.till_3_amount || 0,
        till_4_amount: editingDriveOff.till_4_amount || 0,
        till_5_amount: editingDriveOff.till_5_amount || 0,
        total_amount_received: editingDriveOff.total_amount_received || 0,
        payment_received_date: editingDriveOff.payment_received_date || '',
        payment_till_1: editingDriveOff.payment_till_1 || 0,
        payment_till_2: editingDriveOff.payment_till_2 || 0,
        tracking_status: editingDriveOff.tracking_status,
        tracking_reference: editingDriveOff.tracking_reference || '',
        date_handed_to_guardian: editingDriveOff.date_handed_to_guardian || '',
        head_office_notes: editingDriveOff.head_office_notes || '',
        remarks: editingDriveOff.remarks || '',
      });

      // Load existing files
      const existingFiles = (editingDriveOff as any).supporting_files;
      if (Array.isArray(existingFiles)) {
        setSupportingFiles(existingFiles);
      } else {
        setSupportingFiles([]);
      }
    } else {
      form.reset();
      setSupportingFiles([]);
      // Set default branch for non-super admin users
      if (user?.role === 'manager' && user.branchId) {
        form.setValue('branch_id', user.branchId);
      }
    }
  }, [editingDriveOff, form, user, branches]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFiles: SupportingFile[] = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user?.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error } = await supabase.storage
          .from('drive-off-files')
          .upload(filePath, file);

        if (error) {
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
          continue;
        }

        newFiles.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
        });
      }
      setSupportingFiles(prev => [...prev, ...newFiles]);
      if (newFiles.length > 0) {
        toast.success(`${newFiles.length} file(s) uploaded`);
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = async (index: number) => {
    const file = supportingFiles[index];
    await supabase.storage.from('drive-off-files').remove([file.path]);
    setSupportingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    const branch = branches.find(b => b.id === values.branch_id);
    
    // Ensure date fields are properly formatted (YYYY-MM-DD) or null
    const formatDate = (val?: string) => {
      if (!val || val.trim() === '') return undefined;
      // Already in YYYY-MM-DD format from date input
      return val;
    };

    const formData: DriveOffFormData = {
      branch_id: values.branch_id,
      drive_off_date: values.drive_off_date,
      vehicle_registration: values.vehicle_registration,
      vehicle_model: values.vehicle_model,
      fuel_type: values.fuel_type,
      pump_number: values.pump_number,
      cashier_name: values.cashier_name,
      total_liters: values.total_liters,
      amount_drive_off: values.amount_drive_off,
      till_1_amount: values.till_1_amount,
      till_2_amount: values.till_2_amount,
      till_3_amount: values.till_3_amount,
      till_4_amount: values.till_4_amount,
      till_5_amount: values.till_5_amount,
      total_amount_received: values.total_amount_received,
      payment_received_date: formatDate(values.payment_received_date),
      payment_till_1: values.payment_till_1,
      payment_till_2: values.payment_till_2,
      tracking_status: values.tracking_status || null,
      tracking_reference: values.tracking_reference,
      date_handed_to_guardian: formatDate(values.date_handed_to_guardian),
      head_office_notes: values.head_office_notes,
      remarks: values.remarks,
      organization_id: branch?.organization_id,
      supporting_files: supportingFiles,
    };
    await onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {editingDriveOff ? 'Edit Drive-Off Record' : 'Record New Drive-Off'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Organization & Branch Selection */}
            {user?.role === 'super_admin' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization</label>
                  <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch / Site *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredBranches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {user?.role !== 'super_admin' && (
              <FormField
                control={form.control}
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch / Site *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredBranches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Core Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="drive_off_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Drive-Off *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_registration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Registration No. *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., AB12 CDE" 
                        {...field} 
                        className="uppercase font-bold text-lg"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Model</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ford Focus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Fuel & Cashier Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="fuel_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fuel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FUEL_TYPES.map((fuel) => (
                          <SelectItem key={fuel} value={fuel}>
                            {fuel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pump_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pump No. *</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pump" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PUMP_NUMBERS.map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            Pump {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cashier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cashier Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Name of cashier" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total_liters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Liters *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Amount & Till Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Amount Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <FormField
                  control={form.control}
                  name="amount_drive_off"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (£) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {TILL_NUMBERS.map((tillNum) => (
                  <FormField
                    key={tillNum}
                    control={form.control}
                    name={`till_${tillNum}_amount` as keyof z.infer<typeof formSchema>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Till {tillNum} (£)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Payment Received */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Payment Received (Site)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="total_amount_received"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Received (£)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_received_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_till_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Till 1 (£)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_till_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Till 2 (£)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Tracking Status */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Tracking Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="tracking_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(v === 'none' ? null : v)} 
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Not Set</SelectItem>
                          <SelectItem value="fuel_guardian">Fuel Guardian</SelectItem>
                          <SelectItem value="police_complaint">Police Complaint</SelectItem>
                          <SelectItem value="payment">Payment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {trackingStatus && (
                  <FormField
                    control={form.control}
                    name="tracking_reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter reference/receipt number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {trackingStatus === 'fuel_guardian' && (
                  <FormField
                    control={form.control}
                    name="date_handed_to_guardian"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date Handed to Guardian</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Notes & Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about the incident..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {user?.role === 'super_admin' && (
                <FormField
                  control={form.control}
                  name="head_office_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Head Office Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Internal notes (Head Office only)..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Supporting Files */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Supporting Files</h3>
              <p className="text-sm text-muted-foreground">
                Upload CCTV footage, photos, or any supporting documents (images, videos, PDFs, etc.)
              </p>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept="*/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-primary/40 rounded-lg hover:bg-muted/50 transition-colors">
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isUploading ? 'Uploading...' : 'Upload Files'}
                    </span>
                  </div>
                </label>
              </div>

              {supportingFiles.length > 0 && (
                <div className="space-y-2">
                  {supportingFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.type)}
                        <div>
                          <p className="text-sm font-medium truncate max-w-[300px]">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveFile(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isUploading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingDriveOff ? 'Update Record' : 'Record Drive-Off'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
