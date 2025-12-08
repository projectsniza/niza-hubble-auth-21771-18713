import { ChevronRight, ChevronDown, Search, Plus, Folder as FolderIcon, ShieldCheck, User, Building2, UserX, FolderX, FileText, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder } from '@/types/documents';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
  ShieldCheck, User, Building2, UserX, FolderX, FileText, BookOpen, FolderIcon
};

interface FolderSidebarProps {
  folders: Folder[];
  selectedFolder: string;
  onFolderSelect: (folderId: string) => void;
}

export default function FolderSidebar({ folders, selectedFolder, onFolderSelect }: FolderSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['company']);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev =>
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  const renderFolder = (folder: Folder, level = 0) => {
    const Icon = iconMap[folder.icon] || FolderIcon;
    const isExpanded = expandedFolders.includes(folder.id);
    const isSelected = selectedFolder === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            onFolderSelect(folder.id);
            if (hasChildren) toggleFolder(folder.id);
          }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all hover:bg-accent/50 group",
            isSelected && "bg-accent text-accent-foreground",
            level > 0 && "ml-6"
          )}
        >
          {hasChildren && (
            isExpanded ? 
              <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
          <span className="flex-1 text-left text-sm font-medium">{folder.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {folder.count}
          </span>
        </button>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {folder.children!.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 border-r bg-card/50 backdrop-blur-sm flex flex-col h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Folders</h2>
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-4">
          {folders.map(folder => renderFolder(folder))}
        </div>
      </ScrollArea>
    </div>
  );
}
