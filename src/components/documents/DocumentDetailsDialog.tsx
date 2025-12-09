import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface DocumentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    title: string;
    file_name: string;
    file_path: string;
    file_type?: string | null;
    file_size?: number | null;
    created_at: string | null;
    expiry_date?: string | null;
    follow_up_date?: string | null;
    uploaded_by?: string | null;
  } | null;
}

export default function DocumentDetailsDialog({ 
  open, 
  onOpenChange,
  document 
}: DocumentDetailsDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploaderName, setUploaderName] = useState<string>('Unknown');
  const [isVerified] = useState(true); // All uploaded documents are considered verified

  useEffect(() => {
    if (document && open) {
      loadPreview();
      loadUploaderName();
    }
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [document, open]);

  const loadPreview = async () => {
    if (!document?.file_path) return;
    
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600);
      
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
    }
  };

  const loadUploaderName = async () => {
    if (!document?.uploaded_by) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', document.uploaded_by)
      .single();
    
    if (data?.name) {
      setUploaderName(data.name);
    }
  };

  const handleDownload = async () => {
    if (!document?.file_path) return;
    
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 60);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading:', error);
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileType = (fileName: string, fileType?: string | null) => {
    if (fileType) return fileType;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'Unknown';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image';
    if (ext === 'pdf') return 'PDF';
    if (['doc', 'docx'].includes(ext)) return 'Document';
    if (['xls', 'xlsx'].includes(ext)) return 'Spreadsheet';
    return ext.toUpperCase();
  };

  const isPdf = document?.file_name?.toLowerCase().endsWith('.pdf');
  const isImage = document?.file_name && ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => 
    document.file_name.toLowerCase().endsWith(`.${ext}`)
  );

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Document title */}
        <div className="pb-2">
          <h2 className="text-xl font-semibold">{document.title || document.file_name}</h2>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="receipts">Read receipts & acceptance</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-0">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
              {/* Left Column - Preview */}
              <div className="space-y-4">
                <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden border-2">
                  {previewUrl ? (
                    <>
                      {isPdf ? (
                        <iframe 
                          src={previewUrl}
                          className="w-full h-full"
                          title="Document preview"
                        />
                      ) : isImage ? (
                        <img 
                          src={previewUrl}
                          alt="Document preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <p>Preview not available</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <p>Loading preview...</p>
                    </div>
                  )}
                  
                  {/* Verified Watermark */}
                  {isVerified && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="rotate-[-30deg] opacity-20 border-4 border-green-600 rounded-lg px-8 py-4">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-8 w-8" />
                          <span className="text-2xl font-bold tracking-wider">VERIFIED</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Button onClick={handleDownload} className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download document
                </Button>
              </div>

              {/* Right Column - Information */}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold mb-6">Information</h3>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Filename</span>
                    <span className="text-sm font-medium text-right max-w-[60%] break-words text-primary hover:underline cursor-pointer">
                      {document.file_name}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">File Type</span>
                    <span className="text-sm font-medium">{getFileType(document.file_name, document.file_type)}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Size</span>
                    <span className="text-sm font-medium">{formatFileSize(document.file_size)}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Date created</span>
                    <span className="text-sm font-medium">
                      {document.created_at ? format(new Date(document.created_at), 'dd MMM yy, HH:mm') : 'Unknown'}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Uploaded by</span>
                    <span className="text-sm font-medium">{uploaderName}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Expiry date</span>
                    <span className={`text-sm font-medium ${document.expiry_date ? 'text-foreground' : 'text-primary hover:underline cursor-pointer'}`}>
                      {document.expiry_date ? format(new Date(document.expiry_date), 'dd MMM yy') : 'Not set'}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Follow up date</span>
                    <span className={`text-sm font-medium ${document.follow_up_date ? 'text-foreground' : 'text-primary hover:underline cursor-pointer'}`}>
                      {document.follow_up_date ? format(new Date(document.follow_up_date), 'dd MMM yy') : 'Not set'}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Status</span>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <p className="text-muted-foreground">Document settings will be displayed here.</p>
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">No read receipts available</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}