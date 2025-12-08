import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, autoCreateFolder: boolean) => void;
}

export default function CreateOrganizationDialog({ open, onOpenChange, onSubmit }: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [autoCreateFolder, setAutoCreateFolder] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    await onSubmit(name.trim(), autoCreateFolder);
    setIsSubmitting(false);
    setName('');
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
