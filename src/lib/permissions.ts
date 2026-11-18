/**
 * Single source of truth for which custom-role permission each dashboard page needs.
 * Used by the sidebar, the Home module grid and the route guard so they can never disagree.
 * Pages not listed here (Home, My Profile, Notifications) are open to every signed-in user.
 */
export const PATH_PERMISSION: Record<string, string | string[]> = {
  '/dashboard/overview': 'overview',
  '/dashboard/visualization': 'visualization',
  '/dashboard/employees': 'employee_management',
  '/dashboard/add-employee': 'employee_management',
  '/dashboard/onboarding': ['onboarding', 'employee_management'],
  '/dashboard/documents': 'documents',
  '/dashboard/documents/submit': 'documents',
  '/dashboard/documents/todo': 'documents',
  '/dashboard/drive-offs': 'drive_offs',
  '/dashboard/lottery': 'lottery',
  '/dashboard/daily-reports': 'daily_reports',
  '/dashboard/maintenance': 'maintenance',
  '/dashboard/elearning': 'training',
  '/dashboard/attendance': 'attendance',
  '/dashboard/scheduling': 'scheduling',
  '/dashboard/clock-ins': 'clock_ins',
  '/dashboard/events': 'events',
  '/dashboard/payroll': 'payroll',
  '/dashboard/performance': 'performance',
  '/dashboard/uk-compliance': 'uk_compliance',
  '/dashboard/messages': 'messages',
  '/dashboard/reminders': 'reminders',
  '/dashboard/settings': 'settings',
  '/dashboard/safety-tasks': 'safety',
  '/dashboard/store-templates': 'templates',
  '/dashboard/templates': 'templates',
  '/dashboard/customer-accounts': 'customer_accounts',
  '/dashboard/daily-summary': 'daily_summary',
  '/dashboard/daily-sales-upload': 'daily_summary',
};

/** Permission key(s) required for a path (longest matching prefix), or null if the page is open. */
export function permissionForPath(path: string): string[] | null {
  const clean = path.replace(/\/+$/, '') || '/';
  let best: string | null = null;
  for (const key of Object.keys(PATH_PERMISSION)) {
    if ((clean === key || clean.startsWith(key + '/')) && (!best || key.length > best.length)) best = key;
  }
  if (!best) return null;
  const v = PATH_PERMISSION[best];
  return Array.isArray(v) ? v : [v];
}

/** True when the user may open the path. Super admins and HR without a custom role can open everything. */
export function canOpenPath(path: string, hasCustomRole: boolean, hasPermission: (key: string) => boolean): boolean {
  if (!hasCustomRole) return true;
  const keys = permissionForPath(path);
  if (!keys) return true;
  return keys.some((k) => hasPermission(k));
}
