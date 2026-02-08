import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomRoleAccess, AppAccess } from '@/hooks/useCustomRoleAccess';
import { NizaLoaderFullPage } from '@/components/ui/niza-loader';

interface AppRouteGuardProps {
  children: ReactNode;
  appKey: keyof AppAccess;
}

/**
 * Route guard for Niza apps (Safe, Finance, Templates)
 * Checks if user has access based on:
 * 1. Super admin role (always allowed)
 * 2. Full HR role (always allowed)
 * 3. Custom role with app_access enabled
 */
export default function AppRouteGuard({ children, appKey }: AppRouteGuardProps) {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAppAccess, isLoading: roleLoading } = useCustomRoleAccess();

  const isLoading = authLoading || roleLoading;

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - redirect to login
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Super admins always have access
    if (user.role === 'super_admin') return;

    // Full HR always has access
    if (user.role === 'hr' && user.hrAccessLevel === 'full') return;

    // Check custom role app access
    if (!hasAppAccess(appKey)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, isLoading, hasAppAccess, appKey, navigate]);

  if (isLoading) {
    return <NizaLoaderFullPage />;
  }

  // Check access synchronously for render
  if (!user) return null;
  
  if (user.role === 'super_admin') return <>{children}</>;
  if (user.role === 'hr' && user.hrAccessLevel === 'full') return <>{children}</>;
  if (hasAppAccess(appKey)) return <>{children}</>;

  return null;
}
