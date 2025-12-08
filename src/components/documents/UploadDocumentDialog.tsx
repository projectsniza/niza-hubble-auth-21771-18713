import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload as UploadIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onSuccess?: () => void;
}

export default function UploadDocumentDialog({ open, onOpenChange, folderId, onSuccess }: UploadDocumentDialogProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date>();
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          title: fileName || selectedFile.name,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          folder_id: folderId || null,
          follow_up_date: followUpDate?.toISOString().split('T')[0] || null,
          expiry_date: expiryDate?.toISOString().split('T')[0] || null,
        });

      if (dbError) throw dbError;

      toast({
        title: "Document Uploaded",
        description: `Uploaded: ${fileName || selectedFile.name}`,
      });
      
      setFileName('');
      setFollowUpDate(undefined);
      setExpiryDate(undefined);
      setSelectedFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
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
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileName">Document Name</Label>
            <Input
              id="fileName"
              placeholder="Enter document name (optional)"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "PPP") : "Not set"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Follow up date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !followUpDate && "text-muted-foreground",
                    followUpDate && "border-primary border-2"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? format(followUpDate, "PPP") : "Not set"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={setFollowUpDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {followUpDate && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                <CalendarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Follow-up required: {format(followUpDate, "PPP")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isLoading}>
            <UploadIcon className="h-4 w-4 mr-2" />
            {isLoading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
