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

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadDocumentDialog({ open, onOpenChange }: UploadDocumentDialogProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Document Uploaded",
      description: `Uploaded: ${fileName}${followUpDate ? ` with follow-up on ${format(followUpDate, 'PPP')}` : ''}`,
    });
    
    setFileName('');
    setFollowUpDate(undefined);
    setSelectedFile(null);
    onOpenChange(false);
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
          <Button onClick={handleUpload}>
            <UploadIcon className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
