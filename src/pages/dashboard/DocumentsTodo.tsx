import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, X, Clock } from 'lucide-react';

type FilterStatus = 'all' | 'read_receipt' | 'acceptance' | 'followup_7d' | 'followup_30d' | 'followup_overdue';

interface TodoDocument {
  id: string;
  name: string;
  followUp: string;
  location: string;
  status: string;
  daysUntil: number;
}

export default function DocumentsTodo() {
  const [activeFilters, setActiveFilters] = useState<FilterStatus[]>(['all']);

  // Empty list - will be populated from backend
  const todoDocuments: TodoDocument[] = [];

  const toggleFilter = (filter: FilterStatus) => {
    if (filter === 'all') {
      setActiveFilters(['all']);
    } else {
      const newFilters = activeFilters.filter(f => f !== 'all');
      if (activeFilters.includes(filter)) {
        const filtered = newFilters.filter(f => f !== filter);
        setActiveFilters(filtered.length === 0 ? ['all'] : filtered);
      } else {
        setActiveFilters([...newFilters, filter]);
      }
    }
  };

  const resetFilters = () => {
    setActiveFilters(['all']);
  };

  const getFilteredDocuments = () => {
    if (activeFilters.includes('all')) {
      return todoDocuments;
    }
    return todoDocuments.filter(doc => activeFilters.includes(doc.status as FilterStatus));
  };

  const filteredDocuments = getFilteredDocuments();

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Documents</h1>
        <p className="text-muted-foreground">All folders &gt; To-do list</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5" />
            Filter by status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={activeFilters.includes('read_receipt') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleFilter('read_receipt')}
            >
              Read receipt
            </Button>
            <Button
              variant={activeFilters.includes('acceptance') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleFilter('acceptance')}
            >
              Acceptance
            </Button>
            <Button
              variant={activeFilters.includes('followup_7d') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleFilter('followup_7d')}
            >
              Follow up within 7d
            </Button>
            <Button
              variant={activeFilters.includes('followup_30d') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleFilter('followup_30d')}
            >
              Follow up within 30d
            </Button>
            <Button
              variant={activeFilters.includes('followup_overdue') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleFilter('followup_overdue')}
            >
              Follow up overdue
            </Button>
            {!activeFilters.includes('all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Reset filters
              </Button>
            )}
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Name</TableHead>
                  <TableHead className="text-foreground">Action required</TableHead>
                  <TableHead className="text-foreground">Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Clock className="h-12 w-12 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">No pending documents</p>
                          <p className="text-sm text-muted-foreground">
                            Documents requiring follow-up will appear here
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow key={doc.id} className="cursor-pointer hover:bg-muted">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Follow up: {doc.followUp}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{doc.status}</TableCell>
                      <TableCell className="text-muted-foreground">{doc.location}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}