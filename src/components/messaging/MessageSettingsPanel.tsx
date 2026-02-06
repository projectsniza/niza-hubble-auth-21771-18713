import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, Users, Paperclip, Clock, Save, RefreshCw, 
  Shield, Building2, UserCog, User, Info, Eye, Bell, Check
} from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MessageSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
}

export default function MessageSettingsPanel() {
  const [settings, setSettings] = useState<MessageSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      
      const parsedSettings = (data || []).map(s => ({
        ...s,
        setting_value: typeof s.setting_value === 'string' ? s.setting_value : JSON.stringify(s.setting_value).replace(/"/g, '')
      }));
      
      setSettings(parsedSettings);
    } catch (error) {
      console.error('Error fetching message settings:', error);
      toast.error('Failed to load message settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setChanges(prev => ({ ...prev, [key]: value }));
  };

  const getValue = (key: string): string => {
    if (changes[key] !== undefined) return changes[key];
    const setting = settings.find(s => s.setting_key === key);
    return setting?.setting_value || '';
  };

  const getBoolValue = (key: string): boolean => {
    return getValue(key) === 'true';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(changes)) {
        const { error } = await supabase
          .from('message_settings')
          .update({ setting_value: value, updated_at: new Date().toISOString() })
          .eq('setting_key', key);

        if (error) throw error;
      }

      toast.success('Message settings saved successfully');
      setChanges({});
      fetchSettings();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(changes).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <NizaLoaderInline />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Message Settings</h3>
          <p className="text-sm text-muted-foreground">Configure organization-wide messaging features and access control</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Messaging is available across all organizations and branches. Super Admins, HR, and Store Accounts can always message each other. 
          Employee access can be controlled separately below.
        </AlertDescription>
      </Alert>

      {/* Role Access Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Role Access Overview
          </CardTitle>
          <CardDescription>Who can use the messaging feature</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <Shield className="h-8 w-8 text-green-600 mb-2" />
              <span className="font-medium text-sm">Super Admin</span>
              <Badge variant="default" className="mt-2 bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Always Enabled
              </Badge>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <UserCog className="h-8 w-8 text-green-600 mb-2" />
              <span className="font-medium text-sm">HR</span>
              <Badge variant="default" className="mt-2 bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Always Enabled
              </Badge>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <Building2 className="h-8 w-8 text-green-600 mb-2" />
              <span className="font-medium text-sm">Store Account</span>
              <Badge variant="default" className="mt-2 bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Always Enabled
              </Badge>
            </div>
            <div className={`flex flex-col items-center p-4 rounded-lg border ${
              getBoolValue('employee_messaging_enabled') 
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
                : 'bg-muted border-border'
            }`}>
              <User className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="font-medium text-sm">Employee</span>
              <Badge variant={getBoolValue('employee_messaging_enabled') ? 'default' : 'secondary'} className={`mt-2 ${getBoolValue('employee_messaging_enabled') ? 'bg-green-600' : ''}`}>
                {getBoolValue('employee_messaging_enabled') ? (
                  <><Check className="h-3 w-3 mr-1" />Enabled</>
                ) : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Employee Access Control
          </CardTitle>
          <CardDescription>Control whether employees can use the messaging feature</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-base font-medium">Employee Messaging</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, employees can send and receive messages with other users. 
                When disabled, messaging is hidden from the employee dashboard.
              </p>
            </div>
            <Switch
              checked={getBoolValue('employee_messaging_enabled')}
              onCheckedChange={(checked) => handleChange('employee_messaging_enabled', checked.toString())}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-base font-medium">Group Chats</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to create group conversations with multiple participants
              </p>
            </div>
            <Switch
              checked={getBoolValue('allow_group_chats')}
              onCheckedChange={(checked) => handleChange('allow_group_chats', checked.toString())}
            />
          </div>
        </CardContent>
      </Card>

      {/* File Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-primary" />
            File Attachments
          </CardTitle>
          <CardDescription>Configure file sharing in messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-base font-medium">Allow File Attachments</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to share files and images in messages
              </p>
            </div>
            <Switch
              checked={getBoolValue('allow_file_attachments')}
              onCheckedChange={(checked) => handleChange('allow_file_attachments', checked.toString())}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-base font-medium">Maximum Attachment Size</Label>
              <p className="text-sm text-muted-foreground">
                Maximum file size allowed for attachments
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="100"
                className="w-20"
                value={getValue('max_attachment_size_mb')}
                onChange={(e) => handleChange('max_attachment_size_mb', e.target.value)}
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Message Features
          </CardTitle>
          <CardDescription>Configure messaging experience and notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <Label className="text-base font-medium">Read Receipts</Label>
                <p className="text-sm text-muted-foreground">
                  Show when messages have been read by recipients
                </p>
              </div>
            </div>
            <Switch
              checked={getBoolValue('read_receipts_enabled')}
              onCheckedChange={(checked) => handleChange('read_receipts_enabled', checked.toString())}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <Label className="text-base font-medium">Typing Indicators</Label>
                <p className="text-sm text-muted-foreground">
                  Show when someone is typing a message
                </p>
              </div>
            </div>
            <Switch
              checked={getBoolValue('typing_indicators_enabled')}
              onCheckedChange={(checked) => handleChange('typing_indicators_enabled', checked.toString())}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <Label className="text-base font-medium">Notification Sounds</Label>
                <p className="text-sm text-muted-foreground">
                  Play sound when new messages arrive
                </p>
              </div>
            </div>
            <Switch
              checked={getBoolValue('notification_sound_enabled')}
              onCheckedChange={(checked) => handleChange('notification_sound_enabled', checked.toString())}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Data Retention
          </CardTitle>
          <CardDescription>Configure message storage policies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-base font-medium">Message Retention Period</Label>
              <p className="text-sm text-muted-foreground">
                Number of days to keep messages (0 = keep forever)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="3650"
                className="w-24"
                value={getValue('message_retention_days')}
                onChange={(e) => handleChange('message_retention_days', e.target.value)}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status Summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-4">Current Configuration Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">Employee Access</p>
              <Badge variant={getBoolValue('employee_messaging_enabled') ? 'default' : 'secondary'}>
                {getBoolValue('employee_messaging_enabled') ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">Group Chats</p>
              <Badge variant={getBoolValue('allow_group_chats') ? 'default' : 'secondary'}>
                {getBoolValue('allow_group_chats') ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">Attachments</p>
              <Badge variant={getBoolValue('allow_file_attachments') ? 'default' : 'secondary'}>
                {getBoolValue('allow_file_attachments') ? `Up to ${getValue('max_attachment_size_mb')}MB` : 'Disabled'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <p className="text-xs text-muted-foreground mb-1">Retention</p>
              <Badge variant="outline">
                {getValue('message_retention_days') === '0' ? 'Forever' : `${getValue('message_retention_days')} days`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
