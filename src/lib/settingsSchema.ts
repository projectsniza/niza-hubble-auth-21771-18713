// Business rules that can be changed per organisation (Settings -> Business Rules).
// Every default below is exactly what the app did before, so nothing changes until someone edits a rule.

export type SettingType = 'options' | 'list' | 'number' | 'text' | 'weekday' | 'roleToggles';

export interface OptionItem {
  value: string;
  label: string;
}

export interface SettingDef<T = unknown> {
  key: string;
  area: 'People' | 'Store operations' | 'Attendance' | 'Security';
  label: string;
  help?: string;
  type: SettingType;
  default: T;
  min?: number;
  max?: number;
  /** Only a Super Admin can change this rule (HR can see it but not edit it). */
  superAdminOnly?: boolean;
  /** For 'roleToggles': one on/off switch per role. */
  roles?: { key: string; label: string }[];
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Build option items from plain labels (value = tidy slug of the label). */
export const optionsFromLabels = (labels: string[]): OptionItem[] =>
  labels.map((l) => l.trim()).filter(Boolean).map((label) => ({ value: slug(label), label }));

export const SETTINGS = {
  deactivation_reasons: {
    key: 'deactivation_reasons',
    area: 'People',
    label: 'Deactivation reasons',
    help: 'Reasons offered when an employee is deactivated. Existing records keep the reason they were saved with.',
    type: 'options',
    default: [
      { value: 'resigned', label: 'Resigned' },
      { value: 'temporarily_suspended', label: 'Temporarily Suspended' },
      { value: 'end_of_contract', label: 'End of Contract' },
      { value: 'redundancy', label: 'Redundancy' },
      { value: 'gross_misconduct', label: 'Gross Misconduct' },
      { value: 'mutual_agreement', label: 'Mutual Agreement' },
    ] as OptionItem[],
  },
  maintenance_priorities: {
    key: 'maintenance_priorities',
    area: 'Store operations',
    label: 'Maintenance priorities',
    help: 'Priority levels for maintenance tickets.',
    type: 'options',
    default: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ] as OptionItem[],
  },
  report_categories: {
    key: 'report_categories',
    area: 'Store operations',
    label: 'Daily report categories',
    help: 'Document categories for daily reports.',
    type: 'options',
    default: [
      { value: 'report', label: 'Report' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'receipt', label: 'Receipt' },
      { value: 'letter', label: 'Letter' },
      { value: 'other', label: 'Other' },
    ] as OptionItem[],
  },
  currency_symbol: {
    key: 'currency_symbol',
    area: 'Store operations',
    label: 'Currency symbol',
    help: 'Shown next to money amounts that read this setting.',
    type: 'text',
    default: '£',
  },
  geofence_default_radius: {
    key: 'geofence_default_radius',
    area: 'Attendance',
    label: 'Default clock-in radius (metres)',
    help: 'Used for a clock-in location that has no radius of its own.',
    type: 'number',
    default: 100,
    min: 20,
    max: 5000,
  },
  min_password_length: {
    key: 'min_password_length',
    area: 'Security',
    label: 'Minimum password length',
    help: 'Applies in Settings → Users when an admin activates an employee account or resets a password.',
    type: 'number',
    default: 6,
    min: 6,
    max: 64,
  },
  documents_reauth: {
    key: 'documents_reauth',
    area: 'Security',
    label: 'Ask for the password before opening Documents',
    help:
      'When on, the person must type their login password again every time they open the Documents page. ' +
      'Turn a role off to let it open Documents without asking. Only a Super Admin can change this. ' +
      'Set it on "Group default" to apply to every organisation, or on one organisation to override it there.',
    type: 'roleToggles',
    default: { super_admin: true, hr: true } as Record<string, boolean>,
    superAdminOnly: true,
    roles: [
      { key: 'super_admin', label: 'Super Admin' },
      { key: 'hr', label: 'HR' },
    ],
  },
} satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = (typeof SETTINGS)[K]['default'];

/** Pick the value to use: the organisation's own row, else the group default row, else the built-in default. */
export function resolveSetting<K extends SettingKey>(
  key: K,
  orgValue: unknown,
  groupValue: unknown
): SettingValue<K> {
  const fallback = SETTINGS[key].default as SettingValue<K>;
  const valid = (v: unknown): v is SettingValue<K> => {
    if (v === undefined || v === null) return false;
    const d = SETTINGS[key].default as unknown;
    if (Array.isArray(d)) return Array.isArray(v) && v.length > 0;
    if (d !== null && typeof d === 'object') return typeof v === 'object' && !Array.isArray(v);
    return typeof v === typeof d;
  };
  // A saved on/off map may lack a role added later: fill the gaps from the built-in default.
  const withDefaults = (v: SettingValue<K>): SettingValue<K> => {
    const d = SETTINGS[key].default as unknown;
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) return { ...(d as object), ...(v as object) } as SettingValue<K>;
    return v;
  };
  if (valid(orgValue)) return withDefaults(orgValue);
  if (valid(groupValue)) return withDefaults(groupValue);
  return fallback;
}
