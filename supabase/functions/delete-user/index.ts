import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    console.log("Cleaning up related data for user:", userId);

    const tryNullifyElseDelete = async (table: string, column: string) => {
      try {
        const { error: nullError } = await supabaseAdmin
          .from(table)
          .update({ [column]: null } as Record<string, null>)
          .eq(column, userId);

        if (!nullError) return;

        // If we can't nullify (e.g. NOT NULL), fall back to deleting rows
        console.log(`Nullify ${table}.${column} failed, falling back to delete:`, nullError.message);
        const { error: delError } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(column, userId);
        if (delError) {
          console.log(`Delete ${table} rows by ${column} failed:`, delError.message);
        }
      } catch (e) {
        console.log(`Cleanup helper failed for ${table}.${column}:`, e);
      }
    };

    // Hard-delete messaging rows that reference auth.users (FK blocks deletion)
    const { error: readRcptError } = await supabaseAdmin
      .from("message_read_receipts")
      .delete()
      .eq("user_id", userId);
    if (readRcptError) console.log("message_read_receipts cleanup error:", readRcptError.message);

    // Remove participants
    const { error: partError } = await supabaseAdmin
      .from("conversation_participants")
      .delete()
      .eq("user_id", userId);
    if (partError) console.log("conversation_participants cleanup error:", partError.message);

    // Unpin messages pinned by this user
    await tryNullifyElseDelete("messages", "pinned_by");

    // Delete messages sent by this user (sender_id FK blocks auth user deletion)
    const { error: msgDeleteError } = await supabaseAdmin
      .from("messages")
      .delete()
      .eq("sender_id", userId);
    if (msgDeleteError) console.log("messages cleanup error:", msgDeleteError.message);

    // Delete clock-in records (clock_ins.user_id FK)
    const { error: clockInError } = await supabaseAdmin
      .from("clock_ins")
      .delete()
      .eq("user_id", userId);
    if (clockInError) console.log("clock_ins cleanup error:", clockInError.message);

    // Unlink employees (employees.user_id has ON DELETE SET NULL, but do it explicitly)
    const { error: empError } = await supabaseAdmin
      .from("employees")
      .update({ user_id: null, account_activated: false })
      .eq("user_id", userId);
    if (empError) console.log("employees cleanup error:", empError.message);

    // Nullify common audit/assignment foreign keys that reference auth.users
    await tryNullifyElseDelete("organizations", "created_by");
    await tryNullifyElseDelete("branches", "created_by");
    await tryNullifyElseDelete("teams", "created_by");
    await tryNullifyElseDelete("teams", "team_leader_id");
    await tryNullifyElseDelete("employees", "created_by");
    await tryNullifyElseDelete("employees", "manager_id");
    await tryNullifyElseDelete("contract_approvals", "submitted_by");
    await tryNullifyElseDelete("contract_approvals", "approved_by");
    await tryNullifyElseDelete("contract_approvals", "signed_contract_uploaded_by");
    await tryNullifyElseDelete("right_to_work_checks", "checked_by");
    await tryNullifyElseDelete("document_types", "created_by");
    await tryNullifyElseDelete("folders", "created_by");
    await tryNullifyElseDelete("documents", "uploaded_by");
    await tryNullifyElseDelete("trainings", "assigned_to");
    await tryNullifyElseDelete("trainings", "created_by");
    await tryNullifyElseDelete("training_documents", "uploaded_by");
    await tryNullifyElseDelete("training_assignments", "assigned_by");
    await tryNullifyElseDelete("training_assignments", "assigned_to");
    await tryNullifyElseDelete("daily_reports", "submitted_by");
    await tryNullifyElseDelete("maintenance_tickets", "assigned_to");
    await tryNullifyElseDelete("maintenance_tickets", "reported_by");
    await tryNullifyElseDelete("locations", "created_by");
    await tryNullifyElseDelete("salary_structures", "created_by");
    await tryNullifyElseDelete("payroll_records", "generated_by");
    await tryNullifyElseDelete("leave_types", "created_by");
    await tryNullifyElseDelete("leave_requests", "approved_by");
    await tryNullifyElseDelete("rotas", "created_by");
    await tryNullifyElseDelete("events", "created_by");
    await tryNullifyElseDelete("performance_criteria", "created_by");
    await tryNullifyElseDelete("performance_reviews", "reviewer_id");
    await tryNullifyElseDelete("hazard_reports", "assigned_to");
    await tryNullifyElseDelete("hazard_reports", "reported_by");
    await tryNullifyElseDelete("risk_assessments", "created_by");
    await tryNullifyElseDelete("risk_assessments", "approved_by");
    await tryNullifyElseDelete("risk_assessments", "responsible_person_id");
    await tryNullifyElseDelete("coshh_assessments", "created_by");
    await tryNullifyElseDelete("coshh_assessments", "approved_by");
    await tryNullifyElseDelete("method_statements", "created_by");
    await tryNullifyElseDelete("method_statements", "approved_by");
    await tryNullifyElseDelete("incidents", "reported_by");
    await tryNullifyElseDelete("incidents", "investigated_by");
    await tryNullifyElseDelete("incidents", "closed_by");
    await tryNullifyElseDelete("safety_tasks", "assigned_by");
    await tryNullifyElseDelete("safety_tasks", "assigned_to");
    await tryNullifyElseDelete("safety_tasks", "verified_by");
    await tryNullifyElseDelete("financial_reports", "created_by");
    await tryNullifyElseDelete("reminders", "created_by");
    await tryNullifyElseDelete("reminders", "assigned_to");
    await tryNullifyElseDelete("reminder_settings", "created_by");
    await tryNullifyElseDelete("conversations", "created_by");
    await tryNullifyElseDelete("custom_roles", "created_by");
    await tryNullifyElseDelete("user_custom_roles", "assigned_by");
    await tryNullifyElseDelete("employee_contracts", "created_by");
    await tryNullifyElseDelete("timesheets", "created_by");
    await tryNullifyElseDelete("timesheets", "submitted_by");
    await tryNullifyElseDelete("timesheets", "approved_by");
    await tryNullifyElseDelete("document_follow_up_settings", "created_by");

    console.log("Cleanup completed, deleting auth user...");

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
