import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReminderInterval = { label: string; minutes: number };

const SETTINGS_KEY = "reminder_intervals";

function parseIntervals(value: unknown): ReminderInterval[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const minutes = Number((v as any)?.minutes);
      const label = String((v as any)?.label ?? "");
      if (!Number.isFinite(minutes) || !label) return null;
      return { minutes: Math.max(0, Math.floor(minutes)), label } as ReminderInterval;
    })
    .filter(Boolean) as ReminderInterval[];
}

export default function ReminderSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intervals, setIntervals] = useState<ReminderInterval[]>([]);

  const hasEmpty = useMemo(
    () => intervals.some((i) => !i.label.trim() || !Number.isFinite(i.minutes)),
    [intervals]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("reminder_settings")
        .select("setting_value")
        .eq("setting_key", SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        toast.error(error.message || "Failed to load reminder settings");
        setLoading(false);
        return;
      }

      setIntervals(parseIntervals(data?.setting_value));
      setLoading(false);
    };

    load();
  }, []);

  const save = async () => {
    if (hasEmpty) {
      toast.error("Please fill all labels and minutes");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("reminder_settings")
      .update({ setting_value: intervals })
      .eq("setting_key", SETTINGS_KEY);

    if (error) {
      toast.error(error.message || "Failed to save reminder settings");
    } else {
      toast.success("Reminder settings saved");
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task reminder popups</CardTitle>
        <CardDescription>
          Configure when users see in-app popups before a task due date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Note: Safety tasks currently use a <span className="font-medium">date</span> (no time).
            Reminders are calculated using end-of-day for that date.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-4">
              <Label>Label</Label>
            </div>
            <div className="md:col-span-2">
              <Label>Minutes before</Label>
            </div>
          </div>

          <Separator />

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : intervals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intervals configured.</p>
          ) : (
            <div className="space-y-3">
              {intervals.map((it, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-4">
                    <Input
                      value={it.label}
                      onChange={(e) => {
                        const next = [...intervals];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setIntervals(next);
                      }}
                      placeholder="e.g., 1 day before"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={it.minutes}
                      onChange={(e) => {
                        const next = [...intervals];
                        next[idx] = { ...next[idx], minutes: Number(e.target.value) };
                        setIntervals(next);
                      }}
                      placeholder="Minutes"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIntervals(intervals.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIntervals([...intervals, { label: "New interval", minutes: 15 }])}
              disabled={loading}
            >
              Add interval
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                toast("Test reminder popup", {
                  description: "If you see this, popups are working. Real reminders trigger near task due dates.",
                });
              }}
            >
              Send test popup
            </Button>
          </div>

          <Button type="button" onClick={save} disabled={loading || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
