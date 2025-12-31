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

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: { id: string; name: string; vat_number?: string | null } | null;
  onSubmit: (id: string, name: string, vatNumber?: string) => Promise<void>;
}

export default function EditOrganizationDialog({
  open,
  onOpenChange,
  organization,
  onSubmit,
}: EditOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setVatNumber(organization.vat_number || '');
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organization) return;

    setIsSubmitting(true);
    try {
      await onSubmit(organization.id, name.trim(), vatNumber.trim() || undefined);
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