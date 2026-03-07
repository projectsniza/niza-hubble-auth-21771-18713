import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Calendar,
  MapPin,
  User,
  Users,
  CalendarDays,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  ChevronRight,
  Loader2,
  Navigation,
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface EmployeeData {
  id?: string;
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  branch_id?: string;
  branch: { name: string } | null;
  organization: { name: string } | null;
  team: { name: string } | null;
  manager_id: string | null;
}

interface ClockInRecord {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  location_id: string | null;
  location?: { name: string } | null;
}

interface Shift {
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface EmployeeLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius: number | null;
  branch_id: string;
  is_active: boolean | null;
}

const getTodayLocal = () => format(new Date(), 'yyyy-MM-dd');

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 0,
};

const MIN_ACCEPTABLE_ACCURACY_METERS = 250;
const BEST_GPS_ACCURACY_METERS = 80;
const GEOLOCATION_WATCH_WINDOW_MS = 12000;
const MISCONFIGURED_PIN_DISTANCE_METERS = 500000;

const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const getGeolocationErrorMessage = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access denied. Please allow location access in your browser settings and refresh the page.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information unavailable. Please check your GPS is enabled.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'Location request failed. Please allow location access and enable GPS, then try again.';
  }
};

const getPositionOnce = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
  });

const getReliablePosition = async (
  target?: { latitude: number; longitude: number }
): Promise<GeolocationPosition> => {
  const scorePosition = (position: GeolocationPosition) => {
    const accuracyPenalty = Math.min(position.coords.accuracy, 1500);
    if (!target) return accuracyPenalty;

    const distancePenalty = calculateDistanceMeters(
      position.coords.latitude,
      position.coords.longitude,
      target.latitude,
      target.longitude
    );

    return distancePenalty + accuracyPenalty;
  };

  const first = await getPositionOnce();
  if (first.coords.accuracy <= BEST_GPS_ACCURACY_METERS) {
    return first;
  }

  return await new Promise<GeolocationPosition>((resolve) => {
    let bestPosition = first;
    let settled = false;
    let watchId: number | null = null;
    let timeoutId: number | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      resolve(bestPosition);
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (scorePosition(position) < scorePosition(bestPosition)) {
          bestPosition = position;
        }

        const bestDistance = target
          ? calculateDistanceMeters(
              bestPosition.coords.latitude,
              bestPosition.coords.longitude,
              target.latitude,
              target.longitude
            )
          : 0;

        if (
          bestPosition.coords.accuracy <= BEST_GPS_ACCURACY_METERS &&
          (!target || bestDistance <= Math.max(MIN_ACCEPTABLE_ACCURACY_METERS, 300))
        ) {
          finish();
        }
      },
      () => finish(),
      GEOLOCATION_OPTIONS
    );

    timeoutId = window.setTimeout(finish, GEOLOCATION_WATCH_WINDOW_MS);
  });
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [todayClockIn, setTodayClockIn] = useState<ClockInRecord | null>(null);
  const [activeClockIn, setActiveClockIn] = useState<ClockInRecord | null>(null);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [todaysShifts, setTodaysShifts] = useState<Shift[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [managerName, setManagerName] = useState<string>('');
  const [clockAction, setClockAction] = useState<'in' | 'out' | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [lastClockIssue, setLastClockIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployeeData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const today = getTodayLocal();

      const [employeeResult, clockInResult, activeClockInResult] = await Promise.all([
        supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            job_title,
            department,
            manager_id,
            branch_id,
            branch:branches(name),
            organization:organizations(name),
            team:teams(name)
          `)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('clock_ins')
          .select('id, clock_in_time, clock_out_time, location_id, location:locations(name)')
          .eq('user_id', user.id)
          .gte('clock_in_time', `${today}T00:00:00`)
          .lte('clock_in_time', `${today}T23:59:59`)
          .order('clock_in_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('clock_ins')
          .select('id, clock_in_time, clock_out_time, location_id, location:locations(name)')
          .eq('user_id', user.id)
          .is('clock_out_time', null)
          .order('clock_in_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setTodayClockIn((clockInResult.data as ClockInRecord | null) ?? null);
      setActiveClockIn((activeClockInResult.data as ClockInRecord | null) ?? null);

      let employeeRow = employeeResult.data;

      if (!employeeRow) {
        await supabase.rpc('link_my_employee_record');
        const { data: retryEmployee } = await supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            job_title,
            department,
            manager_id,
            branch_id,
            branch:branches(name),
            organization:organizations(name),
            team:teams(name)
          `)
          .eq('user_id', user.id)
          .maybeSingle();
        employeeRow = retryEmployee;
      }

      if (employeeRow) {
        const employee = employeeRow as unknown as EmployeeData;
        setEmployeeData(employee);

        if (employee.branch_id) {
          const { data: locationRows } = await supabase
            .from('locations')
            .select('id, name, address, latitude, longitude, radius, branch_id, is_active')
            .eq('branch_id', employee.branch_id)
            .eq('is_active', true)
            .order('name');

          const normalizedLocations: EmployeeLocation[] = (locationRows || [])
            .filter((location) => location.latitude != null && location.longitude != null)
            .map((location) => ({
              ...location,
              latitude: Number(location.latitude),
              longitude: Number(location.longitude),
            }));

          setEmployeeLocations(normalizedLocations);
        } else {
          setEmployeeLocations([]);
        }

        if (employee.manager_id) {
          const { data: manager, error: managerError } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', employee.manager_id)
            .maybeSingle();

          if (!managerError && manager?.name) {
            setManagerName(manager.name);
          }
        } else {
          setManagerName('');
        }

        if (employee.id) {
          const { data: rotaShifts } = await supabase
            .from('rota_shifts')
            .select('shift_date, start_time, end_time, status')
            .eq('employee_id', employee.id)
            .gte('shift_date', today)
            .order('shift_date', { ascending: true })
            .limit(10);

          let shifts: Shift[] = (rotaShifts as any) || [];

          if (!shifts || shifts.length === 0) {
            const { data: tsIdsRows } = await supabase
              .from('timesheets')
              .select('id')
              .eq('employee_id', employee.id)
              .gte('week_end_date', today)
              .limit(12);

            const tsIds = (tsIdsRows || []).map((r) => r.id);

            if (tsIds.length > 0) {
              const { data: tsEntries } = await supabase
                .from('timesheet_entries')
                .select('entry_date, shift_start_time, shift_end_time')
                .in('timesheet_id', tsIds)
                .gte('entry_date', today)
                .not('shift_start_time', 'is', null)
                .not('shift_end_time', 'is', null)
                .order('entry_date', { ascending: true })
                .limit(10);

              shifts = (tsEntries || []).map((entry: any) => ({
                shift_date: entry.entry_date,
                start_time: entry.shift_start_time,
                end_time: entry.shift_end_time,
                status: 'scheduled',
              }));
            }
          }

          const todayShifts = (shifts || []).filter((shift: Shift) => shift.shift_date === today);
          const futureShifts = (shifts || []).filter((shift: Shift) => shift.shift_date !== today);
          setTodaysShifts(todayShifts);
          setUpcomingShifts(futureShifts.slice(0, 5));
        }
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, organization_id, branch_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          const [orgResult, branchResult] = await Promise.all([
            profile.organization_id
              ? supabase.from('organizations').select('name').eq('id', profile.organization_id).maybeSingle()
              : Promise.resolve({ data: null }),
            profile.branch_id
              ? supabase.from('branches').select('name').eq('id', profile.branch_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

          setEmployeeData({
            first_name: profile.name?.split(' ')[0] || '',
            last_name: profile.name?.split(' ').slice(1).join(' ') || '',
            job_title: '',
            department: '',
            manager_id: null,
            branch_id: profile.branch_id || undefined,
            branch: branchResult.data ? { name: branchResult.data.name } : null,
            organization: orgResult.data ? { name: orgResult.data.name } : null,
            team: null,
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

  useEffect(() => {
    if (!activeClockIn) {
      setElapsedTime('00:00:00');
      return;
    }

    const updateTimer = () => {
      const start = new Date(activeClockIn.clock_in_time).getTime();
      const now = Date.now();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeClockIn]);

  const currentDate = useMemo(() => format(new Date(), 'EEEE, dd MMMM yyyy'), []);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const handleEmployeeClockIn = useCallback(async () => {
    if (!user?.id) {
      toast.error('Please wait for login to finish, then try again.');
      return;
    }

    if (clockAction || activeClockIn) return;

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    const locationCandidates = employeeLocations.filter(
      (location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    );

    if (locationCandidates.length === 0) {
      toast.error('No active branch location is configured. Please contact your manager.');
      return;
    }

    setClockAction('in');
    setLastClockIssue(null);

    try {
      const position = await getReliablePosition();
      const { latitude, longitude, accuracy } = position.coords;

      let nearest = locationCandidates[0];
      let nearestDistance = calculateDistanceMeters(
        latitude,
        longitude,
        locationCandidates[0].latitude,
        locationCandidates[0].longitude
      );

      for (const candidate of locationCandidates.slice(1)) {
        const candidateDistance = calculateDistanceMeters(
          latitude,
          longitude,
          candidate.latitude,
          candidate.longitude
        );

        if (candidateDistance < nearestDistance) {
          nearest = candidate;
          nearestDistance = candidateDistance;
        }
      }

      const radius = nearest.radius || 100;

      if (accuracy > Math.max(radius * 2, MIN_ACCEPTABLE_ACCURACY_METERS)) {
        throw new Error(`GPS accuracy is too low (±${Math.round(accuracy)}m). Please move outdoors and try again.`);
      }

      const allowMisconfiguredPinOverride =
        nearestDistance > MISCONFIGURED_PIN_DISTANCE_METERS &&
        accuracy <= BEST_GPS_ACCURACY_METERS &&
        locationCandidates.length === 1;

      if (nearestDistance > radius && !allowMisconfiguredPinOverride) {
        const message = `You are ${Math.round(nearestDistance)}m away from ${nearest.name}. Must be within ${radius}m to clock in.`;
        setLastClockIssue(message);
        toast.error(message);
        setClockAction(null);
        return;
      }

      if (allowMisconfiguredPinOverride) {
        toast.warning('Store pin looks misconfigured. Clock-in allowed using verified GPS; ask manager to update store coordinates.');
      }

      const { error } = await supabase.from('clock_ins').insert({
        user_id: user.id,
        branch_id: nearest.branch_id,
        location_id: nearest.id,
        clock_in_time: new Date().toISOString(),
        clock_in_latitude: latitude,
        clock_in_longitude: longitude,
        clock_in_method: 'gps',
      });

      if (error) throw error;

      toast.success(`Clocked in at ${nearest.name}`);
      await fetchEmployeeData();
    } catch (error: any) {
      const message =
        typeof error?.code === 'number'
          ? getGeolocationErrorMessage(error as GeolocationPositionError)
          : error?.message || 'Failed to clock in';

      setLastClockIssue(message);
      toast.error(message);
    } finally {
      setClockAction(null);
    }
  }, [user?.id, clockAction, activeClockIn, employeeLocations, fetchEmployeeData]);

  const handleEmployeeClockOut = useCallback(async () => {
    if (!activeClockIn || clockAction) return;

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setClockAction('out');

    try {
      const position = await getReliablePosition();
      const { latitude, longitude } = position.coords;

      const { error } = await supabase
        .from('clock_ins')
        .update({
          clock_out_time: new Date().toISOString(),
          clock_out_latitude: latitude,
          clock_out_longitude: longitude,
        })
        .eq('id', activeClockIn.id);

      if (error) throw error;

      toast.success('Clocked out successfully');
      await fetchEmployeeData();
    } catch (error: any) {
      const message =
        typeof error?.code === 'number'
          ? getGeolocationErrorMessage(error as GeolocationPositionError)
          : error?.message || 'Failed to clock out';

      setLastClockIssue(message);
      toast.error(message);
    } finally {
      setClockAction(null);
    }
  }, [activeClockIn, clockAction, fetchEmployeeData]);

  const statusLabel = activeClockIn
    ? 'Working'
    : todayClockIn?.clock_out_time
      ? 'Done'
      : 'Not In';

  const statusVariant = activeClockIn ? 'default' : todayClockIn?.clock_out_time ? 'secondary' : 'outline';

  const currentLocationLabel =
    activeClockIn?.location?.name || employeeLocations[0]?.name || employeeData?.branch?.name || 'No location assigned';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-background via-muted/25 to-primary/10 p-4 md:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-36 w-36 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative space-y-4 md:space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Welcome, {employeeData?.first_name || user?.name}!
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">{currentDate}</p>
            </div>
            <Badge variant={statusVariant} className="w-fit text-xs md:text-sm">
              {statusLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            <div className="rounded-xl border border-border/60 bg-card/70 p-3 md:p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Clock In</p>
              <p className="mt-1 text-sm md:text-base font-semibold text-foreground">
                {activeClockIn ? 'Shift in progress' : 'Ready to start'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeClockIn
                  ? `Started at ${format(new Date(activeClockIn.clock_in_time), 'HH:mm')}`
                  : 'No navigation needed — use the button below'}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/70 p-3 md:p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
              <p className="mt-1 text-sm md:text-base font-semibold text-foreground truncate">{currentLocationLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {employeeLocations.length > 1
                  ? 'Nearest assigned location will be used automatically'
                  : employeeData?.organization?.name || 'Assigned branch'}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/70 p-3 md:p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-1 text-sm md:text-base font-semibold text-foreground">
                {activeClockIn ? 'On Shift' : statusLabel}
              </p>
              <p className="mt-1 text-xs font-mono text-muted-foreground">{activeClockIn ? elapsedTime : '00:00:00'}</p>
            </div>
          </div>

          {lastClockIssue && (
            <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-xs md:text-sm text-foreground">{lastClockIssue}</p>
            </div>
          )}

          <Button
            onClick={activeClockIn ? handleEmployeeClockOut : handleEmployeeClockIn}
            size="lg"
            className="w-full md:w-auto"
            disabled={!!clockAction}
          >
            {clockAction ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : activeClockIn ? (
              <Clock className="h-4 w-4 mr-2" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            {clockAction === 'in'
              ? 'Clocking In…'
              : clockAction === 'out'
                ? 'Clocking Out…'
                : activeClockIn
                  ? 'Clock Out'
                  : 'Clock In'}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {activeClockIn ? <CheckCircle className="h-5 w-5 md:h-6 md:w-6" /> : <AlertCircle className="h-5 w-5 md:h-6 md:w-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Status</p>
              <p className="text-sm md:text-lg font-semibold truncate">{statusLabel}</p>
              {todayClockIn && (
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  {format(new Date(todayClockIn.clock_in_time), 'HH:mm')}
                </p>
              )}
            </div>
          </div>
        </Card>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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
                  <Badge variant="outline" className="text-xs">
                    {shift.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

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
