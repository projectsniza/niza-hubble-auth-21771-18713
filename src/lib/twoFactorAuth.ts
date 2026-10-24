import { supabase } from '@/integrations/supabase/client';

export type TwoFactorPurpose =
  | 'login'
  | 'password_reset'
  | 'admin_password_change'
  | 'store_scheduling';

export interface Send2FAResponse {
  success: boolean;
  challengeToken?: string;
  email?: string;
  purpose?: TwoFactorPurpose;
  expiresInSeconds?: number;
  error?: string;
}

export interface Verify2FAResponse {
  success: boolean;
  verified?: boolean;
  resetAuthToken?: string;
  schedulingAccessToken?: string;
  loginAccessToken?: string;
  challengeToken?: string; // If attempts remaining, returns updated challenge token
  error?: string;
  message?: string;
}

const STORE_SCHEDULING_KEY = 'niza_store_scheduling_verified_until';

/**
 * Request a 6-digit OTP code to be sent to the user via Resend
 */
export async function send2FACode(
  email: string,
  purpose: TwoFactorPurpose,
  metadata?: Record<string, unknown>
): Promise<Send2FAResponse> {
  // If 2FA is disabled system-wide, skip sending code for auth purposes
  if (!isTwoFactorAuthEnabledSync() && (purpose === 'login' || purpose === 'store_scheduling' || purpose === 'admin_password_change')) {
    return {
      success: true,
      disabled: true,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'send_code',
        email: email.trim().toLowerCase(),
        purpose,
        metadata,
      },
    });

    if (data?.disabled || data?.error?.toLowerCase().includes('disabled')) {
      memory2FAEnabled = false;
      try {
        localStorage.setItem(TWO_FACTOR_GLOBAL_KEY, 'false');
      } catch {}
      return { success: true, disabled: true };
    }

    if (error) {
      let resolvedError = error.message;
      try {
        if ('context' in error && (error as any).context && typeof (error as any).context.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) resolvedError = body.error;
          if (body?.disabled || body?.error?.toLowerCase().includes('disabled')) {
            memory2FAEnabled = false;
            try {
              localStorage.setItem(TWO_FACTOR_GLOBAL_KEY, 'false');
            } catch {}
            return { success: true, disabled: true };
          }
        }
      } catch {}
      return { success: false, error: resolvedError || 'Failed to send verification code' };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to send verification code' };
    }

    return {
      success: true,
      challengeToken: data.challengeToken,
      email: data.email,
      purpose: data.purpose,
      expiresInSeconds: data.expiresInSeconds,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error sending 2FA code';
    return { success: false, error: message };
  }
}

/**
 * Verify a 6-digit code with the signed challenge token
 */
export async function verify2FACode(
  challengeToken: string,
  code: string,
  newPassword?: string
): Promise<Verify2FAResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'verify_code',
        challengeToken,
        code: code.trim(),
        newPassword,
      },
    });

    if (error) {
      let resolvedError = error.message;
      let nextToken: string | undefined;
      try {
        if ('context' in error && (error as any).context && typeof (error as any).context.json === 'function') {
          const body = await (error as any).context.json();
          if (body?.error) resolvedError = body.error;
          if (body?.challengeToken) nextToken = body.challengeToken;
        }
      } catch {}
      return { success: false, error: resolvedError || 'Verification failed', challengeToken: nextToken };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Invalid verification code',
        challengeToken: data?.challengeToken, // allows remaining attempts retry
      };
    }

    return {
      success: true,
      verified: true,
      resetAuthToken: data.resetAuthToken,
      schedulingAccessToken: data.schedulingAccessToken,
      loginAccessToken: data.loginAccessToken,
      message: data.message,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error verifying code';
    return { success: false, error: message };
  }
}

/**
 * 24-Hour Daily Session Lifecycle Helpers
 * Every user account expires 24 hours after login / 2FA verification.
 * Once 24 hours have elapsed, or on the first open/login of the day,
 * the session is expired and requires fresh login + 2-step verification.
 */
const SESSION_LOGIN_TIME_KEY = 'niza_auth_session_created_at';
const SESSION_LOGIN_DATE_KEY = 'niza_auth_session_created_date';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function recordUserSessionStart(): void {
  try {
    const now = new Date();
    localStorage.setItem(SESSION_LOGIN_TIME_KEY, String(now.getTime()));
    // Record current calendar date (YYYY-MM-DD in local time)
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem(SESSION_LOGIN_DATE_KEY, localDateStr);
  } catch {
    // ignore
  }
}

/**
 * Returns true if the session is older than 24 hours OR belongs to a previous calendar day,
 * guaranteeing that each day when users first open or login to the app, fresh authentication
 * and 2-step verification is enforced.
 */
export function isSessionExpired24Hours(): boolean {
  try {
    const rawTime = localStorage.getItem(SESSION_LOGIN_TIME_KEY);
    const rawDate = localStorage.getItem(SESSION_LOGIN_DATE_KEY);

    if (!rawTime || !rawDate) {
      return true; // No record exists -> session must re-authenticate with 2FA
    }

    const loginTime = parseInt(rawTime, 10);
    if (isNaN(loginTime)) return true;

    // Check if 24 hours have elapsed
    if (Date.now() - loginTime > SESSION_MAX_AGE_MS) {
      return true;
    }

    // Check if today is a new calendar day
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (rawDate !== todayStr) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function clearUserSessionStart(): void {
  try {
    localStorage.removeItem(SESSION_LOGIN_TIME_KEY);
    localStorage.removeItem(SESSION_LOGIN_DATE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Store Account scheduling session helpers
 * Stored strictly in-memory per app launch so that closing the app
 * and opening it again ALWAYS requires 2-step verification (when 2FA is enabled).
 */
let memoryStoreSchedulingVerifiedUntil = 0;

export function isStoreSchedulingVerified(): boolean {
  // If 2FA is disabled system-wide, store scheduling is immediately unlocked!
  if (!isTwoFactorAuthEnabledSync()) {
    return true;
  }
  return Date.now() < memoryStoreSchedulingVerifiedUntil;
}

export function setStoreSchedulingVerified(durationHours = 2): void {
  // Stored strictly in runtime memory for the active app session
  memoryStoreSchedulingVerifiedUntil = Date.now() + durationHours * 60 * 60 * 1000;
  try {
    sessionStorage.removeItem(STORE_SCHEDULING_KEY);
    localStorage.removeItem(STORE_SCHEDULING_KEY);
  } catch {
    // ignore
  }
}

export function clearStoreSchedulingVerified(): void {
  memoryStoreSchedulingVerifiedUntil = 0;
  try {
    sessionStorage.removeItem(STORE_SCHEDULING_KEY);
    localStorage.removeItem(STORE_SCHEDULING_KEY);
  } catch {
    // ignore
  }
}

/**
 * ============================================================================
 * GLOBAL TWO-FACTOR AUTHENTICATION SYSTEM-WIDE SETTING
 * ============================================================================
 * Managed exclusively by Super Administrators in Settings.
 * When disabled:
 * - Normal password login without any 2-step verification code across the app.
 * - Weekly timesheet scheduling is directly unlocked without 2-step verification.
 * - Super admin password changes update directly without 2-step verification.
 */
export const TWO_FACTOR_GLOBAL_KEY = 'niza_2fa_enabled_system_wide';
export const TWO_FACTOR_LAST_UPDATED_KEY = 'niza_2fa_last_updated';
export const TWO_FACTOR_UPDATED_BY_KEY = 'niza_2fa_updated_by';
export const TWO_FACTOR_SETTING_DB_KEY = 'two_factor_auth_enabled';

// In-memory cache for ultra-fast synchronous checks
let memory2FAEnabled: boolean | null = (() => {
  try {
    const cached = localStorage.getItem(TWO_FACTOR_GLOBAL_KEY);
    if (cached === 'false') return false;
    if (cached === 'true') return true;
  } catch {
    // ignore
  }
  return null;
})();

/**
 * Synchronous check whether 2FA is enabled.
 * Uses cached memory/localStorage so UI renders immediately without flashing modals.
 * Defaults to true if no explicit disable recorded.
 */
export function isTwoFactorAuthEnabledSync(): boolean {
  if (memory2FAEnabled !== null) {
    return memory2FAEnabled;
  }
  try {
    const cached = localStorage.getItem(TWO_FACTOR_GLOBAL_KEY);
    if (cached === 'false') {
      memory2FAEnabled = false;
      return false;
    }
    if (cached === 'true') {
      memory2FAEnabled = true;
      return true;
    }
  } catch {
    // ignore
  }
  // Default to true
  return true;
}

/**
 * Fetch latest 2FA setting from database (message_settings table).
 * Synchronizes localStorage and runtime memory cache.
 */
export async function getTwoFactorAuthEnabled(): Promise<boolean> {
  try {
    // 1. Query Edge function first (runs with service role, always accessible to anon and auth users)
    try {
      const { data: edgeData } = await supabase.functions.invoke('resend-2fa', {
        body: { action: 'get_2fa_config' },
      });
      if (edgeData && typeof edgeData.twoFactorEnabled === 'boolean') {
        const isEnabled = edgeData.twoFactorEnabled;
        memory2FAEnabled = isEnabled;
        try {
          localStorage.setItem(TWO_FACTOR_GLOBAL_KEY, String(isEnabled));
          if (edgeData.updatedAt) {
            localStorage.setItem(TWO_FACTOR_LAST_UPDATED_KEY, edgeData.updatedAt);
          }
          if (edgeData.description) {
            localStorage.setItem(TWO_FACTOR_UPDATED_BY_KEY, edgeData.description);
          }
        } catch {
          // ignore
        }
        return isEnabled;
      }
    } catch {
      // fallback to direct table
    }

    // 2. Direct table fallback (when authenticated)
    const { data, error } = await supabase
      .from('message_settings')
      .select('setting_value, updated_at, description')
      .eq('setting_key', TWO_FACTOR_SETTING_DB_KEY)
      .maybeSingle();

    if (!error && data) {
      let isEnabled = true;
      const rawVal = data.setting_value;

      if (rawVal === false || rawVal === 'false' || rawVal === '0') {
        isEnabled = false;
      } else if (typeof rawVal === 'object' && rawVal !== null && (rawVal as any).enabled === false) {
        isEnabled = false;
      } else {
        isEnabled = true;
      }

      memory2FAEnabled = isEnabled;
      try {
        localStorage.setItem(TWO_FACTOR_GLOBAL_KEY, String(isEnabled));
        if (data.updated_at) {
          localStorage.setItem(TWO_FACTOR_LAST_UPDATED_KEY, data.updated_at);
        }
        if (data.description) {
          localStorage.setItem(TWO_FACTOR_UPDATED_BY_KEY, data.description);
        }
      } catch {
        // ignore
      }

      return isEnabled;
    }
  } catch (err) {
    console.warn('Error fetching 2FA setting from DB, using cache:', err);
  }

  // Fallback to cache / sync value
  return isTwoFactorAuthEnabledSync();
}

/**
 * Update 2FA setting system-wide (Super Admin only).
 * Persists to Supabase, updates localStorage and notifies all components.
 */
export async function setTwoFactorAuthEnabled(
  enabled: boolean,
  adminUser?: { id?: string; name?: string; role?: string; email?: string } | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update memory and localStorage immediately
    memory2FAEnabled = enabled;
    const nowIso = new Date().toISOString();
    const updaterInfo = adminUser?.name || adminUser?.email || 'Super Admin';

    try {
      localStorage.setItem(TWO_FACTOR_GLOBAL_KEY, String(enabled));
      localStorage.setItem(TWO_FACTOR_LAST_UPDATED_KEY, nowIso);
      localStorage.setItem(TWO_FACTOR_UPDATED_BY_KEY, updaterInfo);
    } catch {
      // ignore
    }

    // Dispatch custom event for real-time reactivity in current tab
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('niza_2fa_setting_changed', {
          detail: { enabled, updatedBy: updaterInfo, updatedAt: nowIso },
        })
      );
    }

    // Persist to Supabase message_settings
    const { error } = await supabase
      .from('message_settings')
      .upsert(
        {
          setting_key: TWO_FACTOR_SETTING_DB_KEY,
          setting_value: String(enabled),
          description: `2FA ${enabled ? 'enabled' : 'disabled'} by ${updaterInfo}`,
          updated_at: nowIso,
        },
        { onConflict: 'setting_key' }
      );

    if (error) {
      console.warn('Could not persist 2FA setting directly to message_settings:', error.message);
      // Attempt via Edge function
      try {
        await supabase.functions.invoke('resend-2fa', {
          body: {
            action: 'set_2fa_config',
            enabled,
            updatedBy: updaterInfo,
          },
        });
      } catch {
        // ignore
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update 2FA setting';
    return { success: false, error: message };
  }
}

/**
 * Returns metadata about when 2FA setting was last modified and by whom.
 */
export function getTwoFactorMetadata(): { lastUpdated: string | null; updatedBy: string | null } {
  try {
    return {
      lastUpdated: localStorage.getItem(TWO_FACTOR_LAST_UPDATED_KEY),
      updatedBy: localStorage.getItem(TWO_FACTOR_UPDATED_BY_KEY),
    };
  } catch {
    return { lastUpdated: null, updatedBy: null };
  }
}

/**
 * Subscribe to changes in the 2FA setting
 */
export function subscribeToTwoFactorSetting(callback: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<{ enabled: boolean }>;
    if (custom?.detail?.enabled !== undefined) {
      callback(custom.detail.enabled);
    } else {
      callback(isTwoFactorAuthEnabledSync());
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === TWO_FACTOR_GLOBAL_KEY) {
      callback(e.newValue !== 'false');
    }
  };

  window.addEventListener('niza_2fa_setting_changed', handleCustomEvent);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('niza_2fa_setting_changed', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}


