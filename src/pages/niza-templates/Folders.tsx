import { Plus, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Folders() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Folders</h1>
          <p className="text-muted-foreground mt-1">Organize templates into folders</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Folder
        </Button>
      </div>

      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Folder className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">No folders yet</h3>
            <p className="text-muted-foreground mb-4">Create folders to organize your templates</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Folder
          </Button>
        </div>
      </Card>
    </div>
  );
}
