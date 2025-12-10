import { useState, useEffect } from 'react';
import { Calendar, Users, Download, Eye, Edit, MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

interface Rota {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string | null;
  branch_id: string;
  organization_id: string;
  notes: string | null;
  created_by: string | null;
  branch?: { name: string };
}

export function ActiveRotas() {
  const { user } = useAuth();
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
        .gte('end_date', today)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setRotas(data || []);
    } catch (error) {
      console.error('Error fetching rotas:', error);
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
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <Input 
            placeholder="Search rotas..." 
            className="max-w-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
        <>
          {/* Empty State */}
          <Card className="p-12 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-16 h-16 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">No rotas to see here yet...</h3>
                <p className="text-muted-foreground">
                  Active rotas that are currently running are shown here. Create your first rota to get started!
                </p>
              </div>
            </div>
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Create & manage</h3>
                  <p className="text-muted-foreground text-sm">
                    Create, plan and manage rotas all in one place. Add multiple staff to shifts, edit ongoing shifts and get an up-to-date view of who's working when.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Share with employees</h3>
                  <p className="text-muted-foreground text-sm">
                    We'll automatically share published rotas with your staff so they always know when they work.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
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
                    <Badge variant={rota.status === 'published' ? 'default' : 'secondary'}>
                      {rota.status || 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
