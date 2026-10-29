import { supabase } from '@/integrations/supabase/client';

export type TimesheetVerificationMode = 'disabled' | 'passcode' | 'two_factor';

export interface TimesheetSecurityConfig {
  mode: TimesheetVerificationMode;
  isPasscodeSet: boolean;
  passcode?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export const TIMESHEET_MODE_STORAGE_KEY = 'niza_timesheet_verification_mode';
export const TIMESHEET_PASSCODE_CONFIGURED_KEY = 'niza_timesheet_passcode_configured';
export const TIMESHEET_LAST_UPDATED_KEY = 'niza_timesheet_last_updated';
export const TIMESHEET_UPDATED_BY_KEY = 'niza_timesheet_updated_by';
export const TIMESHEET_SESSION_VERIFIED_KEY = 'niza_timesheet_session_verified_until';

// In-memory cache for instant synchronous evaluation
let memoryTimesheetMode: TimesheetVerificationMode = (() => {
  try {
    const cached = localStorage.getItem(TIMESHEET_MODE_STORAGE_KEY);
    if (cached === 'disabled' || cached === 'passcode' || cached === 'two_factor') {
      return cached;
    }
  } catch {}
  return 'disabled';
})();

let memoryPasscodeConfigured: boolean = (() => {
  try {
    return localStorage.getItem(TIMESHEET_PASSCODE_CONFIGURED_KEY) === 'true';
  } catch {
    return false;
  }
})();

let memoryTimesheetVerifiedUntil = 0;

/**
 * Returns the currently cached Timesheets verification mode synchronously.
 */
export function getTimesheetVerificationModeSync(): TimesheetVerificationMode {
  return memoryTimesheetMode;
}

/**
 * Returns true if a passcode is configured in Super Admin settings.
 */
export function isTimesheetPasscodeConfiguredSync(): boolean {
  return memoryPasscodeConfigured;
}

/**
 * Check if the active session is already verified for timesheet actions.
 * Verified tokens persist in memory for the active app session.
 */
export function isTimesheetSessionVerified(): boolean {
  const mode = getTimesheetVerificationModeSync();
  // If disabled, automatically verified
  if (mode === 'disabled') {
    return true;
  }
  // If passcode mode but no passcode set yet: give normal login/access until set!
  if (mode === 'passcode' && !isTimesheetPasscodeConfiguredSync()) {
    return true;
  }
  return Date.now() < memoryTimesheetVerifiedUntil;
}

/**
 * Mark the current timesheet session as verified.
 * For passcode mode, verification defaults to a 2-minute scheduling window so security remains tight.
 */
export function setTimesheetSessionVerified(durationMinutes = 2): void {
  memoryTimesheetVerifiedUntil = Date.now() + durationMinutes * 60 * 1000;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('niza_timesheet_session_unlocked'));
  }
}

/**
 * Clear timesheet verification session.
 */
export function clearTimesheetSessionVerified(): void {
  memoryTimesheetVerifiedUntil = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('niza_timesheet_session_locked'));
  }
}

/**
 * Determines whether a store account needs verification before editing timesheets.
 * Evaluates mode:
 * - 'disabled': false (never required)
 * - 'passcode': true only if passcode IS set and session NOT yet verified
 * - 'two_factor': true only if session NOT yet verified
 */
export function isTimesheetVerificationRequiredSync(): boolean {
  const mode = getTimesheetVerificationModeSync();
  if (mode === 'disabled') {
    return false;
  }
  if (mode === 'passcode') {
    // Until passcode is set, normal login only!
    if (!isTimesheetPasscodeConfiguredSync()) {
      return false;
    }
    return !isTimesheetSessionVerified();
  }
  if (mode === 'two_factor') {
    return !isTimesheetSessionVerified();
  }
  return false;
}

/**
 * Fetch latest Timesheet security configuration from Edge Function & DB.
 */
export async function getTimesheetSecurityConfig(): Promise<TimesheetSecurityConfig> {
  try {
    const { data: edgeData, error } = await supabase.functions.invoke('resend-2fa', {
      body: { action: 'get_timesheet_security_config' },
    });

    if (!error && edgeData && edgeData.success) {
      const mode: TimesheetVerificationMode = edgeData.mode || 'disabled';
      const isPasscodeSet = Boolean(edgeData.isPasscodeSet);

      memoryTimesheetMode = mode;
      memoryPasscodeConfigured = isPasscodeSet;

      try {
        localStorage.setItem(TIMESHEET_MODE_STORAGE_KEY, mode);
        localStorage.setItem(TIMESHEET_PASSCODE_CONFIGURED_KEY, String(isPasscodeSet));
        if (edgeData.updatedAt) localStorage.setItem(TIMESHEET_LAST_UPDATED_KEY, edgeData.updatedAt);
        if (edgeData.updatedBy) localStorage.setItem(TIMESHEET_UPDATED_BY_KEY, edgeData.updatedBy);
      } catch {}

      return {
        mode,
        isPasscodeSet,
        passcode: edgeData.passcode,
        updatedAt: edgeData.updatedAt || null,
        updatedBy: edgeData.updatedBy || null,
      };
    }
  } catch (err) {
    console.warn('Error fetching timesheet security config via edge function, using fallback:', err);
  }

  // Fallback direct table query
  try {
    const { data } = await supabase
      .from('message_settings')
      .select('setting_key, setting_value, updated_at, description')
      .in('setting_key', ['timesheet_verification_mode', 'timesheet_passcode_config']);

    let mode: TimesheetVerificationMode = 'disabled';
    let isPasscodeSet = false;

    (data || []).forEach((row) => {
      if (row.setting_key === 'timesheet_verification_mode') {
        const v = row.setting_value;
        const parsed = typeof v === 'string' ? v.replace(/^"|"$/g, '') : (v as any)?.mode || v;
        if (parsed === 'disabled' || parsed === 'passcode' || parsed === 'two_factor') {
          mode = parsed;
        }
      }
      if (row.setting_key === 'timesheet_passcode_config') {
        const v = row.setting_value;
        if (typeof v === 'object' && v !== null) {
          isPasscodeSet = Boolean((v as any).is_set);
        }
      }
    });

    memoryTimesheetMode = mode;
    memoryPasscodeConfigured = isPasscodeSet;

    return {
      mode,
      isPasscodeSet,
      updatedAt: localStorage.getItem(TIMESHEET_LAST_UPDATED_KEY),
      updatedBy: localStorage.getItem(TIMESHEET_UPDATED_BY_KEY),
    };
  } catch (err) {
    console.error('Fallback failed:', err);
  }

  return {
    mode: memoryTimesheetMode,
    isPasscodeSet: memoryPasscodeConfigured,
    updatedAt: localStorage.getItem(TIMESHEET_LAST_UPDATED_KEY),
    updatedBy: localStorage.getItem(TIMESHEET_UPDATED_BY_KEY),
  };
}

/**
 * Super Admin updates timesheet verification mode and/or passcode.
 */
export async function setTimesheetSecurityConfig(
  mode: TimesheetVerificationMode,
  passcode?: string,
  adminUser?: { name?: string; email?: string } | null
): Promise<{ success: boolean; error?: string; config?: TimesheetSecurityConfig }> {
  try {
    const updaterInfo = adminUser?.name || adminUser?.email || 'Super Admin';
    const { data, error } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'set_timesheet_security_config',
        mode,
        passcode,
        updatedBy: updaterInfo,
      },
    });

    if (error) {
      let resolvedError = error.message;
      try {
        if ('context' in error && (error as any).context && typeof (error as any).context.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) resolvedError = body.error;
        }
      } catch {}
      return { success: false, error: resolvedError || 'Failed to update timesheet security configuration' };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to update configuration' };
    }

    const finalMode: TimesheetVerificationMode = data.mode || mode;
    const isPasscodeSet = Boolean(data.isPasscodeSet);

    memoryTimesheetMode = finalMode;
    memoryPasscodeConfigured = isPasscodeSet;

    const nowIso = data.updatedAt || new Date().toISOString();
    try {
      localStorage.setItem(TIMESHEET_MODE_STORAGE_KEY, finalMode);
      localStorage.setItem(TIMESHEET_PASSCODE_CONFIGURED_KEY, String(isPasscodeSet));
      localStorage.setItem(TIMESHEET_LAST_UPDATED_KEY, nowIso);
      localStorage.setItem(TIMESHEET_UPDATED_BY_KEY, updaterInfo);
    } catch {}

    const resultConfig: TimesheetSecurityConfig = {
      mode: finalMode,
      isPasscodeSet,
      passcode: data.passcode,
      updatedAt: nowIso,
      updatedBy: updaterInfo,
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('niza_timesheet_security_changed', {
          detail: resultConfig,
        })
      );
    }

    return {
      success: true,
      config: resultConfig,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error updating timesheet security settings';
    return { success: false, error: message };
  }
}

/**
 * Verify passcode entered by user. Unlocks store scheduling on success.
 */
export async function verifyTimesheetPasscode(
  passcode: string
): Promise<{ success: boolean; verified?: boolean; error?: string; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'verify_timesheet_passcode',
        passcode: passcode.trim(),
      },
    });

    if (error) {
      let resolvedError = error.message;
      try {
        if ('context' in error && (error as any).context && typeof (error as any).context.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) resolvedError = body.error;
        }
      } catch {}
      return { success: false, verified: false, error: resolvedError || 'Failed to verify passcode' };
    }

    if (!data?.success || !data?.verified) {
      return {
        success: false,
        verified: false,
        error: data?.error || 'Incorrect passcode. Please try again.',
      };
    }

    // Unlock session on success for active scheduling
    setTimesheetSessionVerified(2);

    return {
      success: true,
      verified: true,
      message: data.message || 'Passcode verified successfully',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error verifying passcode';
    return { success: false, verified: false, error: message };
  }
}

/**
 * Subscribe to changes in Timesheets security settings
 */
export function subscribeToTimesheetSecurity(
  callback: (config: TimesheetSecurityConfig) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<TimesheetSecurityConfig>;
    if (custom?.detail) {
      callback(custom.detail);
    } else {
      getTimesheetSecurityConfig().then(callback);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === TIMESHEET_MODE_STORAGE_KEY || e.key === TIMESHEET_PASSCODE_CONFIGURED_KEY) {
      getTimesheetSecurityConfig().then(callback);
    }
  };

  window.addEventListener('niza_timesheet_security_changed', handleCustomEvent);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('niza_timesheet_security_changed', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}

