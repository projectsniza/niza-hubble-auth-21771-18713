import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FolderPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
}

interface PermissionUser {
  id: string;
  name: string;
  initials: string;
}

export default function FolderPermissionsDialog({ 
  open, 
  onOpenChange,
  folderName 
}: FolderPermissionsDialogProps) {
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<PermissionUser[]>([
    { id: '1', name: 'Ragunathan Visvanathan', initials: 'RV' }
  ]);
  const [searchName, setSearchName] = useState('');
  const [filterType, setFilterType] = useState('Company');

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSave = () => {
    toast({
      title: "Permissions Updated",
      description: `Updated permissions for ${folderName}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Who can see {folderName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="searchName">Name</Label>
              <Input
                id="searchName"
                placeholder="Name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Label>Filter</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Company">Company</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
                  <SelectItem value="Team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {selectedUsers.length} person can see this folder
            </p>
            <div className="border rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto space-y-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveUser(user.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
