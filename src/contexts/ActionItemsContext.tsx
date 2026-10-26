import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ACTION_MODULES, ActionModule, ActionItem } from '@/components/messaging/hooks/useActionItems';

interface ActionItemsContextType {
  myOpenItems: ActionItem[];
  raisedByMe: ActionItem[];
  allItems: ActionItem[];
  openCount: number;
  loading: boolean;
  popupOpen: boolean;
  activePopupItem: ActionItem | null;
  openPopup: (item?: ActionItem) => void;
  closePopup: () => void;
  snoozeItem: (id: string) => void;
  refetch: () => Promise<void>;
  createActionItem: (payload: {
    conversation_id: string;
    message_id?: string | null;
    assigned_to: string;
    title: string;
    details?: string;
    module: ActionModule;
    reference_date?: string | null;
    due_date?: string | null;
  }) => Promise<boolean>;
  markDone: (id: string, completion_note?: string) => Promise<boolean>;
  acknowledge: (id: string) => Promise<boolean>;
  closeAction: (id: string) => Promise<boolean>;
}

const ActionItemsContext = createContext<ActionItemsContextType | undefined>(undefined);

const table = () => (supabase as unknown as { from: (t: string) => any }).from('message_action_items');

export function ActionItemsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [myOpenItems, setMyOpenItems] = useState<ActionItem[]>([]);
  const [raisedByMe, setRaisedByMe] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [snoozedIds, setSnoozedIds] = useState<Record<string, number>>({});
  const [popupOpen, setPopupOpen] = useState(false);
  const [manualPopupItem, setManualPopupItem] = useState<ActionItem | null>(null);

  const fetchActionItems = useCallback(async () => {
    if (!user?.id) {
      setMyOpenItems([]);
      setRaisedByMe([]);
      return;
    }

    setLoading(true);
    try {
      const [mineRes, raisedRes] = await Promise.all([
        table()
          .select('*')
          .eq('assigned_to', user.id)
          .in('status', ['open', 'acknowledged'])
          .order('created_at', { ascending: false }),
        table()
          .select('*')
          .eq('raised_by', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const openItems = (mineRes.data || []) as ActionItem[];
      setMyOpenItems(openItems);
      setRaisedByMe((raisedRes.data || []) as ActionItem[]);
    } catch (err) {
      console.error('Error fetching global action items:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActionItems();
  }, [fetchActionItems]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global-action-items-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_action_items' }, payload => {
        fetchActionItems();

        if (payload.eventType === 'INSERT') {
          const newItem = payload.new as ActionItem;
          if (newItem.assigned_to === user.id) {
            toast.info(`New Action Item: ${newItem.title}`, {
              description: `Module: ${newItem.module_label || 'General'}`,
            });
            // Automatically open popup for new incoming item
            setManualPopupItem(newItem);
            setPopupOpen(true);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchActionItems]);

  // Determine active item to popup
  const activePopupItem = useMemo(() => {
    if (manualPopupItem && manualPopupItem.status !== 'completed' && manualPopupItem.status !== 'closed') {
      return manualPopupItem;
    }
    const now = Date.now();
    // Return first open item not snoozed within the last 15 minutes
    const unsnoozed = myOpenItems.find(item => {
      const snoozeTime = snoozedIds[item.id];
      if (!snoozeTime) return true;
      return now - snoozeTime > 15 * 60 * 1000;
    });
    return unsnoozed || null;
  }, [manualPopupItem, myOpenItems, snoozedIds]);

  // If there's an active item and user has not dismissed it recently, open the popup
  useEffect(() => {
    if (activePopupItem) {
      setPopupOpen(true);
    }
  }, [activePopupItem]);

  const openPopup = useCallback((item?: ActionItem) => {
    if (item) {
      setManualPopupItem(item);
    } else if (myOpenItems.length > 0) {
      setManualPopupItem(myOpenItems[0]);
    }
    setPopupOpen(true);
  }, [myOpenItems]);

  const closePopup = useCallback(() => {
    setPopupOpen(false);
    setManualPopupItem(null);
  }, []);

  const snoozeItem = useCallback((id: string) => {
    setSnoozedIds(prev => ({ ...prev, [id]: Date.now() }));
    setPopupOpen(false);
    setManualPopupItem(null);
  }, []);

  const createActionItem = useCallback(
    async (payload: {
      conversation_id: string;
      message_id?: string | null;
      assigned_to: string;
      title: string;
      details?: string;
      module: ActionModule;
      reference_date?: string | null;
      due_date?: string | null;
    }) => {
      if (!user?.id) return false;
      try {
        const { error } = await table().insert({
          conversation_id: payload.conversation_id,
          message_id: payload.message_id ?? null,
          raised_by: user.id,
          assigned_to: payload.assigned_to,
          title: payload.title,
          details: payload.details || null,
          module_key: payload.module.key,
          module_label: payload.module.label,
          module_route: payload.module.route,
          reference_date: payload.reference_date || null,
          due_date: payload.due_date || null,
        });

        if (error) {
          toast.error(error.message || 'Failed to raise action item');
          return false;
        }

        toast.success(`Action item created for ${payload.module.label}`);
        fetchActionItems();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error creating action item';
        toast.error(msg);
        return false;
      }
    },
    [user?.id, fetchActionItems]
  );

  const markDone = useCallback(
    async (id: string, completion_note?: string) => {
      if (!user?.id) return false;
      try {
        const now = new Date().toISOString();
        const patch: Record<string, unknown> = {
          status: 'completed',
          completed_at: now,
          completed_by: user.id,
        };
        if (completion_note) patch.completion_note = completion_note;

        const { error } = await table().update(patch).eq('id', id);
        if (error) {
          toast.error(error.message || 'Failed to complete action item');
          return false;
        }

        toast.success('Action item marked as done!');
        // Remove from snoozed list and close popup if it's the active one
        setSnoozedIds(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (manualPopupItem?.id === id) setManualPopupItem(null);
        await fetchActionItems();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error updating action item';
        toast.error(msg);
        return false;
      }
    },
    [user?.id, manualPopupItem?.id, fetchActionItems]
  );

  const acknowledge = useCallback(
    async (id: string) => {
      if (!user?.id) return false;
      try {
        const now = new Date().toISOString();
        const { error } = await table()
          .update({ status: 'acknowledged', acknowledged_at: now })
          .eq('id', id);

        if (error) {
          toast.error(error.message || 'Failed to acknowledge action item');
          return false;
        }
        await fetchActionItems();
        return true;
      } catch (err) {
        return false;
      }
    },
    [user?.id, fetchActionItems]
  );

  const closeAction = useCallback(
    async (id: string) => {
      if (!user?.id) return false;
      try {
        const now = new Date().toISOString();
        const { error } = await table()
          .update({ status: 'closed', closed_at: now, closed_by: user.id })
          .eq('id', id);

        if (error) {
          toast.error(error.message || 'Failed to close action item');
          return false;
        }
        toast.success('Action item closed');
        await fetchActionItems();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error closing action item';
        toast.error(msg);
        return false;
      }
    },
    [user?.id, fetchActionItems]
  );

  const allItems = useMemo(() => {
    return [...myOpenItems, ...raisedByMe];
  }, [myOpenItems, raisedByMe]);

  return (
    <ActionItemsContext.Provider
      value={{
        myOpenItems,
        raisedByMe,
        allItems,
        openCount: myOpenItems.length,
        loading,
        popupOpen,
        activePopupItem,
        openPopup,
        closePopup,
        snoozeItem,
        refetch: fetchActionItems,
        createActionItem,
        markDone,
        acknowledge,
        closeAction,
      }}
    >
      {children}
    </ActionItemsContext.Provider>
  );
}

export function useActionItemsGlobal() {
  const context = useContext(ActionItemsContext);
  if (!context) {
    throw new Error('useActionItemsGlobal must be used within an ActionItemsProvider');
  }
  return context;
}
