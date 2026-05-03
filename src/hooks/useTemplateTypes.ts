import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateType {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export function useTemplateTypes(includeInactive = false) {
  const [types, setTypes] = useState<TemplateType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    let q = supabase.from('template_types').select('*').order('sort_order', { ascending: true });
    if (!includeInactive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) { toast.error('Failed to load template types'); }
    else setTypes(data || []);
    setIsLoading(false);
  }, [includeInactive]);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const labelFor = useCallback((value: string) => {
    return types.find(t => t.value === value)?.label
      ?? value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }, [types]);

  return { types, isLoading, refetch: fetchTypes, labelFor };
}

export async function createTemplateType(label: string) {
  const value = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!value) throw new Error('Invalid name');
  const { data: max } = await supabase.from('template_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const next = (max?.[0]?.sort_order ?? 0) + 10;
  const { error } = await supabase.from('template_types').insert({ value, label: label.trim(), sort_order: next });
  if (error) throw error;
}

export async function updateTemplateType(id: string, patch: Partial<Pick<TemplateType, 'label' | 'is_active' | 'sort_order'>>) {
  const { error } = await supabase.from('template_types').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTemplateType(id: string) {
  const { error } = await supabase.from('template_types').delete().eq('id', id);
  if (error) throw error;
}
