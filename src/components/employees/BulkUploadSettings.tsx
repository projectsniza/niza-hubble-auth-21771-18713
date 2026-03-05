import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, Settings2, Loader2, FileText } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BulkDocSetting {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  doc_order: number;
  enabled: boolean;
}

export default function BulkUploadSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BulkDocSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<BulkDocSetting | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMandatory, setFormMandatory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bulk_upload_document_settings')
        .select('*')
        .order('doc_order');
      if (error) throw error;
      setSettings(data || []);
    } catch (err: any) {
      toast.error('Failed to load settings: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingDoc(null);
    setFormName('');
    setFormDescription('');
    setFormMandatory(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (doc: BulkDocSetting) => {
    setEditingDoc(doc);
    setFormName(doc.name);
    setFormDescription(doc.description || '');
    setFormMandatory(doc.is_mandatory);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Document name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingDoc) {
        const { error } = await supabase
          .from('bulk_upload_document_settings')
          .update({ name: formName, description: formDescription || null, is_mandatory: formMandatory, updated_at: new Date().toISOString() })
          .eq('id', editingDoc.id);
        if (error) throw error;
        toast.success('Document updated');
      } else {
        const { error } = await supabase
          .from('bulk_upload_document_settings')
          .insert({
            name: formName,
            description: formDescription || null,
            is_mandatory: formMandatory,
            doc_order: settings.length,
            created_by: user?.id
          });
        if (error) throw error;
        toast.success('Document added');
      }
      setIsDialogOpen(false);
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('bulk_upload_document_settings')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bulk_upload_document_settings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Document removed');
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><NizaLoaderInline /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Bulk Upload Document Settings
              </CardTitle>
              <CardDescription>
                Configure which documents should be uploaded for bulk imported employees. These will appear when you click "Upload Docs" in the Bulk Uploads tab.
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No documents configured</p>
              <p className="text-sm">Add documents that need to be uploaded for bulk imported employees</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map((doc) => (
                  <TableRow key={doc.id} className={!doc.enabled ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{doc.description || '-'}</TableCell>
                    <TableCell>
                      {doc.is_mandatory ? (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={doc.enabled} onCheckedChange={(v) => handleToggle(doc.id, v)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(doc)}>Edit</Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Edit Document' : 'Add Document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Right to Work" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Brief description..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formMandatory} onCheckedChange={setFormMandatory} />
              <Label>Required document (mandatory)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDoc ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
