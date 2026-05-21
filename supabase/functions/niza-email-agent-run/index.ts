// Run a single email agent: fetches recent unread messages with PDF/image
// attachments, uploads them to the niza-invoices bucket, creates niza_invoices
// rows, and invokes niza-invoice-extract for each.
//
// Supports mailbox_type:
//   - "imap"    : direct IMAP via deno-imap (webmail / Zoho / cPanel)
//   - "outlook" : Microsoft Graph via Lovable connector gateway (TODO)
//   - "gmail"   : Gmail via Lovable connector gateway (TODO)
//
// Phase 1: IMAP path implemented end-to-end (text fetch + attachment download),
// Outlook/Gmail return a structured "not_implemented" so the UI can guide
// admins to wire them in Phase 2.

import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapClient } from "https://deno.land/x/imap@v0.1.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let runId: string | undefined;
  try {
    const { agent_id } = await req.json();
    if (!agent_id) throw new Error("agent_id is required");

    const { data: agent, error: aErr } = await supa
      .from("niza_email_agents").select("*").eq("id", agent_id).maybeSingle();
    if (aErr || !agent) throw new Error(aErr?.message || "agent not found");

    const { data: runRow } = await supa.from("niza_email_agent_runs").insert({
      agent_id, status: "running",
    }).select("id").single();
    runId = runRow?.id;

    let scanned = 0, extracted = 0;
    const log: string[] = [];

    if (agent.mailbox_type === "imap") {
      if (!agent.imap_host || !agent.imap_user || !agent.imap_password) {
        throw new Error("IMAP host/user/password not configured on agent");
      }
      const client = new ImapClient({
        host: agent.imap_host,
        port: agent.imap_port || 993,
        tls: agent.imap_use_tls ?? true,
        username: agent.imap_user,
        password: agent.imap_password,
      });
      await client.connect();
      await client.selectMailbox(agent.folder || "INBOX");
      const ids = await client.search(["UNSEEN"]);
      log.push(`Found ${ids.length} unread messages`);
      scanned = ids.length;

      for (const id of ids.slice(0, 25)) {
        try {
          const msg = await client.fetchMessage(id, { envelope: true, bodyStructure: true });
          const parts = (msg as any).bodyStructure?.parts || [];
          for (const part of parts) {
            const name = part.disposition?.filename || part.parameters?.name;
            const mime = `${part.type}/${part.subtype}`.toLowerCase();
            const ok = name && /\.(pdf|jpg|jpeg|png|webp)$/i.test(name);
            if (!ok) continue;
            const att = await client.fetchPart(id, part.section);
            const path = `${agent.branch_id || "global"}/agent/${Date.now()}_${name}`;
            await supa.storage.from("niza-invoices").upload(path, att, {
              contentType: mime, upsert: false,
            });
            const { data: inv } = await supa.from("niza_invoices").insert({
              organization_id: agent.organization_id,
              branch_id: agent.branch_id,
              source: "email_agent",
              file_path: path,
              email_message_id: (msg as any).envelope?.messageId,
              extraction_status: "pending",
            }).select("id").single();
            // fire extractor
            const fn = `${Deno.env.get("SUPABASE_URL")}/functions/v1/niza-invoice-extract`;
            fetch(fn, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                storage_path: path,
                provider: agent.ai_provider,
                model: agent.ai_model,
                api_key: agent.ai_api_key,
                invoice_id: inv?.id,
              }),
            }).catch(() => {});
            extracted++;
          }
          await client.addFlags(id, ["\\Seen"]);
        } catch (e) {
          log.push(`msg ${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await client.disconnect();
    } else {
      throw new Error(`mailbox_type=${agent.mailbox_type} is not yet implemented in Phase 1 (IMAP only)`);
    }

    await supa.from("niza_email_agents").update({
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_error: null,
    }).eq("id", agent_id);
    if (runId) await supa.from("niza_email_agent_runs").update({
      ended_at: new Date().toISOString(), status: "ok",
      emails_scanned: scanned, invoices_extracted: extracted,
      log_text: log.join("\n"),
    }).eq("id", runId);

    return new Response(JSON.stringify({ ok: true, scanned, extracted, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (runId) await supa.from("niza_email_agent_runs").update({
      ended_at: new Date().toISOString(), status: "failed", error_message: msg,
    }).eq("id", runId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
