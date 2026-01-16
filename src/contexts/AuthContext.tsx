import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'hr' | 'manager' | 'employee';

export type HRAccessLevel = 'full' | 'organization' | 'branch';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  organizationId?: string;
  branchId?: string;
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

  const fetchUserProfile = useCallback(async (userId: string): Promise<AppUser | null | 'deactivated'> => {
    try {
      // Fetch profile and role in parallel for better performance
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, name, organization_id, branch_id, hr_access_level, is_active')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
      ]);

      if (profileResult.error) {
        console.error('Error fetching profile:', profileResult.error);
        return null;
      }

      const profile = profileResult.data;

      // Check if user is deactivated
      if (profile.is_active === false) {
        return 'deactivated';
      }

      if (roleResult.error) {
        console.error('Error fetching role:', roleResult.error);
        return null;
      }

      const appUser: AppUser = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: roleResult.data.role as UserRole,
        organizationId: profile.organization_id || undefined,
        branchId: profile.branch_id || undefined,
        hrAccessLevel: profile.hr_access_level as HRAccessLevel | undefined,
      };

      return appUser;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Check for existing session FIRST before setting up listener
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

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
        
        // Only process if session actually changed
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          if (newSession?.user) {
            // Defer profile fetch to avoid deadlock
            setTimeout(async () => {
              if (mounted) {
                const result = await fetchUserProfile(newSession.user.id);
                if (mounted) {
                  if (result === 'deactivated') {
                    // User is deactivated - sign them out
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                  } else {
                    setUser(result);
                  }
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

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const logout = useCallback(async () => {
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

    return { error: null };
  }, []);

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