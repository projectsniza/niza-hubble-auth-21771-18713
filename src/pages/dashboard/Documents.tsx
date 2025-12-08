import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShieldX, Upload, FolderPlus, FileText, ChevronRight, Folder, File, 
  Search, Clock, AlertTriangle, Eye, Download, Trash2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import CreateFolderDialog from '@/components/documents/CreateFolderDialog';
import UploadDocumentDialog from '@/components/documents/UploadDocumentDialog';

interface FolderItem {
  id: string;
  name: string;
  path: string;
  folder_type: string;
  parent_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
  employee_id: string | null;
}

interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  expiry_date: string | null;
  follow_up_date: string | null;
  created_at: string;
  folder_id: string | null;
}

export default function Documents() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  const hasAccess = user?.role === 'super_admin' || user?.role === 'hr';

  useEffect(() => {
    fetchFoldersAndDocuments();
  }, [currentFolderId]);

  const fetchFoldersAndDocuments = async () => {
    setLoading(true);
    try {
      // Fetch folders
      let foldersQuery = supabase.from('folders').select('*');
      if (currentFolderId) {
        foldersQuery = foldersQuery.eq('parent_id', currentFolderId);
      } else {
        foldersQuery = foldersQuery.is('parent_id', null);
      }
      const { data: foldersData } = await foldersQuery.order('name');
      setFolders(foldersData || []);

      // Fetch documents
      let docsQuery = supabase.from('documents').select('*');
      if (currentFolderId) {
        docsQuery = docsQuery.eq('folder_id', currentFolderId);
      } else {
        docsQuery = docsQuery.is('folder_id', null);
      }
      const { data: docsData } = await docsQuery.order('created_at', { ascending: false });
      setDocuments(docsData || []);

      // Build breadcrumbs
      if (currentFolderId) {
        await buildBreadcrumbs(currentFolderId);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildBreadcrumbs = async (folderId: string) => {
    const crumbs: FolderItem[] = [];
    let currentId: string | null = folderId;
    
    while (currentId) {
      const { data: folder } = await supabase
        .from('folders')
        .select('*')
        .eq('id', currentId)
        .single();
      
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parent_id;
      } else {
        break;
      }
    }
    
    setBreadcrumbs(crumbs);
  };

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const getDocumentStatus = (doc: DocumentItem) => {
    if (!doc.follow_up_date && !doc.expiry_date) return 'normal';
    
    const checkDate = doc.follow_up_date || doc.expiry_date;
    if (!checkDate) return 'normal';
    
    const daysUntil = differenceInDays(new Date(checkDate), new Date());
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 30) return 'upcoming';
    return 'normal';
  };

  const filteredDocuments = documents.filter(doc => {
    if (activeTab === 'overdue') return getDocumentStatus(doc) === 'overdue';
    if (activeTab === 'upcoming') return getDocumentStatus(doc) === 'upcoming';
    return true;
  });

  const overdueCount = documents.filter(d => getDocumentStatus(d) === 'overdue').length;
  const upcomingCount = documents.filter(d => getDocumentStatus(d) === 'upcoming').length;

  if (!hasAccess) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access the Documents module.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
            <p className="text-muted-foreground">Manage all company and employee documents</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <Button onClick={() => setShowCreateFolder(true)} variant="outline" className="gap-2">
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-4">
          <Button
            variant="link"
            className="h-auto p-0 text-primary"
            onClick={() => handleBreadcrumbClick(null)}
          >
            All Folders
          </Button>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="link"
                className={`h-auto p-0 ${index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-primary'}`}
                onClick={() => handleBreadcrumbClick(crumb.id)}
              >
                {crumb.name}
              </Button>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Overdue Documents</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{upcomingCount}</p>
                <p className="text-xs text-muted-foreground">Upcoming Follow-ups</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{documents.length}</p>
                <p className="text-xs text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="flex-1 p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="overdue" className="gap-2">
              Overdue
              {overdueCount > 0 && <Badge variant="destructive">{overdueCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              Upcoming
              {upcomingCount > 0 && <Badge variant="secondary">{upcomingCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && activeTab === 'all' && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Folders</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {folders.map((folder) => (
                    <Card
                      key={folder.id}
                      onClick={() => handleFolderClick(folder.id)}
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="h-8 w-8 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{folder.folder_type}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {filteredDocuments.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Documents</h3>
                <div className="space-y-2">
                  {filteredDocuments.map((doc) => {
                    const status = getDocumentStatus(doc);
                    return (
                      <Card key={doc.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <File className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground">{doc.title}</p>
                              <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                              <div className="flex gap-2 mt-1">
                                {doc.follow_up_date && (
                                  <Badge variant={status === 'overdue' ? 'destructive' : status === 'upcoming' ? 'secondary' : 'outline'}>
                                    Follow-up: {format(new Date(doc.follow_up_date), 'dd MMM yyyy')}
                                  </Badge>
                                )}
                                {doc.expiry_date && (
                                  <Badge variant="outline">
                                    Expires: {format(new Date(doc.expiry_date), 'dd MMM yyyy')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : folders.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Folder className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">No documents yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Documents will appear here once organizations and employees are created.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setShowCreateFolder(true)} className="gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Create Folder
                    </Button>
                    <Button onClick={() => setShowUpload(true)} variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Document
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateFolderDialog 
        open={showCreateFolder} 
        onOpenChange={setShowCreateFolder}
        parentFolderId={currentFolderId}
        onSuccess={fetchFoldersAndDocuments}
      />
      
      <UploadDocumentDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        folderId={currentFolderId}
        onSuccess={fetchFoldersAndDocuments}
      />
    </div>
  );
}
