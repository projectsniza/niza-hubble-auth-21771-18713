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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !currentUser) throw new Error("Unauthorized");

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

    const userMetadata = {
      name,
      role: role || "employee",
      organization_id: organization_id || "",
      branch_id: branch_id || "",
      hr_access_level: hr_access_level || "",
      custom_role_id: custom_role_id || "",
    };

    // Try to create the user first
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    // If email already exists, delete the old user and recreate
    if (createError && createError.message?.includes("already been registered")) {
      console.log("User with this email exists, attempting to delete and recreate...");

      // Find the existing user by email
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.error("Error listing users:", listError);
        throw new Error("Failed to look up existing user");
      }

      const existingUser = listData.users.find((u: any) => u.email === email);
      if (!existingUser) {
        throw new Error("User exists but could not be found for re-creation");
      }

      // Clean up references first
      const { error: cleanupError } = await supabaseAdmin.rpc("cleanup_user_references", {
        p_user_id: existingUser.id,
      });
      if (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      // Delete the old auth user
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.error("Delete existing user error:", deleteError);
        throw new Error("Failed to remove existing user account: " + deleteError.message);
      }

      console.log("Old user deleted, recreating...");

      // Now create the new user
      const { data: recreatedUser, error: recreateError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (recreateError) {
        console.error("Recreate user error:", recreateError);
        throw new Error(recreateError.message);
      }

      const newUserId = recreatedUser.user.id;
      console.log("User re-created successfully:", newUserId);

      return new Response(
        JSON.stringify({ success: true, userId: newUserId, message: "User re-created successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (createError) {
      console.error("Admin createUser error:", createError);
      throw new Error(createError.message);
    }

    const newUserId = newUserData.user.id;
    console.log("User created successfully:", newUserId);

    return new Response(
      JSON.stringify({ success: true, userId: newUserId, message: "User created successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Create user function error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
