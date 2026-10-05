import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bell, Clock, BellOff, CheckCircle2, AlertTriangle, 
  FileText, User, Building, MapPin, Eye, Calendar, ShieldAlert 
} from 'lucide-react';
import { 
  addDays, addHours, addMinutes, differenceInDays, 
  format, formatDistanceToNow, parseISO, setHours, setMinutes, startOfTomorrow 
} from 'date-fns';
import { toast } from 'sonner';

interface DueItem {
  id: string;
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

export default function ReminderDuePopup() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<DueItem | null>(null);
  const queueRef = useRef<DueItem[]>([]);
  const shownRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const nowIso = now.toISOString();

    const itemsToAdd: DueItem[] = [];

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
        .limit(20);

      if (!remError && reminderData) {
        reminderData.forEach((r: any) => {
          if (shownRef.current.has(`rem_${r.id}`)) return;
          if (r.snoozed_until && new Date(r.snoozed_until) > now) return;

          itemsToAdd.push({
            id: `rem_${r.id}`,
            sourceType: 'reminder',
            title: r.title,
            description: r.description,
            due_date: r.reminder_date,
          });
        });
      }
    } catch (err) {
      console.error('Error checking reminders:', err);
    }

    // 2. Fetch Overdue & Upcoming Document Follow-ups
    const hasDocAccess = user.role === 'super_admin' || user.role === 'hr' || user.role === 'manager';
    if (hasDocAccess) {
      try {
        // Fetch follow-up intervals
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
          .limit(100);

        if (!docError && docsData) {
          docsData.forEach((doc: any) => {
            const itemKey = `doc_${doc.id}`;
            if (shownRef.current.has(itemKey)) return;

            // Check localStorage for client-side snooze or session acknowledgement
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
              itemsToAdd.push({
                id: itemKey,
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
                }
              });
            }
          });
        }
      } catch (err) {
        console.error('Error checking document follow-ups:', err);
      }
    }

    if (itemsToAdd.length === 0) return;

    itemsToAdd.forEach((item) => {
      if (!shownRef.current.has(item.id)) {
        queueRef.current.push(item);
        shownRef.current.add(item.id);
      }
    });

    if (!current && queueRef.current.length > 0) {
      setCurrent(queueRef.current.shift() || null);
    }
  }, [user, current]);

  useEffect(() => {
    if (!user) return;
    check();
    const t = window.setInterval(check, 25_000);
    return () => window.clearInterval(t);
  }, [user, check]);

  const advance = () => {
    setCurrent(queueRef.current.shift() || null);
  };

  const handleAcknowledge = async () => {
    if (!current) return;

    if (current.sourceType === 'reminder') {
      const remId = current.id.replace('rem_', '');
      await supabase
        .from('reminders')
        .update({ is_dismissed: true, acknowledged_at: new Date().toISOString() })
        .eq('id', remId);
      toast.success('Reminder acknowledged');
    } else if (current.document) {
      // Dismiss for current browser session
      sessionStorage.setItem(`doc_dismissed_${current.document.id}`, 'true');
      toast.success('Document follow-up acknowledged for this session');
    }

    advance();
  };

  const handleComplete = async () => {
    if (!current) return;

    if (current.sourceType === 'reminder') {
      const remId = current.id.replace('rem_', '');
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: true })
        .eq('id', remId);
      if (error) toast.error('Failed to complete'); else toast.success('Reminder marked complete');
    } else if (current.document) {
      // Clear follow-up date and record resolution
      const { error } = await supabase
        .from('documents')
        .update({ 
          follow_up_date: null,
          verified_at: new Date().toISOString()
        })
        .eq('id', current.document.id);

      localStorage.setItem(`doc_completed_${current.document.id}`, new Date().toISOString());
      
      const empName = current.employee 
        ? `${current.employee.first_name || ''} ${current.employee.last_name || ''}`.trim()
        : 'Employee';

      if (error) {
        toast.error('Failed to mark document complete');
      } else {
        toast.success(`Document follow-up for ${empName} marked complete`);
      }
    }

    advance();
  };

  const handleSnooze = async (until: Date) => {
    if (!current) return;
    shownRef.current.delete(current.id);

    if (current.sourceType === 'reminder') {
      const remId = current.id.replace('rem_', '');
      const { error } = await supabase
        .from('reminders')
        .update({ snoozed_until: until.toISOString(), reminder_date: until.toISOString() })
        .eq('id', remId);
      if (error) toast.error('Failed to snooze'); else toast.success(`Snoozed until ${format(until, 'MMM d, HH:mm')}`);
    } else if (current.document) {
      localStorage.setItem(`doc_snoozed_${current.document.id}`, until.toISOString());
      toast.success(`Follow-up snoozed until ${format(until, 'PPp')}`);
    }

    advance();
  };

  const handleViewDocument = async () => {
    if (!current?.document?.file_path) return;
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(current.document.file_path, 120);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error('Unable to open document: ' + (err.message || 'File not accessible'));
    }
  };

  if (!current) return null;
  const now = new Date();
  const dueDate = parseISO(current.due_date);

  const isDoc = current.sourceType === 'document_overdue' || current.sourceType === 'document_upcoming';
  const isOverdue = current.sourceType === 'document_overdue';
  const empName = current.employee 
    ? `${current.employee.first_name || ''} ${current.employee.last_name || ''}`.trim()
    : null;

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && handleAcknowledge()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border shadow-xl">
        {/* Top Highlight Banner */}
        <div className={`p-5 flex items-start justify-between gap-3 border-b ${
          isOverdue 
            ? 'bg-red-500/10 border-red-200 dark:border-red-900/50' 
            : current.sourceType === 'document_upcoming'
            ? 'bg-amber-500/10 border-amber-200 dark:border-amber-900/50'
            : 'bg-primary/10 border-primary/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              isOverdue 
                ? 'bg-red-600 text-white' 
                : current.sourceType === 'document_upcoming'
                ? 'bg-amber-600 text-white'
                : 'bg-primary text-primary-foreground'
            }`}>
              {isOverdue ? (
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              ) : current.sourceType === 'document_upcoming' ? (
                <Clock className="h-6 w-6" />
              ) : (
                <Bell className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  {isOverdue 
                    ? 'Document Overdue' 
                    : current.sourceType === 'document_upcoming'
                    ? 'Upcoming Document Follow-up'
                    : 'Reminder Due'}
                </h2>
                <Badge variant={isOverdue ? 'destructive' : current.sourceType === 'document_upcoming' ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0 h-4 uppercase font-bold">
                  {isOverdue ? 'Action Required' : current.sourceType === 'document_upcoming' ? 'Upcoming' : 'Task'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOverdue 
                  ? 'Expired or overdue follow-up requiring review' 
                  : current.sourceType === 'document_upcoming'
                  ? 'Upcoming expiration / review date'
                  : 'Scheduled task alert'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body with Rich Details */}
        <div className="p-6 space-y-4">
          {/* Main Title & File Name */}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground leading-snug">{current.title}</h3>
            {current.document?.file_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {current.document.file_name}
              </p>
            )}
            {current.description && !current.document && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pt-1">{current.description}</p>
            )}
          </div>

          {/* Employee Details Card (Essential Requirement) */}
          {empName && (
            <div className="bg-slate-50 dark:bg-slate-900/60 border rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary" />
                  {empName}
                </span>
                {current.employee?.email && (
                  <span className="text-[11px] text-muted-foreground">{current.employee.email}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t">
                {current.employee?.organizations?.name && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Building className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{current.employee.organizations.name}</span>
                  </div>
                )}
                {current.employee?.branches?.name && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{current.employee.branches.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline & Schedule Dates */}
          <div className="space-y-2 bg-muted/40 rounded-xl p-3.5 border text-xs">
            {current.document?.expiry_date && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-destructive" />
                  Expiry Date:
                </span>
                <span className="font-semibold text-foreground">
                  {format(new Date(current.document.expiry_date), 'dd MMM yyyy')}
                  <span className="text-muted-foreground text-[11px] ml-1.5">
                    ({formatDistanceToNow(new Date(current.document.expiry_date), { addSuffix: true })})
                  </span>
                </span>
              </div>
            )}
            {current.document?.follow_up_date && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Follow-up Date:
                </span>
                <span className="font-semibold text-foreground">
                  {format(new Date(current.document.follow_up_date), 'dd MMM yyyy, p')}
                </span>
              </div>
            )}
            {!current.document && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Scheduled for:
                </span>
                <span className="font-semibold text-foreground">{format(dueDate, 'PPpp')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Left Action: View Document button if document exists */}
          {current.document?.file_path ? (
            <Button variant="outline" size="sm" onClick={handleViewDocument} className="gap-1.5 text-xs h-9 w-full sm:w-auto">
              <Eye className="h-3.5 w-3.5 text-primary" />
              View Document
            </Button>
          ) : (
            <div />
          )}

          {/* Right Actions: Snooze, Acknowledge, Mark Complete */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
                  <Clock className="h-3.5 w-3.5" /> Snooze
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1.5 text-xs space-y-0.5">
                <button className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" onClick={() => handleSnooze(addMinutes(now, 15))}>15 minutes</button>
                <button className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" onClick={() => handleSnooze(addHours(now, 1))}>1 hour</button>
                <button className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" onClick={() => handleSnooze(addHours(now, 3))}>3 hours</button>
                <button className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" onClick={() => handleSnooze(setMinutes(setHours(startOfTomorrow(), 9), 0))}>Tomorrow 9:00 AM</button>
                <button className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent rounded-lg transition-colors" onClick={() => handleSnooze(addDays(now, 7))}>7 days</button>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={handleAcknowledge} className="gap-1.5 text-xs h-9">
              <BellOff className="h-3.5 w-3.5" /> Acknowledge
            </Button>

            <Button size="sm" onClick={handleComplete} className="gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
