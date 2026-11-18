import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SlotAssignment } from '@/lib/lotteryCalculations';

export interface SlotAssignmentRow extends SlotAssignment {
  branch_id: string;
  notes: string | null;
}

export interface PlanogramChange {
  id: string;
  branch_id: string;
  change_date: string;
  change_type: 'replace' | 'replace_move' | 'move' | 'price';
  from_slot: number | null;
  to_slot: number | null;
  old_game_id: string | null;
  new_game_id: string | null;
  old_game_number: string | null;
  new_game_number: string | null;
  old_game_name: string | null;
  new_game_name: string | null;
  old_price: number | null;
  new_price: number | null;
  old_final_closing: number | null;
  old_returned: number | null;
  new_opening_activated: number | null;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}

/**
 * Dated slot assignments that overlap [windowStart, windowEnd] for the given branches.
 * This is the source of truth for which game occupied which dispenser slot on each day.
 */
export function useSlotAssignments(branchIds: string[], windowStart: string, windowEnd: string) {
  return useQuery({
    queryKey: ['lottery-slot-assignments', branchIds, windowStart, windowEnd],
    enabled: branchIds.length > 0,
    queryFn: async (): Promise<SlotAssignmentRow[]> => {
      const { data, error } = await supabase
        .from('lottery_slot_assignments')
        .select('id, branch_id, slot_number, game_id, effective_from, effective_to, notes')
        .in('branch_id', branchIds)
        .lte('effective_from', windowEnd)
        .or(`effective_to.is.null,effective_to.gte.${windowStart}`)
        .order('slot_number')
        .order('effective_from');
      if (error) throw error;
      return (data || []) as SlotAssignmentRow[];
    },
  });
}

/** Full planogram change log for the given branches (newest first). */
export function usePlanogramChanges(branchIds: string[]) {
  return useQuery({
    queryKey: ['lottery-planogram-changes', branchIds],
    enabled: branchIds.length > 0,
    queryFn: async (): Promise<PlanogramChange[]> => {
      const { data, error } = await supabase
        .from('lottery_planogram_changes')
        .select('*')
        .in('branch_id', branchIds)
        .order('change_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as PlanogramChange[];
    },
  });
}

/** Changes that touched a slot (as source or destination). */
export const changesForSlot = (changes: readonly PlanogramChange[], branchId: string, slot: number) =>
  changes.filter((c) => c.branch_id === branchId && (c.from_slot === slot || c.to_slot === slot));
