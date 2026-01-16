import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { addMinutes, endOfDay, format, isWithinInterval, subMinutes } from "date-fns";

type ReminderInterval = { label: string; minutes: number };

type SafetyTaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  organization_id: string;
  branch_id: string;
};

const SETTINGS_KEY = "reminder_intervals";

function parseIntervals(value: unknown): ReminderInterval[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v): ReminderInterval | null => {
      if (typeof v !== 'object' || v === null) return null;
      const item = v as Record<string, unknown>;
      const minutes = Number(item.minutes);
      const label = String(item.label ?? "");
      if (!Number.isFinite(minutes) || !label) return null;
      return { minutes: Math.max(0, Math.floor(minutes)), label };
    })
    .filter((item): item is ReminderInterval => item !== null);
}

function taskDueAt(task: SafetyTaskRow): Date | null {
  if (!task.due_date) return null;
  const d = new Date(task.due_date);
  if (Number.isNaN(d.getTime())) return null;
  // due_date is DATE in DB (no time). Use end-of-day so "1 hour before" makes sense.
  return endOfDay(d);
}

function loadFiredSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveFiredSet(storageKey: string, set: Set<string>) {
  try {
    // Keep it bounded so localStorage doesn't grow forever
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(storageKey, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export default function TaskReminderListener() {
  const { user } = useAuth();
  const [intervals, setIntervals] = useState<ReminderInterval[]>([]);
  const runningRef = useRef(false);

  const intervalsKey = useMemo(() => JSON.stringify(intervals), [intervals]);

  const fetchIntervals = useCallback(async () => {
    const { data, error } = await supabase
      .from("reminder_settings")
      .select("setting_value")
      .eq("setting_key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      // Silent: we don't want to spam users if settings can't be read.
      return;
    }

    setIntervals(parseIntervals(data?.setting_value) || []);
  }, []);

  const tick = useCallback(async () => {
    if (!user || runningRef.current) return;
    runningRef.current = true;

    try {
      // 1) Load settings (first run or if empty)
      if (intervals.length === 0) {
        await fetchIntervals();
      }

      const effectiveIntervals = intervals.length ? intervals : [];
      if (effectiveIntervals.length === 0) return;

      // 2) Load tasks assigned to this user
      const { data: tasks, error: tasksError } = await supabase
        .from("safety_tasks")
        .select("id,title,description,due_date,status,priority,organization_id,branch_id")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(200);

      if (tasksError) return;

      const now = new Date();
      const windowEnd = addMinutes(now, 1);

      const firedStorageKey = `niza_task_reminders_fired:${user.id}`;
      const firedSet = loadFiredSet(firedStorageKey);

      for (const task of (tasks || []) as SafetyTaskRow[]) {
        const dueAt = taskDueAt(task);
        if (!dueAt) continue;

        for (const interval of effectiveIntervals) {
          const reminderType = `safety_task_${interval.minutes}`;
          const fireAt = subMinutes(dueAt, interval.minutes);

          if (
            isWithinInterval(now, {
              start: fireAt,
              end: windowEnd,
            })
          ) {
            const key = `${task.id}:${reminderType}`;
            if (firedSet.has(key)) continue;

            firedSet.add(key);
            saveFiredSet(firedStorageKey, firedSet);

            const openPath = window.location.pathname.startsWith("/niza-safe")
              ? "/niza-safe/tasks"
              : "/dashboard/safety-tasks";

            toast(`Task reminder: ${task.title}`, {
              description: `Due ${format(dueAt, "PPpp")} • ${interval.label}`,
              action: {
                label: "Open",
                onClick: () => {
                  window.location.href = openPath;
                },
              },
              cancel: {
                label: "Dismiss",
                onClick: () => {
                  // Already recorded as fired; dismiss just closes this popup.
                },
              },
            });
          }
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [fetchIntervals, intervals, user, intervalsKey]);

  useEffect(() => {
    if (!user) return;
    fetchIntervals();
  }, [user, fetchIntervals]);

  useEffect(() => {
    if (!user) return;

    // Initial check + poll every minute
    tick();
    const id = window.setInterval(() => tick(), 60_000);
    return () => window.clearInterval(id);
  }, [user, tick]);

  return null;
}
