import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, Calendar, MapPin, User, Users, Building, 
  CalendarDays, CheckCircle, AlertCircle, FileText, DollarSign,
  ChevronRight
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

  const fetchEmployeeData = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch employee profile and clock-in in parallel
      const [employeeResult, clockInResult] = await Promise.all([
        supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            job_title,
            department,
            manager_id,
            branch:branches(name),
            organization:organizations(name),
            team:teams(name)
          `)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('clock_ins')
          .select('clock_in_time, clock_out_time')
          .eq('user_id', user.id)
          .gte('clock_in_time', `${today}T00:00:00`)
          .lte('clock_in_time', `${today}T23:59:59`)
          .order('clock_in_time', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      setTodayClockIn(clockInResult.data);

      if (employeeResult.data) {
        const employee = employeeResult.data;
        setEmployeeData(employee);

        // Fetch manager and shifts in parallel
        const [managerResult, shiftsResult] = await Promise.all([
          employee.manager_id
            ? supabase
                .from('profiles')
                .select('name')
                .eq('id', employee.manager_id)
                .single()
            : Promise.resolve({ data: null }),
          employee.id
            ? supabase
                .from('rota_shifts')
                .select('shift_date, start_time, end_time, status')
                .eq('employee_id', employee.id)
                .gte('shift_date', today)
                .order('shift_date', { ascending: true })
                .limit(10)
            : Promise.resolve({ data: null })
        ]);

        if (managerResult.data) {
          setManagerName(managerResult.data.name);
        }

        if (shiftsResult.data) {
          const shifts = shiftsResult.data;
          const todayShifts = shifts.filter((s: Shift) => s.shift_date === today);
          const futureShifts = shifts.filter((s: Shift) => s.shift_date !== today);
          setTodaysShifts(todayShifts);
          setUpcomingShifts(futureShifts.slice(0, 5));
        }
      } else {
        // Fallback: fetch from profile if no employee record linked
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, organization_id, branch_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          // Fetch org and branch names in parallel
          const [orgResult, branchResult] = await Promise.all([
            profile.organization_id 
              ? supabase.from('organizations').select('name').eq('id', profile.organization_id).maybeSingle()
              : Promise.resolve({ data: null }),
            profile.branch_id
              ? supabase.from('branches').select('name').eq('id', profile.branch_id).maybeSingle()
              : Promise.resolve({ data: null })
          ]);

          setEmployeeData({
            first_name: profile.name?.split(' ')[0] || '',
            last_name: profile.name?.split(' ').slice(1).join(' ') || '',
            job_title: '',
            department: '',
            manager_id: null,
            branch: branchResult.data ? { name: branchResult.data.name } : null,
            organization: orgResult.data ? { name: orgResult.data.name } : null,
            team: null
          });
        }
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
    }
  }, [user, fetchEmployeeData]);

  const currentDate = useMemo(() => format(new Date(), 'EEEE, dd MMMM yyyy'), []);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      {/* Welcome Header - Mobile Optimized */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome, {employeeData?.first_name || user?.name}!
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">{currentDate}</p>
        </div>
        <Button 
          onClick={() => handleNavigate('/dashboard/clock-ins')}
          className="w-full md:w-auto"
          size="lg"
        >
          <Clock className="h-4 w-4 mr-2" />
          {todayClockIn && !todayClockIn.clock_out_time ? 'Clock Out' : 'Clock In'}
        </Button>
      </div>

      {/* Quick Stats - Mobile Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Today's Status */}
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${
              todayClockIn ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {todayClockIn ? <CheckCircle className="h-5 w-5 md:h-6 md:w-6" /> : <AlertCircle className="h-5 w-5 md:h-6 md:w-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Status</p>
              <p className="text-sm md:text-lg font-semibold truncate">
                {todayClockIn 
                  ? todayClockIn.clock_out_time 
                    ? 'Done' 
                    : 'Working'
                  : 'Not In'
                }
              </p>
              {todayClockIn && (
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  {format(new Date(todayClockIn.clock_in_time), 'HH:mm')}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Location</p>
              <p className="text-sm md:text-lg font-semibold truncate">{employeeData?.branch?.name || '-'}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{employeeData?.organization?.name}</p>
            </div>
          </div>
        </Card>

        {/* Team */}
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Users className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Team</p>
              <p className="text-sm md:text-lg font-semibold truncate">{employeeData?.team?.name || 'N/A'}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{employeeData?.department || '-'}</p>
            </div>
          </div>
        </Card>

        {/* Reporting To */}
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center">
              <User className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Manager</p>
              <p className="text-sm md:text-lg font-semibold truncate">{managerName || 'N/A'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Shifts Section - Mobile Optimized */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Today's Shifts */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-base md:text-lg font-semibold">Today's Shifts</h2>
          </div>
          {todaysShifts.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-muted-foreground">
              <CalendarDays className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No shifts scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {todaysShifts.map((shift, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm md:text-base font-medium">
                      {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <Badge variant={shift.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                    {shift.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Shifts */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-base md:text-lg font-semibold">Upcoming Shifts</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleNavigate('/dashboard/scheduling')} className="text-xs md:text-sm">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          {upcomingShifts.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-muted-foreground">
              <CalendarDays className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming shifts</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {upcomingShifts.map((shift, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm md:text-base font-medium">{format(new Date(shift.shift_date), 'EEE, dd MMM')}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{shift.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <Card className="p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Button 
            variant="outline" 
            className="h-16 md:h-20 flex-col gap-1 md:gap-2 text-xs md:text-sm" 
            onClick={() => handleNavigate('/dashboard/my-profile')}
          >
            <User className="h-4 w-4 md:h-5 md:w-5" />
            <span>My Profile</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-16 md:h-20 flex-col gap-1 md:gap-2 text-xs md:text-sm" 
            onClick={() => handleNavigate('/dashboard/attendance')}
          >
            <Calendar className="h-4 w-4 md:h-5 md:w-5" />
            <span>Request Leave</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-16 md:h-20 flex-col gap-1 md:gap-2 text-xs md:text-sm" 
            onClick={() => handleNavigate('/dashboard/documents')}
          >
            <FileText className="h-4 w-4 md:h-5 md:w-5" />
            <span>My Documents</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-16 md:h-20 flex-col gap-1 md:gap-2 text-xs md:text-sm" 
            onClick={() => handleNavigate('/dashboard/payroll')}
          >
            <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
            <span>Pay Slips</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}