import type { AppUser } from '@/contexts/AuthContext';

/**
 * Check if user has admin-level access (super_admin or any HR).
 * HR users have the same features as super_admin except Contract Approvals.
 */
export function isAdminOrHR(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin' || user.role === 'hr';
}

/**
 * Check if user is super_admin only (for Contract Approvals, Settings management).
 */
export function isSuperAdmin(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin';
}

/**
 * Get the user's scoped organization ID.
 * Super admins have no scope restriction (returns undefined).
 * HR users return their assigned organizationId.
 */
export function getScopedOrgId(user: AppUser | null): string | undefined {
  if (!user) return undefined;
  if (user.role === 'super_admin') return undefined; // no restriction
  return user.organizationId;
}

/**
 * Get the user's scoped branch ID.
 * Super admins have no scope restriction (returns undefined).
 * HR users with branch-level scope return their branchId.
 */
export function getScopedBranchId(user: AppUser | null): string | undefined {
  if (!user) return undefined;
  if (user.role === 'super_admin') return undefined; // no restriction
  if (user.role === 'hr' && user.hrAccessLevel === 'branch') return user.branchId;
  return undefined;
}

/**
 * Whether user needs to select org/branch (i.e., they don't have a fixed scope).
 * Super admins always need selection. HR with 'full' or 'organization' scope need branch selection.
 */
export function needsOrgBranchSelection(user: AppUser | null): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'hr') return true; // HR always needs selection within their scope
  return false;
}
