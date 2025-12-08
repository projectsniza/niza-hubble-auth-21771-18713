import { Upload, FolderPlus, LayoutGrid, List, Download, Share2, FileText, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ViewMode } from '@/types/documents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DocumentActionsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onUpload: () => void;
  onCreateFolder: () => void;
  onGenerateReport: () => void;
}

export default function DocumentActions({ 
  viewMode, 
  onViewModeChange, 
  onUpload, 
  onCreateFolder,
  onGenerateReport 
}: DocumentActionsProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b bg-card/30 backdrop-blur-sm">
      <div className="flex items-center gap-2 flex-1">
        <Button onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        <Button onClick={onCreateFolder} variant="outline" className="gap-2">
          <FolderPlus className="h-4 w-4" />
          New Folder
        </Button>
        <Button onClick={onGenerateReport} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Reports
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share2 className="h-4 w-4 mr-2" />
              Bulk Share
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onViewModeChange('list')}
            className="rounded-r-none"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => onViewModeChange('grid')}
            className="rounded-l-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
