import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
    verified_by_name?: string | null;
    verified_by_role?: string | null;
    verified_by_signature?: string | null;
    verified_at?: string | null;
    verification_message?: string | null;
  } | null;
}

export default function DocumentDetailsDialog({ 
  open, 
  onOpenChange,
  document: documentProp 
}: DocumentDetailsDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploaderName, setUploaderName] = useState<string>('Unknown');
  const [fullDoc, setFullDoc] = useState<DocumentDetailsDialogProps['document']>(null);
  
  // Use full doc if loaded, otherwise fall back to prop
  const document = fullDoc || documentProp;
  
  // Check if document has e-signature verification
  const hasEsignature = !!(document?.verified_by_name && document?.verified_by_signature);
  const isVerified = hasEsignature;

  useEffect(() => {
    if (documentProp && open) {
      loadFullDocument();
      loadPreview();
    }
    if (!open) {
      setFullDoc(null);
      setUploaderName('Unknown');
    }
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [documentProp, open]);

  const loadFullDocument = async () => {
    if (!documentProp?.id) return;
    
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentProp.id)
      .single();
    
    if (data) {
      setFullDoc(data as any);
      // Load uploader name from the full record
      if (data.uploaded_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.uploaded_by)
          .single();
        if (profile?.name) setUploaderName(profile.name);
      }
    }
  };

  const loadPreview = async () => {
    if (!documentProp?.file_path) return;
    
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(documentProp.file_path, 3600);
      
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
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
              
              {/* E-Signature Overlay */}
              {isVerified && (
                <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-background/95 border-t-2 border-green-500 p-4 pointer-events-none">
                  {document?.verification_message && (
                    <p className="text-xs text-muted-foreground mb-2 italic">{document.verification_message}</p>
                  )}
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Verified by</p>
                      <p className="text-sm font-semibold">{document?.verified_by_name}</p>
                      <p className="text-xs text-muted-foreground">{document?.verified_by_role}</p>
                    </div>
                    {document?.verified_by_signature && (
                      <img 
                        src={document.verified_by_signature} 
                        alt="Signature"
                        className="h-10 max-w-[120px] object-contain"
                      />
                    )}
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-bold">VERIFIED</span>
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

              {/* E-Signature Verification Section */}
              {hasEsignature && (
                <>
                  <Separator />
                  <div className="py-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Verification Details</h4>
                    
                    {document?.verification_message && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Verification Message</p>
                        <p className="text-sm">{document.verification_message}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Verified By</p>
                        <p className="text-sm font-medium">{document?.verified_by_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Role</p>
                        <p className="text-sm font-medium">{document?.verified_by_role}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Signature</p>
                      <div className="bg-background border rounded-lg p-3 inline-block">
                        <img 
                          src={document?.verified_by_signature || ''} 
                          alt="Verification signature"
                          className="h-12 max-w-[200px] object-contain"
                        />
                      </div>
                    </div>
                    
                    {document?.verified_at && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Verified At</p>
                        <p className="text-sm font-medium">
                          {format(new Date(document.verified_at), 'dd MMM yy, HH:mm')}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {!hasEsignature && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground font-medium">Status</span>
                    <Badge variant="secondary" className="text-muted-foreground">
                      No verification required
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}