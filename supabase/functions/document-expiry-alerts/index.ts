// Emails people about employee documents that are about to expire, need a follow-up, or are overdue.
//
//   POST { action: "run" }      send the alerts that are due now
//   POST { action: "preview" }  same, but send nothing: says who would get what
//
// Who may call it: a Super Admin (signed in), or a scheduler sending the x-cron-secret header
// (DOC_ALERT_CRON_SECRET, or FUEL_CRON_SECRET if that one is not set).
//
// Settings come from Document Settings > "Follow-up Intervals (days before expiry)":
//   an organisation's own row if it has one, otherwise the global row (organization_id is null).
//   Once a document is within an interval (for example 30, 14, 7 days) one email goes out for it. Each interval
//   is sent once per expiry date. When the date passes, one "overdue" email goes out.
//   The same applies to a document's follow-up date.
//
// Who gets which documents (one combined email per person, never one per document):
//   Super Admin: every document.   HR: by access level (full = all, organisation = their organisation,
//   branch = their branches).   Store login (manager): their own branch(es).
//   A custom role's organisation / branches override the profile, the same way the app does.
//   Documents of deactivated or deleted employees are left out.
//
// Secrets: RESEND_API_KEY (already used by the login-code emails), optional RESEND_FROM_EMAIL, APP_URL.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL =
  "https://bnxlmeilekynzadjbsrx.supabase.co/storage/v1/object/public/template-assets/niza-cloud-logo.png";
const DEFAULT_INTERVALS = [30];
const MAX_ROWS_IN_EMAIL = 150;
const DAY_MS = 86_400_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

interface Alert {
  docId: string;
  kind: "expiry" | "follow_up";
  dueDate: string; // yyyy-mm-dd
  days: number; // negative = overdue
  overdue: boolean;
  intervalsToLog: number[]; // 0 means "overdue"
  title: string;
  fileName: string;
  employeeName: string;
  employeeId: string | null;
  orgId: string | null;
  branchId: string | null;
  branchName: string;
}

interface Person {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "hr" | "manager";
  level: "full" | "organization" | "branch";
  orgId: string | null;
  branchIds: string[];
}

function toDay(d: string): number {
  return Math.floor(new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() / DAY_MS);
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ---- who is calling -----------------------------------------------------------------------------------
    const cronSecret = Deno.env.get("DOC_ALERT_CRON_SECRET") || Deno.env.get("FUEL_CRON_SECRET");
    const sentSecret = req.headers.get("x-cron-secret");
    let allowed = Boolean(cronSecret && sentSecret && sentSecret === cronSecret);
    if (!allowed) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const { data: u } = await admin.auth.getUser(token);
        if (u?.user) {
          const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
          allowed = (roles || []).some((r: Row) => r.role === "super_admin");
        }
      }
    }
    if (!allowed) return json({ success: false, error: "Only a Super Admin can run document alerts" }, 403);

    let action = "run";
    try {
      const body = await req.json();
      if (body?.action === "preview") action = "preview";
    } catch (_e) { /* no body = run */ }
    const dryRun = action === "preview";

    // ---- settings -------------------------------------------------------------------------------------------
    const { data: settingsRows } = await admin
      .from("document_follow_up_settings")
      .select("organization_id, follow_up_intervals, is_active");
    const globalRow = (settingsRows || []).find((r: Row) => r.organization_id === null);
    const orgRows = new Map<string, Row>();
    (settingsRows || []).forEach((r: Row) => { if (r.organization_id) orgRows.set(r.organization_id, r); });

    const settingsFor = (orgId: string | null): number[] | null => {
      const row = (orgId && orgRows.get(orgId)) || globalRow;
      if (!row) return DEFAULT_INTERVALS;
      if (row.is_active === false) return null; // switched off
      const list = (row.follow_up_intervals || []).filter((n: number) => Number.isFinite(n) && n >= 0);
      return list.length ? list : DEFAULT_INTERVALS;
    };

    let widest = 0;
    (settingsRows || []).forEach((r: Row) => (r.follow_up_intervals || []).forEach((n: number) => { if (n > widest) widest = n; }));
    if (!settingsRows || settingsRows.length === 0) widest = Math.max(...DEFAULT_INTERVALS);

    const today = Math.floor(Date.now() / DAY_MS);
    const horizon = new Date((today + widest) * DAY_MS).toISOString().slice(0, 10);

    // ---- documents that could need an alert ---------------------------------------------------------------
    const docs: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("documents")
        .select("id, title, file_name, expiry_date, follow_up_date, employee_id, folder_id")
        .or(`expiry_date.lte.${horizon},follow_up_date.lte.${horizon}`)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      docs.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    if (docs.length === 0) return json({ success: true, dryRun, documents: 0, emails: 0, message: "Nothing is due." });

    // owner of each document: its employee, or the employee folder it sits in
    const folderIds = [...new Set(docs.filter((d) => !d.employee_id && d.folder_id).map((d) => d.folder_id))];
    const folderEmployee = new Map<string, string>();
    for (const part of chunk(folderIds, 100)) {
      const { data } = await admin.from("folders").select("id, employee_id").in("id", part);
      (data || []).forEach((f: Row) => { if (f.employee_id) folderEmployee.set(f.id, f.employee_id); });
    }
    const employeeIdOf = (d: Row): string | null => d.employee_id || (d.folder_id && folderEmployee.get(d.folder_id)) || null;

    const empIds = [...new Set(docs.map(employeeIdOf).filter(Boolean) as string[])];
    const employees = new Map<string, Row>();
    for (const part of chunk(empIds, 100)) {
      const { data } = await admin
        .from("employees")
        .select("id, first_name, last_name, status, branch_id, organization_id")
        .in("id", part);
      (data || []).forEach((e: Row) => employees.set(e.id, e));
    }
    const { data: branchRows } = await admin.from("branches").select("id, name");
    const branchName = new Map<string, string>((branchRows || []).map((b: Row) => [b.id, b.name]));

    // ---- work out what is due ----------------------------------------------------------------------------------
    const logged = new Set<string>();
    for (const part of chunk(docs.map((d) => d.id), 100)) {
      const { data } = await admin
        .from("document_alert_log")
        .select("document_id, kind, due_date, interval_days")
        .in("document_id", part);
      (data || []).forEach((l: Row) => logged.add(`${l.document_id}|${l.kind}|${l.due_date}|${l.interval_days}`));
    }

    const alerts: Alert[] = [];
    for (const d of docs) {
      const empId = employeeIdOf(d);
      const emp = empId ? employees.get(empId) : null;
      if (emp && ["inactive", "terminated", "deleted"].includes(String(emp.status || "").toLowerCase())) continue;
      const orgId: string | null = emp?.organization_id ?? null;
      const intervals = settingsFor(orgId);
      if (!intervals) continue;

      for (const kind of ["expiry", "follow_up"] as const) {
        const due: string | null = kind === "expiry" ? d.expiry_date : d.follow_up_date;
        if (!due) continue;
        const days = toDay(due) - today;
        const dueDate = due.slice(0, 10);
        let toLog: number[] = [];
        let overdue = false;

        if (days < 0) {
          overdue = true;
          if (logged.has(`${d.id}|${kind}|${dueDate}|0`)) continue;
          toLog = [0];
        } else {
          const crossed = intervals.filter((i: number) => days <= i);
          const fresh = crossed.filter((i: number) => !logged.has(`${d.id}|${kind}|${dueDate}|${i}`));
          if (fresh.length === 0) continue;
          toLog = crossed; // remember every step already reached, so only the next one triggers later
        }

        alerts.push({
          docId: d.id, kind, dueDate, days, overdue, intervalsToLog: toLog,
          title: d.title || d.file_name || "Document",
          fileName: d.file_name || "",
          employeeName: emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "—",
          employeeId: empId,
          orgId,
          branchId: emp?.branch_id ?? null,
          branchName: emp?.branch_id ? branchName.get(emp.branch_id) || "" : "",
        });
      }
    }
    if (alerts.length === 0) return json({ success: true, dryRun, documents: 0, emails: 0, message: "Nothing new is due." });

    // ---- who gets them ------------------------------------------------------------------------------------------
    const { data: roleRows } = await admin.from("user_roles").select("user_id, role").in("role", ["super_admin", "hr", "manager"]);
    const roleOf = new Map<string, Person["role"]>();
    const rank = { super_admin: 3, hr: 2, manager: 1 } as const;
    (roleRows || []).forEach((r: Row) => {
      const cur = roleOf.get(r.user_id);
      if (!cur || rank[r.role as Person["role"]] > rank[cur]) roleOf.set(r.user_id, r.role);
    });

    const profiles: Row[] = [];
    for (const part of chunk([...roleOf.keys()], 100)) {
      const { data } = await admin
        .from("profiles")
        .select("id, email, name, display_name, organization_id, branch_id, hr_access_level, is_active, custom_role_id")
        .in("id", part);
      profiles.push(...(data || []));
    }

    const customIds = [...new Set(profiles.map((p: Row) => p.custom_role_id).filter(Boolean))];
    const customRoles = new Map<string, Row>();
    if (customIds.length) {
      const { data } = await admin.from("custom_roles").select("id, base_role, organization_id, branch_id, branch_ids, is_active").in("id", customIds);
      (data || []).forEach((c: Row) => customRoles.set(c.id, c));
    }

    const people: Person[] = [];
    for (const p of profiles) {
      if (p.is_active === false || !p.email) continue;
      let role = roleOf.get(p.id)!;
      let level = (p.hr_access_level as Person["level"]) || "full";
      let orgId: string | null = p.organization_id ?? null;
      let branchIds: string[] = p.branch_id ? [p.branch_id] : [];
      const cr = p.custom_role_id ? customRoles.get(p.custom_role_id) : null;
      if (cr && cr.is_active !== false) {
        if (cr.base_role === "hr" || cr.base_role === "manager" || cr.base_role === "super_admin") role = cr.base_role;
        const ids: string[] = (cr.branch_ids && cr.branch_ids.length ? cr.branch_ids : cr.branch_id ? [cr.branch_id] : []) as string[];
        if (ids.length) { level = "branch"; branchIds = ids; orgId = cr.organization_id ?? orgId; }
        else if (cr.organization_id) { level = "organization"; orgId = cr.organization_id; }
      }
      people.push({ id: p.id, email: p.email, name: p.display_name || p.name || p.email, role, level, orgId, branchIds });
    }

    const canSee = (person: Person, a: Alert): boolean => {
      if (person.role === "super_admin") return true;
      if (person.role === "manager") return Boolean(a.branchId && person.branchIds.includes(a.branchId));
      // hr
      if (person.level === "full") return true;
      if (person.level === "organization") return Boolean(person.orgId && a.orgId === person.orgId);
      return Boolean(a.branchId && person.branchIds.includes(a.branchId));
    };

    const perPerson = new Map<string, Alert[]>();
    for (const person of people) {
      const mine = alerts.filter((a) => canSee(person, a));
      if (mine.length) perPerson.set(person.id, mine);
    }

    if (dryRun) {
      return json({
        success: true, dryRun: true, documents: new Set(alerts.map((a) => `${a.docId}|${a.kind}`)).size,
        emails: perPerson.size,
        recipients: people.filter((p) => perPerson.has(p.id)).map((p) => ({ name: p.name, role: p.role, count: perPerson.get(p.id)!.length })),
      });
    }

    // ---- send ---------------------------------------------------------------------------------------------------
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ success: false, error: "RESEND_API_KEY is not set for this function" }, 500);
    const from = Deno.env.get("RESEND_FROM_EMAIL") || "Niza Group <alerts@nizagroup.uk>";
    const appUrl = Deno.env.get("APP_URL") || "";

    const delivered = new Set<string>(); // "docId|kind|dueDate" that reached at least one person
    let sent = 0;
    let failed = 0;
    for (const person of people) {
      const mine = perPerson.get(person.id);
      if (!mine) continue;
      const html = buildEmail(person, mine, appUrl);
      const overdueN = mine.filter((a) => a.overdue).length;
      const soonN = mine.length - overdueN;
      const subject = `Document alerts: ${soonN ? `${soonN} due soon` : ""}${soonN && overdueN ? ", " : ""}${overdueN ? `${overdueN} overdue` : ""}`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [person.email], subject, html }),
      });
      if (res.ok) {
        sent++;
        mine.forEach((a) => delivered.add(`${a.docId}|${a.kind}|${a.dueDate}`));
      } else {
        failed++;
        console.error("Resend failed", person.email, res.status, await res.text());
      }
    }

    // remember what was sent
    const logRowsToWrite: Row[] = [];
    for (const a of alerts) {
      if (!delivered.has(`${a.docId}|${a.kind}|${a.dueDate}`)) continue;
      for (const i of a.intervalsToLog) {
        logRowsToWrite.push({ document_id: a.docId, kind: a.kind, due_date: a.dueDate, interval_days: i });
      }
    }
    for (const part of chunk(logRowsToWrite, 500)) {
      await admin.from("document_alert_log").upsert(part, { onConflict: "document_id,kind,due_date,interval_days", ignoreDuplicates: true });
    }

    return json({ success: true, dryRun: false, documents: delivered.size, emails: sent, failed });
  } catch (e) {
    console.error("document-expiry-alerts error", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function buildEmail(person: Person, alerts: Alert[], appUrl: string): string {
  const overdue = alerts.filter((a) => a.overdue).sort((x, y) => x.days - y.days);
  const soon = alerts.filter((a) => !a.overdue).sort((x, y) => x.days - y.days);

  const label = (a: Alert) => (a.kind === "expiry" ? "Expiry" : "Follow-up");
  const when = (a: Alert) =>
    a.days < 0 ? `${-a.days} day${a.days === -1 ? "" : "s"} overdue` : a.days === 0 ? "today" : `in ${a.days} day${a.days === 1 ? "" : "s"}`;
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

  const table = (list: Alert[], colour: string) => {
    const shown = list.slice(0, MAX_ROWS_IN_EMAIL);
    const rows = shown
      .map(
        (a) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;"><b>${esc(a.employeeName)}</b><br><span style="color:#64748b;">${esc(a.branchName)}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${esc(a.title)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${label(a)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;white-space:nowrap;">${fmt(a.dueDate)}<br><span style="color:${colour};font-weight:600;">${when(a)}</span></td>
      </tr>`
      )
      .join("");
    const more = list.length > shown.length ? `<p style="font-size:12px;color:#64748b;">…and ${list.length - shown.length} more. Open Documents to see them all.</p>` : "";
    return `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px;">
      <thead><tr style="background:#f1f5f9;">
        <th align="left" style="padding:8px 10px;font-size:12px;color:#475569;">Employee</th>
        <th align="left" style="padding:8px 10px;font-size:12px;color:#475569;">Document</th>
        <th align="left" style="padding:8px 10px;font-size:12px;color:#475569;">What</th>
        <th align="left" style="padding:8px 10px;font-size:12px;color:#475569;">Date</th>
      </tr></thead><tbody>${rows}</tbody></table>${more}`;
  };

  const link = appUrl ? `<p style="margin:20px 0 0;"><a href="${esc(appUrl)}" style="background:#047857;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Documents</a></p>` : "";

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <img src="${LOGO_URL}" alt="Niza" height="36" style="margin-bottom:12px;">
      <h2 style="margin:0 0 6px;font-size:20px;">Employee document alerts</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;">Hello ${esc(person.name)}, these employee documents need attention${person.role === "super_admin" ? "" : " in your area"}.</p>
      ${overdue.length ? `<h3 style="margin:18px 0 0;font-size:15px;color:#be123c;">Overdue (${overdue.length})</h3>${table(overdue, "#be123c")}` : ""}
      ${soon.length ? `<h3 style="margin:18px 0 0;font-size:15px;color:#b45309;">Coming up (${soon.length})</h3>${table(soon, "#b45309")}` : ""}
      ${link}
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:14px;">Automated notification from alerts@nizagroup.uk. Please do not reply directly to this email.</p>
  </div></body></html>`;
}
