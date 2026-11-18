// Niza AI Assistant
// - Authenticates the caller, resolves their role + scope, and builds a compact live-data
//   snapshot using the CALLER'S OWN JWT (so database RLS is always enforced) plus explicit
//   branch/organisation filters (defence in depth).
// - Streams the answer from OpenRouter (free, latency-sorted models). The API key lives only in
//   the OPENROUTER_API_KEY function secret and never reaches the browser.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fastest zero-cost models, measured by time-to-first-token. OpenRouter falls through the list
// automatically if the first is rate limited or down.
const MODELS = [
  "nvidia/nemotron-3.5-super-vl:free", // fastest measured (~0.5s to first token)
  "nvidia/nemotron-3.5-lightning:free",
  "particle-ai/particle-1:free",
]; // OpenRouter allows at most 3 models per request

type Role = "super_admin" | "hr" | "manager" | "employee";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const londonDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const londonTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "AI assistant is not configured (missing OPENROUTER_API_KEY)." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const uid = userData.user.id;

    // ---- body ----
    const body = await req.json().catch(() => ({}));
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    const history = incoming
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (!history.length || history[history.length - 1].role !== "user") return json({ error: "No question provided" }, 400);

    // ---- who is asking + scope ----
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      db.from("profiles").select("id, name, email, organization_id, branch_id, hr_access_level, custom_role_id").eq("id", uid).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", uid).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (!profile) return json({ error: "Profile not found" }, 403);

    let role: Role = (roleRow?.role as Role) || "employee";
    let customBranchIds: string[] = [];
    let customOrgId: string | null = null;
    let hasCustomRole = false;
    if (profile.custom_role_id) {
      const { data: cr } = await (db as any)
        .from("custom_roles")
        .select("base_role, branch_ids, branch_id, organization_id, is_active")
        .eq("id", profile.custom_role_id)
        .maybeSingle();
      if (cr && cr.is_active !== false) {
        hasCustomRole = true;
        if (cr.base_role && !roleRow?.role) role = cr.base_role as Role;
        customBranchIds = Array.isArray(cr.branch_ids) && cr.branch_ids.filter(Boolean).length > 0
          ? cr.branch_ids.filter(Boolean)
          : cr.branch_id ? [cr.branch_id] : [];
        customOrgId = cr.organization_id ?? null;
      }
    }

    // Effective scope mirrors get_my_profile_data(): a custom role's organisation / branches
    // override the profile's default "full" access.
    let hrLevel: string = profile.hr_access_level || "full";
    let scopeOrgId: string | null = profile.organization_id ?? null;
    if (hasCustomRole && customBranchIds.length > 0) hrLevel = "branch";
    else if (hasCustomRole && customOrgId) { hrLevel = "organization"; scopeOrgId = customOrgId; }
    const ownBranches = customBranchIds.length > 0
      ? customBranchIds
      : [...new Set(profile.branch_id ? [profile.branch_id] : [])];

    // Branch/organisation scope. null => unrestricted.
    let scopeLabel = "";
    let orgFilter: string | null = null;
    let branchFilter: string[] | null = null;
    if (role === "super_admin" || (role === "hr" && hrLevel === "full")) {
      scopeLabel = "ALL organisations and branches";
    } else if (role === "hr" && hrLevel === "organization" && scopeOrgId) {
      orgFilter = scopeOrgId;
      scopeLabel = "their own organisation only";
    } else if (role === "hr" || role === "manager") {
      branchFilter = ownBranches;
      scopeLabel = "their assigned branch(es) only";
    } else {
      scopeLabel = "their own personal records only";
    }

    const today = londonDate();
    const weekAgo = londonDate(new Date(Date.now() - 7 * 864e5));
    const todayStartIso = new Date(`${today}T00:00:00Z`).toISOString();
    const in7 = londonDate(new Date(Date.now() + 7 * 864e5));
    const in14 = londonDate(new Date(Date.now() + 14 * 864e5));
    const in30 = londonDate(new Date(Date.now() + 30 * 864e5));
    const isStaff = role === "employee";

    // ---- scoped data helpers ----
    const scopeByBranch = (q: any, col = "branch_id") => {
      if (branchFilter) q = q.in(col, branchFilter.length ? branchFilter : ["00000000-0000-0000-0000-000000000000"]);
      return q;
    };

    const ctx: Record<string, unknown> = {};
    ctx.now_london = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "full", timeStyle: "short" }).format(new Date());
    ctx.asking_user = { name: profile.name, role, scope: scopeLabel };

    // Branch + organisation names (scoped)
    let brQ = db.from("branches").select("id, name, organization_id");
    if (orgFilter) brQ = brQ.eq("organization_id", orgFilter);
    brQ = scopeByBranch(brQ, "id");
    const [{ data: branches }, { data: orgs }] = await Promise.all([brQ, db.from("organizations").select("id, name")]);
    const branchName = new Map((branches || []).map((b: any) => [b.id, b.name]));
    const orgName = new Map((orgs || []).map((o: any) => [o.id, o.name]));
    const scopedBranchIds = (branches || []).map((b: any) => b.id);
    const inScope = (q: any, col = "branch_id") => (orgFilter || branchFilter ? q.in(col, scopedBranchIds.length ? scopedBranchIds : ["00000000-0000-0000-0000-000000000000"]) : q);
    ctx.branches = (branches || []).map((b: any) => `${b.name} (${orgName.get(b.organization_id) ?? "?"})`);

    if (isStaff) {
      // ---------- Staff: own records only ----------
      const { data: me } = await db.from("employees").select("id").eq("user_id", uid).limit(1).maybeSingle();
      const none = Promise.resolve({ data: [] as any[] });
      const [clocks, leave, events, shifts] = await Promise.all([
        db.from("clock_ins").select("clock_in_time, clock_out_time, branch_id").eq("user_id", uid).gte("clock_in_time", `${weekAgo}T00:00:00Z`).order("clock_in_time", { ascending: false }).limit(20),
        me ? db.from("leave_requests").select("start_date, end_date, status, reason").eq("employee_id", me.id).gte("end_date", weekAgo).order("start_date").limit(20) : none,
        db.from("events").select("title, event_date, event_type").gte("event_date", today).order("event_date").limit(10),
        me ? db.from("rota_shifts").select("shift_date, start_time, end_time, status, employee_response").eq("employee_id", me.id).gte("shift_date", today).lte("shift_date", in14).order("shift_date").limit(30) : none,
      ]);
      ctx.my_upcoming_shifts = shifts.data || [];
      ctx.my_clock_ins_last_7_days = (clocks.data || []).map((c: any) => ({
        in: c.clock_in_time, out: c.clock_out_time, branch: branchName.get(c.branch_id) ?? null,
      }));
      ctx.my_leave_requests = leave.data || [];
      ctx.upcoming_events = events.data || [];
    } else {
      // ---------- Managers / HR / Admin ----------
      let repQ = db.from("daily_reports").select("branch_id, report_type, report_date, submitted_at, submitted_by").gte("report_date", weekAgo).order("submitted_at", { ascending: true }).limit(600);
      repQ = inScope(repQ);
      let empQ = db.from("employees").select("id, user_id, first_name, last_name, job_title, department, status, branch_id, join_date").limit(500);
      empQ = inScope(empQ);
      let clkQ = db.from("clock_ins").select("user_id, branch_id, clock_in_time, clock_out_time").gte("clock_in_time", todayStartIso).order("clock_in_time", { ascending: true }).limit(500);
      clkQ = inScope(clkQ);
      let tixQ = db.from("maintenance_tickets").select("title, status, priority, branch_id, created_at").neq("status", "closed").neq("status", "resolved").order("created_at", { ascending: false }).limit(60);
      tixQ = inScope(tixQ);
      const evQ = db.from("events").select("title, event_date, event_type, branch_id").gte("event_date", today).order("event_date").limit(15);

      const [reports, emps, clocks, tickets, events] = await Promise.all([repQ, empQ, clkQ, tixQ, evQ]);

      // names for submitters / clocked-in users
      const userIds = [...new Set([...(reports.data || []).map((r: any) => r.submitted_by), ...(clocks.data || []).map((c: any) => c.user_id)].filter(Boolean))];
      const { data: people } = userIds.length ? await db.from("profiles").select("id, name").in("id", userIds) : { data: [] as any[] };
      const personName = new Map((people || []).map((p: any) => [p.id, p.name]));

      const todays = (reports.data || []).filter((r: any) => r.report_date === today);
      ctx.daily_reports_today = todays.map((r: any, i: number) => ({
        order_submitted: i + 1, // 1 = first to submit today
        branch: branchName.get(r.branch_id) ?? "?",
        type: r.report_type,
        submitted_at_uk: londonTime(r.submitted_at),
        submitted_by: personName.get(r.submitted_by) ?? null,
      }));
      const submittedBranchIds = new Set(todays.map((r: any) => r.branch_id));
      ctx.branches_without_daily_report_today = (branches || []).filter((b: any) => !submittedBranchIds.has(b.id)).map((b: any) => b.name);
      const perBranch: Record<string, number> = {};
      for (const r of reports.data || []) perBranch[branchName.get(r.branch_id) ?? "?"] = (perBranch[branchName.get(r.branch_id) ?? "?"] || 0) + 1;
      ctx.daily_reports_count_last_7_days_by_branch = perBranch;

      const E = emps.data || [];
      const byStatus: Record<string, number> = {};
      for (const e of E) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      ctx.employee_counts_by_status = byStatus;
      ctx.employees = E.map((e: any) => `${e.first_name} ${e.last_name} | ${e.job_title ?? "-"} | ${e.department ?? "-"} | ${e.status} | ${branchName.get(e.branch_id) ?? "-"}`);

      ctx.clock_ins_today = (clocks.data || []).map((c: any) => ({
        employee: personName.get(c.user_id) ?? "?",
        branch: branchName.get(c.branch_id) ?? "?",
        in_uk: londonTime(c.clock_in_time),
        out_uk: londonTime(c.clock_out_time),
      }));
      ctx.currently_clocked_in = (clocks.data || []).filter((c: any) => !c.clock_out_time).length;

      // Leave, scheduling and onboarding - always filtered to employees in this user's scope
      const empById = new Map(E.map((e: any) => [e.id, e]));
      const nameOf = (id: string) => {
        const e: any = empById.get(id);
        return e ? `${e.first_name} ${e.last_name}` : null;
      };
      const branchOf = (id: string) => branchName.get((empById.get(id) as any)?.branch_id) ?? "-";

      const [leaveRes, shiftRes, onbRes, caRes] = await Promise.all([
        db.from("leave_requests").select("employee_id, start_date, end_date, status").gte("end_date", today).order("start_date").limit(400),
        db.from("rota_shifts").select("employee_id, shift_date, start_time, end_time, status, employee_response").gte("shift_date", today).lte("shift_date", in7).order("shift_date").order("start_time").limit(800),
        db.from("employee_onboarding").select("employee_id, current_step, basic_details_completed, contract_uploaded, contract_submitted_for_approval, contract_approved, contract_signed, right_to_work_completed, documents_uploaded, updated_at").is("completed_at", null).limit(400),
        db.from("contract_approvals").select("employee_id, status, submitted_at").eq("status", "pending").limit(200),
      ]);

      ctx.leave_upcoming_or_pending = (leaveRes.data || [])
        .filter((l: any) => empById.has(l.employee_id))
        .slice(0, 80)
        .map((l: any) => ({ employee: nameOf(l.employee_id), branch: branchOf(l.employee_id), from: l.start_date, to: l.end_date, status: l.status }));

      const shifts = (shiftRes.data || []).filter((sh: any) => empById.has(sh.employee_id));
      const fmtShift = (sh: any) => ({
        employee: nameOf(sh.employee_id),
        branch: branchOf(sh.employee_id),
        date: sh.shift_date,
        time: `${String(sh.start_time ?? "").slice(0, 5)}-${String(sh.end_time ?? "").slice(0, 5)}`,
        response: sh.employee_response ?? null,
      });
      ctx.shifts_today = shifts.filter((sh: any) => sh.shift_date === today).slice(0, 120).map(fmtShift);
      ctx.shifts_next_7_days_count_by_branch = shifts.reduce((acc: Record<string, number>, sh: any) => {
        const b = branchOf(sh.employee_id);
        acc[b] = (acc[b] || 0) + 1;
        return acc;
      }, {});
      ctx.shifts_awaiting_employee_response = shifts.filter((sh: any) => !sh.employee_response || sh.employee_response === "pending").slice(0, 40).map(fmtShift);
      const clockedInUserIds = new Set((clocks.data || []).map((c: any) => c.user_id));
      ctx.scheduled_today_but_not_clocked_in = shifts
        .filter((sh: any) => sh.shift_date === today && !clockedInUserIds.has((empById.get(sh.employee_id) as any)?.user_id))
        .slice(0, 40)
        .map(fmtShift);

      const nextStep = (o: any) =>
        !o.basic_details_completed ? "Basic details"
        : !o.contract_uploaded ? "Contract upload"
        : !o.contract_submitted_for_approval ? "Submit contract for approval"
        : !o.contract_approved ? "Awaiting contract approval"
        : !o.contract_signed ? "Awaiting employee signature"
        : !o.right_to_work_completed ? "Right to work check"
        : !o.documents_uploaded ? "Document upload"
        : "Final review";
      ctx.onboarding_in_progress = (onbRes.data || [])
        .filter((o: any) => empById.has(o.employee_id))
        .slice(0, 60)
        .map((o: any) => ({ employee: nameOf(o.employee_id), branch: branchOf(o.employee_id), next_step: nextStep(o), last_update: String(o.updated_at ?? "").slice(0, 10) }));
      ctx.contracts_awaiting_approval = (caRes.data || [])
        .filter((c: any) => empById.has(c.employee_id))
        .map((c: any) => ({ employee: nameOf(c.employee_id), branch: branchOf(c.employee_id), submitted: String(c.submitted_at ?? "").slice(0, 10) }));

      ctx.open_maintenance_tickets = (tickets.data || []).map((t: any) => ({ title: t.title, status: t.status, priority: t.priority, branch: branchName.get(t.branch_id) ?? "?" }));
      ctx.upcoming_events = (events.data || []).map((e: any) => ({ title: e.title, date: e.event_date, type: e.event_type }));

      if (role === "super_admin" || role === "hr") {
        const docSel = "title, follow_up_date, expiry_date, employee:employees(first_name, last_name)";
        const [{ count: overdue }, { count: upcoming }, overdueList, dueList, expiringList] = await Promise.all([
          db.from("documents").select("id", { count: "exact", head: true }).lt("follow_up_date", today),
          db.from("documents").select("id", { count: "exact", head: true }).gte("follow_up_date", today).lte("follow_up_date", in30),
          db.from("documents").select(docSel).lt("follow_up_date", today).order("follow_up_date").limit(15),
          db.from("documents").select(docSel).gte("follow_up_date", today).lte("follow_up_date", in30).order("follow_up_date").limit(15),
          db.from("documents").select(docSel).gte("expiry_date", today).lte("expiry_date", in30).order("expiry_date").limit(15),
        ]);
        const docRow = (d: any) => ({
          title: d.title,
          employee: d.employee ? `${d.employee.first_name} ${d.employee.last_name}` : null,
          follow_up: d.follow_up_date,
          expires: d.expiry_date,
        });
        ctx.documents = {
          follow_ups_overdue: overdue ?? 0,
          follow_ups_due_next_30_days: upcoming ?? 0,
          overdue_follow_ups: (overdueList.data || []).map(docRow),
          follow_ups_due_soon: (dueList.data || []).map(docRow),
          expiring_next_30_days: (expiringList.data || []).map(docRow),
        };
      }
    }

    const system = `You are "Niza AI", the in-app assistant for the Niza Cloud HR & operations platform.

You answer questions using ONLY the LIVE DATA below, which has already been filtered to what this user is allowed to see (${scopeLabel}).
Rules:
- Be fast and concise: lead with the direct answer, then short bullet points if useful. No long preambles.
- Times are UK local time. "Today" is ${today}.
- For "who/which store submitted first", use daily_reports_today (order_submitted 1 = first) and say the time.
- Scheduling: use shifts_today, scheduled_today_but_not_clocked_in, shifts_awaiting_employee_response (or my_upcoming_shifts for staff).
- Onboarding: use onboarding_in_progress (with next_step) and contracts_awaiting_approval.
- Documents: use documents (overdue_follow_ups, follow_ups_due_soon, expiring_next_30_days).
- If asked about something outside the user's scope or not present in the data, say you don't have access to that data or it isn't in the current data. NEVER guess, never invent names, numbers or times, and never reveal anything beyond the data given.
- Never output personal sensitive data (addresses, NI numbers, DOB, salary, passwords); you don't have them.
- You may also explain how to use app modules (Employee Hub, Documents, Daily Reports, Clock-ins, Rota, Leave, Payroll, Lottery, Messages, Reminders) in a few steps.
- Format: plain text with simple markdown (bold, bullets). Keep answers under ~150 words unless asked for detail.

LIVE DATA (JSON):
${JSON.stringify(ctx)}`;

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nizacloud.nizagroup.uk",
        "X-Title": "Niza Cloud AI Assistant",
      },
      body: JSON.stringify({
        model: MODELS[0],
        models: MODELS,
        provider: { sort: "latency", allow_fallbacks: true },
        reasoning: { enabled: false }, // skip "thinking" tokens for the fastest replies
        stream: true,
        temperature: 0.2,
        max_tokens: 700,
        messages: [{ role: "system", content: system }, ...history],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      console.error("OpenRouter error", upstream.status, t.slice(0, 300));
      return json({ error: upstream.status === 429 ? "The assistant is busy right now. Please try again in a moment." : "The assistant is unavailable right now." }, 502);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("ai-assistant error", e);
    return json({ error: "Something went wrong." }, 500);
  }
});
