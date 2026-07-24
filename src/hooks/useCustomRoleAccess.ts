import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppAccess {
  niza_safe: boolean;
  niza_finance: boolean;
  niza_templates: boolean;
  niza_elearning: boolean;
}

interface CustomRoleData {
  id: string;
  name: string;
  base_role: string;
  permissions: Record<string, boolean>;
  app_access: AppAccess;
  organization_id: string | null;
  branch_id: string | null;
  branch_ids: string[];
}

export function useCustomRoleAccess() {
  const { user } = useAuth();
  const [customRole, setCustomRole] = useState<CustomRoleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomRole() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Get the user's custom_role_id from their profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('custom_role_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.custom_role_id) {
          setCustomRole(null);
          setIsLoading(false);
          return;
        }

        // Fetch the custom role details
        const { data: role, error: roleError } = await supabase
          .from('custom_roles')
          .select('*')
          .eq('id', profile.custom_role_id)
          .eq('is_active', true)
          .single();

        if (roleError || !role) {
          setCustomRole(null);
          setIsLoading(false);
          return;
        }

        // Parse app_access safely
        let app_access: AppAccess = {
          niza_safe: false,
          niza_finance: false,
          niza_templates: false,
          niza_elearning: false,
        };

        if (role.app_access && typeof role.app_access === 'object') {
          const access = role.app_access as Record<string, unknown>;
          app_access = {
            niza_safe: Boolean(access.niza_safe),
            niza_finance: Boolean(access.niza_finance),
            niza_templates: Boolean(access.niza_templates),
            niza_elearning: Boolean(access.niza_elearning),
          };
        }

        // Parse permissions safely
        let permissions: Record<string, boolean> = {};
        if (role.permissions && typeof role.permissions === 'object' && !Array.isArray(role.permissions)) {
          permissions = role.permissions as Record<string, boolean>;
        }

        setCustomRole({
          id: role.id,
          name: role.name,
          base_role: role.base_role,
          permissions,
          app_access,
          organization_id: role.organization_id,
          branch_id: role.branch_id,
          branch_ids: Array.isArray((role as any).branch_ids) ? ((role as any).branch_ids as string[]) : (role.branch_id ? [role.branch_id] : []),
        });
      } catch (error) {
        console.error('Error fetching custom role:', error);
        setCustomRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomRole();
  }, [user?.id]);

  // Helper functions to check access
  const hasAppAccess = (app: keyof AppAccess): boolean => {
    // Super admins always have access
    if (user?.role === 'super_admin') return true;
    // HR without custom role has full access
    if (user?.role === 'hr' && !customRole) return true;

    // Check custom role app access
    if (customRole?.app_access) {
      return customRole.app_access[app] === true;
    }

    return false;
  };

  const hasPermission = (permission: string): boolean => {
    // Super admins have all permissions
    if (user?.role === 'super_admin') return true;

    // HR without custom role has all permissions
    if (user?.role === 'hr' && !customRole) return true;

    // Check custom role permissions
    if (customRole?.permissions) {
      return customRole.permissions[permission] === true;
    }

    return false;
  };

  const isWithinScope = (orgId?: string, branchId?: string): boolean => {
    // Super admins can access everything
    if (user?.role === 'super_admin') return true;

    // If custom role has no scope restrictions, allow
    if (!customRole?.organization_id && !customRole?.branch_id && (!customRole?.branch_ids || customRole.branch_ids.length === 0)) {
      return true;
    }

    // Check organization scope
    if (customRole?.organization_id && orgId && orgId !== customRole.organization_id) {
      return false;
    }

    // Check branch scope: allow any branch in branch_ids, or the legacy single branch_id.
    const allowedBranches = (customRole?.branch_ids && customRole.branch_ids.length > 0)
      ? customRole.branch_ids
      : (customRole?.branch_id ? [customRole.branch_id] : []);

    if (allowedBranches.length > 0 && branchId && !allowedBranches.includes(branchId)) {
      return false;
    }

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
