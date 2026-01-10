import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Upload as UploadIcon, PenTool, Eraser } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onSuccess?: () => void;
  requiresEsignature?: boolean;
  verificationMessage?: string;
}

export default function UploadDocumentDialog({ 
  open, 
  onOpenChange, 
  folderId, 
  onSuccess,
  requiresEsignature = false,
  verificationMessage = ''
}: UploadDocumentDialogProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date>();
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // E-signature fields
  const [verifierName, setVerifierName] = useState('');
  const [verifierRole, setVerifierRole] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, [open, requiresEsignature]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name.split('.')[0]);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureDataUrl = (): string | null => {
    if (!hasSignature || !canvasRef.current) return null;
    return canvasRef.current.toDataURL('image/png');
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

    if (requiresEsignature) {
      if (!verifierName.trim()) {
        toast({
          title: "Error",
          description: "Please enter your name for verification",
          variant: "destructive",
        });
        return;
      }
      if (!verifierRole.trim()) {
        toast({
          title: "Error",
          description: "Please enter your role/designation",
          variant: "destructive",
        });
        return;
      }
      if (!hasSignature) {
        toast({
          title: "Error",
          description: "Please provide your signature",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop() || 'bin';
      const filePath = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const insertData: any = {
        title: fileName || selectedFile.name,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        folder_id: folderId || null,
        follow_up_date: followUpDate?.toISOString().split('T')[0] || null,
        expiry_date: expiryDate?.toISOString().split('T')[0] || null,
      };

      if (requiresEsignature) {
        insertData.verified_by_name = verifierName;
        insertData.verified_by_role = verifierRole;
        insertData.verified_by_signature = getSignatureDataUrl();
        insertData.verified_at = new Date().toISOString();
        insertData.verification_message = verificationMessage || null;
      }

      const { error: dbError } = await supabase
        .from('documents')
        .insert(insertData);

      if (dbError) throw dbError;

      toast({
        title: "Document Uploaded",
        description: `Uploaded: ${fileName || selectedFile.name}`,
      });
      
      // Reset form
      setFileName('');
      setFollowUpDate(undefined);
      setExpiryDate(undefined);
      setSelectedFile(null);
      setVerifierName('');
      setVerifierRole('');
      setHasSignature(false);
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
      <DialogContent className={cn("sm:max-w-[500px]", requiresEsignature && "sm:max-w-[600px]")}>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
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

          {/* E-Signature Section */}
          {requiresEsignature && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">E-Signature Verification</h3>
                </div>
                
                {verificationMessage && (
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <p className="text-sm font-medium mb-1">Verification Statement</p>
                    <p className="text-sm text-muted-foreground">{verificationMessage}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="verifier-name">Your Name *</Label>
                    <Input
                      id="verifier-name"
                      placeholder="Enter your full name"
                      value={verifierName}
                      onChange={(e) => setVerifierName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verifier-role">Your Role/Designation *</Label>
                    <Input
                      id="verifier-role"
                      placeholder="e.g., HR Manager"
                      value={verifierRole}
                      onChange={(e) => setVerifierRole(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Signature *</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearSignature}
                      className="h-7 text-xs"
                    >
                      <Eraser className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="border-2 rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={canvasRef}
                      width={350}
                      height={120}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Draw your signature above using mouse or touch
                  </p>
                </div>
              </div>
            </>
          )}
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
