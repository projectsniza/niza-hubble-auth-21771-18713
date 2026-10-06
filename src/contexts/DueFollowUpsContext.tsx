import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays, parseISO, format, addHours } from 'date-fns';
import { toast } from 'sonner';

export interface DueItem {
  id: string;
  rawId: string;
  sourceType: 'reminder' | 'document_overdue' | 'document_upcoming';
  title: string;
  description?: string | null;
  due_date: string;
  employee?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    organizations?: { name?: string } | null;
    branches?: { name?: string } | null;
  } | null;
  document?: {
    id: string;
    file_name: string;
    file_path: string;
    expiry_date?: string | null;
    follow_up_date?: string | null;
    folder_path?: string | null;
  } | null;
}

interface DueFollowUpsContextType {
  items: DueItem[];
  overdueItems: DueItem[];
  upcomingItems: DueItem[];
  reminderItems: DueItem[];
  totalCount: number;
  overdueCount: number;
  upcomingCount: number;
  reminderCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  isPopupOpen: boolean;
  setIsPopupOpen: (open: boolean) => void;
  currentItemIndex: number;
  setCurrentItemIndex: (index: number) => void;
  snoozeItem: (item: DueItem, until: Date) => Promise<void>;
  snoozeAll: (until: Date) => Promise<void>;
  acknowledgeItem: (item: DueItem) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  completeItem: (item: DueItem) => Promise<void>;
  viewDocument: (item: DueItem) => Promise<void>;
  openReviewModal: (startIndex?: number) => void;
}

const DueFollowUpsContext = createContext<DueFollowUpsContextType | undefined>(undefined);

export function DueFollowUpsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const hasAutoPoppedRef = useRef(false);

  const fetchDueItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    setLoading(true);
    const now = new Date();
    const nowIso = now.toISOString();
    const fetchedList: DueItem[] = [];

    // 1. Fetch Due Reminders
    try {
      const { data: reminderData, error: remError } = await supabase
        .from('reminders')
        .select('id,title,description,reminder_date,is_completed,is_dismissed,snoozed_until')
        .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
        .eq('is_completed', false)
        .eq('is_dismissed', false)
        .lte('reminder_date', nowIso)
        .order('reminder_date', { ascending: true })
        .limit(50);

      if (!remError && reminderData) {
        reminderData.forEach((r: any) => {
          if (r.snoozed_until && new Date(r.snoozed_until) > now) return;

          fetchedList.push({
            id: `rem_${r.id}`,
            rawId: r.id,
            sourceType: 'reminder',
            title: r.title,
            description: r.description,
            due_date: r.reminder_date,
          });
        });
      }
    } catch (err) {
      console.error('Error fetching reminders for due items:', err);
    }

    // 2. Fetch Document Follow-ups (Admin / HR / Manager)
    const hasDocAccess = ['super_admin', 'hr', 'manager'].includes(user.role);
    if (hasDocAccess) {
      try {
        let followUpIntervals = [30];
        const { data: followSettings } = await supabase
          .from('document_follow_up_settings')
          .select('follow_up_intervals, is_active')
          .is('organization_id', null)
          .maybeSingle();

        if (followSettings?.is_active && followSettings.follow_up_intervals?.length > 0) {
          followUpIntervals = followSettings.follow_up_intervals;
        }
        const maxInterval = Math.max(...followUpIntervals);

        const { data: docsData, error: docError } = await supabase
          .from('documents')
          .select(`
            id,
            title,
            file_name,
            file_path,
            expiry_date,
            follow_up_date,
            created_at,
            folder_id,
            verified_at,
            employee:employees(
              id,
              first_name,
              last_name,
              email,
              organizations(name),
              branches(name)
            ),
            folder:folders(id, name, path)
          `)
          .or('expiry_date.not.is.null,follow_up_date.not.is.null')
          .is('verified_at', null)
          .limit(150);

        if (!docError && docsData) {
          docsData.forEach((doc: any) => {
            // Check client-side snooze, session dismiss, and local completion
            const snoozedUntilStr = localStorage.getItem(`doc_snoozed_${doc.id}`);
            if (snoozedUntilStr && new Date(snoozedUntilStr) > now) return;

            const isDismissedSession = sessionStorage.getItem(`doc_dismissed_${doc.id}`);
            if (isDismissedSession) return;

            const isCompletedLocal = localStorage.getItem(`doc_completed_${doc.id}`);
            if (isCompletedLocal) return;

            let isOverdue = false;
            let isUpcoming = false;
            let dueDate = doc.follow_up_date || doc.expiry_date || nowIso;

            // Check Expiry Date
            if (doc.expiry_date) {
              const daysUntilExpiry = differenceInDays(new Date(doc.expiry_date), now);
              if (daysUntilExpiry < 0) {
                isOverdue = true;
                dueDate = doc.expiry_date;
              } else if (daysUntilExpiry <= maxInterval) {
                isUpcoming = true;
                dueDate = doc.expiry_date;
              }
            }

            // Check Follow-up Date
            if (!isOverdue && doc.follow_up_date) {
              const daysUntilFollowUp = differenceInDays(new Date(doc.follow_up_date), now);
              if (daysUntilFollowUp < 0) {
                isOverdue = true;
                dueDate = doc.follow_up_date;
              } else if (daysUntilFollowUp <= maxInterval) {
                isUpcoming = true;
                dueDate = doc.follow_up_date;
              }
            }

            if (isOverdue || isUpcoming) {
              fetchedList.push({
                id: `doc_${doc.id}`,
                rawId: doc.id,
                sourceType: isOverdue ? 'document_overdue' : 'document_upcoming',
                title: doc.title || doc.file_name || 'Document Follow-up',
                description: doc.file_name,
                due_date: dueDate,
                employee: doc.employee,
                document: {
                  id: doc.id,
                  file_name: doc.file_name,
                  file_path: doc.file_path,
                  expiry_date: doc.expiry_date,
                  follow_up_date: doc.follow_up_date,
                  folder_path: doc.folder?.path,
                },
              });
            }
          });
        }
      } catch (err) {
        console.error('Error checking documents for due items:', err);
      }
    }

    // Sort: Overdue items first (by due date ascending), then reminders, then upcoming
    fetchedList.sort((a, b) => {
      const priorityOrder = { document_overdue: 0, reminder: 1, document_upcoming: 2 };
      const priorityDiff = priorityOrder[a.sourceType] - priorityOrder[b.sourceType];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    setItems(fetchedList);
    setLoading(false);

    // Auto-open review popup once per session if overdue items exist
    const sessionPopupKey = `due_popup_shown_session_${user.id}`;
    if (!hasAutoPoppedRef.current && !sessionStorage.getItem(sessionPopupKey)) {
      hasAutoPoppedRef.current = true;
      if (fetchedList.length > 0) {
        sessionStorage.setItem(sessionPopupKey, '1');
        setCurrentItemIndex(0);
        setIsPopupOpen(true);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchDueItems();
    const interval = setInterval(fetchDueItems, 60_000);
    return () => clearInterval(interval);
  }, [fetchDueItems]);

  const overdueItems = items.filter((i) => i.sourceType === 'document_overdue');
  const upcomingItems = items.filter((i) => i.sourceType === 'document_upcoming');
  const reminderItems = items.filter((i) => i.sourceType === 'reminder');

  const snoozeItem = async (item: DueItem, until: Date) => {
    if (item.sourceType === 'reminder') {
      const { error } = await supabase
        .from('reminders')
        .update({ snoozed_until: until.toISOString() })
        .eq('id', item.rawId);
      if (error) {
        toast.error('Failed to snooze reminder');
        return;
      }
    } else {
      localStorage.setItem(`doc_snoozed_${item.rawId}`, until.toISOString());
    }

    toast.success(`Snoozed until ${format(until, 'MMM d, HH:mm')}`);
    
    // Remove item from active list
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (next.length === 0) {
        setIsPopupOpen(false);
      } else if (currentItemIndex >= next.length) {
        setCurrentItemIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const snoozeAll = async (until: Date) => {
    if (items.length === 0) return;

    const count = items.length;
    const reminderIds = items.filter((i) => i.sourceType === 'reminder').map((i) => i.rawId);
    const docIds = items.filter((i) => i.sourceType !== 'reminder').map((i) => i.rawId);

    if (reminderIds.length > 0) {
      await supabase
        .from('reminders')
        .update({ snoozed_until: until.toISOString() })
        .in('id', reminderIds);
    }

    docIds.forEach((id) => {
      localStorage.setItem(`doc_snoozed_${id}`, until.toISOString());
    });

    setIsPopupOpen(false);
    setItems([]);
    setCurrentItemIndex(0);
    toast.success(`All ${count} open item${count > 1 ? 's' : ''} snoozed until ${format(until, 'MMM d, HH:mm')}`);
  };

  const acknowledgeItem = async (item: DueItem) => {
    if (item.sourceType === 'reminder') {
      await supabase
        .from('reminders')
        .update({ is_dismissed: true, acknowledged_at: new Date().toISOString() })
        .eq('id', item.rawId);
      toast.success('Reminder acknowledged');
    } else {
      sessionStorage.setItem(`doc_dismissed_${item.rawId}`, 'true');
      toast.success('Document follow-up acknowledged for this session');
    }

    setItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (next.length === 0) {
        setIsPopupOpen(false);
      } else if (currentItemIndex >= next.length) {
        setCurrentItemIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const acknowledgeAll = async () => {
    if (items.length === 0) return;

    const count = items.length;
    const reminderIds = items.filter((i) => i.sourceType === 'reminder').map((i) => i.rawId);
    const docIds = items.filter((i) => i.sourceType !== 'reminder').map((i) => i.rawId);

    if (reminderIds.length > 0) {
      await supabase
        .from('reminders')
        .update({ is_dismissed: true, acknowledged_at: new Date().toISOString() })
        .in('id', reminderIds);
    }

    docIds.forEach((id) => {
      sessionStorage.setItem(`doc_dismissed_${id}`, 'true');
    });

    setIsPopupOpen(false);
    setItems([]);
    setCurrentItemIndex(0);
    toast.success(`All ${count} item${count > 1 ? 's' : ''} acknowledged for this session`);
  };

  const completeItem = async (item: DueItem) => {
    if (item.sourceType === 'reminder') {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: true })
        .eq('id', item.rawId);
      if (error) {
        toast.error('Failed to mark complete');
        return;
      }
      toast.success('Reminder marked complete');
    } else if (item.document) {
      const { error } = await supabase
        .from('documents')
        .update({
          follow_up_date: null,
          verified_at: new Date().toISOString(),
        })
        .eq('id', item.rawId);

      localStorage.setItem(`doc_completed_${item.rawId}`, new Date().toISOString());

      const empName = item.employee
        ? `${item.employee.first_name || ''} ${item.employee.last_name || ''}`.trim()
        : 'Employee';

      if (error) {
        toast.error('Failed to mark document complete');
        return;
      }
      toast.success(`Document follow-up for ${empName} marked complete`);
    }

    setItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (next.length === 0) {
        setIsPopupOpen(false);
      } else if (currentItemIndex >= next.length) {
        setCurrentItemIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const viewDocument = async (item: DueItem) => {
    if (!item.document?.file_path) {
      toast.error('No document file attached');
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(item.document.file_path, 120);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error('Unable to open document: ' + (err.message || 'File not accessible'));
    }
  };

  const openReviewModal = (startIndex = 0) => {
    if (items.length === 0) {
      toast.info('No overdue or due items to review');
      return;
    }
    setCurrentItemIndex(Math.min(startIndex, items.length - 1));
    setIsPopupOpen(true);
  };

  return (
    <DueFollowUpsContext.Provider
      value={{
        items,
        overdueItems,
        upcomingItems,
        reminderItems,
        totalCount: items.length,
        overdueCount: overdueItems.length,
        upcomingCount: upcomingItems.length,
        reminderCount: reminderItems.length,
        loading,
        refetch: fetchDueItems,
        isPopupOpen,
        setIsPopupOpen,
        currentItemIndex,
        setCurrentItemIndex,
        snoozeItem,
        snoozeAll,
        acknowledgeItem,
        acknowledgeAll,
        completeItem,
        viewDocument,
        openReviewModal,
      }}
    >
      {children}
    </DueFollowUpsContext.Provider>
  );
}

export function useDueFollowUps() {
  const context = useContext(DueFollowUpsContext);
  if (!context) {
    throw new Error('useDueFollowUps must be used within a DueFollowUpsProvider');
  }
  return context;
}
