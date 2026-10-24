import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  KeyRound, 
  CalendarClock, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  Info,
  Clock,
  UserCheck,
  Sparkles,
  Loader2
} from 'lucide-react';
import { 
  getTwoFactorAuthEnabled, 
  setTwoFactorAuthEnabled, 
  isTwoFactorAuthEnabledSync,
  getTwoFactorMetadata,
  subscribeToTwoFactorSetting 
} from '@/lib/twoFactorAuth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SecuritySettingsPanel() {
  const { user } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(() => isTwoFactorAuthEnabledSync());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<{ lastUpdated: string | null; updatedBy: string | null }>(() => getTwoFactorMetadata());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const enabled = await getTwoFactorAuthEnabled();
      setTwoFactorEnabled(enabled);
      setMetadata(getTwoFactorMetadata());
    } catch (err) {
      console.error('Error fetching 2FA setting:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const unsubscribe = subscribeToTwoFactorSetting((enabled) => {
      setTwoFactorEnabled(enabled);
      setMetadata(getTwoFactorMetadata());
    });
    return () => unsubscribe();
  }, []);

  const handleToggleAttempt = (checked: boolean) => {
    // If disabling 2FA, show a confirmation modal so superadmin makes a conscious choice
    if (!checked) {
      setPendingToggleValue(false);
      setConfirmDialogOpen(true);
    } else {
      executeToggle(true);
    }
  };

  const executeToggle = async (newVal: boolean) => {
    setSaving(true);
    try {
      const res = await setTwoFactorAuthEnabled(newVal, user);
      if (!res.success) {
        toast.error(res.error || 'Failed to update 2FA configuration');
        return;
      }

      setTwoFactorEnabled(newVal);
      setMetadata(getTwoFactorMetadata());

      if (newVal) {
        toast.success('2-Factor Authentication has been enabled system-wide. 2-step verification is now active.');
      } else {
        toast.success('2-Factor Authentication disabled. Users and Timesheets can now sign in normally without 2-step verification.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error updating security settings');
    } finally {
      setSaving(false);
      setPendingToggleValue(null);
      setConfirmDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 transition-colors ${
              twoFactorEnabled 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
            }`}>
              {twoFactorEnabled ? (
                <ShieldCheck className="h-8 w-8" />
              ) : (
                <ShieldAlert className="h-8 w-8" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-foreground tracking-tight">
                  Authentication & 2-Factor Security
                </h3>
                <Badge 
                  variant="outline" 
                  className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold uppercase tracking-wider"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Super Admin Exclusive
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Configure organization-wide two-step verification policies. You can toggle 2FA on or off across the entire application including user logins, password changes, and store timesheet scheduling.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading || saving}
            className="self-start md:self-center shrink-0 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </div>

      {/* Main Switch Card */}
      <Card className={`border-2 transition-all duration-300 shadow-md ${
        twoFactorEnabled
          ? 'border-emerald-500/30 bg-gradient-to-b from-card to-emerald-500/[0.02]'
          : 'border-amber-500/30 bg-gradient-to-b from-card to-amber-500/[0.02]'
      }`}>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Two-Factor Authentication (2FA)
                </CardTitle>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  twoFactorEnabled
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    twoFactorEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`} />
                  {twoFactorEnabled ? 'ENFORCED SYSTEM-WIDE' : 'DISABLED (NORMAL LOGIN)'}
                </span>
              </div>
              <CardDescription className="text-sm">
                {twoFactorEnabled
                  ? 'All users, timesheets, and super administrators must complete a 6-digit email code verification before accessing the system.'
                  : '2-step verification is turned off. All users sign in normally with password, and timesheets unlock without OTP prompts.'}
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center shrink-0 bg-muted/50 p-2.5 rounded-xl border border-border">
              <span className="text-sm font-medium text-foreground select-none">
                {twoFactorEnabled ? '2FA Active' : '2FA Off'}
              </span>
              <Switch
                id="two-factor-system-toggle"
                checked={twoFactorEnabled}
                onCheckedChange={handleToggleAttempt}
                disabled={loading || saving}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Status Alert Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
            twoFactorEnabled
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-100'
              : 'bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-100'
          }`}>
            {twoFactorEnabled ? (
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            )}
            <div className="text-sm space-y-1">
              <p className="font-semibold">
                {twoFactorEnabled
                  ? 'High Security Mode Enabled'
                  : 'Direct Access Mode Active (2FA Disabled)'}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {twoFactorEnabled
                  ? 'Resend 2-Step OTP is requested during sign-in, timesheet weekly scheduling, and sensitive administrative actions. Disabling this toggle lets users log in directly with their password.'
                  : 'You have disabled two-factor verification. The app now operates normally without any 2-step verification codes, including all logins and weekly timesheets scheduling.'}
              </p>
            </div>
          </div>

          {/* Affected Systems Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Affected Modules & Access Scopes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* User Login Scope */}
              <div className={`p-4 rounded-xl border transition-all ${
                twoFactorEnabled 
                  ? 'bg-card border-border/70 hover:border-emerald-500/40' 
                  : 'bg-amber-500/[0.04] border-amber-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${
                    twoFactorEnabled ? 'bg-primary/10 text-primary' : 'bg-amber-500/15 text-amber-600'
                  }`}>
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <h5 className="font-semibold text-sm text-foreground">User Login Flow</h5>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Sign-in authentication experience for all accounts across mobile & desktop.
                </p>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {twoFactorEnabled ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> 6-Digit Email OTP Required
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Unlock className="h-3.5 w-3.5" /> Normal Password Only
                    </span>
                  )}
                </div>
              </div>

              {/* Timesheets Scope */}
              <div className={`p-4 rounded-xl border transition-all ${
                twoFactorEnabled 
                  ? 'bg-card border-border/70 hover:border-emerald-500/40' 
                  : 'bg-amber-500/[0.04] border-amber-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${
                    twoFactorEnabled ? 'bg-primary/10 text-primary' : 'bg-amber-500/15 text-amber-600'
                  }`}>
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <h5 className="font-semibold text-sm text-foreground">Timesheets & Rota</h5>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Store manager weekly view rota scheduling and employee shift updates.
                </p>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {twoFactorEnabled ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> Store Email 2FA Required
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Unlock className="h-3.5 w-3.5" /> Direct Unlocked Access
                    </span>
                  )}
                </div>
              </div>

              {/* Super Admin Security Scope */}
              <div className={`p-4 rounded-xl border transition-all ${
                twoFactorEnabled 
                  ? 'bg-card border-border/70 hover:border-emerald-500/40' 
                  : 'bg-amber-500/[0.04] border-amber-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${
                    twoFactorEnabled ? 'bg-primary/10 text-primary' : 'bg-amber-500/15 text-amber-600'
                  }`}>
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <h5 className="font-semibold text-sm text-foreground">Super Admin Security</h5>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Password changes and administrative security challenge checkpoints.
                </p>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {twoFactorEnabled ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> Admin Code Verification
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Unlock className="h-3.5 w-3.5" /> Direct Password Update
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Audit & Modification Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-4 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {metadata.lastUpdated
                  ? `Last modified: ${format(new Date(metadata.lastUpdated), 'PPP p')}`
                  : 'Status: Synchronized'}
              </span>
            </div>
            {metadata.updatedBy && (
              <span className="text-foreground/80 font-medium">
                {metadata.updatedBy}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog When Disabling */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-lg">Disable 2-Factor Authentication?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground pt-1 space-y-2">
              <p>
                Are you sure you want to turn off 2-factor authentication system-wide?
              </p>
              <p className="text-foreground font-medium">
                • Users will be able to log in normally with just their email & password without any 2-step verification code.
              </p>
              <p className="text-foreground font-medium">
                • Timesheets weekly scheduling will unlock directly for store accounts without requiring OTP codes.
              </p>
              <p>
                You can re-enable 2FA at any time from this Settings page.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeToggle(false)}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2-Step Verification'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
