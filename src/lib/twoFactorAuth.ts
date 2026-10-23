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
  try {
    const { data, error } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'send_code',
        email: email.trim().toLowerCase(),
        purpose,
        metadata,
      },
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to send verification code' };
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
      return { success: false, error: error.message || 'Verification failed' };
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
 * and opening it again ALWAYS requires 2-step verification.
 */
let memoryStoreSchedulingVerifiedUntil = 0;

export function isStoreSchedulingVerified(): boolean {
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

