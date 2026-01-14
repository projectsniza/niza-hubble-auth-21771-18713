import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations, useBranches } from '@/hooks/useOrganizations';

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
  onSuccess: () => void;
}

export default function EditEmployeeDialog({ 
  open, 
  onOpenChange, 
  employee, 
  onSuccess 
}: EditEmployeeDialogProps) {
  const { organizations } = useOrganizations();
  const { branches } = useBranches();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    address: '',
    job_title: '',
    department: '',
    organization_id: '',
    branch_id: '',
    join_date: '',
    national_insurance_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    status: 'active'
  });

  // Populate form when employee changes
  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        date_of_birth: employee.date_of_birth || '',
        address: employee.address || '',
        job_title: employee.job_title || '',
        department: employee.department || '',
        organization_id: employee.organization_id || '',
        branch_id: employee.branch_id || '',
        join_date: employee.join_date || '',
        national_insurance_number: employee.national_insurance_number || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        status: employee.status || 'active'
      });
    }
  }, [employee]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredBranches = formData.organization_id
    ? branches.filter(b => b.organization_id === formData.organization_id)
    : branches;

  const handleSubmit = async () => {
    if (!employee?.id) return;

    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast.error('First name, last name, and email are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || null,
          date_of_birth: formData.date_of_birth || null,
          address: formData.address || null,
          job_title: formData.job_title || null,
          department: formData.department || null,
          organization_id: formData.organization_id,
          branch_id: formData.branch_id,
          join_date: formData.join_date || null,
          national_insurance_number: formData.national_insurance_number || null,
          emergency_contact_name: formData.emergency_contact_name || null,
          emergency_contact_phone: formData.emergency_contact_phone || null,
          status: formData.status
        })
        .eq('id', employee.id);

      if (error) throw error;

      toast.success('Employee updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to update employee: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Personal Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="national_insurance_number">NI Number</Label>
                <Input
                  id="national_insurance_number"
                  value={formData.national_insurance_number}
                  onChange={(e) => handleInputChange('national_insurance_number', e.target.value)}
                  placeholder="AB123456C"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Employment Information */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm text-muted-foreground">Employment Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => handleInputChange('job_title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select 
                  value={formData.organization_id} 
                  onValueChange={(v) => {
                    handleInputChange('organization_id', v);
                    handleInputChange('branch_id', '');
                  }}
                >
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
                <Select 
                  value={formData.branch_id} 
                  onValueChange={(v) => handleInputChange('branch_id', v)}
                  disabled={!formData.organization_id}
                >
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="join_date">Join Date</Label>
                <Input
                  id="join_date"
                  type="date"
                  value={formData.join_date}
                  onChange={(e) => handleInputChange('join_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => handleInputChange('status', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm text-muted-foreground">Emergency Contact</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Name</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_phone">Phone</Label>
                <Input
                  id="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
