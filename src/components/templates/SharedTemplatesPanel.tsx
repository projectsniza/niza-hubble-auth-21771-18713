import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Trash2, Download, Share2, Globe, Building, FolderOpen, List, ChevronRight } from 'lucide-react';
import { useSharedTemplates } from '@/hooks/useSharedTemplates';
import { useTemplateTypes } from '@/hooks/useTemplateTypes';
import { useAuth } from '@/contexts/AuthContext';
import ShareTemplateDialog from './ShareTemplateDialog';
import TemplateTypeManager from './TemplateTypeManager';
import { format } from 'date-fns';

export default function SharedTemplatesPanel() {
  const { user } = useAuth();
  const { templates, isLoading, deleteSharedTemplate } = useSharedTemplates();
  const { labelFor } = useTemplateTypes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [layout, setLayout] = useState<'list' | 'folder'>('list');
  const [openedType, setOpenedType] = useState<string | null>(null);

  const handleDownload = (filePath: string) => window.open(filePath, '_blank');

  const byType = useMemo(() => {
    const m: Record<string, typeof templates> = {};
    templates.forEach(t => { (m[t.template_type] ||= []).push(t); });
    return m;
  }, [templates]);

  if (isLoading) {
    return <Card><CardContent className="p-8 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></CardContent></Card>;
  }

  const renderRow = (template: any) => (
    <div key={template.id} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 transition-colors">
      <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{template.title}</h4>
          {template.is_global ? (
            <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full"><Globe className="h-3 w-3" />All Stores</span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full"><Building className="h-3 w-3" />Specific</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{labelFor(template.template_type)} • {format(new Date(template.created_at), 'MMM d, yyyy')}</p>
      </div>
      <div className="flex items-center gap-1">
        {template.file_path && <Button variant="ghost" size="icon" onClick={() => handleDownload(template.file_path)}><Download className="h-4 w-4" /></Button>}
        <Button variant="ghost" size="icon" onClick={() => deleteSharedTemplate(template.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Shared Templates</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button variant={layout === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => { setLayout('list'); setOpenedType(null); }} className="rounded-r-none h-8 w-8"><List className="h-4 w-4" /></Button>
            <Button variant={layout === 'folder' ? 'default' : 'ghost'} size="icon" onClick={() => setLayout('folder')} className="rounded-l-none h-8 w-8"><FolderOpen className="h-4 w-4" /></Button>
          </div>
          {user?.role === 'super_admin' && <TemplateTypeManager />}
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Share Template</Button>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Shared Templates</h3>
            <p className="text-sm text-muted-foreground mb-4">Share templates with store logins so they can use them</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Share First Template</Button>
          </div>
        ) : layout === 'folder' ? (
          openedType ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Button variant="ghost" size="sm" onClick={() => setOpenedType(null)}>Folders</Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{labelFor(openedType)}</span>
              </div>
              <div className="space-y-3">{(byType[openedType] || []).map(renderRow)}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(byType).map(([type, items]) => (
                <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenedType(type)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent/10"><FolderOpen className="h-6 w-6 text-accent-foreground" /></div>
                    <div>
                      <p className="font-semibold">{labelFor(type)}</p>
                      <p className="text-xs text-muted-foreground">{items.length} file(s)</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">{templates.map(renderRow)}</div>
        )}
      </CardContent>

      <ShareTemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
