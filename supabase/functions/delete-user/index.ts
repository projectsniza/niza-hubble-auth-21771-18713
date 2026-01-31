import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create client with user's token to verify they're a super_admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !currentUser) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    // Check if user is super_admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .single();

    if (roleError) {
      console.error("Role error:", roleError);
      throw new Error("Failed to verify user role");
    }

    if (roleData?.role !== "super_admin") {
      throw new Error("Only super admins can delete users");
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      throw new Error("Missing userId");
    }

    // Prevent self-deletion
    if (userId === currentUser.id) {
      throw new Error("You cannot delete your own account");
    }

    // First clean up related data that might have foreign key constraints
    // Delete from conversation_participants
    await supabaseAdmin
      .from("conversation_participants")
      .delete()
      .eq("user_id", userId);

    // Delete messages sent by this user (soft delete by setting is_deleted)
    await supabaseAdmin
      .from("messages")
      .update({ is_deleted: true })
      .eq("sender_id", userId);

    // Update employees to unlink from this user
    await supabaseAdmin
      .from("employees")
      .update({ user_id: null, account_activated: false })
      .eq("user_id", userId);

    // Delete the user using admin API - this will cascade to profiles and user_roles
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Delete user error:", deleteError);
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    console.error("Delete user function error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
