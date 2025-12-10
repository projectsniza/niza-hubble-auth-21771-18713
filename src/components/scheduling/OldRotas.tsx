import { useState, useEffect } from 'react';
import { Calendar, Download, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Rota {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string | null;
  branch?: { name: string };
}

export function OldRotas() {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('start-date');

  useEffect(() => {
    fetchRotas();
  }, []);

  const fetchRotas = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('rotas')
        .select('*, branch:branches(name)')
        .lt('end_date', today)
        .order('end_date', { ascending: false });

      if (error) throw error;
      setRotas(data || []);
    } catch (error) {
      console.error('Error fetching old rotas:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRotas = rotas
    .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'start-date':
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        case 'start-date-old':
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Old rotas</h2>
          <p className="text-muted-foreground">Rotas which have ended are shown here.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input 
              placeholder="Search rotas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="ghost" className="text-primary" onClick={() => setSearchQuery('')}>
            Clear all filters
          </Button>
        </div>
        <div className="mt-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start-date">Start date (Newest first)</SelectItem>
              <SelectItem value="start-date-old">Start date (Oldest first)</SelectItem>
              <SelectItem value="name">Rota name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Rota name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filteredRotas.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-16 h-16 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">No rotas to see here yet...</h3>
            <p className="text-muted-foreground mb-4">
              Old rotas that have finished will appear here for your reference.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRotas.map(rota => (
                <TableRow key={rota.id}>
                  <TableCell className="font-medium">{rota.name}</TableCell>
                  <TableCell>{rota.branch?.name || 'N/A'}</TableCell>
                  <TableCell>{format(new Date(rota.start_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{format(new Date(rota.end_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Completed</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Report Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Generate a rota report</h3>
            <p className="text-muted-foreground text-sm">
              At the tap of a button, you can download a summary of the hours your staff have worked over a set period. It also includes the total hours worked.
            </p>
          </div>
          <Button variant="outline" className="flex-shrink-0">
            <Download className="mr-2 h-4 w-4" />
            Download rota report
          </Button>
        </div>
      </Card>
    </div>
  );
}
