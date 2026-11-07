import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Loader2,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
  Radio,
  Sliders,
  Building2,
  Search,
  RotateCcw
} from 'lucide-react';
import { 
  getTwoFactorAuthEnabled, 
  setTwoFactorAuthEnabled, 
  isTwoFactorAuthEnabledSync,
  getTwoFactorMetadata,
  subscribeToTwoFactorSetting 
} from '@/lib/twoFactorAuth';
import {
  getTimesheetSecurityConfig,
  setTimesheetSecurityConfig,
  subscribeToTimesheetSecurity,
  TIMESHEET_GLOBAL_PASSCODE_KEY,
  type TimesheetVerificationMode,
  type TimesheetSecurityConfig,
} from '@/lib/timesheetSecurity';
import { TimesheetPasscodeModal } from '@/components/scheduling/TimesheetPasscodeModal';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgBranch } from '@/contexts/OrgBranchContext';
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
  const { branches } = useOrgBranch();
  const isSuperAdmin = user?.role === 'super_admin';

  // Global 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(() => isTwoFactorAuthEnabledSync());
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [metadata, setMetadata] = useState<{ lastUpdated: string | null; updatedBy: string | null }>(() => getTwoFactorMetadata());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingToggleValue, setPendingToggleValue] = useState<boolean | null>(null);

  // Timesheets & Rota Verification State (Independent of Global 2FA)
  const [tsMode, setTsMode] = useState<TimesheetVerificationMode>('disabled');
  const [isPasscodeSet, setIsPasscodeSet] = useState(false);
  const [storedPasscode, setStoredPasscode] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showStoredPasscode, setShowStoredPasscode] = useState(false);
  const [showInputPasscode, setShowInputPasscode] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [savingTs, setSavingTs] = useState(false);
  const [tsMetadata, setTsMetadata] = useState<{ lastUpdated: string | null; updatedBy: string | null }>({
    lastUpdated: null,
    updatedBy: null,
  });

  // Branch-specific passcodes state
  const [branchPasscodes, setBranchPasscodes] = useState<Record<string, { isPasscodeSet: boolean; passcode?: string; updatedAt?: string; updatedBy?: string }>>({});
  const [branchSearch, setBranchSearch] = useState('');
  const [selectedBranchIdForEdit, setSelectedBranchIdForEdit] = useState<string | null>(null);
  const [branchPasscodeInput, setBranchPasscodeInput] = useState('');
  const [showBranchPasscodeInput, setShowBranchPasscodeInput] = useState(false);
  const [visibleBranchPasscodeIds, setVisibleBranchPasscodeIds] = useState<Record<string, boolean>>({});
  const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);
  const [branchClearDialogOpen, setBranchClearDialogOpen] = useState(false);
  const [branchToClear, setBranchToClear] = useState<{ id: string; name: string } | null>(null);

  // Modal test preview state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [clearPasscodeDialogOpen, setClearPasscodeDialogOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // 1. Fetch Global 2FA
      const enabled = await getTwoFactorAuthEnabled();
      setTwoFactorEnabled(enabled);
      setMetadata(getTwoFactorMetadata());

      // 2. Fetch Timesheets Security Config
      const tsConfig = await getTimesheetSecurityConfig();
      setTsMode(tsConfig.mode);
      setIsPasscodeSet(tsConfig.isPasscodeSet);
      if (tsConfig.passcode !== undefined) {
        setStoredPasscode(tsConfig.passcode);
        if (tsConfig.passcode) {
          try {
            localStorage.setItem(TIMESHEET_GLOBAL_PASSCODE_KEY, tsConfig.passcode);
          } catch {}
        }
      }
      if (tsConfig.branchPasscodes) {
        setBranchPasscodes(tsConfig.branchPasscodes);
      }
      setTsMetadata({
        lastUpdated: tsConfig.updatedAt || null,
        updatedBy: tsConfig.updatedBy || null,
      });
    } catch (err) {
      console.error('Error fetching security settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const unsub2FA = subscribeToTwoFactorSetting((enabled) => {
      setTwoFactorEnabled(enabled);
      setMetadata(getTwoFactorMetadata());
    });

    const unsubTs = subscribeToTimesheetSecurity((config) => {
      setTsMode(config.mode);
      setIsPasscodeSet(config.isPasscodeSet);
      if (config.passcode !== undefined) {
        setStoredPasscode(config.passcode);
        if (config.passcode) {
          try {
            localStorage.setItem(TIMESHEET_GLOBAL_PASSCODE_KEY, config.passcode);
          } catch {}
        }
      }
      if (config.branchPasscodes) {
        setBranchPasscodes(config.branchPasscodes);
      }
      setTsMetadata({
        lastUpdated: config.updatedAt || null,
        updatedBy: config.updatedBy || null,
      });
    });

    return () => {
      unsub2FA();
      unsubTs();
    };
  }, []);

  // Handler: Global 2FA toggle
  const handleToggleAttempt = (checked: boolean) => {
    if (!checked) {
      setPendingToggleValue(false);
      setConfirmDialogOpen(true);
    } else {
      executeToggle(true);
    }
  };

  const executeToggle = async (newVal: boolean) => {
    setSavingGlobal(true);
    try {
      const res = await setTwoFactorAuthEnabled(newVal, user);
      if (!res.success) {
        toast.error(res.error || 'Failed to update 2FA configuration');
        return;
      }

      setTwoFactorEnabled(newVal);
      setMetadata(getTwoFactorMetadata());

      if (newVal) {
        toast.success('System-Wide 2FA Enabled. 2-Step OTP required for user sign-in.');
      } else {
        toast.success('System-Wide 2FA Disabled. Normal password sign-in is now active.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error updating security settings');
    } finally {
      setSavingGlobal(false);
      setPendingToggleValue(null);
      setConfirmDialogOpen(false);
    }
  };

  // Handler: Select Timesheets & Rota verification mode
  const handleSelectTsMode = async (newMode: TimesheetVerificationMode) => {
    if (newMode === tsMode) return;
    setSavingTs(true);
    try {
      const res = await setTimesheetSecurityConfig(newMode, undefined, user);
      if (!res.success) {
        toast.error(res.error || 'Failed to update timesheet verification mode');
        return;
      }

      setTsMode(newMode);
      if (res.config) {
        setIsPasscodeSet(res.config.isPasscodeSet);
        if (res.config.passcode !== undefined) setStoredPasscode(res.config.passcode);
        setTsMetadata({
          lastUpdated: res.config.updatedAt || null,
          updatedBy: res.config.updatedBy || null,
        });
      }

      if (newMode === 'disabled') {
        toast.success('Timesheets & Rota verification disabled. Direct access granted.');
      } else if (newMode === 'passcode') {
        if (!isPasscodeSet && !storedPasscode) {
          toast.info('Passcode mode selected. Note: normal access is granted until you configure a passcode below.');
        } else {
          toast.success('Timesheets & Rota protected with Passcode verification.');
        }
      } else if (newMode === 'two_factor') {
        toast.success('Timesheets & Rota 2FA enabled. Store accounts will require email OTP codes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating timesheet verification mode');
    } finally {
      setSavingTs(false);
    }
  };

  // Handler: Save or change Passcode (Super Admin only)
  const handleSavePasscode = async () => {
    if (!passcodeInput.trim()) {
      toast.error('Please enter a passcode');
      return;
    }

    setSavingTs(true);
    try {
      const res = await setTimesheetSecurityConfig(tsMode, passcodeInput.trim(), user);
      if (!res.success) {
        toast.error(res.error || 'Failed to save passcode');
        return;
      }

      setStoredPasscode(passcodeInput.trim());
      setIsPasscodeSet(true);
      setPasscodeInput('');
      if (res.config) {
        setTsMetadata({
          lastUpdated: res.config.updatedAt || null,
          updatedBy: res.config.updatedBy || null,
        });
      }

      toast.success('Timesheet security passcode updated successfully! Only you can view or change this passcode.');
    } catch (err: any) {
      toast.error(err.message || 'Error saving passcode');
    } finally {
      setSavingTs(false);
    }
  };

  // Handler: Clear Passcode
  const handleClearPasscode = async () => {
    setSavingTs(true);
    try {
      const res = await setTimesheetSecurityConfig(tsMode, '', user);
      if (!res.success) {
        toast.error(res.error || 'Failed to clear passcode');
        return;
      }

      setStoredPasscode('');
      setIsPasscodeSet(false);
      setPasscodeInput('');
      setClearPasscodeDialogOpen(false);
      toast.success('Passcode removed. Timesheets will allow normal login until a new passcode is configured.');
    } catch (err: any) {
      toast.error(err.message || 'Error clearing passcode');
    } finally {
      setSavingTs(false);
    }
  };

  const handleCopyPasscode = () => {
    if (!storedPasscode) return;
    navigator.clipboard.writeText(storedPasscode);
    setCopiedPasscode(true);
    toast.success('Passcode copied to clipboard');
    setTimeout(() => setCopiedPasscode(false), 2000);
  };

  // Handler: Save or change branch-specific Passcode
  const handleSaveBranchPasscode = async (branchId: string, passcodeVal: string) => {
    if (!passcodeVal.trim()) {
      toast.error('Please enter a passcode for this branch');
      return;
    }

    setSavingTs(true);
    try {
      const res = await setTimesheetSecurityConfig(tsMode, passcodeVal.trim(), user, branchId);
      if (!res.success) {
        toast.error(res.error || 'Failed to save branch passcode');
        return;
      }

      const branchName = branches.find(b => b.id === branchId)?.name || 'Branch';

      setBranchPasscodes(prev => ({
        ...prev,
        [branchId]: {
          branchId,
          isPasscodeSet: true,
          passcode: passcodeVal.trim(),
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name || user?.email || 'Super Admin',
        }
      }));

      setSelectedBranchIdForEdit(null);
      setBranchPasscodeInput('');
      toast.success(`Unique passcode saved for "${branchName}"! Other branches remain unaffected.`);
    } catch (err: any) {
      toast.error(err.message || 'Error saving branch passcode');
    } finally {
      setSavingTs(false);
    }
  };

  // Handler: Clear / Reset branch-specific Passcode
  const handleClearBranchPasscode = async () => {
    if (!branchToClear) return;
    setSavingTs(true);
    try {
      const res = await setTimesheetSecurityConfig(tsMode, '', user, branchToClear.id);
      if (!res.success) {
        toast.error(res.error || 'Failed to remove branch passcode');
        return;
      }

      setBranchPasscodes(prev => {
        const next = { ...prev };
        delete next[branchToClear.id];
        return next;
      });

      setBranchClearDialogOpen(false);
      setBranchToClear(null);
      toast.success(`Passcode removed for ${branchToClear.name}. Branch will use global default passcode.`);
    } catch (err: any) {
      toast.error(err.message || 'Error removing branch passcode');
    } finally {
      setSavingTs(false);
    }
  };

  const handleCopyBranchPasscode = (branchId: string, code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedBranchId(branchId);
    toast.success('Branch passcode copied to clipboard');
    setTimeout(() => setCopiedBranchId(null), 2000);
  };

  const toggleBranchPasscodeVisibility = (branchId: string) => {
    setVisibleBranchPasscodeIds(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 transition-colors ${
              twoFactorEnabled || tsMode !== 'disabled'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30'
            }`}>
              {twoFactorEnabled || tsMode !== 'disabled' ? (
                <ShieldCheck className="h-8 w-8" />
              ) : (
                <ShieldAlert className="h-8 w-8" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-foreground tracking-tight">
                  Security, Passcode & 2-Factor Control
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
                Manage global authentication policies and granular verification rules for Timesheets & Rota. Timesheet access can be secured with a Passcode, Email 2FA, or left directly unlocked independently from global sign-in 2FA.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading || savingGlobal || savingTs}
            className="self-start md:self-center shrink-0 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: TIMESHEETS & ROTA INDEPENDENT VERIFICATION FEATURE */}
      {/* ========================================================================= */}
      <Card className="border-2 border-primary/20 shadow-md bg-gradient-to-b from-card via-card to-primary/[0.02]">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold text-foreground">
                  Timesheets & Rota Access Verification
                </CardTitle>
                <Badge 
                  variant="outline"
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    tsMode === 'disabled'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : tsMode === 'passcode'
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {tsMode === 'disabled' ? 'Direct Access' : tsMode === 'passcode' ? 'Passcode Protected' : '2FA Enforced'}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                Control the verification checkpoint for weekly timesheet rota editing. Either Passcode OR Two-Factor can be active, or both can be turned off for direct access.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewModalOpen(true)}
              disabled={loading || tsMode === 'disabled'}
              className="shrink-0 gap-2 self-start sm:self-center text-xs"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Test Passcode Dialog
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Mode Selector - 3 Distinct Mutually Exclusive Options */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Verification Mode for Timesheets & Rota
            </Label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Disabled / Direct Access */}
              <button
                type="button"
                onClick={() => handleSelectTsMode('disabled')}
                disabled={savingTs || loading}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  tsMode === 'disabled'
                    ? 'border-amber-500 bg-amber-500/[0.08] ring-2 ring-amber-500/20 shadow-sm'
                    : 'border-border/70 hover:border-amber-500/40 bg-card hover:bg-muted/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      tsMode === 'disabled' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Unlock className="h-4 w-4" />
                    </div>
                    {tsMode === 'disabled' && (
                      <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Disabled (Direct Access)
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No 2-step email code and no passcode required. Managers open and edit timesheets directly without prompts.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border/40 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  {tsMode === 'disabled' ? '✓ Currently Selected' : 'Click to enable direct access'}
                </div>
              </button>

              {/* Option 2: Passcode Entry */}
              <button
                type="button"
                onClick={() => handleSelectTsMode('passcode')}
                disabled={savingTs || loading}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  tsMode === 'passcode'
                    ? 'border-blue-500 bg-blue-500/[0.08] ring-2 ring-blue-500/20 shadow-sm'
                    : 'border-border/70 hover:border-blue-500/40 bg-card hover:bg-muted/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      tsMode === 'passcode' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <KeyRound className="h-4 w-4" />
                    </div>
                    {tsMode === 'passcode' && (
                      <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Passcode Protection
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Requires a Super Admin passcode before store accounts can edit weekly scheduling. Two-Factor 2FA is turned off for timesheets.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border/40 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                  {tsMode === 'passcode' ? '✓ Currently Selected' : 'Click to enable passcode lock'}
                </div>
              </button>

              {/* Option 3: Two-Factor Authentication (2FA) */}
              <button
                type="button"
                onClick={() => handleSelectTsMode('two_factor')}
                disabled={savingTs || loading}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  tsMode === 'two_factor'
                    ? 'border-emerald-500 bg-emerald-500/[0.08] ring-2 ring-emerald-500/20 shadow-sm'
                    : 'border-border/70 hover:border-emerald-500/40 bg-card hover:bg-muted/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      tsMode === 'two_factor' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    {tsMode === 'two_factor' && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Two-Factor 2FA (Email OTP)
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sends a 6-digit OTP code to the store account email via Resend before unlocking scheduling. Works even if global 2FA is off.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border/40 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {tsMode === 'two_factor' ? '✓ Currently Selected' : 'Click to enable 2FA OTP'}
                </div>
              </button>
            </div>
          </div>

          {/* PASSCODE CONFIGURATION BOX (Shown whenever Passcode mode is chosen OR when Super Admin configures passcode) */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Super Admin Timesheet Passcode
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Only you (Super Admin) can view and modify this secret passcode.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                isPasscodeSet
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isPasscodeSet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isPasscodeSet ? 'Passcode Configured & Active' : 'Passcode Not Configured'}
              </span>
            </div>

            {/* Informative Alert for Passcode State */}
            {isPasscodeSet ? (
              <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] text-xs text-foreground flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-950 dark:text-emerald-200">
                    Active Passcode Protection is Ready
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    When Timesheet Passcode mode is selected, store managers will be prompted to enter this passcode before opening or editing weekly shifts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] text-xs text-foreground flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950 dark:text-amber-200">
                    Normal Login Active Until Passcode Is Set
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    No passcode is currently configured. Store accounts will have normal direct access without prompts until you set a passcode below.
                  </p>
                </div>
              </div>
            )}

            {/* Current Passcode Preview (Super Admin visibility) */}
            {isPasscodeSet && storedPasscode && (
              <div className="p-3 bg-card rounded-lg border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Configured Passcode
                  </span>
                  <div className="flex items-center gap-2 font-mono text-base font-bold text-foreground">
                    <span>
                      {showStoredPasscode ? storedPasscode : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowStoredPasscode(!showStoredPasscode)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title={showStoredPasscode ? 'Hide passcode' : 'Show passcode'}
                    >
                      {showStoredPasscode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPasscode}
                    className="gap-1.5 text-xs h-8"
                  >
                    {copiedPasscode ? <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedPasscode ? 'Copied' : 'Copy Passcode'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setClearPasscodeDialogOpen(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}

            {/* Super Admin Master Passcode Override Form */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="superadmin-passcode-input" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {isPasscodeSet ? 'Change Super Admin Master Passcode' : 'Set Super Admin Master Passcode'}
                </Label>
                <span className="text-[11px] text-muted-foreground">Emergency master key: Super Admin can use this to access any branch</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="superadmin-passcode-input"
                    type={showInputPasscode ? 'text' : 'password'}
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder={isPasscodeSet ? 'Enter new master passcode (e.g. 582910)' : 'Enter master passcode (e.g. 582910)'}
                    className="pl-9 pr-10 font-mono tracking-wider text-sm"
                    autoComplete="off"
                    disabled={savingTs || loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInputPasscode(!showInputPasscode)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showInputPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Button
                  onClick={handleSavePasscode}
                  disabled={savingTs || loading || !passcodeInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 gap-1.5"
                >
                  {savingTs ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      {isPasscodeSet ? 'Update Master Passcode' : 'Save Master Passcode'}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This secret master passcode is exclusive to Super Admin for emergency override. It is never assigned or reflected onto branch stores.
              </p>
            </div>

            {/* ========================================================================= */}
            {/* BRANCH-WISE UNIQUE PASSCODES SUB-SECTION */}
            {/* ========================================================================= */}
            <div className="mt-6 pt-5 border-t border-border/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground">
                      Branch-Wise Unique Passcodes
                    </h4>
                    <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 text-primary">
                      {branches.length} Branches
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Assign a unique secret passcode to each branch manager. Setting a unique passcode here applies <strong>only to that specific branch</strong> and will never change any other branch's passcode.
                  </p>
                </div>

                {/* Branch Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search branches..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Branch Passcodes Table / List */}
              <div className="rounded-xl border border-border/80 overflow-hidden bg-card divide-y divide-border/60">
                {branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase())).length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    {branchSearch ? 'No branches match your search query.' : 'No branches available.'}
                  </div>
                ) : (
                  branches
                    .filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()))
                    .map((branch) => {
                      const bData = branchPasscodes[branch.id];
                      const hasCustom = Boolean(bData?.isPasscodeSet && bData?.passcode);
                      const isEditing = selectedBranchIdForEdit === branch.id;
                      const isVisible = visibleBranchPasscodeIds[branch.id];

                      return (
                        <div key={branch.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              hasCustom 
                                ? 'bg-emerald-500/10 text-emerald-600 font-bold' 
                                : isPasscodeSet 
                                  ? 'bg-muted text-muted-foreground' 
                                  : 'bg-amber-500/10 text-amber-600'
                            }`}>
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground truncate">
                                  {branch.name}
                                </span>
                                {hasCustom ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] px-1.5 py-0 h-4 font-semibold">
                                    Unique Passcode
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-400/60 bg-amber-500/10 text-[9px] px-1.5 py-0 h-4 font-medium">
                                    No Passcode Set
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                                {hasCustom && bData?.passcode ? (
                                  <>
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">Unique Code:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      {isVisible ? bData.passcode : '••••••••'}
                                    </span>
                                    <span className="text-[10px] text-emerald-600/80 font-sans font-medium">(Branch Secret)</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleBranchPasscodeVisibility(branch.id)}
                                      className="hover:text-foreground p-0.5"
                                      title={isVisible ? 'Hide' : 'Reveal'}
                                    >
                                      {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </button>
                                  </>
                                ) : (
                                  <span className="italic text-muted-foreground/70 font-sans">
                                    No unique passcode configured (Direct access)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons / Inline Edit Input */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {isEditing ? (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-muted/40 p-1.5 rounded-lg border border-border">
                                <div className="relative">
                                  <Input
                                    type={showBranchPasscodeInput ? 'text' : 'password'}
                                    value={branchPasscodeInput}
                                    onChange={(e) => setBranchPasscodeInput(e.target.value)}
                                    placeholder="Enter unique code..."
                                    className="h-7 w-40 text-xs font-mono pr-7 bg-background"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowBranchPasscodeInput(!showBranchPasscodeInput)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    {showBranchPasscodeInput ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveBranchPasscode(branch.id, branchPasscodeInput)}
                                    disabled={savingTs || !branchPasscodeInput.trim()}
                                    className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1"
                                  >
                                    {savingTs ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save for this branch'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedBranchIdForEdit(null);
                                      setBranchPasscodeInput('');
                                    }}
                                    className="h-7 px-2 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {hasCustom && bData?.passcode && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyBranchPasscode(branch.id, bData.passcode!)}
                                    className="h-7 px-2 text-[11px] gap-1"
                                    title="Copy secret passcode for this branch"
                                  >
                                    {copiedBranchId === branch.id ? <CheckCheck className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                    <span>{copiedBranchId === branch.id ? 'Copied' : 'Copy'}</span>
                                  </Button>
                                )}
                                <Button
                                  variant={hasCustom ? 'outline' : 'default'}
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBranchIdForEdit(branch.id);
                                    setBranchPasscodeInput(hasCustom ? (bData?.passcode || '') : '');
                                  }}
                                  className={`h-7 px-2.5 text-[11px] gap-1 ${
                                    hasCustom 
                                      ? 'border-border' 
                                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  }`}
                                >
                                  <KeyRound className="h-3 w-3" />
                                  <span>{hasCustom ? 'Change' : 'Set Passcode'}</span>
                                </Button>
                                {hasCustom && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setBranchToClear({ id: branch.id, name: branch.name });
                                      setBranchClearDialogOpen(true);
                                    }}
                                    className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-[11px]"
                                    title="Remove passcode for this branch"
                                  >
                                    Reset
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Audit & Modification Info for Timesheets */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>
                  {tsMetadata.lastUpdated
                    ? `Timesheet security modified: ${format(new Date(tsMetadata.lastUpdated), 'PPP p')}`
                    : 'Timesheet security: Synchronized'}
                </span>
              </div>
              {tsMetadata.updatedBy && (
                <span className="text-foreground/80 font-medium">
                  By {tsMetadata.updatedBy}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* SECTION 2: SYSTEM-WIDE TWO-FACTOR AUTHENTICATION TOGGLE (LOGIN & ADMIN) */}
      {/* ========================================================================= */}
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
                  Global Two-Factor Authentication (2FA)
                </CardTitle>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  twoFactorEnabled
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    twoFactorEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`} />
                  {twoFactorEnabled ? 'ENFORCED GLOBALLY' : 'DISABLED (NORMAL LOGIN)'}
                </span>
              </div>
              <CardDescription className="text-sm">
                {twoFactorEnabled
                  ? 'All user account sign-ins and sensitive administrative actions require 6-digit email OTP verification.'
                  : 'System-wide 2FA is turned off. Users sign in normally with password.'}
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center shrink-0 bg-muted/50 p-2.5 rounded-xl border border-border">
              <span className="text-sm font-medium text-foreground select-none">
                {twoFactorEnabled ? 'Global 2FA Active' : 'Global 2FA Off'}
              </span>
              <Switch
                id="two-factor-system-toggle"
                checked={twoFactorEnabled}
                onCheckedChange={handleToggleAttempt}
                disabled={loading || savingGlobal}
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
                  ? 'High Security Login Mode Enabled'
                  : 'Direct Access Mode Active (Global 2FA Disabled)'}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {twoFactorEnabled
                  ? 'Resend 2-Step OTP is requested during sign-in and administrative password updates. You can still customize Timesheets & Rota verification separately above.'
                  : 'Global 2FA is off. Users log in directly with their password. You can still enforce Timesheets Passcode or 2FA independently using the card above.'}
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
                tsMode === 'disabled'
                  ? 'bg-amber-500/[0.04] border-amber-500/30'
                  : tsMode === 'passcode'
                  ? 'bg-blue-500/[0.04] border-blue-500/30'
                  : 'bg-emerald-500/[0.04] border-emerald-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${
                    tsMode === 'disabled'
                      ? 'bg-amber-500/15 text-amber-600'
                      : tsMode === 'passcode'
                      ? 'bg-blue-500/15 text-blue-600'
                      : 'bg-emerald-500/15 text-emerald-600'
                  }`}>
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <h5 className="font-semibold text-sm text-foreground">Timesheets & Rota</h5>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Store manager weekly view rota scheduling and employee shift updates.
                </p>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {tsMode === 'disabled' ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Unlock className="h-3.5 w-3.5" /> Direct Unlocked Access
                    </span>
                  ) : tsMode === 'passcode' ? (
                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" />
                      {isPasscodeSet ? 'Passcode Required' : 'Passcode (Normal Login until set)'}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> Store Email 2FA Required
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

          {/* Audit & Modification Info for Global 2FA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-4 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {metadata.lastUpdated
                  ? `Global 2FA modified: ${format(new Date(metadata.lastUpdated), 'PPP p')}`
                  : 'Status: Synchronized'}
              </span>
            </div>
            {metadata.updatedBy && (
              <span className="text-foreground/80 font-medium">
                By {metadata.updatedBy}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog When Disabling Global 2FA */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-lg">Disable System-Wide 2FA?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground pt-1 space-y-2">
              <p>
                Are you sure you want to turn off 2-factor authentication system-wide?
              </p>
              <p className="text-foreground font-medium">
                • Users will be able to log in normally with just their email & password without any 2-step verification code.
              </p>
              <p>
                Timesheet verification settings configured above will still remain active based on your chosen mode.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={savingGlobal}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeToggle(false)}
              disabled={savingGlobal}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {savingGlobal ? (
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

      {/* Confirmation Dialog When Clearing Passcode */}
      <AlertDialog open={clearPasscodeDialogOpen} onOpenChange={setClearPasscodeDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-lg">Remove Timesheet Passcode?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground pt-1 space-y-2">
              <p>
                Are you sure you want to remove the current timesheet passcode?
              </p>
              <p className="text-foreground font-medium">
                • Until you set a new passcode, Timesheets & Rota will allow normal direct access without prompts.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={savingTs}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPasscode}
              disabled={savingTs}
              className="bg-destructive hover:bg-destructive/90 text-white font-semibold"
            >
              {savingTs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Passcode'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog When Clearing Branch Passcode */}
      <AlertDialog open={branchClearDialogOpen} onOpenChange={setBranchClearDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <AlertDialogTitle className="text-lg">Remove Branch Passcode?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground pt-1 space-y-2">
              <p>
                Are you sure you want to remove the unique passcode for <strong className="text-foreground">{branchToClear?.name}</strong>?
              </p>
              <p className="text-foreground font-medium">
                • This branch will have direct access without passcode prompts until a new passcode is assigned.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={savingTs}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearBranchPasscode}
              disabled={savingTs}
              className="bg-destructive hover:bg-destructive/90 text-white font-semibold"
            >
              {savingTs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Yes, Remove Passcode'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Passcode Modal for Super Admin Testing */}
      <TimesheetPasscodeModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        onSuccess={() => {
          toast.success('Test verification passed successfully!');
        }}
        title="Test: Manager Timesheet Passcode"
        description="This is a live preview of what managers see when accessing Timesheets with passcode mode enabled."
      />
    </div>
  );
}
