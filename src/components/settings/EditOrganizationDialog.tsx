import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: { id: string; name: string; vat_number?: string | null; registration_number?: string | null; address?: string | null } | null;
  onSubmit: (id: string, name: string, vatNumber?: string, registrationNumber?: string, address?: string) => Promise<void>;
}

export default function EditOrganizationDialog({
  open,
  onOpenChange,
  organization,
  onSubmit,
}: EditOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setVatNumber(organization.vat_number || '');
      setRegistrationNumber(organization.registration_number || '');
      setAddress(organization.address || '');
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organization) return;

    setIsSubmitting(true);
    try {
      await onSubmit(organization.id, name.trim(), vatNumber.trim() || undefined, registrationNumber.trim() || undefined, address.trim() || undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update the organization details. The associated document folder will also be renamed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter organization name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Registered Office Address</Label>
              <Textarea
                id="org-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 15 The Gallop, Sutton, Surrey, SM2 5RU"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                This address will appear in employee contracts under PARTIES section
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-number">Registration Number</Label>
              <Input
                id="registration-number"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g., 12345678"
              />
              <p className="text-xs text-muted-foreground">
                Company registration number - auto-filled in contracts
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat-number">VAT Number</Label>
              <Input
                id="vat-number"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="e.g., GB123456789"
              />
              <p className="text-xs text-muted-foreground">
                Will be auto-filled in employee contracts
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
