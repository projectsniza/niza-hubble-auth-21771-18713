import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, FolderOpen, FileText, Upload, Download, Trash2, FolderPlus, 
  ChevronRight, Home, Edit2, Folder 
} from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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

interface FolderItem {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  color?: string;
  folder_type: string;
}

interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  folder_id: string | null;
  created_at: string;
}

const FOLDER_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Green', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Purple', value: '#8B5CF6' },
];

export default function SafeDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteDocPath, setDeleteDocPath] = useState<string | null>(null);

  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].value);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';

  useEffect(() => {
    fetchFoldersAndDocuments();
  }, [currentFolderId]);

  const fetchFoldersAndDocuments = async () => {
    setIsLoading(true);
    try {
      // Fetch folders - at root show folders with show_in_safety, otherwise show children
      let foldersQuery = supabase.from('folders').select('*').order('name');
      
      if (currentFolderId === null) {
        // At root level - show folders marked as show_in_safety with no parent
        foldersQuery = foldersQuery.eq('show_in_safety', true).is('parent_id', null);
      } else {
        foldersQuery = foldersQuery.eq('parent_id', currentFolderId);
      }
      
      const { data: foldersData } = await foldersQuery;
      setFolders(foldersData || []);

      // Fetch documents in current folder
      if (currentFolderId) {
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('folder_id', currentFolderId)
          .order('created_at', { ascending: false });
        
        setDocuments(docsData || []);
      } else {
        setDocuments([]);
      }

      // Build breadcrumbs
      if (currentFolderId) {
        await buildBreadcrumbs(currentFolderId);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({ title: "Error", description: "Please enter a folder name", variant: "destructive" });
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      let parentId = currentFolderId;
      let path = newFolderName;

      if (parentId) {
        const { data: parentFolder } = await supabase
          .from('folders')
          .select('path')
          .eq('id', parentId)
          .single();

        if (parentFolder) {
          path = `${parentFolder.path}/${newFolderName}`;
        }
      }

      const { error } = await supabase.from('folders').insert({
        name: newFolderName,
        path,
        parent_id: parentId,
        folder_type: 'general',
        color: newFolderColor,
        show_in_safety: true,
        created_by: authUser?.id,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Folder created successfully" });
      setShowCreateFolder(false);
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0].value);
      fetchFoldersAndDocuments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle) {
      toast({ title: "Error", description: "Please provide title and file", variant: "destructive" });
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // Upload file to storage
      const fileExt = uploadFile.name.split('.').pop();
      const filePath = `safety-documents/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadFile);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: docError } = await supabase.from('documents').insert({
        title: uploadTitle,
        file_name: uploadFile.name,
        file_path: filePath,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        folder_id: currentFolderId,
        uploaded_by: authUser?.id,
      });

      if (docError) throw docError;

      toast({ title: "Success", description: "Document uploaded successfully" });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadTitle('');
      fetchFoldersAndDocuments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Download started" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocId || !deleteDocPath) return;

    try {
      await supabase.storage.from('documents').remove([deleteDocPath]);
      const { error } = await supabase.from('documents').delete().eq('id', deleteDocId);
      if (error) throw error;

      toast({ title: "Success", description: "Document deleted" });
      setDeleteDocId(null);
      setDeleteDocPath(null);
      fetchFoldersAndDocuments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;

    try {
      const { error } = await supabase.from('folders').delete().eq('id', deleteFolderId);
      if (error) throw error;

      toast({ title: "Success", description: "Folder deleted" });
      setDeleteFolderId(null);
      fetchFoldersAndDocuments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isProtectedFolder = (folder: FolderItem) => {
    return folder.folder_type === 'root' || folder.path === 'Safety Documents';
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Safety Documents</h1>
          <p className="text-muted-foreground">Manage safety-related documents and folders</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowUploadDialog(true)}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button 
              onClick={() => setShowCreateFolder(true)}
              variant="outline"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
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
              onClick={() => setCurrentFolderId(crumb.id)}
            >
              {crumb.name}
            </Button>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
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
                        <div 
                          onClick={() => setCurrentFolderId(folder.id)} 
                          className="flex items-center gap-3 flex-1 min-w-0"
                        >
                          <Folder
                            className="h-8 w-8"
                            style={{ color: folder.color || '#3B82F6' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{folder.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {folder.folder_type === 'root' ? 'Root folder' : 'Folder'}
                            </p>
                          </div>
                        </div>
                        {!isProtected && isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteFolderId(folder.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documents Table */}
          {currentFolderId && (
            <Card className="overflow-hidden border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No documents in this folder</p>
                        {isAdmin && (
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => setShowUploadDialog(true)}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Document
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-accent/5 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-primary">{doc.title}</p>
                              <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.file_type?.split('/')[1] || 'unknown'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFileSize(doc.file_size)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(doc.created_at), 'PPP')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setDeleteDocId(doc.id);
                                  setDeleteDocPath(doc.file_path);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create a new folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder name</Label>
              <Input
                id="folderName"
                placeholder="Enter folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex gap-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewFolderColor(color.value)}
                    className={`w-12 h-12 rounded-lg transition-all ${
                      newFolderColor === color.value
                        ? 'ring-2 ring-primary ring-offset-2'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Safety Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Title</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || !uploadTitle}>Upload</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument} className="bg-destructive text-destructive-foreground">
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
              Are you sure you want to delete this folder? All documents inside will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}