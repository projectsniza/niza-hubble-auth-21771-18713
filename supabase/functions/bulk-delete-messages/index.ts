import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  messageIds: string[];
  conversationId: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !currentUser) throw new Error("Unauthorized");

    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .single();

    if (roleError || roleData?.role !== "super_admin") {
      throw new Error("Only super admins can delete messages");
    }

    const { messageIds, conversationId } = (await req.json()) as Payload;
    if (!conversationId) throw new Error("Missing conversationId");
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      throw new Error("Missing messageIds");
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("messages")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .in("id", messageIds)
      .select("id");

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, deletedCount: updatedRows?.length ?? 0 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
