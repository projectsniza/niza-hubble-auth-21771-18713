import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, autoCreateFolder: boolean, vatNumber?: string, registrationNumber?: string, address?: string) => void;
}

export default function CreateOrganizationDialog({ open, onOpenChange, onSubmit }: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [autoCreateFolder, setAutoCreateFolder] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    await onSubmit(name.trim(), autoCreateFolder, vatNumber.trim() || undefined, registrationNumber.trim() || undefined, address.trim() || undefined);
    setIsSubmitting(false);
    setName('');
    setVatNumber('');
    setRegistrationNumber('');
    setAddress('');
    setAutoCreateFolder(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Niza Group Eastbourne"
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="org-address">Registered Office Address</Label>
            <Textarea
              id="org-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 15 The Gallop, Sutton, Surrey, SM2 5RU"
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This address will appear in employee contracts under PARTIES section
            </p>
          </div>
          <div>
            <Label htmlFor="registration-number">Registration Number (Optional)</Label>
            <Input
              id="registration-number"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g., 12345678"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Company registration number - auto-filled in contracts
            </p>
          </div>
          <div>
            <Label htmlFor="vat-number">VAT Number (Optional)</Label>
            <Input
              id="vat-number"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="e.g., GB123456789"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be auto-filled in employee contracts
            </p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
            <div className="space-y-0.5">
              <Label htmlFor="doc-folder">Create Document Folder</Label>
              <p className="text-sm text-muted-foreground">
                Auto-create: Company Documents/{name || '<Organization Name>'}/
              </p>
            </div>
            <Switch
              id="doc-folder"
              checked={autoCreateFolder}
              onCheckedChange={setAutoCreateFolder}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
