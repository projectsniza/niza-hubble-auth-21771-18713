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
  isSnoozed?: boolean;
  snoozedUntil?: string | null;
  isDismissed?: boolean;
  isCompleted?: boolean;
  employee_name?: string | null;
  employee_email?: string | null;
  employee_job_title?: string | null;
  branch_name?: string | null;
  store_name?: string | null;
  organization_name?: string | null;
  employee?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    job_title?: string | null;
    organization?: { name?: string } | null;
    branch?: { name?: string } | null;
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
    folder_name?: string | null;
  } | null;
}

interface DueFollowUpsContextType {
  allItems: DueItem[];
  items: DueItem[];
  overdueItems: DueItem[];
  upcomingItems: DueItem[];
  reminderItems: DueItem[];
  snoozedItems: DueItem[];
  dismissedItems: DueItem[];
  totalCount: number;
  allCount: number;
  overdueCount: number;
  upcomingCount: number;
  reminderCount: number;
  snoozedCount: number;
  dismissedCount: number;
  allOverdueCount: number;
  allUpcomingCount: number;
  allReminderCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  isPopupOpen: boolean;
  setIsPopupOpen: (open: boolean) => void;
  currentItemIndex: number;
  setCurrentItemIndex: (index: number) => void;
  snoozeItem: (item: DueItem, until: Date) => Promise<void>;
  unsnoozeItem: (item: DueItem) => Promise<void>;
  snoozeAll: (until: Date) => Promise<void>;
  acknowledgeItem: (item: DueItem) => Promise<void>;
  undismissItem: (item: DueItem) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  restoreAll: () => Promise<void>;
  completeItem: (item: DueItem) => Promise<void>;
  viewDocument: (item: DueItem) => Promise<void>;
  openReviewModal: (startIndex?: number, customItems?: DueItem[]) => void;
  reviewItemsList: DueItem[];
}

const DueFollowUpsContext = createContext<DueFollowUpsContextType | undefined>(undefined);

export function DueFollowUpsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [allItems, setAllItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [reviewItemsList, setReviewItemsList] = useState<DueItem[]>([]);
  const hasAutoPoppedRef = useRef(false);

  const fetchDueItems = useCallback(async () => {
    if (!user || (user.role !== 'super_admin' && user.role !== 'hr')) {
      setAllItems([]);
      return;
    }

    setLoading(true);
    const now = new Date();
    const nowIso = now.toISOString();
    const fetchedList: DueItem[] = [];

    // 0. Pre-fetch branch reference data for instant, reliable Store & Org resolution
    let branchById = new Map<string, { name: string; orgName: string | null }>();
    let branchByName = new Map<string, { id: string; name: string; orgName: string | null }>();
    try {
      const { data: bData } = await supabase
        .from('branches')
        .select('id, name, organization_id, organizations(id, name)');
      if (bData) {
        bData.forEach((b: any) => {
          const orgName = (b.organizations as any)?.name || null;
          branchById.set(b.id, { name: b.name, orgName });
          if (b.name) {
            branchByName.set(b.name.trim().toLowerCase(), { id: b.id, name: b.name, orgName });
          }
        });
      }
    } catch (bErr) {
      console.error('Error prefetching branches for due items:', bErr);
    }

    // 1. Fetch Due Reminders
    try {
      const { data: reminderData, error: remError } = await supabase
        .from('reminders')
        .select(`
          id,
          title,
          description,
          reminder_date,
          is_completed,
          is_dismissed,
          snoozed_until,
          branch_id,
          organization_id,
          related_entity_type,
          related_entity_id
        `)
        .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
        .eq('is_completed', false)
        .lte('reminder_date', nowIso)
        .order('reminder_date', { ascending: true })
        .limit(100);

      if (!remError && reminderData) {
        reminderData.forEach((r: any) => {
          const isSnoozed = !!(r.snoozed_until && new Date(r.snoozed_until) > now);
          const isDismissed = !!r.is_dismissed;
          const bInfo = r.branch_id ? branchById.get(r.branch_id) : null;

          fetchedList.push({
            id: `rem_${r.id}`,
            rawId: r.id,
            sourceType: 'reminder',
            title: r.title,
            description: r.description,
            due_date: r.reminder_date,
            isSnoozed,
            snoozedUntil: r.snoozed_until,
            isDismissed,
            branch_name: bInfo?.name || null,
            store_name: bInfo?.name || null,
            organization_name: bInfo?.orgName || null,
          });
        });
      }
    } catch (err) {
      console.error('Error fetching reminders for due items:', err);
    }

    // 2. Fetch Document Follow-ups (Super Admin / HR only; store accounts/managers do not receive document expiry notifications)
    const hasDocAccess = ['super_admin', 'hr'].includes(user.role);
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
            employee_id,
            verified_at,
            employee:employees(
              id,
              first_name,
              last_name,
              email,
              job_title,
              branch_id,
              organization_id,
              organizations(name),
              branches(name)
            ),
            folder:folders(
              id,
              name,
              path,
              folder_type,
              parent_id,
              employee_id,
              branch_id,
              organization_id
            )
          `)
          .or('expiry_date.not.is.null,follow_up_date.not.is.null')
          .is('verified_at', null)
          .limit(200);

        if (!docError && docsData) {
          // Identify any missing employee IDs to batch resolve
          const missingEmpIds = new Set<string>();
          docsData.forEach((doc: any) => {
            if (!doc.employee) {
              if (doc.employee_id) missingEmpIds.add(doc.employee_id);
              if (doc.folder?.employee_id) missingEmpIds.add(doc.folder.employee_id);
              if (doc.file_path) {
                const match = doc.file_path.match(/employees\/([0-9a-fA-F-]{36})/);
                if (match) missingEmpIds.add(match[1]);
              }
            }
          });

          const empMap = new Map<string, any>();
          if (missingEmpIds.size > 0) {
            try {
              const { data: extraEmps } = await supabase
                .from('employees')
                .select(`
                  id,
                  first_name,
                  last_name,
                  email,
                  job_title,
                  branch_id,
                  organization_id
                `)
                .in('id', Array.from(missingEmpIds));
              if (extraEmps) {
                extraEmps.forEach((e: any) => empMap.set(e.id, e));
              }
            } catch (empErr) {
              console.error('Error fetching missing employees for due items:', empErr);
            }
          }

          docsData.forEach((doc: any) => {
            const isCompletedLocal = localStorage.getItem(`doc_completed_${doc.id}`);
            if (isCompletedLocal) return;

            const snoozedUntilStr = localStorage.getItem(`doc_snoozed_${doc.id}`);
            const isSnoozed = !!(snoozedUntilStr && new Date(snoozedUntilStr) > now);

            const isDismissedSession = !!sessionStorage.getItem(`doc_dismissed_${doc.id}`);

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
              // 1. Resolve employee object
              let emp = doc.employee || null;
              if (!emp) {
                if (doc.employee_id && empMap.has(doc.employee_id)) {
                  emp = empMap.get(doc.employee_id);
                } else if (doc.folder?.employee_id && empMap.has(doc.folder.employee_id)) {
                  emp = empMap.get(doc.folder.employee_id);
                } else if (doc.file_path) {
                  const m = doc.file_path.match(/employees\/([0-9a-fA-F-]{36})/);
                  if (m && empMap.has(m[1])) {
                    emp = empMap.get(m[1]);
                  }
                }
              }

              // 2. Resolve employee display fields
              let empName: string | null = null;
              let empEmail: string | null = null;
              let empJobTitle: string | null = null;

              if (emp) {
                const fn = (emp.first_name || '').trim();
                const ln = (emp.last_name || '').trim();
                empName = `${fn} ${ln}`.trim() || null;
                empEmail = emp.email || null;
                empJobTitle = emp.job_title || null;
              }

              // 3. Resolve Branch (Store) and Organization
              let branchName: string | null = null;
              let orgName: string | null = null;

              if (emp) {
                const bRel = Array.isArray(emp.branches) ? emp.branches[0] : (emp.branches || (Array.isArray(emp.branch) ? emp.branch[0] : emp.branch));
                if (bRel?.name) branchName = bRel.name;
                const oRel = Array.isArray(emp.organizations) ? emp.organizations[0] : (emp.organizations || (Array.isArray(emp.organization) ? emp.organization[0] : emp.organization));
                if (oRel?.name) orgName = oRel.name;

                if (!branchName && emp.branch_id && branchById.has(emp.branch_id)) {
                  const bInfo = branchById.get(emp.branch_id)!;
                  branchName = bInfo.name;
                  if (!orgName) orgName = bInfo.orgName;
                }
              }

              if (!branchName && doc.folder?.branch_id && branchById.has(doc.folder.branch_id)) {
                const bInfo = branchById.get(doc.folder.branch_id)!;
                branchName = bInfo.name;
                if (!orgName) orgName = bInfo.orgName;
              }

              // 4. Fallback: Parse from folder path (e.g. "Company Documents/TEXACO - NISA LLANGOLLEN/Harry Jones")
              const folderPath: string = doc.folder?.path || '';
              if (folderPath) {
                const segments = folderPath
                  .split(/[\\/]/)
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0);

                // Match any segment against known branches
                for (const seg of segments) {
                  const lower = seg.toLowerCase();
                  if (branchByName.has(lower)) {
                    if (!branchName) {
                      const match = branchByName.get(lower)!;
                      branchName = match.name;
                      if (!orgName) orgName = match.orgName;
                    }
                  }
                }

                // If employee name still not resolved, check folder name or path segments
                if (!empName) {
                  if (doc.folder?.folder_type === 'employee' && doc.folder?.name) {
                    empName = doc.folder.name;
                  } else if (segments.length >= 2) {
                    const lastSeg = segments[segments.length - 1];
                    const lastLower = lastSeg.toLowerCase();
                    if (
                      !branchByName.has(lastLower) &&
                      !['company documents', 'employee documents', 'documents', 'general', 'root'].includes(lastLower)
                    ) {
                      empName = lastSeg;
                    }
                  }
                }

                // If branch still missing, check non-root segments
                if (!branchName && segments.length >= 2) {
                  const nonRoots = segments.filter(
                    (s: string) => !['company documents', 'employee documents', 'documents', 'root'].includes(s.toLowerCase())
                  );
                  if (nonRoots.length === 2) {
                    branchName = nonRoots[0];
                    if (!empName) empName = nonRoots[1];
                  } else if (nonRoots.length >= 3) {
                    if (!orgName) orgName = nonRoots[0];
                    branchName = nonRoots[1];
                    if (!empName) empName = nonRoots[2];
                  }
                }
              }

              // Doc title fallback (e.g. "Right to Work - Harry Jones")
              if (!empName && doc.title && doc.title.includes(' - ')) {
                const parts = doc.title.split(' - ');
                if (parts.length >= 2 && parts[parts.length - 1].trim().length > 2) {
                  empName = parts[parts.length - 1].trim();
                }
              }

              fetchedList.push({
                id: `doc_${doc.id}`,
                rawId: doc.id,
                sourceType: isOverdue ? 'document_overdue' : 'document_upcoming',
                title: doc.title || doc.file_name || 'Document Follow-up',
                description: doc.file_name,
                due_date: dueDate,
                isSnoozed,
                snoozedUntil: isSnoozed ? snoozedUntilStr : null,
                isDismissed: isDismissedSession,
                employee_name: empName,
                employee_email: empEmail,
                employee_job_title: empJobTitle,
                branch_name: branchName,
                store_name: branchName,
                organization_name: orgName,
                employee: emp ? {
                  id: emp.id,
                  first_name: emp.first_name,
                  last_name: emp.last_name,
                  email: emp.email,
                  job_title: emp.job_title,
                  branch: branchName ? { name: branchName } : null,
                  organization: orgName ? { name: orgName } : null,
                  branches: branchName ? { name: branchName } : null,
                  organizations: orgName ? { name: orgName } : null,
                } : null,
                document: {
                  id: doc.id,
                  file_name: doc.file_name,
                  file_path: doc.file_path,
                  expiry_date: doc.expiry_date,
                  follow_up_date: doc.follow_up_date,
                  folder_path: doc.folder?.path || null,
                  folder_name: doc.folder?.name || null,
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

    setAllItems(fetchedList);
    setLoading(false);

    // Auto-open review popup once per session only if active overdue/due items exist
    const activeList = fetchedList.filter((i) => !i.isSnoozed && !i.isDismissed);
    const sessionPopupKey = `due_popup_shown_session_${user.id}`;
    if (!hasAutoPoppedRef.current && !sessionStorage.getItem(sessionPopupKey)) {
      hasAutoPoppedRef.current = true;
      if (activeList.length > 0) {
        sessionStorage.setItem(sessionPopupKey, '1');
        setReviewItemsList(activeList);
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

  // Derived filtered collections
  const items = allItems.filter((i) => !i.isSnoozed && !i.isDismissed);
  const overdueItems = items.filter((i) => i.sourceType === 'document_overdue');
  const upcomingItems = items.filter((i) => i.sourceType === 'document_upcoming');
  const reminderItems = items.filter((i) => i.sourceType === 'reminder');
  const snoozedItems = allItems.filter((i) => i.isSnoozed);
  const dismissedItems = allItems.filter((i) => i.isDismissed && !i.isSnoozed);

  const allOverdueCount = allItems.filter((i) => i.sourceType === 'document_overdue').length;
  const allUpcomingCount = allItems.filter((i) => i.sourceType === 'document_upcoming').length;
  const allReminderCount = allItems.filter((i) => i.sourceType === 'reminder').length;

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

    setAllItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, isSnoozed: true, snoozedUntil: until.toISOString() } : i
      )
    );

    setReviewItemsList((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (next.length === 0) {
        setIsPopupOpen(false);
      } else if (currentItemIndex >= next.length) {
        setCurrentItemIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const unsnoozeItem = async (item: DueItem) => {
    if (item.sourceType === 'reminder') {
      await supabase
        .from('reminders')
        .update({ snoozed_until: null })
        .eq('id', item.rawId);
    } else {
      localStorage.removeItem(`doc_snoozed_${item.rawId}`);
    }

    setAllItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, isSnoozed: false, snoozedUntil: null } : i
      )
    );

    toast.success('Item restored to active list');
  };

  const snoozeAll = async (until: Date) => {
    const activeOnes = allItems.filter((i) => !i.isSnoozed && !i.isDismissed);
    if (activeOnes.length === 0) return;

    const count = activeOnes.length;
    const reminderIds = activeOnes.filter((i) => i.sourceType === 'reminder').map((i) => i.rawId);
    const docIds = activeOnes.filter((i) => i.sourceType !== 'reminder').map((i) => i.rawId);

    if (reminderIds.length > 0) {
      await supabase
        .from('reminders')
        .update({ snoozed_until: until.toISOString() })
        .in('id', reminderIds);
    }

    docIds.forEach((id) => {
      localStorage.setItem(`doc_snoozed_${id}`, until.toISOString());
    });

    setAllItems((prev) =>
      prev.map((i) =>
        !i.isSnoozed && !i.isDismissed
          ? { ...i, isSnoozed: true, snoozedUntil: until.toISOString() }
          : i
      )
    );

    setIsPopupOpen(false);
    setReviewItemsList([]);
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

    setAllItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isDismissed: true } : i))
    );

    setReviewItemsList((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (next.length === 0) {
        setIsPopupOpen(false);
      } else if (currentItemIndex >= next.length) {
        setCurrentItemIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const undismissItem = async (item: DueItem) => {
    if (item.sourceType === 'reminder') {
      await supabase
        .from('reminders')
        .update({ is_dismissed: false })
        .eq('id', item.rawId);
    } else {
      sessionStorage.removeItem(`doc_dismissed_${item.rawId}`);
    }

    setAllItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isDismissed: false } : i))
    );

    toast.success('Item restored to active list');
  };

  const acknowledgeAll = async () => {
    const activeOnes = allItems.filter((i) => !i.isSnoozed && !i.isDismissed);
    if (activeOnes.length === 0) return;

    const count = activeOnes.length;
    const reminderIds = activeOnes.filter((i) => i.sourceType === 'reminder').map((i) => i.rawId);
    const docIds = activeOnes.filter((i) => i.sourceType !== 'reminder').map((i) => i.rawId);

    if (reminderIds.length > 0) {
      await supabase
        .from('reminders')
        .update({ is_dismissed: true, acknowledged_at: new Date().toISOString() })
        .in('id', reminderIds);
    }

    docIds.forEach((id) => {
      sessionStorage.setItem(`doc_dismissed_${id}`, 'true');
    });

    setAllItems((prev) =>
      prev.map((i) => (!i.isSnoozed ? { ...i, isDismissed: true } : i))
    );

    setIsPopupOpen(false);
    setReviewItemsList([]);
    setCurrentItemIndex(0);
    toast.success(`All ${count} item${count > 1 ? 's' : ''} acknowledged for this session`);
  };

  const restoreAll = async () => {
    // Clear all client-side storage keys for snooze & dismiss
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('doc_snoozed_')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('doc_dismissed_')) {
        sessionStorage.removeItem(key);
      }
    });

    // Reset reminders in Supabase
    try {
      await supabase
        .from('reminders')
        .update({ snoozed_until: null, is_dismissed: false })
        .or(`created_by.eq.${user?.id},assigned_to.eq.${user?.id}`)
        .eq('is_completed', false);
    } catch (e) {
      console.error('Error resetting reminder dismiss/snooze:', e);
    }

    setAllItems((prev) =>
      prev.map((i) => ({ ...i, isSnoozed: false, snoozedUntil: null, isDismissed: false }))
    );

    toast.success('All items restored to active view');
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

      const empName = item.employee_name || (item.employee
        ? `${item.employee.first_name || ''} ${item.employee.last_name || ''}`.trim()
        : null);

      if (error) {
        toast.error('Failed to mark document complete');
        return;
      }
      toast.success(empName ? `Document follow-up for ${empName} marked complete` : 'Document follow-up marked complete');
    }

    setAllItems((prev) => prev.filter((i) => i.id !== item.id));
    setReviewItemsList((prev) => {
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

  const openReviewModal = (startIndex = 0, customItems?: DueItem[]) => {
    const listToReview = customItems || (items.length > 0 ? items : allItems);
    if (listToReview.length === 0) {
      toast.info('No overdue or due items to review');
      return;
    }
    setReviewItemsList(listToReview);
    setCurrentItemIndex(Math.min(startIndex, listToReview.length - 1));
    setIsPopupOpen(true);
  };

  return (
    <DueFollowUpsContext.Provider
      value={{
        allItems,
        items,
        overdueItems,
        upcomingItems,
        reminderItems,
        snoozedItems,
        dismissedItems,
        totalCount: items.length,
        allCount: allItems.length,
        overdueCount: overdueItems.length,
        upcomingCount: upcomingItems.length,
        reminderCount: reminderItems.length,
        snoozedCount: snoozedItems.length,
        dismissedCount: dismissedItems.length,
        allOverdueCount,
        allUpcomingCount,
        allReminderCount,
        loading,
        refetch: fetchDueItems,
        isPopupOpen,
        setIsPopupOpen,
        currentItemIndex,
        setCurrentItemIndex,
        snoozeItem,
        unsnoozeItem,
        snoozeAll,
        acknowledgeItem,
        undismissItem,
        acknowledgeAll,
        restoreAll,
        completeItem,
        viewDocument,
        openReviewModal,
        reviewItemsList,
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
