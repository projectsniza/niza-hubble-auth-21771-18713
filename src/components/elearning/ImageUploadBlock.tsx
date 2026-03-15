import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Image, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  currentUrl?: string;
  caption?: string;
  onUpload: (url: string) => void;
  onCaptionChange?: (caption: string) => void;
  bucket?: string;
  folder?: string;
  placeholder?: string;
  compact?: boolean;
}

export default function ImageUploadBlock({ 
  currentUrl, caption, onUpload, onCaptionChange, 
  bucket = 'elearning', folder = 'course-images',
  placeholder = 'Upload an image or paste a URL',
  compact = false
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;

      const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(path, 3600 * 24 * 365);
      if (signedData?.signedUrl) {
        onUpload(signedData.signedUrl);
        toast.success('Image uploaded');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onUpload(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
            Upload
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowUrlInput(!showUrlInput)}>
            <Image className="h-3 w-3 mr-1" /> URL
          </Button>
        </div>
        {showUrlInput && (
          <div className="flex gap-2">
            <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste image URL..." className="h-8 text-sm" />
            <Button type="button" size="sm" onClick={handleUrlSubmit} className="h-8">Set</Button>
          </div>
        )}
        {currentUrl && (
          <div className="relative group">
            <img src={currentUrl} alt="" className="w-full h-32 object-cover rounded-lg border" />
            <Button 
              type="button" variant="destructive" size="icon" 
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onUpload('')}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {onCaptionChange && (
          <Input value={caption || ''} onChange={(e) => onCaptionChange(e.target.value)} placeholder="Caption (optional)" className="h-8 text-sm" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentUrl ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-primary/20">
          <img src={currentUrl} alt={caption || ''} className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Replace
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => onUpload('')}>
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div 
          className="w-full h-48 border-2 border-dashed border-muted-foreground/20 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
          onClick={() => fileRef.current?.click()}
        >
          <Image className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{placeholder}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              Upload Image
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowUrlInput(!showUrlInput); }}>
              URL
            </Button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

      {showUrlInput && (
        <div className="flex gap-2">
          <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste image URL..." className="text-sm" />
          <Button type="button" size="sm" onClick={handleUrlSubmit}>Set</Button>
        </div>
      )}

      {onCaptionChange && (
        <Input value={caption || ''} onChange={(e) => onCaptionChange(e.target.value)} placeholder="Caption (optional)" className="text-sm" />
      )}
    </div>
  );
}
