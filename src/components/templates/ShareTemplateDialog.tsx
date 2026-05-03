import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, X } from 'lucide-react';
import { useSharedTemplates } from '@/hooks/useSharedTemplates';
import { useTemplateTypes } from '@/hooks/useTemplateTypes';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
}

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
  const [shareScope, setShareScope] = useState<'global' | 'organization' | 'branch'>('global');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createSharedTemplate } = useSharedTemplates();
  const { types: templateTypes } = useTemplateTypes();

  useEffect(() => {
    const fetchData = async () => {
      const [orgsRes, branchesRes] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('branches').select('id, name, organization_id').order('name'),
      ]);
      setOrganizations(orgsRes.data || []);
      setBranches(branchesRes.data || []);
    };
    if (open) fetchData();
  }, [open]);

  const filteredBranches = selectedOrgId
    ? branches.filter(b => b.organization_id === selectedOrgId)
    : branches;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const isGlobal = shareScope === 'global';
      const orgId = shareScope === 'organization' ? selectedOrgId : (shareScope === 'branch' ? (branches.find(b => b.id === selectedBranchId)?.organization_id || null) : null);
      const branchId = shareScope === 'branch' ? selectedBranchId : null;

      await createSharedTemplate({
        title: title.trim(),
        description: description.trim() || null,
        template_type: templateType,
        is_global: isGlobal,
        branch_id: branchId,
        organization_id: orgId,
      }, file || undefined);

      // Reset form
      setTitle('');
      setDescription('');
      setTemplateType('general');
      setShareScope('global');
      setSelectedOrgId('');
      setSelectedBranchId('');
      setFile(null);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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

          <div className="space-y-3">
            <Label>Share With</Label>
            <RadioGroup value={shareScope} onValueChange={(v) => setShareScope(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="global" />
                <Label htmlFor="global" className="font-normal">All Stores</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="organization" id="organization" />
                <Label htmlFor="organization" className="font-normal">Specific Organization (all branches)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="branch" id="branch" />
                <Label htmlFor="branch" className="font-normal">Specific Branch</Label>
              </div>
            </RadioGroup>
          </div>

          {(shareScope === 'organization' || shareScope === 'branch') && (
            <div className="space-y-2">
              <Label>Select Organization</Label>
              <Select value={selectedOrgId} onValueChange={(v) => { setSelectedOrgId(v); setSelectedBranchId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {shareScope === 'branch' && selectedOrgId && (
            <div className="space-y-2">
              <Label>Select Branch</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
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
                <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload file</span>
                <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || isSubmitting}>
              {isSubmitting ? 'Sharing...' : 'Share Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
