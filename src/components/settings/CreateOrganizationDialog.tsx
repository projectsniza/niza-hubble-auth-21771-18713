import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (org: { name: string; description: string; hasDocumentFolder: boolean }) => void;
}

export default function CreateOrganizationDialog({ open, onOpenChange, onSubmit }: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hasDocumentFolder, setHasDocumentFolder] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, hasDocumentFolder });
    setName('');
    setDescription('');
    setHasDocumentFolder(true);
    onOpenChange(false);
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
              placeholder="e.g., Niza Superstores (Eastbourne) Ltd"
              required
            />
          </div>
          <div>
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your organization"
              rows={3}
              required
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
            <div className="space-y-0.5">
              <Label htmlFor="doc-folder">Create Document Folder</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create a document folder for this organization
              </p>
            </div>
            <Switch
              id="doc-folder"
              checked={hasDocumentFolder}
              onCheckedChange={setHasDocumentFolder}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Organization</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
