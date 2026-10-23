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
          .select('status, deactivation_reason, email')
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

      const profile = profileResult.data;
      if (!profile) return null;

      if (employeeByUserResult.error && employeeByUserResult.error.code !== 'PGRST116') {
        console.error('Error fetching employee status by user:', employeeByUserResult.error);
      }

      let employeeStatus = employeeByUserResult.data?.status ?? null;
      let employeeDeactivationReason = employeeByUserResult.data?.deactivation_reason ?? null;

      if ((!employeeStatus || !employeeDeactivationReason) && profile.email) {
        const { data: employeeByEmail, error: employeeByEmailError } = await supabase
          .from('employees')
          .select('status, deactivation_reason')
          .ilike('email', profile.email)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (employeeByEmailError && employeeByEmailError.code !== 'PGRST116') {
          console.error('Error fetching employee status by email:', employeeByEmailError);
        }

        employeeStatus = employeeByEmail?.status ?? employeeStatus;
        employeeDeactivationReason = employeeByEmail?.deactivation_reason ?? employeeDeactivationReason;
      }

      const isEmployeeDeactivated =
        employeeStatus === 'inactive' ||
        employeeStatus === 'terminated' ||
        !!employeeDeactivationReason;

      // Check if user is deactivated in either profiles or employees
      if (profile.is_active === false || isEmployeeDeactivated) {
        return 'deactivated';
      }

      if (roleResult.error) {
        if (roleResult.error.code !== 'PGRST116') {
          console.error('Error fetching role:', roleResult.error);
        }
        return null;
      }

      let branchIds: string[] = [];
      if (profile.custom_role_id) {
        const { data: customRole } = await (supabase as any)
          .from('custom_roles')
          .select('branch_ids, branch_id, organization_id, is_active')
          .eq('id', profile.custom_role_id)
          .eq('is_active', true)
          .maybeSingle();

        if (customRole) {
          branchIds = Array.isArray(customRole.branch_ids)
            ? customRole.branch_ids.filter(Boolean)
            : customRole.branch_id
              ? [customRole.branch_id]
              : [];
        }
      }

      const appUser: AppUser = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: (roleResult.data?.role as UserRole) ?? 'employee',
        organizationId: profile.organization_id || undefined,
        branchId: profile.branch_id || undefined,
        branchIds,
        hrAccessLevel: (profile.hr_access_level as HRAccessLevel) || 'full',
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
        error: 'Your email is not verified yet. Use "Login with email code" on the sign-in page to receive a 6-digit code.',
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