import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/hooks/useActivityLogs';
import type { Session } from '@supabase/supabase-js';
import {
  recordUserSessionStart,
  isSessionExpired24Hours,
  clearUserSessionStart,
} from '@/lib/twoFactorAuth';

export type UserRole = 'super_admin' | 'hr' | 'manager' | 'employee';

export type HRAccessLevel = 'full' | 'organization' | 'branch';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  organizationId?: string;
  branchId?: string;
  branchIds?: string[];
  hrAccessLevel?: HRAccessLevel;
  /** Active custom role, loaded with the profile so permissions apply from the first render. */
  customRole?: AppCustomRole | null;
}

export interface AppCustomRole {
  id: string;
  name: string;
  base_role: string;
  permissions: Record<string, boolean>;
  app_access: { niza_safe: boolean; niza_finance: boolean; niza_templates: boolean; niza_elearning: boolean; niza_fuel: boolean };
  organization_id: string | null;
  branch_id: string | null;
  branch_ids: string[];
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchUserProfile = useCallback(async (userId: string, retryCount = 0): Promise<AppUser | null | 'deactivated'> => {
    try {
      // Fetch profile, role and employee status in parallel for better performance
      const [profileResult, roleResult, employeeByUserResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, name, organization_id, branch_id, hr_access_level, is_active, custom_role_id')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('employees')
          .select('status, deactivation_reason, email, branch_id, organization_id')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      // Retry on 503/network errors (up to 2 retries)
      const hasServerError = [profileResult.error, roleResult.error, employeeByUserResult.error].some(
        err => err && (err.message?.includes('503') || err.message?.includes('fetch') || err.code === 'PGRST301')
      );
      if (hasServerError && retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchUserProfile(userId, retryCount + 1);
      }

      if (profileResult.error) {
        if (profileResult.error.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileResult.error);
        }
        return null;
      }

      let profile = profileResult.data;

      // Auto-heal a missing profile row. Only the name/email come from the user's own
      // metadata; scope fields come from app_metadata (which users cannot edit), and the
      // role is never written from the browser — user_roles is managed by the server.
      if (!profile) {
        try {
          const { data: authUserData } = await supabase.auth.getUser();
          if (authUserData?.user && authUserData.user.id === userId) {
            const meta = authUserData.user.user_metadata || {};
            const appMeta = authUserData.user.app_metadata || {};
            const { data: healedProfile } = await supabase
              .from('profiles')
              .upsert({
                id: userId,
                email: authUserData.user.email || '',
                name: meta.name || authUserData.user.email || 'User',
                organization_id: appMeta.organization_id || null,
                branch_id: appMeta.branch_id || null,
                is_active: true,
              })
              .select('id, email, name, organization_id, branch_id, hr_access_level, is_active, custom_role_id')
              .maybeSingle();

            if (healedProfile) profile = healedProfile;
          }
        } catch (healErr) {
          console.warn('Auto-healing profile error:', healErr);
        }
      }

      if (!profile) return null;

      if (employeeByUserResult.error && employeeByUserResult.error.code !== 'PGRST116') {
        console.error('Error fetching employee status by user:', employeeByUserResult.error);
      }

      let employeeStatus = employeeByUserResult.data?.status ?? null;
      let employeeDeactivationReason = employeeByUserResult.data?.deactivation_reason ?? null;

      let employeeByEmailData: any = null;
      if ((!employeeStatus || !employeeDeactivationReason) && profile.email) {
        const { data: employeeByEmail, error: employeeByEmailError } = await supabase
          .from('employees')
          .select('status, deactivation_reason, branch_id, organization_id')
          .ilike('email', profile.email)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (employeeByEmailError && employeeByEmailError.code !== 'PGRST116') {
          console.error('Error fetching employee status by email:', employeeByEmailError);
        }

        employeeByEmailData = employeeByEmail;
        employeeStatus = employeeByEmail?.status ?? employeeStatus;
        employeeDeactivationReason = employeeByEmail?.deactivation_reason ?? employeeDeactivationReason;
      }

      // Determine user role with fallback for custom roles
      let resolvedRole: UserRole = (roleResult.data?.role as UserRole) || 'employee';

      // Check custom role if attached
      let branchIds: string[] = [];
      let appCustomRole: AppCustomRole | null = null;
      if (profile.custom_role_id) {
        const { data: customRole } = await (supabase as any)
          .from('custom_roles')
          .select('id, name, base_role, permissions, app_access, branch_ids, branch_id, organization_id, is_active')
          .eq('id', profile.custom_role_id)
          .maybeSingle();

        if (customRole) {
          // If the custom role itself has been deactivated by Super Admin, block access
          if (customRole.is_active === false) {
            return 'deactivated';
          }
          if (customRole.base_role && !roleResult.data?.role) {
            resolvedRole = customRole.base_role as UserRole;
          }
          branchIds = Array.isArray(customRole.branch_ids) && customRole.branch_ids.filter(Boolean).length > 0
            ? customRole.branch_ids.filter(Boolean)
            : customRole.branch_id
              ? [customRole.branch_id]
              : [];
          const access = (customRole.app_access && typeof customRole.app_access === 'object') ? customRole.app_access : {};
          appCustomRole = {
            id: customRole.id,
            name: customRole.name,
            base_role: customRole.base_role,
            permissions: (customRole.permissions && typeof customRole.permissions === 'object' && !Array.isArray(customRole.permissions))
              ? customRole.permissions
              : {},
            app_access: {
              niza_safe: Boolean(access.niza_safe),
              niza_finance: Boolean(access.niza_finance),
              niza_templates: Boolean(access.niza_templates),
              niza_elearning: Boolean(access.niza_elearning),
              niza_fuel: Boolean(access.niza_fuel),
            },
            organization_id: customRole.organization_id ?? null,
            branch_id: customRole.branch_id ?? null,
            branch_ids: branchIds,
          };
        }
      }

      // Only evaluate employee status for pure staff employees (not custom roles or administrative roles)
      const isCustomRoleUser = Boolean(profile.custom_role_id);
      const isPureStaffEmployee = resolvedRole === 'employee' && !isCustomRoleUser;

      const isEmployeeDeactivated = isPureStaffEmployee && (
        employeeStatus === 'inactive' ||
        employeeStatus === 'terminated' ||
        Boolean(employeeDeactivationReason)
      );

      // Check if user is deactivated in profile or (for staff employees) in employee record
      if (profile.is_active === false || isEmployeeDeactivated) {
        return 'deactivated';
      }

      const resolvedBranchId = profile.branch_id || employeeByUserResult.data?.branch_id || employeeByEmailData?.branch_id || undefined;
      const resolvedOrgId = profile.organization_id || employeeByUserResult.data?.organization_id || employeeByEmailData?.organization_id || undefined;

      // Effective scope: a custom role's organisation / branches override the profile defaults
      // (mirrors get_my_profile_data() in the database, so screens and RLS agree).
      let effectiveOrgId = resolvedOrgId;
      let effectiveLevel: HRAccessLevel = (profile.hr_access_level as HRAccessLevel) || 'full';
      if (appCustomRole) {
        if (branchIds.length > 0) {
          effectiveLevel = 'branch';
          effectiveOrgId = appCustomRole.organization_id ?? resolvedOrgId;
        } else if (appCustomRole.organization_id) {
          effectiveLevel = 'organization';
          effectiveOrgId = appCustomRole.organization_id;
        }
      }

      const appUser: AppUser = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: resolvedRole,
        organizationId: effectiveOrgId,
        // store accounts whose store is only set on their custom role still get a "my branch"
        branchId: resolvedBranchId ?? (branchIds.length > 0 ? branchIds[0] : undefined),
        branchIds,
        hrAccessLevel: effectiveLevel,
        customRole: appCustomRole,
      };

      return appUser;
    } catch (error) {
      // Retry on network errors
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchUserProfile(userId, retryCount + 1);
      }
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Check for existing session FIRST before setting up listener
    const initializeAuth = async () => {
      try {
        // Enforce 24-hour automatic logout across all accounts
        if (isSessionExpired24Hours()) {
          clearUserSessionStart();
          await supabase.auth.signOut();
          if (mounted) {
            setSession(null);
            setUser(null);
            setIsLoading(false);
            setIsInitialized(true);
          }
          return;
        }

        const {
          data: { session: existingSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          const refreshTokenInvalid =
            sessionError.code === 'refresh_token_not_found' ||
            sessionError.message?.includes('Refresh Token Not Found');

          if (refreshTokenInvalid) {
            await supabase.auth.signOut({ scope: 'local' });
          }

          setSession(null);
          setUser(null);
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        if (existingSession?.user && !existingSession.user.email_confirmed_at) {
          // Block app access for unverified accounts
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        if (existingSession?.user) {
          setSession(existingSession);
          const result = await fetchUserProfile(existingSession.user.id);
          if (mounted) {
            if (result === 'deactivated') {
              // User is deactivated - sign them out
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
            } else {
              setUser(result);
            }
            setIsLoading(false);
            setIsInitialized(true);
          }
        } else {
          setSession(null);
          setUser(null);
          setIsLoading(false);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener AFTER initial check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted || !isInitialized) return;
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        } else if (event === 'SIGNED_IN') {
          if (newSession?.user && !newSession.user.email_confirmed_at) {
            supabase.auth.signOut();
            return;
          }
          setSession(newSession);
          if (newSession?.user) {
            setTimeout(async () => {
              if (mounted) {
                const result = await fetchUserProfile(newSession.user.id);
                if (mounted) {
                  if (result === 'deactivated') {
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                  } else if (result) {
                    setUser(result);
                  }
                }
              }
            }, 0);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Only update session, don't re-fetch profile unless user is null
          setSession(newSession);
          if (!user && newSession?.user) {
            setTimeout(async () => {
              if (mounted) {
                const result = await fetchUserProfile(newSession.user.id);
                if (mounted && result && result !== 'deactivated') {
                  setUser(result);
                }
              }
            }, 0);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isInitialized, fetchUserProfile]);

  // Periodic and window-focus watchdog to immediately log out when 24 hours have passed
  useEffect(() => {
    if (!session) return;

    const checkExpiration = async () => {
      if (isSessionExpired24Hours()) {
        clearUserSessionStart();
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
    };

    // Check every minute
    const interval = setInterval(checkExpiration, 60 * 1000);

    // Also check whenever tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExpiration();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [session]);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    // Unverified accounts cannot access the app until they confirm via email code
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return {
        error: 'Your email is not verified yet. Use "Forgot password?" on the sign-in page to verify your email and set a new password.',
      };
    }

    // Immediately fetch user profile and set state after successful login
    // This ensures user state is set before returning to the caller
    if (data.user) {
      const result = await fetchUserProfile(data.user.id);
      if (result === 'deactivated') {
        // Sign out the deactivated user immediately
        await supabase.auth.signOut();
        return { error: 'Your account has been deactivated. Please contact your administrator.' };
      }

      if (!result) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return { error: 'Unable to load your account. Please contact your administrator.' };
      }

      // Set user and session state immediately so navigation works
      setSession(data.session);
      setUser(result);
      recordUserSessionStart();
    }

    return { error: null };
  }, [fetchUserProfile]);

  const logout = useCallback(async () => {
    clearUserSessionStart();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    // Log password change activity for super admin notification
    if (user) {
      await logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        activityType: 'password_change',
        activityCategory: 'security',
        title: 'Password Changed',
        description: `${user.name} changed their password`,
        organizationId: user.organizationId,
        branchId: user.branchId,
      });
    }

    return { error: null };
  }, [user]);

  const contextValue = useMemo(() => ({
    user,
    session,
    isLoading,
    login,
    logout,
    updatePassword
  }), [user, session, isLoading, login, logout, updatePassword]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};