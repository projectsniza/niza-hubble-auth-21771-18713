import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Download, FileText, Trash2, Upload, X, Share2, FolderOpen } from 'lucide-react';
import { useStoreTemplates, SharedTemplate, StoreTemplate } from '@/hooks/useSharedTemplates';
import { format } from 'date-fns';

export default function StoreTemplates() {
  const { templates, sharedTemplates, isLoading, createStoreTemplate, deleteStoreTemplate } = useStoreTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState('general');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createStoreTemplate({
        title: title.trim(),
        description: description.trim() || null,
        template_type: templateType,
      }, file || undefined);

      // Reset form
      setTitle('');
      setDescription('');
      setTemplateType('general');
      setFile(null);
      setDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = (template: SharedTemplate | StoreTemplate) => {
    if (template.file_path) {
      window.open(template.file_path, '_blank');
    }
  };

  const TemplateCard = ({ 
    template, 
    isShared = false, 
    onDelete 
  }: { 
    template: SharedTemplate | StoreTemplate; 
    isShared?: boolean;
    onDelete?: () => void;
  }) => (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{template.title}</h3>
              {isShared && (
                <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                  Shared
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {template.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="capitalize">{template.template_type.replace('_', ' ')}</span>
              <span>•</span>
              <span>{format(new Date(template.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {template.file_path && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleDownload(template)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {!isShared && onDelete && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-muted-foreground">Manage and use templates for your store</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <Tabs defaultValue="shared" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shared" className="gap-2">
            <Share2 className="h-4 w-4" />
            Shared by Admin ({sharedTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="store" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            My Templates ({templates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shared" className="space-y-4">
          {sharedTemplates.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Shared Templates</h3>
                <p className="text-muted-foreground">
                  Templates shared by admin will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sharedTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} isShared />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="store" className="space-y-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your own templates for your store
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <TemplateCard 
                  key={template.id} 
                  template={template}
                  onDelete={() => deleteStoreTemplate(template.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
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
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!title.trim() || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
