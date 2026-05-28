import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, CalendarDays, Layers, Loader2, Clock } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { refreshTimeIncrement } from '@/hooks/useTimeIncrement';

type RotaView = 'table' | 'timeline' | 'drag-drop';

interface RotaSettingsData {
  id?: string;
  default_view: string;
  restricted_permissions: boolean;
  hide_shift_labels: boolean;
  accept_decline_enabled: boolean;
  open_shifts_enabled: boolean;
  time_increment_minutes: number;
}

export function RotaSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RotaSettingsData>({
    default_view: 'table',
    restricted_permissions: false,
    hide_shift_labels: false,
    accept_decline_enabled: false,
    open_shifts_enabled: false,
    time_increment_minutes: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rota_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching rota settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        default_view: settings.default_view,
        restricted_permissions: settings.restricted_permissions,
        hide_shift_labels: settings.hide_shift_labels,
        accept_decline_enabled: settings.accept_decline_enabled,
        open_shifts_enabled: settings.open_shifts_enabled,
        time_increment_minutes: settings.time_increment_minutes,
      };
      if (settings.id) {
        const { error } = await supabase
          .from('rota_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rota_settings').insert(payload);
        if (error) throw error;
      }

      await refreshTimeIncrement();
      toast.success('Settings saved successfully');
      fetchSettings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <NizaLoaderInline />
      </div>
    );
  }

  // Only Super Admin and Full HR can access settings
  if (user?.role !== 'super_admin' && user?.role !== 'hr') {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">
          Only Super Admin and Full HR can manage rota settings.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Rota settings</h2>
        <p className="text-muted-foreground">
          Configure your rota preferences and permissions
        </p>
      </div>

      {/* Default View Selection */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Select your default rota view below</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                settings.default_view === 'table' && 'border-primary bg-primary/5'
              )}
              onClick={() => setSettings({ ...settings, default_view: 'table' })}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    settings.default_view === 'table' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                  )}>
                    <Table className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Table view</h3>
                  <p className="text-sm text-muted-foreground">
                    Set your shift times and easily assign this across employees and dates at once.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                settings.default_view === 'timeline' && 'border-primary bg-primary/5'
              )}
              onClick={() => setSettings({ ...settings, default_view: 'timeline' })}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    settings.default_view === 'timeline' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                  )}>
                    <CalendarDays className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Timeline view</h3>
                  <p className="text-sm text-muted-foreground">
                    Add your shift times and assign this to as many employees as you need.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              className={cn(
                'p-6 cursor-pointer transition-all',
                settings.default_view === 'drag-drop' && 'border-primary bg-primary/5'
              )}
              onClick={() => setSettings({ ...settings, default_view: 'drag-drop' })}
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={cn(
                    'w-16 h-16 rounded-lg flex items-center justify-center',
                    settings.default_view === 'drag-drop' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                  )}>
                    <Layers className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Drag and drop view</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop each employee onto the shift you'd like them to work.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      {/* Company Rota Settings */}
      <Card className="p-6 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-6">Company rota settings</h3>
          
          {/* Restricted Permissions */}
          <div className="space-y-4 pb-6 border-b">
            <div>
              <Label className="text-base font-semibold">Restricted rota permissions</Label>
              <p className="text-sm text-muted-foreground mt-1">
                By enabling this setting, you are restricting the edit and delete capabilities of your managers. Once created, rotas can be edited by the author and by admins.
              </p>
            </div>
            <RadioGroup 
              value={settings.restricted_permissions ? 'enable' : 'disable'} 
              onValueChange={(v) => setSettings({ ...settings, restricted_permissions: v === 'enable' })}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="restricted-enable" />
                  <Label htmlFor="restricted-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="restricted-disable" />
                  <Label htmlFor="restricted-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Hide Shift Labels */}
          <div className="space-y-4 py-6 border-b">
            <div>
              <Label className="text-base font-semibold">Hide shift labels in rotas from employees</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enabling this setting will prevent employees from seeing any colours and labels assigned to shifts.
              </p>
            </div>
            <RadioGroup 
              value={settings.hide_shift_labels ? 'enable' : 'disable'} 
              onValueChange={(v) => setSettings({ ...settings, hide_shift_labels: v === 'enable' })}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="labels-enable" />
                  <Label htmlFor="labels-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="labels-disable" />
                  <Label htmlFor="labels-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Accept/Decline Shifts */}
          <div className="space-y-4 py-6 border-b">
            <div>
              <Label className="text-base font-semibold">Ability to accept and decline shifts</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enable this to allow employees to accept or decline shifts assigned to them.
              </p>
            </div>
            <RadioGroup 
              value={settings.accept_decline_enabled ? 'enable' : 'disable'} 
              onValueChange={(v) => setSettings({ ...settings, accept_decline_enabled: v === 'enable' })}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="accept-enable" />
                  <Label htmlFor="accept-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="accept-disable" />
                  <Label htmlFor="accept-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Open Shifts */}
          <div className="space-y-4 pt-6">
            <div>
              <Label className="text-base font-semibold">Activate open shifts</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enabling this setting will allow employees to assign themselves to available open shifts. Only admins and managers can create open shifts.
              </p>
            </div>
            <RadioGroup 
              value={settings.open_shifts_enabled ? 'enable' : 'disable'} 
              onValueChange={(v) => setSettings({ ...settings, open_shifts_enabled: v === 'enable' })}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="open-enable" />
                  <Label htmlFor="open-enable" className="font-normal cursor-pointer">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="open-disable" />
                  <Label htmlFor="open-disable" className="font-normal cursor-pointer">Disable</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button variant="outline" onClick={fetchSettings}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
