import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FolderOpen, FileText, Upload, Download, Trash2, Eye } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SafetyDocument {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  folder_id: string | null;
  created_at: string;
  folder?: { name: string };
}

export default function SafeDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<SafetyDocument[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr' || user?.role === 'manager';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [docsRes, foldersRes] = await Promise.all([
        supabase.from('documents').select('*, folder:folders(name)').order('created_at', { ascending: false }),
        supabase.from('folders').select('*').order('name'),
      ]);

      setDocuments(docsRes.data || []);
      setFolders(foldersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
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
        folder_id: selectedFolder,
        uploaded_by: authUser?.id,
      });

      if (docError) throw docError;

      toast({ title: "Success", description: "Document uploaded successfully" });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadTitle('');
      setSelectedFolder(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDownload = async (doc: SafetyDocument) => {
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

  const handleDelete = async (doc: SafetyDocument) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([doc.file_path]);

      // Delete record
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;

      toast({ title: "Success", description: "Document deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Safety Documents</h1>
          <p className="text-muted-foreground">Manage your safety documents and folders</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setShowUploadDialog(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        )}
      </div>

      <div className="mb-6">
        <Label className="text-sm font-semibold mb-2 block">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Folders</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {folders.slice(0, 4).map((folder) => (
              <Card key={folder.id} className="p-4 cursor-pointer hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{folder.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {documents.filter(d => d.folder_id === folder.id).length} files
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Documents Table */}
      <Card className="overflow-hidden border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Folder</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No documents found</p>
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
                    {doc.file_size ? formatFileSize(doc.file_size) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.folder?.name || '-'}
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
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
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
            {folders.length > 0 && (
              <div className="space-y-2">
                <Label>Folder (optional)</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={selectedFolder || ''}
                  onChange={(e) => setSelectedFolder(e.target.value || null)}
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || !uploadTitle}>Upload</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
