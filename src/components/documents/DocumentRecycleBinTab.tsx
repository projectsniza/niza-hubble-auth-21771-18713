import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Trash2,
  RotateCcw,
  Search,
  FileText,
  AlertCircle,
  Folder,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  DeletedDocumentRecord,
  getRecycleBinDocuments,
  restoreFromRecycleBin,
  permanentlyDeleteFromRecycleBin,
  emptyRecycleBin,
} from '@/lib/recycleBin';

interface DocumentRecycleBinTabProps {
  onDocumentRestored?: () => void;
}

export default function DocumentRecycleBinTab({ onDocumentRestored }: DocumentRecycleBinTabProps) {
  const [deletedDocs, setDeletedDocs] = useState<DeletedDocumentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('all');
  const [permanentDeleteDocId, setPermanentDeleteDocId] = useState<string | null>(null);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDocs = () => {
    const list = getRecycleBinDocuments();
    setDeletedDocs(list);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const foldersList = useMemo(() => {
    const set = new Set<string>();
    deletedDocs.forEach(d => {
      if (d.folder_name) set.add(d.folder_name);
    });
    return Array.from(set);
  }, [deletedDocs]);

  const filteredDocs = useMemo(() => {
    let result = [...deletedDocs];
    if (selectedFolderFilter !== 'all') {
      result = result.filter(d => d.folder_name === selectedFolderFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        (d.folder_name && d.folder_name.toLowerCase().includes(q)) ||
        (d.employee_name && d.employee_name.toLowerCase().includes(q)) ||
        (d.deleted_by_name && d.deleted_by_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [deletedDocs, searchQuery, selectedFolderFilter]);

  const handleRestore = async (docId: string, title: string) => {
    setIsProcessing(true);
    try {
      await restoreFromRecycleBin(docId);
      toast.success(`"${title}" has been restored successfully`);
      loadDocs();
      onDocumentRestored?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteDocId) return;
    setIsProcessing(true);
    try {
      await permanentlyDeleteFromRecycleBin(permanentDeleteDocId);
      toast.success('Document permanently deleted');
      setPermanentDeleteDocId(null);
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document permanently');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyAll = async () => {
    setIsProcessing(true);
    try {
      await emptyRecycleBin();
      toast.success('Recycle bin emptied');
      setConfirmEmptyOpen(false);
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to empty recycle bin');
    } finally {
      setIsProcessing(false);
    }
  };

  const getDaysRemaining = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const daysSince = differenceInDays(new Date(), deletedDate);
    const remaining = Math.max(0, 90 - daysSince);
    return remaining;
  };

  return (
    <div className="space-y-4">
      {/* Information Banner */}
      <div className="p-4 rounded-xl bg-muted/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Recycle Bin (90-Day Retention)
              <Badge variant="outline" className="text-xs font-normal">
                {deletedDocs.length} {deletedDocs.length === 1 ? 'item' : 'items'}
              </Badge>
            </h4>
            <p className="text-xs text-muted-foreground">
              Deleted documents are kept safely here for 90 days. You can search, inspect, or restore them anytime to their original folder.
            </p>
          </div>
        </div>

        {deletedDocs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmEmptyOpen(true)}
            className="text-destructive hover:bg-destructive/10 shrink-0 gap-1.5"
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4" />
            Empty Recycle Bin
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deleted files by name, original folder, employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {foldersList.length > 0 && (
          <select
            value={selectedFolderFilter}
            onChange={(e) => setSelectedFolderFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Original Folders ({foldersList.length})</option>
            {foldersList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content Table / Empty State */}
      {filteredDocs.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Trash2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {searchQuery || selectedFolderFilter !== 'all' ? 'No matching deleted documents' : 'Recycle Bin is empty'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || selectedFolderFilter !== 'all'
                  ? 'Try clearing your search term or folder filter'
                  : 'Documents deleted within the last 90 days will be available here for restore'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Document Name</TableHead>
                <TableHead>Original Location</TableHead>
                <TableHead>Deleted On</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.map((doc) => {
                const daysRemaining = getDaysRemaining(doc.deleted_at);
                return (
                  <TableRow key={doc.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[280px]" title={doc.title}>
                            {doc.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {doc.file_name}
                            {doc.employee_name && ` • ${doc.employee_name}`}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="truncate max-w-[180px]" title={doc.folder_path || doc.folder_name || 'Root'}>
                          {doc.folder_name || 'Company Documents'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(doc.deleted_at), 'dd MMM yyyy, HH:mm')}
                        </div>
                        {doc.deleted_by_name && (
                          <p className="text-xs text-muted-foreground">by {doc.deleted_by_name}</p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${
                          daysRemaining <= 7
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : daysRemaining <= 30
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(doc.id, doc.title)}
                          disabled={isProcessing}
                          className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                          title="Restore document to folder"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPermanentDeleteDocId(doc.id)}
                          disabled={isProcessing}
                          className="h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Confirmation Dialog: Permanent Delete Single Item */}
      <AlertDialog open={!!permanentDeleteDocId} onOpenChange={(open) => !open && setPermanentDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the document from both the Recycle Bin and cloud storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Empty All Items */}
      <AlertDialog open={confirmEmptyOpen} onOpenChange={setConfirmEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Recycle Bin?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently remove all {deletedDocs.length} documents currently in the Recycle Bin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Empty All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
