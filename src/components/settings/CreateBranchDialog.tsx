import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (branch: { name: string; location: string; hasDocumentFolder: boolean }) => void;
}

export default function CreateBranchDialog({ open, onOpenChange, onSubmit }: CreateBranchDialogProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [hasDocumentFolder, setHasDocumentFolder] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, location, hasDocumentFolder });
    setName('');
    setLocation('');
    setHasDocumentFolder(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Branch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="branch-name">Branch Name</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Street Branch"
              required
            />
          </div>
          <div>
            <Label htmlFor="branch-location">Location</Label>
            <Input
              id="branch-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., 123 Main Street, London"
              required
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
            <div className="space-y-0.5">
              <Label htmlFor="branch-doc-folder">Create Document Folder</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create a document folder for this branch
              </p>
            </div>
            <Switch
              id="branch-doc-folder"
              checked={hasDocumentFolder}
              onCheckedChange={setHasDocumentFolder}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Branch</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
