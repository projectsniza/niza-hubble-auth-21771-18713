// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, test } from 'bun:test';
import { resolveSetting, optionsFromLabels, SETTINGS } from './settingsSchema';

describe('resolveSetting', () => {
  test('uses the built-in default when nothing is saved', () => {
    expect(resolveSetting('geofence_default_radius', undefined, undefined)).toBe(100);
  });
  test('organisation value wins over group default', () => {
    expect(resolveSetting('geofence_default_radius', 250, 150)).toBe(250);
  });
  test('group default is used when the organisation has none', () => {
    expect(resolveSetting('geofence_default_radius', undefined, 150)).toBe(150);
  });
  test('an empty list or wrong type falls back instead of breaking forms', () => {
    expect(resolveSetting('maintenance_priorities', [], undefined)).toEqual(SETTINGS.maintenance_priorities.default);
    expect(resolveSetting('geofence_default_radius', 'abc', undefined)).toBe(100);
  });
  test('option labels become tidy values', () => {
    expect(optionsFromLabels(['Gas Leak', '  '])).toEqual([{ value: 'gas_leak', label: 'Gas Leak' }]);
  });
});

describe('documents_reauth (ask for the password before opening Documents)', () => {
  test('is on for Super Admin and HR by default', () => {
    expect(resolveSetting('documents_reauth', undefined, undefined)).toEqual({ super_admin: true, hr: true });
  });
  test('an organisation can switch one role off and keeps the other default', () => {
    expect(resolveSetting('documents_reauth', { hr: false }, undefined)).toEqual({ super_admin: true, hr: false });
  });
  test('the group default applies when the organisation has none', () => {
    expect(resolveSetting('documents_reauth', undefined, { super_admin: false, hr: true })).toEqual({ super_admin: false, hr: true });
  });
  test('a broken saved value falls back to on', () => {
    expect(resolveSetting('documents_reauth', 'nope', ['x'])).toEqual({ super_admin: true, hr: true });
  });
  test('only a Super Admin may change it', () => {
    expect(SETTINGS.documents_reauth.superAdminOnly).toBe(true);
  });
});
