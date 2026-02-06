import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, FileText, Bell, Loader2, Save } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface FollowUpSettings {
  id: string;
  follow_up_count: number;
  follow_up_intervals: number[];
  is_active: boolean;
}

export default function DocumentSettingsPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FollowUpSettings | null>(null);
  const [intervals, setIntervals] = useState<number[]>([30]);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_follow_up_settings')
        .select('*')
        .is('organization_id', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data);
        setIntervals(data.follow_up_intervals || [30]);
        setIsActive(data.is_active ?? true);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInterval = () => {
    if (intervals.length >= 10) {
      toast.error('Maximum 10 follow-ups allowed');
      return;
    }
    const lastInterval = intervals[intervals.length - 1] || 30;
    setIntervals([...intervals, lastInterval + 10]);
  };

  const handleRemoveInterval = (index: number) => {
    if (intervals.length <= 1) {
      toast.error('At least one follow-up interval is required');
      return;
    }
    setIntervals(intervals.filter((_, i) => i !== index));
  };

  const handleIntervalChange = (index: number, value: number) => {
    const newIntervals = [...intervals];
    newIntervals[index] = Math.max(1, value);
    setIntervals(newIntervals);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sort intervals in descending order (furthest first)
      const sortedIntervals = [...intervals].sort((a, b) => b - a);
      
      if (settings?.id) {
        const { error } = await supabase
          .from('document_follow_up_settings')
          .update({
            follow_up_count: sortedIntervals.length,
            follow_up_intervals: sortedIntervals,
            is_active: isActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_follow_up_settings')
          .insert({
            organization_id: null,
            follow_up_count: sortedIntervals.length,
            follow_up_intervals: sortedIntervals,
            is_active: isActive,
            created_by: user?.id
          });

        if (error) throw error;
      }

      toast.success('Document follow-up settings saved');
      fetchSettings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Document Settings</CardTitle>
          </div>
          <CardDescription>
            Configure global document management settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Follow-up Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Follow-up Documents</h3>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="follow-up-active" className="text-sm">Enable Auto Follow-ups</Label>
                <Switch
                  id="follow-up-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Configure automatic follow-up reminders before document expiry dates. 
              Follow-ups are calculated based on the expiry date set during upload.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Follow-up Intervals (days before expiry)</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddInterval}
                  disabled={intervals.length >= 10}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Follow-up
                </Button>
              </div>

              <div className="space-y-3">
                {intervals.map((interval, index) => (
                  <div key={index} className="flex items-center gap-3 bg-background rounded-lg p-3 border">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={interval}
                        onChange={(e) => handleIntervalChange(index, parseInt(e.target.value) || 1)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">days before expiry</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInterval(index)}
                      disabled={intervals.length <= 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground border-t pt-3">
                <strong>Example:</strong> If a document expires on Jan 30 and you set follow-ups at 30, 14, and 7 days, 
                reminders will appear on Dec 31, Jan 16, and Jan 23.
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}