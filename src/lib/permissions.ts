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

// ---------------------------------------------------------------------------
// Default page access for people WITHOUT a custom role. Before this, anyone without a
// custom role could open any URL (for example a store account could type /dashboard/payroll).
// The lists mirror each role's sidebar. Data is still protected by the database either way.
// ---------------------------------------------------------------------------
const EMPLOYEE_DEFAULT_KEYS = [
  'reminders', 'clock_ins', 'scheduling', 'attendance', 'safety', 'payroll', 'training',
  'events', 'performance', 'settings', 'messages',
];
const MANAGER_DEFAULT_KEYS = [
  'overview', 'messages', 'reminders', 'employee_management', 'documents', 'drive_offs', 'lottery',
  'daily_reports', 'daily_summary', 'maintenance', 'safety', 'templates', 'scheduling', 'clock_ins',
  'attendance', 'events', 'training', 'performance', 'customer_accounts', 'settings',
];

/** Route check that also covers users who have no custom role (employee, store account, HR). */
export function canOpenPathForRole(
  path: string,
  role: string,
  hasCustomRole: boolean,
  hasPermission: (key: string) => boolean
): boolean {
  if (role === 'super_admin') return true;
  if (hasCustomRole) return canOpenPath(path, true, hasPermission);

  const clean = path.replace(/\/+$/, '') || '/';
  if (role === 'hr') return clean !== '/dashboard/visualization';

  const keys = permissionForPath(clean);
  if (!keys) return true;

  // The full Documents library is HR-only; employees and store accounts only use the submit / to-do pages.
  if (clean === '/dashboard/documents') return false;
  if (role === 'employee') return keys.some((k) => EMPLOYEE_DEFAULT_KEYS.includes(k) || (k === 'documents' && clean.startsWith('/dashboard/documents/')));
  if (role === 'manager') return keys.some((k) => MANAGER_DEFAULT_KEYS.includes(k));
  return true;
}
