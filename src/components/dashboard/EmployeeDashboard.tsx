import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, Calendar, MapPin, User, Users, Building, 
  CalendarDays, CheckCircle, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface EmployeeData {
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  branch: { name: string } | null;
  organization: { name: string } | null;
  team: { name: string } | null;
  manager_id: string | null;
}

interface ClockIn {
  clock_in_time: string;
  clock_out_time: string | null;
}

interface Shift {
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [todayClockIn, setTodayClockIn] = useState<ClockIn | null>(null);
  const [todaysShifts, setTodaysShifts] = useState<Shift[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [managerName, setManagerName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
    }
  }, [user]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      // Fetch employee profile
      const { data: employee } = await supabase
        .from('employees')
        .select(`
          first_name,
          last_name,
          job_title,
          department,
          manager_id,
          branch:branches(name),
          organization:organizations(name),
          team:teams(name)
        `)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (employee) {
        setEmployeeData(employee);

        // Fetch manager name if exists
        if (employee.manager_id) {
          const { data: manager } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', employee.manager_id)
            .single();
          if (manager) setManagerName(manager.name);
        }
      }

      // Fetch today's clock-in
      const today = new Date().toISOString().split('T')[0];
      const { data: clockIn } = await supabase
        .from('clock_ins')
        .select('clock_in_time, clock_out_time')
        .eq('user_id', user?.id)
        .gte('clock_in_time', `${today}T00:00:00`)
        .lte('clock_in_time', `${today}T23:59:59`)
        .order('clock_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTodayClockIn(clockIn);

      // Fetch today's and upcoming shifts
      const { data: shifts } = await supabase
        .from('rota_shifts')
        .select('shift_date, start_time, end_time, status')
        .eq('employee_id', user?.id)
        .gte('shift_date', today)
        .order('shift_date', { ascending: true })
        .limit(10);

      if (shifts) {
        const todayShifts = shifts.filter(s => s.shift_date === today);
        const futureShifts = shifts.filter(s => s.shift_date !== today);
        setTodaysShifts(todayShifts);
        setUpcomingShifts(futureShifts.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentDate = format(new Date(), 'EEEE, dd MMMM yyyy');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, {employeeData?.first_name || user?.name}!
          </h1>
          <p className="text-muted-foreground">{currentDate}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/dashboard/clock-ins')}>
            <Clock className="h-4 w-4 mr-2" />
            {todayClockIn && !todayClockIn.clock_out_time ? 'Clock Out' : 'Clock In'}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Status */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              todayClockIn ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {todayClockIn ? <CheckCircle className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Status</p>
              <p className="text-lg font-semibold">
                {todayClockIn 
                  ? todayClockIn.clock_out_time 
                    ? 'Clocked Out' 
                    : 'Working'
                  : 'Not Clocked In'
                }
              </p>
              {todayClockIn && (
                <p className="text-xs text-muted-foreground">
                  In: {format(new Date(todayClockIn.clock_in_time), 'HH:mm')}
                  {todayClockIn.clock_out_time && 
                    ` • Out: ${format(new Date(todayClockIn.clock_out_time), 'HH:mm')}`
                  }
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-lg font-semibold">{employeeData?.branch?.name || '-'}</p>
              <p className="text-xs text-muted-foreground">{employeeData?.organization?.name}</p>
            </div>
          </div>
        </Card>

        {/* Team */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Team</p>
              <p className="text-lg font-semibold">{employeeData?.team?.name || 'Not Assigned'}</p>
              <p className="text-xs text-muted-foreground">{employeeData?.department || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Reporting To */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 text-secondary-foreground flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reporting To</p>
              <p className="text-lg font-semibold">{managerName || 'Not Assigned'}</p>
              <p className="text-xs text-muted-foreground">Manager</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Shifts */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Today's Shifts</h2>
          </div>
          {todaysShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No shifts scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysShifts.map((shift, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <Badge variant={shift.status === 'completed' ? 'default' : 'secondary'}>
                    {shift.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Shifts */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Upcoming Shifts</h2>
            </div>
            <Button variant="link" size="sm" onClick={() => navigate('/dashboard/scheduling')}>
              View All
            </Button>
          </div>
          {upcomingShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No upcoming shifts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingShifts.map((shift, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{format(new Date(shift.shift_date), 'EEE, dd MMM')}</p>
                    <p className="text-sm text-muted-foreground">
                      {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <Badge variant="outline">{shift.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/dashboard/my-profile')}>
            <User className="h-5 w-5" />
            <span>My Profile</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/dashboard/my-leave')}>
            <Calendar className="h-5 w-5" />
            <span>Request Leave</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/dashboard/documents')}>
            <Building className="h-5 w-5" />
            <span>My Documents</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2" onClick={() => navigate('/dashboard/payroll')}>
            <Clock className="h-5 w-5" />
            <span>Pay Slips</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
