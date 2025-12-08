import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen, FileText } from "lucide-react";

export default function SafeDocuments() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Documents</h1>
          <p className="text-muted-foreground">Manage your safety documents and folders</p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg">
          + New Document
        </Button>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-2 text-foreground">Search</h3>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search All Folders"
            className="pl-10"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-border">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Category</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Sites</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Last updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-accent/5 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-primary font-medium">Company Documents</span>
                </div>
              </td>
              <td className="px-6 py-4 text-foreground">Folder</td>
              <td className="px-6 py-4 text-muted-foreground">N/A</td>
              <td className="px-6 py-4 text-muted-foreground">N/A</td>
              <td className="px-6 py-4 text-muted-foreground">N/A</td>
            </tr>
            <tr className="hover:bg-accent/5 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-medium">Health and Safety Hub</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">Read only</span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-foreground">Folder</td>
              <td className="px-6 py-4 text-muted-foreground">N/A</td>
              <td className="px-6 py-4 text-muted-foreground">N/A</td>
              <td className="px-6 py-4 text-muted-foreground">N/A</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
