import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimesheetView } from '@/components/scheduling/TimesheetView';
import { HolidayBalance } from '@/components/scheduling/HolidayBalance';
import { MonthlyLockStatus } from '@/components/scheduling/MonthlyLockStatus';
import { BranchHourTargets } from '@/components/scheduling/BranchHourTargets';
import { SchedulingReports } from '@/components/scheduling/reports/SchedulingReports';
import { MonthlyHoursPanel } from '@/components/scheduling/MonthlyHoursPanel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, CalendarDays } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
  rota?: { name: string } | null;
}

const getTodayLocal = () => format(new Date(), 'yyyy-MM-dd');

export default function Scheduling() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('timesheets');
  const [employeeShifts, setEmployeeShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'employee') {
      fetchEmployeeShifts();
    }
  }, [user]);

  const fetchEmployeeShifts = async () => {
    setLoading(true);
    try {
      let { data: empRecord } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!empRecord) {
        // Attempt to auto-link the employee record (server-side) then retry
        await supabase.rpc('link_my_employee_record');
        const retry = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user?.id)
          .maybeSingle();
        empRecord = retry.data || null;
      }

      if (!empRecord) {
        setEmployeeShifts([]);
        return;
      }

      const today = getTodayLocal();

      // Primary source: rota_shifts (when using rota scheduling)
      const { data: rotaShifts } = await supabase
        .from('rota_shifts')
        .select('id, shift_date, start_time, end_time, status, rota:rotas(name)')
        .eq('employee_id', empRecord.id)
        .gte('shift_date', today)
        .order('shift_date', { ascending: true })
        .limit(20);

      if (rotaShifts && rotaShifts.length > 0) {
        setEmployeeShifts(rotaShifts as any);
        return;
      }

      // Fallback source: timesheet_entries (when shifts are entered in Timesheets)
      const { data: tsIdsRows, error: tsIdsError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('employee_id', empRecord.id)
        .gte('week_end_date', today)
        .limit(12);

      if (tsIdsError) throw tsIdsError;

      const tsIds = (tsIdsRows || []).map(r => r.id);
      if (tsIds.length === 0) {
        setEmployeeShifts([]);
        return;
      }

      const { data: tsEntries, error: tsEntriesError } = await supabase
        .from('timesheet_entries')
        .select('id, entry_date, shift_start_time, shift_end_time')
        .in('timesheet_id', tsIds)
        .gte('entry_date', today)
        .not('shift_start_time', 'is', null)
        .not('shift_end_time', 'is', null)
        .order('entry_date', { ascending: true })
        .limit(20);

      if (tsEntriesError) throw tsEntriesError;

      const mapped: Shift[] = (tsEntries || []).map((e: any) => ({
        id: e.id,
        shift_date: e.entry_date,
        start_time: e.shift_start_time,
        end_time: e.shift_end_time,
        status: 'scheduled',
        rota: null,
      }));

      setEmployeeShifts(mapped);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Employee View - show their schedule and timesheets
  if (user?.role === 'employee') {
    const todayStr = getTodayLocal();
    const todayShifts = employeeShifts.filter(s => s.shift_date === todayStr);
    const upcomingShifts = employeeShifts.filter(s => s.shift_date !== todayStr);

    return (
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">My Schedule</h1>
          <p className="text-sm md:text-base text-muted-foreground">View your shifts and holiday balance</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <NizaLoaderInline />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Today's Shifts</h2>
              </div>
              {todayShifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No shifts scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayShifts.map(shift => (
                    <div key={shift.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}</p>
                        {shift.rota?.name && <p className="text-sm text-muted-foreground">{shift.rota.name}</p>}
                      </div>
                      <Badge variant={shift.status === 'completed' ? 'default' : 'secondary'}>
                        {shift.status || 'Scheduled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Upcoming Shifts</h2>
              </div>
              {upcomingShifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No upcoming shifts scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingShifts.map(shift => (
                    <div key={shift.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{format(new Date(shift.shift_date), 'EEE, dd MMM yyyy')}</p>
                        <p className="text-sm text-muted-foreground">
                          {shift.start_time?.slice(0,5)} - {shift.end_time?.slice(0,5)}
                          {shift.rota?.name && ` • ${shift.rota.name}`}
                        </p>
                      </div>
                      <Badge variant="outline">{shift.status || 'Scheduled'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Admin/HR/Manager View - Full timesheet system
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Timesheets & Holiday</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Track worked hours and monitor holiday balances
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6">
          <TabsTrigger value="timesheets" className="flex-1 min-w-[100px] text-xs md:text-sm">Weekly Timesheets</TabsTrigger>
          <TabsTrigger value="holiday" className="flex-1 min-w-[100px] text-xs md:text-sm">Holiday Balance</TabsTrigger>
          {user?.role === 'super_admin' && (
            <>
              <TabsTrigger value="targets" className="flex-1 min-w-[100px] text-xs md:text-sm">Hour Targets</TabsTrigger>
              <TabsTrigger value="lockstatus" className="flex-1 min-w-[100px] text-xs md:text-sm">Lock Status</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="timesheets" className="mt-0">
          <TimesheetView />
        </TabsContent>

        <TabsContent value="holiday" className="mt-0">
          <HolidayBalance />
        </TabsContent>

        {user?.role === 'super_admin' && (
          <>
            <TabsContent value="targets" className="mt-0">
              <BranchHourTargets />
            </TabsContent>
            <TabsContent value="lockstatus" className="mt-0">
              <MonthlyLockStatus />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
