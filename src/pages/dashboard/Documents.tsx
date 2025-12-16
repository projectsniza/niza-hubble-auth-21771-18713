import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShieldX, Upload, FolderPlus, FileText, ChevronRight, Folder, File, 
  Search, Clock, AlertTriangle, Eye, Download, Trash2, Lock, Edit2, Home
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import CreateFolderDialog from '@/components/documents/CreateFolderDialog';
import UploadDocumentDialog from '@/components/documents/UploadDocumentDialog';
import DocumentDetailsDialog from '@/components/documents/DocumentDetailsDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface FolderItem {
  id: string;
  name: string;
  path: string;
  folder_type: string;
  parent_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
  employee_id: string | null;
  is_system?: boolean;
  is_deletable?: boolean;
  color?: string;
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
  employee?: { first_name: string; last_name: string } | null;
}

export default function Documents() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = searchParams.get('filter');
    return filter === 'overdue' || filter === 'upcoming' ? filter : 'all';
  });
  const [loading, setLoading] = useState(true);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteDocPath, setDeleteDocPath] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [renameFolder, setRenameFolder] = useState<FolderItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [showDocumentDetails, setShowDocumentDetails] = useState(false);

  const hasAccess = user?.role === 'super_admin' || user?.role === 'hr';

  // Initialize with Company Documents root folder
  useEffect(() => {
    const initializeRoot = async () => {
      const { data: rootFolder } = await supabase
        .from('folders')
        .select('*')
        .eq('folder_type', 'root')
        .eq('path', 'Company Documents')
        .single();
      
      if (rootFolder) {
        setRootFolderId(rootFolder.id);
        // Start at null to show Company Documents as the first folder
        setCurrentFolderId(null);
      }
    };
    initializeRoot();
  }, []);

  // Fetch all documents for global stats
  useEffect(() => {
    const fetchAllDocuments = async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, title, file_name, file_path, expiry_date, follow_up_date, created_at, folder_id, employee:employees(first_name, last_name)');
      setAllDocuments(data || []);
    };
    fetchAllDocuments();
  }, []);

  // Update activeTab when URL filter changes
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'overdue' || filter === 'upcoming') {
      setActiveTab(filter);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchFoldersAndDocuments();
  }, [currentFolderId, rootFolderId]);

  const fetchFoldersAndDocuments = async () => {
    setLoading(true);
    try {
      // If currentFolderId is null, show the root Company Documents folder
      if (currentFolderId === null && rootFolderId) {
        // Fetch the root folder to display it
        const { data: rootFolder } = await supabase
          .from('folders')
          .select('*')
          .eq('id', rootFolderId)
          .single();
        
        setFolders(rootFolder ? [rootFolder] : []);
        setDocuments([]);
        setBreadcrumbs([]);
      } else if (currentFolderId) {
        // Fetch subfolders of current folder
        const { data: foldersData } = await supabase
          .from('folders')
          .select('*')
          .eq('parent_id', currentFolderId)
          .order('name');
        setFolders(foldersData || []);

        // Fetch documents in current folder
        const { data: docsData } = await supabase
          .from('documents')
          .select('id, title, file_name, file_path, expiry_date, follow_up_date, created_at, folder_id, employee:employees(first_name, last_name)')
          .eq('folder_id', currentFolderId)
          .order('created_at', { ascending: false });
        setDocuments(docsData || []);

        // Build breadcrumbs
        await buildBreadcrumbs(currentFolderId);
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
    // If clicking root or home, go to Company Documents
    if (folderId === null && rootFolderId) {
      setCurrentFolderId(rootFolderId);
    } else {
      setCurrentFolderId(folderId);
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocId || !deleteDocPath) return;

    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([deleteDocPath]);

      // Delete record
      const { error } = await supabase.from('documents').delete().eq('id', deleteDocId);
      if (error) throw error;

      setDocuments(prev => prev.filter(d => d.id !== deleteDocId));
      setAllDocuments(prev => prev.filter(d => d.id !== deleteDocId));
      toast.success('Document deleted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteDocId(null);
      setDeleteDocPath(null);
    }
  };

  const handleRenameFolder = async () => {
    if (!renameFolder || !newFolderName.trim()) return;

    setIsRenaming(true);
    try {
      // Build new path
      const pathParts = renameFolder.path.split('/');
      pathParts[pathParts.length - 1] = newFolderName.trim();
      const newPath = pathParts.join('/');

      const { error } = await supabase
        .from('folders')
        .update({ name: newFolderName.trim(), path: newPath })
        .eq('id', renameFolder.id);

      if (error) throw error;

      toast.success('Folder renamed successfully');
      setRenameFolder(null);
      setNewFolderName('');
      fetchFoldersAndDocuments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRenaming(false);
    }
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

  // When filtering by overdue/upcoming from URL, use all documents globally
  const isGlobalFilter = searchParams.get('filter') === 'overdue' || searchParams.get('filter') === 'upcoming';
  const docsToFilter = isGlobalFilter ? allDocuments : documents;
  
  const filteredDocuments = docsToFilter.filter(doc => {
    if (activeTab === 'overdue') return getDocumentStatus(doc) === 'overdue';
    if (activeTab === 'upcoming') return getDocumentStatus(doc) === 'upcoming';
    return true;
  });

  // Use allDocuments for global stats
  const globalOverdueCount = allDocuments.filter(d => getDocumentStatus(d) === 'overdue').length;
  const globalUpcomingCount = allDocuments.filter(d => getDocumentStatus(d) === 'upcoming').length;
  const globalTotalCount = allDocuments.length;

  const overdueCount = documents.filter(d => getDocumentStatus(d) === 'overdue').length;
  const upcomingCount = documents.filter(d => getDocumentStatus(d) === 'upcoming').length;

  const isProtectedFolder = (folder: FolderItem) => {
    return folder.is_deletable === false || 
           folder.folder_type === 'root' || 
           folder.folder_type === 'organization' || 
           folder.folder_type === 'branch' || 
           folder.folder_type === 'employee';
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', deleteFolderId);

      if (error) throw error;

      setFolders(prev => prev.filter(f => f.id !== deleteFolderId));
      toast.success('Folder deleted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteFolderId(null);
    }
  };

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
          {/* Home icon to return to root folder view */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCurrentFolderId(null)}
            title="Go to root"
          >
            <Home className="h-4 w-4" />
          </Button>
          {breadcrumbs.length > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <Button
                variant="link"
                className={`h-auto p-0 ${index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-primary'}`}
                onClick={() => handleBreadcrumbClick(crumb.id)}
              >
                {crumb.folder_type === 'root' && <Lock className="h-3 w-3 mr-1 inline" />}
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
                <p className="text-2xl font-bold text-foreground">{globalOverdueCount}</p>
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
                <p className="text-2xl font-bold text-foreground">{globalUpcomingCount}</p>
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
                <p className="text-2xl font-bold text-foreground">{globalTotalCount}</p>
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
                  {folders.map((folder) => {
                    const isProtected = isProtectedFolder(folder);
                    return (
                      <Card
                        key={folder.id}
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div onClick={() => handleFolderClick(folder.id)} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="relative">
                              <Folder 
                                className="h-8 w-8" 
                                style={{ color: folder.color || '#3B82F6' }} 
                              />
                              {isProtected && (
                                <Lock className="h-3 w-3 text-muted-foreground absolute -bottom-1 -right-1" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{folder.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {folder.folder_type === 'root' ? 'Root folder' : folder.folder_type}
                              </p>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameFolder(folder);
                                setNewFolderName(folder.name);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {!isProtected && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteFolderId(folder.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
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
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground">{doc.file_name}</p>
                                {doc.employee && (
                                  <span className="text-sm text-primary">• {doc.employee.first_name} {doc.employee.last_name}</span>
                                )}
                              </div>
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
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setShowDocumentDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={async () => {
                                const { data } = await supabase.storage
                                  .from('documents')
                                  .createSignedUrl(doc.file_path, 60);
                                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setDeleteDocId(doc.id);
                                setDeleteDocPath(doc.file_path);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Delete Document Confirmation */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => { setDeleteDocId(null); setDeleteDocPath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Confirmation */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this folder? All documents and subfolders inside will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Folder Dialog */}
      <Dialog open={!!renameFolder} onOpenChange={(open) => { if (!open) { setRenameFolder(null); setNewFolderName(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for the folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameFolder(null); setNewFolderName(''); }}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={isRenaming || !newFolderName.trim()}>
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
      <DocumentDetailsDialog
        open={showDocumentDetails}
        onOpenChange={setShowDocumentDetails}
        document={selectedDocument}
      />
    </div>
  );
}
