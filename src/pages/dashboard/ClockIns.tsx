import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Search, Clock, User, QrCode, Plus, History, Info, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Location {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius: number | null;
  qr_enabled: boolean | null;
  is_active: boolean | null;
  branch_id: string;
}

interface ClockIn {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_method: string | null;
  location_id: string | null;
  branch_id: string;
  branch?: { name: string; organization_id: string } | null;
  location?: { name: string } | null;
}

// Convert DMS (Degrees Minutes Seconds) to Decimal
const dmsToDecimal = (dms: string): number | null => {
  // Pattern: 8°12'01.2"N or 77°16'43.9"E
  const pattern = /(\d+)°(\d+)'([\d.]+)"([NSEW])/i;
  const match = dms.trim().match(pattern);
  
  if (match) {
    const degrees = parseFloat(match[1]);
    const minutes = parseFloat(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4].toUpperCase();
    
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }
  return null;
};

// Parse coordinates in multiple formats
const parseCoordinate = (input: string): number | null => {
  const trimmed = input.trim();
  
  // Try as decimal first
  const decimal = parseFloat(trimmed);
  if (!isNaN(decimal)) {
    return decimal;
  }
  
  // Try as DMS
  return dmsToDecimal(trimmed);
};

// Format decimal to DMS string
const decimalToDms = (decimal: number, isLat: boolean): string => {
  const direction = isLat 
    ? (decimal >= 0 ? 'N' : 'S') 
    : (decimal >= 0 ? 'E' : 'W');
  
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(1);
  
  return `${degrees}°${minutes}'${seconds}"${direction}`;
};

export default function ClockIns() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [clockIns, setClockIns] = useState<ClockIn[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('locations');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [coordinateFormat, setCoordinateFormat] = useState<'decimal' | 'dms'>('decimal');
  const [activeClockIn, setActiveClockIn] = useState<ClockIn | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [clockAction, setClockAction] = useState<{ type: 'in' | 'out'; locationId?: string } | null>(null);
  
  // History tab filters
  const [historyFilterOrg, setHistoryFilterOrg] = useState('');
  const [historyFilterBranch, setHistoryFilterBranch] = useState('');
  const [historyFilterMonth, setHistoryFilterMonth] = useState(new Date().getMonth().toString());
  const [historyFilterYear, setHistoryFilterYear] = useState(new Date().getFullYear().toString());
  const [clockInProfiles, setClockInProfiles] = useState<Record<string, { name: string; display_name: string | null }>>({});
  
  const canViewFilters = user?.role === 'super_admin' || (user?.role === 'hr' && user?.hrAccessLevel === 'full');
  
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '100',
    organizationId: '',
    branchId: '',
    qrEnabled: true
  });

  useEffect(() => {
    fetchData();
  }, [user?.id, historyFilterMonth, historyFilterYear]);

  // Timer effect for active clock-in
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
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeClockIn]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user's employee record to get their branch_id
      let userBranchId: string | null = null;
      if (user?.role === 'employee') {
        const { data: empData } = await supabase
          .from('employees')
          .select('branch_id')
          .eq('user_id', user.id)
          .maybeSingle();
        userBranchId = empData?.branch_id || null;
      }

      // Build date range for history filter
      const monthStart = new Date(parseInt(historyFilterYear), parseInt(historyFilterMonth), 1);
      const monthEnd = new Date(parseInt(historyFilterYear), parseInt(historyFilterMonth) + 1, 0, 23, 59, 59);

      const [locationsRes, clockInsRes, branchesRes, orgsRes] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.from('clock_ins')
          .select('*, branch:branches(name, organization_id), location:locations(name)')
          .gte('clock_in_time', monthStart.toISOString())
          .lte('clock_in_time', monthEnd.toISOString())
          .order('clock_in_time', { ascending: false }),
        supabase.from('branches').select('*, organizations(name)').order('name'),
        supabase.from('organizations').select('*').order('name')
      ]);

      // Filter locations for employees - they only see their branch's locations
      let filteredLocations = locationsRes.data || [];
      if (user?.role === 'employee' && userBranchId) {
        filteredLocations = filteredLocations.filter(l => l.branch_id === userBranchId);
      }

      setLocations(filteredLocations);
      setBranches(branchesRes.data || []);
      setOrganizations(orgsRes.data || []);

      // Fetch profiles for clock-in users
      if (clockInsRes.data && clockInsRes.data.length > 0) {
        const userIds = [...new Set(clockInsRes.data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name')
          .in('id', userIds);
        
        const profileMap: Record<string, { name: string; display_name: string | null }> = {};
        profiles?.forEach(p => {
          profileMap[p.id] = { name: p.name || '', display_name: p.display_name };
        });
        setClockInProfiles(profileMap);
      }

      setClockIns(clockInsRes.data || []);

      // Find active clock-in for current user (clocked in but not clocked out)
      const activeSession = (clockInsRes.data || []).find(
        (c: ClockIn) => c.user_id === user?.id && !c.clock_out_time
      );
      setActiveClockIn(activeSession || null);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBranches = newLocation.organizationId 
    ? branches.filter(b => b.organization_id === newLocation.organizationId)
    : branches;

  const getCurrentLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setNewLocation(prev => ({
          ...prev,
          latitude: latitude.toFixed(8),
          longitude: longitude.toFixed(8)
        }));
        toast.success('Location captured successfully');
        setGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Location request failed. Please allow location access and enable GPS, then try again.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings and refresh the page.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable. Please check your GPS is enabled.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        toast.error(errorMessage);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCreateLocation = async () => {
    if (!newLocation.name || !newLocation.branchId || !newLocation.latitude || !newLocation.longitude) {
      toast.error('Please fill in all required fields');
      return;
    }

    const lat = parseCoordinate(newLocation.latitude);
    const lng = parseCoordinate(newLocation.longitude);

    if (lat === null || lng === null) {
      toast.error('Invalid coordinate format. Use decimal (e.g., 8.200333) or DMS (e.g., 8°12\'01.2"N)');
      return;
    }

    console.log('Saving coordinates:', { lat, lng });
    
    try {
      const { error } = await supabase.from('locations').insert({
        name: newLocation.name,
        address: newLocation.address || null,
        latitude: parseFloat(lat.toFixed(8)),
        longitude: parseFloat(lng.toFixed(8)),
        radius: parseInt(newLocation.radius),
        branch_id: newLocation.branchId,
        qr_enabled: newLocation.qrEnabled,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success('Location created successfully');
      setShowAddLocation(false);
      setNewLocation({ name: '', address: '', latitude: '', longitude: '', radius: '100', organizationId: '', branchId: '', qrEnabled: true });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create location');
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedLocation) return;

    const lat = parseCoordinate(newLocation.latitude);
    const lng = parseCoordinate(newLocation.longitude);

    if (lat === null || lng === null) {
      toast.error('Invalid coordinate format');
      return;
    }

    console.log('Updating coordinates:', { lat, lng });
    
    try {
      const { error } = await supabase
        .from('locations')
        .update({
          name: newLocation.name,
          address: newLocation.address || null,
          latitude: parseFloat(lat.toFixed(8)),
          longitude: parseFloat(lng.toFixed(8)),
          radius: parseInt(newLocation.radius),
          qr_enabled: newLocation.qrEnabled
        })
        .eq('id', selectedLocation.id);

      if (error) throw error;

      toast.success('Location updated successfully');
      setShowEditLocation(false);
      setSelectedLocation(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update location');
    }
  };

  const openEditDialog = (location: Location) => {
    setSelectedLocation(location);
    const branch = branches.find(b => b.id === location.branch_id);
    setNewLocation({
      name: location.name,
      address: location.address || '',
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: (location.radius || 100).toString(),
      organizationId: branch?.organization_id || '',
      branchId: location.branch_id,
      qrEnabled: location.qr_enabled ?? true
    });
    setShowEditLocation(true);
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete dependent clock-ins first to satisfy FK clock_ins_location_id_fkey
      const { error: clockInsError } = await supabase
        .from('clock_ins')
        .delete()
        .eq('location_id', locationId);

      if (clockInsError) throw clockInsError;

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      toast.success('Location deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete location');
    }
  };

  const handleClockIn = async (locationId: string) => {
    if (!user?.id) {
      toast.error('Please wait for login to finish, then try again.');
      return;
    }

    if (clockAction) return;
    setClockAction({ type: 'in', locationId });

    try {
      // Fetch fresh location data directly from database to ensure we have correct coordinates
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .maybeSingle();

      if (locationError) {
        console.error('Error fetching location:', locationError);
        toast.error('Failed to fetch location data');
        setClockAction(null);
        return;
      }

      if (!locationData) {
        toast.error('Location not found. Please refresh the page.');
        setClockAction(null);
        return;
      }

      console.log('Fresh location from DB:', locationData);

      // Validate location coordinates
      if (
        locationData.latitude == null ||
        locationData.longitude == null ||
        isNaN(Number(locationData.latitude)) ||
        isNaN(Number(locationData.longitude))
      ) {
        console.error('Invalid location coordinates:', locationData);
        toast.error('Location coordinates are not configured properly. Please contact admin.');
        setClockAction(null);
        return;
      }

      // Get current position
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            console.log('User GPS coordinates:', { latitude, longitude });
            console.log('Location coordinates:', {
              lat: locationData.latitude,
              lng: locationData.longitude,
              radius: locationData.radius,
            });

            const distance = calculateDistance(
              latitude,
              longitude,
              Number(locationData.latitude),
              Number(locationData.longitude)
            );
            const radius = locationData.radius || 100;

            console.log('Distance calculation:', { distance, radius, withinRange: distance <= radius });

            if (distance > radius) {
              toast.error(`You are ${Math.round(distance)}m away. Must be within ${radius}m to clock in.`);
              setClockAction(null);
              return;
            }

            const { error } = await supabase.from('clock_ins').insert({
              user_id: user.id,
              branch_id: locationData.branch_id,
              location_id: locationId,
              clock_in_time: new Date().toISOString(),
              clock_in_latitude: latitude,
              clock_in_longitude: longitude,
              clock_in_method: 'gps',
            });

            if (error) throw error;
            toast.success('Clocked in successfully');
            setClockAction(null);
            fetchData();
          } catch (error: any) {
            console.error('Clock in error:', error);
            toast.error(error.message || 'Failed to clock in');
            setClockAction(null);
          }
        },
        (geoError) => {
          let errorMessage = 'Location request failed. Please allow location access and enable GPS, then try again.';
          switch (geoError.code) {
            case geoError.PERMISSION_DENIED:
              errorMessage =
                'Location access denied. Please allow location access in your browser settings and refresh the page.';
              break;
            case geoError.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check your GPS is enabled.';
              break;
            case geoError.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          toast.error(errorMessage);
          setClockAction(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (error: any) {
      console.error('Clock in error:', error);
      toast.error(error.message || 'Failed to clock in');
      setClockAction(null);
    }
  };

  const handleClockOut = async () => {
    if (!activeClockIn) {
      toast.error('No active clock-in session found');
      return;
    }

    if (clockAction) return;
    setClockAction({ type: 'out' });

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
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
            setActiveClockIn(null);
            setClockAction(null);
            fetchData();
          } catch (error: any) {
            toast.error(error.message || 'Failed to clock out');
            setClockAction(null);
          }
        },
        (geoError) => {
          let errorMessage = 'Location request failed. Please allow location access and enable GPS, then try again.';
          switch (geoError.code) {
            case geoError.PERMISSION_DENIED:
              errorMessage =
                'Location access denied. Please allow location access in your browser settings and refresh the page.';
              break;
            case geoError.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check your GPS is enabled.';
              break;
            case geoError.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          toast.error(errorMessage);
          setClockAction(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
      setClockAction(null);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const activeLocations = locations.filter(l => l.is_active);
  const qrLocations = locations.filter(l => l.qr_enabled);
  const todayClockIns = clockIns.filter(c => 
    new Date(c.clock_in_time).toDateString() === new Date().toDateString()
  );

  const renderLocationForm = (isEdit: boolean) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Location Name *</Label>
        <Input 
          value={newLocation.name}
          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
          placeholder="e.g., Main Office - London" 
        />
      </div>
      
      {!isEdit && (
        <>
          <div className="space-y-2">
            <Label>Organization *</Label>
            <Select 
              value={newLocation.organizationId}
              onValueChange={(v) => setNewLocation({ ...newLocation, organizationId: v, branchId: '' })}
            >
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Branch *</Label>
            <Select 
              value={newLocation.branchId}
              onValueChange={(v) => setNewLocation({ ...newLocation, branchId: v })}
              disabled={!newLocation.organizationId}
            >
              <SelectTrigger>
                <SelectValue placeholder={newLocation.organizationId ? "Select branch" : "Select organization first"} />
              </SelectTrigger>
              <SelectContent>
                {filteredBranches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredBranches.length === 0 && newLocation.organizationId && (
              <p className="text-xs text-amber-600">No branches found for this organization</p>
            )}
          </div>
        </>
      )}
      
      <div className="space-y-2">
        <Label>Address</Label>
        <Input 
          value={newLocation.address}
          onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
          placeholder="Full address" 
        />
      </div>
      
      {/* Get Current Location Button */}
      <Button 
        type="button" 
        variant="outline" 
        onClick={getCurrentLocation}
        disabled={gettingLocation}
        className="w-full"
      >
        <MapPin className="h-4 w-4 mr-2" />
        {gettingLocation ? 'Getting Location...' : 'Get My Current Location'}
      </Button>
      
      {/* Coordinate Format Selector */}
      <div className="space-y-2">
        <Label>Coordinate Format</Label>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant={coordinateFormat === 'decimal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCoordinateFormat('decimal')}
          >
            Decimal (e.g., 8.200333)
          </Button>
          <Button 
            type="button"
            variant={coordinateFormat === 'dms' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCoordinateFormat('dms')}
          >
            DMS (e.g., 8°12'01.2"N)
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude *</Label>
          <Input 
            value={newLocation.latitude}
            onChange={(e) => setNewLocation({ ...newLocation, latitude: e.target.value })}
            placeholder={coordinateFormat === 'decimal' ? '8.200333' : '8°12\'01.2"N'} 
          />
        </div>
        <div className="space-y-2">
          <Label>Longitude *</Label>
          <Input 
            value={newLocation.longitude}
            onChange={(e) => setNewLocation({ ...newLocation, longitude: e.target.value })}
            placeholder={coordinateFormat === 'decimal' ? '77.278861' : '77°16\'43.9"E'} 
          />
        </div>
      </div>
      
      <Card className="p-3 border-blue-200 bg-blue-50">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-medium">Supported Formats:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Decimal: 8.200333, 77.278861</li>
              <li>DMS: 8°12'01.2"N, 77°16'43.9"E</li>
            </ul>
          </div>
        </div>
      </Card>
      
      <div className="space-y-2">
        <Label>Geofence Radius (meters)</Label>
        <Input 
          type="number"
          value={newLocation.radius}
          onChange={(e) => setNewLocation({ ...newLocation, radius: e.target.value })}
          placeholder="100" 
        />
        <p className="text-xs text-muted-foreground">
          Employees must be within this distance to clock in
        </p>
      </div>
      <Button onClick={isEdit ? handleUpdateLocation : handleCreateLocation} className="w-full">
        {isEdit ? 'Update Location' : 'Create Location'}
      </Button>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Clock-ins & Locations</h2>
          <p className="text-muted-foreground mt-1">Manage employee check-in locations and geofencing</p>
        </div>
        
        {user?.role === 'super_admin' && (
          <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Location</DialogTitle>
              </DialogHeader>
              {renderLocationForm(false)}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={showEditLocation} onOpenChange={setShowEditLocation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          {renderLocationForm(true)}
        </DialogContent>
      </Dialog>

      {/* Active Session Card */}
      {activeClockIn && (
        <Card className="p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <Clock className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Currently Working</p>
                <p className="text-3xl font-bold text-foreground font-mono">{elapsedTime}</p>
                <p className="text-xs text-muted-foreground">
                  Started at {format(new Date(activeClockIn.clock_in_time), 'HH:mm')}
                </p>
              </div>
            </div>
            <Button 
              size="lg" 
              variant="destructive" 
              onClick={handleClockOut}
              className="gap-2"
            >
              <Clock className="h-5 w-5" />
              Clock Out
            </Button>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeLocations.length}</p>
              <p className="text-xs text-muted-foreground">Active Locations</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{clockIns.length}</p>
              <p className="text-xs text-muted-foreground">Total Clock-ins</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{todayClockIns.length}</p>
              <p className="text-xs text-muted-foreground">Clocked In Today</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{branches.length}</p>
              <p className="text-xs text-muted-foreground">Branches</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search locations..." 
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Clock-in History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : locations.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No locations configured</h3>
                  <p className="text-muted-foreground mb-4">Add your first location to enable employee clock-ins</p>
                </div>
                {user?.role === 'super_admin' && (
                  <Button onClick={() => setShowAddLocation(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add First Location
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).map(location => (
                <Card key={location.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">{location.address || 'No address'}</p>
                    </div>
                    {location.qr_enabled && (
                      <Badge variant="secondary" className="gap-1">
                        <QrCode className="h-3 w-3" />
                        QR
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>Radius: {location.radius || 100}m</p>
                    <p className="text-xs">
                      Decimal: {location.latitude}, {location.longitude}
                    </p>
                    <p className="text-xs">
                      DMS: {decimalToDms(location.latitude, true)}, {decimalToDms(location.longitude, false)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {activeClockIn && activeClockIn.location_id === location.id ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        disabled={!!clockAction}
                        onClick={handleClockOut}
                      >
                        <Clock className={`h-4 w-4 mr-2 ${clockAction?.type === 'out' ? 'animate-spin' : ''}`} />
                        {clockAction?.type === 'out' ? 'Clocking Out…' : 'Clock Out'}
                      </Button>
                    ) : activeClockIn ? (
                      <Button size="sm" className="flex-1" disabled variant="outline">
                        <Clock className="h-4 w-4 mr-2" />
                        Active
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={!!clockAction}
                        onClick={() => handleClockIn(location.id)}
                      >
                        <Clock
                          className={`h-4 w-4 mr-2 ${
                            clockAction?.type === 'in' && clockAction.locationId === location.id ? 'animate-spin' : ''
                          }`}
                        />
                        {clockAction?.type === 'in' && clockAction.locationId === location.id
                          ? 'Clocking In…'
                          : 'Clock In'}
                      </Button>
                    )}
                    {user?.role === 'super_admin' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(location)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDeleteLocation(location.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-4">
          {/* History Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by employee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {canViewFilters && (
                <>
                  <Select value={historyFilterOrg} onValueChange={(v) => { setHistoryFilterOrg(v); setHistoryFilterBranch(''); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Organizations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={historyFilterBranch} onValueChange={setHistoryFilterBranch}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches
                        .filter(b => !historyFilterOrg || historyFilterOrg === 'all' || b.organization_id === historyFilterOrg)
                        .map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              
              <Select value={historyFilterMonth} onValueChange={setHistoryFilterMonth}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {new Date(2025, i).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={historyFilterYear} onValueChange={setHistoryFilterYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() + i - 2;
                    return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </Card>
          
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Filter clock-ins based on filters
                  let filtered = clockIns;
                  
                  // Apply org filter
                  if (historyFilterOrg && historyFilterOrg !== 'all') {
                    filtered = filtered.filter(c => c.branch?.organization_id === historyFilterOrg);
                  }
                  
                  // Apply branch filter
                  if (historyFilterBranch && historyFilterBranch !== 'all') {
                    filtered = filtered.filter(c => c.branch_id === historyFilterBranch);
                  }
                  
                  // Apply search
                  if (searchQuery) {
                    filtered = filtered.filter(c => {
                      const profile = clockInProfiles[c.user_id];
                      const name = profile?.display_name || profile?.name || '';
                      return name.toLowerCase().includes(searchQuery.toLowerCase());
                    });
                  }
                  
                  if (filtered.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No clock-in records found for {new Date(parseInt(historyFilterYear), parseInt(historyFilterMonth)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return filtered.map(clockIn => {
                    const profile = clockInProfiles[clockIn.user_id];
                    const employeeName = profile?.display_name || profile?.name || 'Unknown';
                    
                    // Calculate duration
                    let duration = '-';
                    if (clockIn.clock_out_time) {
                      const diffMs = new Date(clockIn.clock_out_time).getTime() - new Date(clockIn.clock_in_time).getTime();
                      const hours = Math.floor(diffMs / (1000 * 60 * 60));
                      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      duration = `${hours}h ${mins}m`;
                    }
                    
                    return (
                      <TableRow key={clockIn.id}>
                        <TableCell className="font-medium">{employeeName}</TableCell>
                        <TableCell>{clockIn.branch?.name || '-'}</TableCell>
                        <TableCell>{clockIn.location?.name || '-'}</TableCell>
                        <TableCell>{format(new Date(clockIn.clock_in_time), 'dd MMM yyyy, HH:mm')}</TableCell>
                        <TableCell>
                          {clockIn.clock_out_time 
                            ? format(new Date(clockIn.clock_out_time), 'dd MMM yyyy, HH:mm')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>{duration}</TableCell>
                        <TableCell>
                          <Badge variant={clockIn.clock_out_time ? 'secondary' : 'default'}>
                            {clockIn.clock_out_time ? 'Completed' : 'Active'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}