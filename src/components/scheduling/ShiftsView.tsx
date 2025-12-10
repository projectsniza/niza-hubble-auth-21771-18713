import { useState, useEffect } from 'react';
import { Calendar, Users, Monitor } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_duration: number | null;
  status: string | null;
  notes: string | null;
  employee_response: string | null;
  employee?: { first_name: string; last_name: string };
  rota?: { name: string };
}

export function ShiftsView() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShiftsFor, setShowShiftsFor] = useState<'everyone' | 'me'>('everyone');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({
    start: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
    end: format(endOfWeek(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchShifts();
  }, [showShiftsFor, dateRange]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('rota_shifts')
        .select(`
          *,
          employee:employees(first_name, last_name),
          rota:rotas(name)
        `)
        .gte('shift_date', dateRange.start)
        .lte('shift_date', dateRange.end)
        .order('shift_date', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShifts = shifts.filter(s => {
    const employeeName = `${s.employee?.first_name || ''} ${s.employee?.last_name || ''}`.toLowerCase();
    const rotaName = s.rota?.name?.toLowerCase() || '';
    return employeeName.includes(searchQuery.toLowerCase()) || rotaName.includes(searchQuery.toLowerCase());
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
      <div>
        <h2 className="text-2xl font-bold">Shifts</h2>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 flex-1">
            <Input 
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="max-w-xs"
            />
            <Input 
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="max-w-xs"
            />
            <Input 
              placeholder="Search by name or rota..." 
              className="max-w-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="ghost" className="text-primary" onClick={() => {
              setSearchQuery('');
              setDateRange({
                start: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
                end: format(endOfWeek(new Date()), 'yyyy-MM-dd')
              });
            }}>
              Clear all filters
            </Button>
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-muted-foreground mr-2">Show shifts for</span>
            <Button
              variant={showShiftsFor === 'everyone' ? 'default' : 'outline'}
              onClick={() => setShowShiftsFor('everyone')}
              size="sm"
            >
              Everyone
            </Button>
            <Button
              variant={showShiftsFor === 'me' ? 'default' : 'outline'}
              onClick={() => setShowShiftsFor('me')}
              size="sm"
            >
              Me
            </Button>
          </div>
        </div>
      </Card>

      {filteredShifts.length === 0 ? (
        <>
          <Card className="p-12 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-center mb-6">
                <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-16 h-16 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">No shifts to see here yet...</h3>
              <p className="text-muted-foreground">
                All your upcoming shifts will appear here once you create your first rota.
              </p>
            </div>
          </Card>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Create & manage</h3>
                  <p className="text-muted-foreground text-sm">
                    Create, plan and manage rotas all in one place.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Share with employees</h3>
                  <p className="text-muted-foreground text-sm">
                    We'll automatically share published rotas with your staff.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Monitor className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Everything in one place</h3>
                  <p className="text-muted-foreground text-sm">
                    No need to use different tools to keep track of rotas.
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
                <TableHead>Employee</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShifts.map(shift => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">
                    {shift.employee?.first_name} {shift.employee?.last_name}
                  </TableCell>
                  <TableCell>{shift.rota?.name || 'N/A'}</TableCell>
                  <TableCell>{format(new Date(shift.shift_date), 'EEE dd MMM')}</TableCell>
                  <TableCell>{shift.start_time}</TableCell>
                  <TableCell>{shift.end_time}</TableCell>
                  <TableCell>{shift.break_duration ? `${shift.break_duration} min` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={
                      shift.employee_response === 'accepted' ? 'default' : 
                      shift.employee_response === 'declined' ? 'destructive' : 
                      'secondary'
                    }>
                      {shift.employee_response || 'pending'}
                    </Badge>
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
