import { useState } from 'react';
import { FileText, Image, File, FolderIcon, Eye, CalendarClock } from 'lucide-react';
import { Document, Folder, SortField, SortOrder } from '@/types/documents';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DocumentListProps {
  folders?: Folder[];
  documents: Document[];
  onFolderClick?: (folderId: string) => void;
  onDocumentSelect: (doc: Document) => void;
}

export default function DocumentList({ folders = [], documents, onFolderClick, onDocumentSelect }: DocumentListProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('dateCreated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const allItems = [...folders, ...documents];
  const hasItems = allItems.length > 0;

  const getFileIcon = (type: string) => {
    if (type.includes('PNG') || type.includes('JPG')) return Image;
    if (type.includes('PDF') || type.includes('DOC')) return FileText;
    return File;
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === allItems.length) {
      setSelectedItems([]);
    } else {
      const allIds = [
        ...folders.map(f => f.id),
        ...documents.map(d => d.id)
      ];
      setSelectedItems(allIds);
    }
  };

  return (
    <div className="p-6">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b">
            <TableHead className="w-12">
              <Checkbox
                checked={hasItems && selectedItems.length === allItems.length}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Size</TableHead>
            <TableHead className="font-semibold">Date created</TableHead>
            <TableHead className="font-semibold">Visibility</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Folders */}
          {folders.map(folder => (
            <TableRow
              key={folder.id}
              className={cn(
                "hover:bg-muted/50 cursor-pointer transition-colors",
                selectedItems.includes(folder.id) && "bg-muted/50"
              )}
              onClick={() => onFolderClick?.(folder.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedItems.includes(folder.id)}
                  onCheckedChange={() => toggleSelectItem(folder.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <FolderIcon className="h-5 w-5 text-primary" />
                  <span className="text-primary hover:underline">{folder.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">Folder</span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">-</span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">-</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Eye className="h-4 w-4" />
                  <span>Everyone with access</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          
          {/* Documents */}
          {documents.map(doc => {
            const Icon = getFileIcon(doc.type);
            return (
              <TableRow
                key={doc.id}
                className={cn(
                  "hover:bg-muted/50 cursor-pointer transition-colors",
                  selectedItems.includes(doc.id) && "bg-muted/50"
                )}
                onClick={() => onDocumentSelect(doc)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedItems.includes(doc.id)}
                    onCheckedChange={() => toggleSelectItem(doc.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-primary hover:underline">{doc.name}</span>
                    </div>
                    {doc.followUpDate && (
                      <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 font-medium ml-8">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>Follow up: {format(new Date(doc.followUpDate), 'dd MMM yy')}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">{doc.type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{doc.size}</TableCell>
                <TableCell className="text-muted-foreground">{doc.dateCreated}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-primary">
                    <Eye className="h-4 w-4" />
                    <span>Everyone with access</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {!hasItems && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">This folder is empty</p>
        </div>
      )}
    </div>
  );
}
