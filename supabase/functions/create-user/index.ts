import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment configuration");
    }
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Client with caller's token to verify role
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !currentUser) throw new Error("Unauthorized");

    // Check if caller is super_admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .single();

    if (roleError || roleData?.role !== "super_admin") {
      throw new Error("Only super admins can create users");
    }

    const body = await req.json();
    const { email, password, name, role, organization_id, branch_id, hr_access_level, custom_role_id } = body;

    if (!email || !password || !name) {
      throw new Error("Missing required fields: email, password, name");
    }

    // Use admin.createUser which works reliably for re-registration of deleted emails
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can log in immediately
      user_metadata: {
        name,
        role: role || "employee",
        organization_id: organization_id || "",
        branch_id: branch_id || "",
        hr_access_level: hr_access_level || "",
        custom_role_id: custom_role_id || "",
      },
    });

    if (createError) {
      console.error("Admin createUser error:", createError);
      throw new Error(createError.message);
    }

    const newUserId = newUserData.user.id;
    console.log("User created successfully:", newUserId);

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUserId,
        message: "User created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Create user function error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
