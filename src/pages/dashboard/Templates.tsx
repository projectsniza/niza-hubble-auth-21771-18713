import { useState } from 'react';
import { Search, Download, Printer, Grid3x3, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function Templates() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const templates = [
    { id: 1, name: 'Employee ID Card', type: 'ID Card', folder: 'Identity' },
    { id: 2, name: 'Visiting Card - Manager', type: 'Business Card', folder: 'Business Cards' },
    { id: 3, name: 'Email Signature Standard', type: 'Email Signature', folder: 'Email' },
    { id: 4, name: 'Letterhead Template', type: 'Document', folder: 'Documents' },
    { id: 5, name: 'Certificate of Employment', type: 'Certificate', folder: 'HR Documents' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Templates</h1>
        <p className="text-muted-foreground mt-1">View and use company templates</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by folder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            <SelectItem value="identity">Identity</SelectItem>
            <SelectItem value="business">Business Cards</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="documents">Documents</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-lg flex items-center justify-center">
                  <div className="text-6xl opacity-20">📄</div>
                </div>
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{template.type}</Badge>
                    <span className="text-xs text-muted-foreground">{template.folder}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-2">
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Printer className="h-3 w-3" />
                    Print
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded flex items-center justify-center text-2xl">
                      📄
                    </div>
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{template.type}</Badge>
                        <span className="text-xs text-muted-foreground">{template.folder}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2">
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Printer className="h-3 w-3" />
                      Print
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
