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

interface EditBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: { id: string; name: string; address?: string | null } | null;
  onSubmit: (id: string, name: string, address?: string) => Promise<void>;
}

export default function EditBranchDialog({
  open,
  onOpenChange,
  branch,
  onSubmit,
}: EditBranchDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setAddress(branch.address || '');
    }
  }, [branch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !branch) return;

    setIsSubmitting(true);
    try {
      await onSubmit(branch.id, name.trim(), address.trim() || undefined);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
          <DialogDescription>
            Update the branch details. The associated document folder will also be renamed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter branch name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Address (Optional)</Label>
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter branch address"
              />
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
