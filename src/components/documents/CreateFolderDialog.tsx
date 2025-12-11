import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentFolderId?: string;
  onSuccess?: () => void;
}

const FOLDER_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Green', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Purple', value: '#8B5CF6' },
];

export default function CreateFolderDialog({ open, onOpenChange, parentFolderId, onSuccess }: CreateFolderDialogProps) {
  const { toast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);
  const [showInSafety, setShowInSafety] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if this is a root-level folder (no parent or parent is Company Documents root)
  const isRootLevel = !parentFolderId;

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let path = folderName;
      
      if (parentFolderId) {
        const { data: parentFolder } = await supabase
          .from('folders')
          .select('path')
          .eq('id', parentFolderId)
          .single();
        
        if (parentFolder) {
          path = `${parentFolder.path}/${folderName}`;
        }
      }

      const { error } = await supabase
        .from('folders')
        .insert({
          name: folderName,
          path,
          parent_id: parentFolderId || null,
          folder_type: 'general',
          color: selectedColor,
          // Only allow show_in_safety for root-level folders
          show_in_safety: isRootLevel ? showInSafety : false,
        });

      if (error) throw error;

      toast({
        title: "Folder Created",
        description: `Created folder: ${folderName}${showInSafety && isRootLevel ? ' (visible in Niza Safe)' : ''}`,
      });
      
      setFolderName('');
      setSelectedColor(FOLDER_COLORS[0].value);
      setShowInSafety(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a new folder</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="folderName">Folder name</Label>
            <Input
              id="folderName"
              placeholder="Enter folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-12 h-12 rounded-lg transition-all ${
                    selectedColor === color.value 
                      ? 'ring-2 ring-primary ring-offset-2' 
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Show in Niza Safe option - only for root-level folders */}
          {isRootLevel && (
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="showInSafety"
                checked={showInSafety}
                onCheckedChange={(checked) => setShowInSafety(checked as boolean)}
              />
              <Label 
                htmlFor="showInSafety" 
                className="text-sm font-normal cursor-pointer"
              >
                Show this folder in Niza Safe Documents
              </Label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}