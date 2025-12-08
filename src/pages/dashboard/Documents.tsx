import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX, Upload, FolderPlus, FileText, ChevronRight, Folder, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CreateFolderDialog from '@/components/documents/CreateFolderDialog';
import FolderPermissionsDialog from '@/components/documents/FolderPermissionsDialog';
import UploadDocumentDialog from '@/components/documents/UploadDocumentDialog';
import ReportsPanel from '@/components/documents/ReportsPanel';

interface FolderItem {
  id: string;
  name: string;
  type: 'folder';
  children?: FolderItem[];
}

export default function Documents() {
  const { user } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Empty folders - will be populated from backend
  const folders: FolderItem[] = [];

  // Role-based access control
  const hasAccess = user?.role === 'super_admin' || user?.role === 'hr';

  if (!hasAccess) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access the Documents module. Only Super Admins and HR can view documents.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
  };

  const handleBreadcrumbClick = () => {
    setCurrentFolderId(null);
  };

  return (
    <div className="flex h-screen">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header with Breadcrumb */}
        <div className="border-b bg-background">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold mb-3 text-foreground">Documents</h1>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="link"
                className="h-auto p-0 text-primary hover:underline"
                onClick={handleBreadcrumbClick}
              >
                All folders
              </Button>
              {currentFolderId && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">Current Folder</span>
                </>
              )}
            </div>
          </div>

          {/* Search and Actions Bar */}
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 flex-1 max-w-xl">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border-border"
                  />
                </div>
                <Button variant="outline" className="px-6">Search</Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View</span>
                <select className="h-9 px-3 border rounded-md bg-background text-sm border-border">
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                </select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-muted-foreground">Move</Button>
                <Button variant="outline" size="sm" className="text-muted-foreground">Notify</Button>
                <Button variant="outline" size="sm" className="text-muted-foreground">Delete</Button>
                <Button variant="outline" size="sm" className="text-muted-foreground">Download</Button>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => setShowUpload(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <Button onClick={() => setShowCreateFolder(true)} className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  New folder
                </Button>
                <Button onClick={() => setShowReports(true)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Create report
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Empty State */}
        <div className="flex-1 overflow-auto p-6">
          {folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Folder className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Documents will appear here once organizations and employees are created.
              </p>
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
          ) : (
            <div className="grid gap-2">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => handleFolderClick(folder.id)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                >
                  <Folder className="h-5 w-5 text-primary" />
                  <span className="text-foreground">{folder.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reports Panel */}
      {showReports && <ReportsPanel onClose={() => setShowReports(false)} />}

      {/* Dialogs */}
      <CreateFolderDialog 
        open={showCreateFolder} 
        onOpenChange={setShowCreateFolder} 
      />
      
      <FolderPermissionsDialog
        open={showPermissions}
        onOpenChange={setShowPermissions}
        folderName=""
      />

      <UploadDocumentDialog
        open={showUpload}
        onOpenChange={setShowUpload}
      />
    </div>
  );
}