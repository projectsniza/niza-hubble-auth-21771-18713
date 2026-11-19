import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Find an auth user by email without the 50-user page limit of listUsers().
// Looks in profiles first (profiles.id = auth user id), then pages through every auth user.
// deno-lint-ignore no-explicit-any
async function findAuthUserByEmail(supabaseAdmin: any, email: string): Promise<{ id: string; email?: string } | null> {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", target)
    .limit(1)
    .maybeSingle();
  if (profile?.id) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (data?.user && data.user.email?.toLowerCase() === target) return data.user;
  }

  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    // deno-lint-ignore no-explicit-any
    const hit = users.find((u: any) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (users.length < perPage) break;
  }
  return null;
}

const ALLOWED_ROLES = ["super_admin", "hr", "manager", "employee"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing environment configuration");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Client acting as the caller: its reads go through the caller's own row-level security.
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !currentUser) throw new Error("Unauthorized");

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id);
    const callerRoles = (roleRows || []).map((r: { role: string }) => r.role);
    const isSuperAdmin = callerRoles.includes("super_admin");
    const isHr = callerRoles.includes("hr");

    const body = await req.json();
    const { email, password, name, organization_id, branch_id, hr_access_level, custom_role_id, employee_id } = body;
    let role: string = body.role || "employee";

    if (!email || !password || !name) throw new Error("Missing required fields: email, password, name");
    if (String(password).length < 6) throw new Error("Password must be at least 6 characters");
    if (!ALLOWED_ROLES.includes(role)) throw new Error("Invalid role");

    // Super admins can create any account. HR can only create an employee login for an
    // employee record it can see (its own scope, checked by the database rules).
    if (!isSuperAdmin) {
      if (!isHr) throw new Error("Only super admins or HR can create accounts");
      if (!employee_id) throw new Error("HR can only create accounts for an existing employee");
      role = "employee";
      const { data: visible } = await supabaseClient
        .from("employees")
        .select("id")
        .eq("id", employee_id)
        .maybeSingle();
      if (!visible) throw new Error("This employee is outside your scope");
    }

    // Never replace an existing login: report it instead.
    const existing = await findAuthUserByEmail(supabaseAdmin, email);
    if (existing) {
      return json({ success: false, code: "email_in_use", userId: existing.id, error: "An account with this email already exists" });
    }

    const userMetadata = {
      name,
      role,
      organization_id: organization_id || "",
      branch_id: branch_id || "",
      hr_access_level: isSuperAdmin ? hr_access_level || "" : "",
      custom_role_id: isSuperAdmin ? custom_role_id || "" : "",
    };

    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
      // app_metadata cannot be changed by the user, so the app trusts this copy of the role.
      app_metadata: { role },
    });
    if (createError) {
      if (createError.message?.includes("already been registered")) {
        return json({ success: false, code: "email_in_use", error: "An account with this email already exists" });
      }
      throw new Error(createError.message);
    }

    const newUserId = newUserData.user.id;

    // Link the employee record when one was given.
    if (employee_id) {
      const { error: linkError } = await supabaseAdmin
        .from("employees")
        .update({ user_id: newUserId, account_activated: true, status: "active" })
        .eq("id", employee_id);
      if (linkError) throw new Error("Account created but linking the employee failed: " + linkError.message);
    }

    return json({ success: true, userId: newUserId, message: "User created successfully" });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Create user function error:", errorMessage);
    // 200 so the app can read the message (invoke() hides the body of non-2xx replies).
    return json({ success: false, error: errorMessage });
  }
});
