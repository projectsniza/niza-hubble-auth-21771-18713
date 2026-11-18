import { useAuth } from '@/contexts/AuthContext';
import type { AppCustomRole } from '@/contexts/AuthContext';

export interface AppAccess {
  niza_safe: boolean;
  niza_finance: boolean;
  niza_templates: boolean;
  niza_elearning: boolean;
}

/**
 * Custom role access for the signed-in user.
 *
 * The role is loaded together with the user's profile (AuthContext), so permissions are
 * known on the very first render. Previously each caller fetched it separately and, while
 * that fetch was running, HR users briefly had *every* permission - which is why popups and
 * pages outside the role still appeared.
 */
export function useCustomRoleAccess() {
  const { user, isLoading } = useAuth();
  const customRole: AppCustomRole | null = user?.customRole ?? null;

  const hasAppAccess = (app: keyof AppAccess): boolean => {
    if (user?.role === 'super_admin') return true;
    if (user?.role === 'hr' && !customRole) return true;
    if (customRole?.app_access) return customRole.app_access[app] === true;
    return false;
  };

  const hasPermission = (permission: string): boolean => {
    if (user?.role === 'super_admin') return true;
    // HR without a custom role keeps full access
    if (user?.role === 'hr' && !customRole) return true;
    if (customRole?.permissions) return customRole.permissions[permission] === true;
    return false;
  };

  const isWithinScope = (orgId?: string, branchId?: string): boolean => {
    if (user?.role === 'super_admin') return true;
    if (!customRole?.organization_id && (!customRole?.branch_ids || customRole.branch_ids.length === 0)) return true;
    if (customRole?.organization_id && orgId && orgId !== customRole.organization_id) return false;
    const allowed = customRole?.branch_ids || [];
    if (allowed.length > 0 && branchId && !allowed.includes(branchId)) return false;
    return true;
  };

  return {
    customRole,
    isLoading,
    hasAppAccess,
    hasPermission,
    isWithinScope,
  };
}
