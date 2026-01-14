import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, Download, Eye, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FileInfo {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

interface FileAttachmentProps {
  files: FileInfo[];
  onFilesChange: (files: FileInfo[]) => void;
  bucket: string;
  folderPath?: string;
  maxFiles?: number;
  label?: string;
  accept?: string;
  disabled?: boolean;
}

export function FileAttachment({
  files,
  onFilesChange,
  bucket,
  folderPath = '',
  maxFiles = 5,
  label = "Attachments",
  accept = "*/*",
  disabled = false,
}: FileAttachmentProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || disabled) return;
    
    const uploadedFiles = Array.from(e.target.files);
    
    if (files.length + uploadedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const newFiles: FileInfo[] = [];

    for (const file of uploadedFiles) {
      try {
        const fileExt = file.name.split('.').pop() || 'bin';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        newFiles.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
        });
      } catch (error: any) {
        console.error('Upload error:', error);
        toast({
          title: "Upload failed",
          description: error.message || `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    onFilesChange([...files, ...newFiles]);
    setIsUploading(false);
    e.target.value = '';
  };

  const handleRemoveFile = async (index: number) => {
    if (disabled) return;
    
    const fileToRemove = files[index];
    
    try {
      await supabase.storage.from(bucket).remove([fileToRemove.path]);
    } catch (error) {
      console.error('Error removing file:', error);
    }

    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const handlePreview = async (file: FileInfo) => {
    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(file.path);
      setPreviewUrl(data.publicUrl);
      setPreviewFile(file);
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast({
        title: "Preview failed",
        description: "Could not load file preview",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(file.path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message || "Could not download file",
        variant: "destructive",
      });
    }
  };

  const isImageFile = (file: FileInfo) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    return file.type && imageTypes.includes(file.type);
  };

  const isPdfFile = (file: FileInfo) => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {/* Upload Button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isUploading || files.length >= maxFiles}
          className="relative"
          onClick={() => document.getElementById(`file-input-${bucket}`)?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {isUploading ? 'Uploading...' : 'Upload Files'}
        </Button>
        <input
          id={`file-input-${bucket}`}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileUpload}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <span className="text-xs text-muted-foreground">
          {files.length}/{maxFiles} files
        </span>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                {file.size && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePreview(file)}
                  title="Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(file)}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveFile(index)}
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && previewFile && (
              <>
                {isImageFile(previewFile) ? (
                  <img
                    src={previewUrl}
                    alt={previewFile.name}
                    className="max-w-full h-auto mx-auto rounded-lg"
                  />
                ) : isPdfFile(previewFile) ? (
                  <iframe
                    src={previewUrl}
                    title={previewFile.name}
                    className="w-full h-[70vh] rounded-lg"
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                    <Button onClick={() => handleDownload(previewFile)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download to View
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Read-only file viewer for viewing attached files
export function FileViewer({
  files,
  bucket,
  label = "Attached Files",
}: {
  files: FileInfo[];
  bucket: string;
  label?: string;
}) {
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  if (files.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-muted-foreground">{label}</Label>
        <p className="text-sm text-muted-foreground">No files attached</p>
      </div>
    );
  }

  const handlePreview = async (file: FileInfo) => {
    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(file.path);
      setPreviewUrl(data.publicUrl);
      setPreviewFile(file);
    } catch (error) {
      console.error('Error getting preview URL:', error);
    }
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(file.path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message || "Could not download file",
        variant: "destructive",
      });
    }
  };

  const isImageFile = (file: FileInfo) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    return file.type && imageTypes.includes(file.type);
  };

  const isPdfFile = (file: FileInfo) => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  };

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{file.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handlePreview(file)}
                title="Preview"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDownload(file)}
                title="Download"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && previewFile && (
              <>
                {isImageFile(previewFile) ? (
                  <img
                    src={previewUrl}
                    alt={previewFile.name}
                    className="max-w-full h-auto mx-auto rounded-lg"
                  />
                ) : isPdfFile(previewFile) ? (
                  <iframe
                    src={previewUrl}
                    title={previewFile.name}
                    className="w-full h-[70vh] rounded-lg"
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                    <Button onClick={() => handleDownload(previewFile)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download to View
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
