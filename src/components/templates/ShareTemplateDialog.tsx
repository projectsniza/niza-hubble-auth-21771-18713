import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Upload, X } from 'lucide-react';
import { useSharedTemplates } from '@/hooks/useSharedTemplates';
import { supabase } from '@/integrations/supabase/client';

interface Branch {
  id: string;
  name: string;
  organization_id: string;
}

interface ShareTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ShareTemplateDialog({ open, onOpenChange }: ShareTemplateDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState('general');
  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createSharedTemplate } = useSharedTemplates();

  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from('branches')
        .select('id, name, organization_id')
        .order('name');
      setBranches(data || []);
    };
    if (open) fetchBranches();
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const branch = branches.find(b => b.id === selectedBranchId);
      
      await createSharedTemplate({
        title: title.trim(),
        description: description.trim() || null,
        template_type: templateType,
        is_global: isGlobal,
        branch_id: isGlobal ? null : selectedBranchId || null,
        organization_id: isGlobal ? null : branch?.organization_id || null,
      }, file || undefined);

      // Reset form
      setTitle('');
      setDescription('');
      setTemplateType('general');
      setIsGlobal(true);
      setSelectedBranchId('');
      setFile(null);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Template with Stores</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Template Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter template title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this template..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Template Type</Label>
            <Select value={templateType} onValueChange={setTemplateType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="id_card">ID Card</SelectItem>
                <SelectItem value="business_card">Business Card</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
                <SelectItem value="form">Form</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="global">Share with all stores</Label>
            <Switch
              id="global"
              checked={isGlobal}
              onCheckedChange={setIsGlobal}
            />
          </div>

          {!isGlobal && (
            <div className="space-y-2">
              <Label>Select Store</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Template File (Optional)</Label>
            {file ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload file</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sharing...' : 'Share Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
