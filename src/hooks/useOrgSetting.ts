import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { resolveSetting, SETTINGS, type SettingKey, type SettingValue } from '@/lib/settingsSchema';

interface Row {
  id: string;
  organization_id: string | null;
  key: string;
  value: unknown;
}

const QUERY_KEY = ['org_settings'];

/** All saved setting rows (a handful of small rows, cached for the whole app). */
function useSettingRows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.from('org_settings').select('id, organization_id, key, value');
      if (error) throw error;
      return (data || []) as Row[];
    },
  });
}

/**
 * The value of a business rule for an organisation:
 * the organisation's own setting, else the group default, else the built-in default.
 * `organizationId` defaults to the signed-in user's organisation.
 */
export function useOrgSetting<K extends SettingKey>(key: K, organizationId?: string | null): SettingValue<K> {
  const { user } = useAuth();
  const { data: rows } = useSettingRows();
  const orgId = organizationId === undefined ? user?.organizationId ?? null : organizationId;

  return useMemo(() => {
    const own = orgId ? rows?.find((r) => r.key === key && r.organization_id === orgId)?.value : undefined;
    const group = rows?.find((r) => r.key === key && r.organization_id === null)?.value;
    return resolveSetting(key, own, group);
  }, [rows, key, orgId]);
}

/**
 * Same as useOrgSetting, but also says whether the saved rules have finished loading.
 * Use it where showing the wrong value for a moment would matter (for example a password prompt).
 */
export function useOrgSettingState<K extends SettingKey>(
  key: K,
  organizationId?: string | null
): { value: SettingValue<K>; isLoading: boolean } {
  const { user } = useAuth();
  const { data: rows, isLoading } = useSettingRows();
  const orgId = organizationId === undefined ? user?.organizationId ?? null : organizationId;
  const value = useMemo(() => {
    const own = orgId ? rows?.find((r) => r.key === key && r.organization_id === orgId)?.value : undefined;
    const group = rows?.find((r) => r.key === key && r.organization_id === null)?.value;
    return resolveSetting(key, own, group);
  }, [rows, key, orgId]);
  return { value, isLoading: !!user && isLoading };
}

/** Read / change rules for the Business Rules screen. */
export function useOrgSettingsAdmin() {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading, error, refetch } = useSettingRows();

  const getRow = useCallback(
    (key: string, organizationId: string | null) =>
      rows.find((r) => r.key === key && r.organization_id === organizationId),
    [rows]
  );

  /** Save a value for an organisation (null = group default). */
  const save = useCallback(
    async (key: SettingKey, organizationId: string | null, value: unknown) => {
      if (!(key in SETTINGS)) throw new Error('Unknown setting');
      const existing = getRow(key, organizationId);
      const { error: saveError } = existing
        ? await supabase.from('org_settings').update({ value: value as never }).eq('id', existing.id)
        : await supabase.from('org_settings').insert({ key, organization_id: organizationId, value: value as never });
      if (saveError) throw saveError;
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    [getRow, queryClient]
  );

  /** Remove an organisation's own value so it falls back to the group default. */
  const reset = useCallback(
    async (key: SettingKey, organizationId: string | null) => {
      const existing = getRow(key, organizationId);
      if (!existing) return;
      const { error: delError } = await supabase.from('org_settings').delete().eq('id', existing.id);
      if (delError) throw delError;
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    [getRow, queryClient]
  );

  return { rows, isLoading, error, refetch, getRow, save, reset };
}
