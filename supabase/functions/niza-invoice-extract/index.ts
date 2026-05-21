// Extract invoice fields (supplier, invoice_no, date, net, vat, gross, line items)
// from a PDF or image using either OpenAI (vision/files) or Google Gemini.
// Body: { storage_path?: string, file_base64?: string, mime_type?: string,
//         provider?: 'openai'|'gemini', model?: string, api_key?: string,
//         invoice_id?: string }
// If invoice_id is provided, the resulting fields are also written back to
// public.niza_invoices.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYS_PROMPT = `You are an invoice data extractor for a UK convenience-store group.
Return ONLY a JSON object with these keys:
{
  "supplier": string,
  "invoice_number": string,
  "invoice_date": "YYYY-MM-DD",
  "currency": "GBP" | "EUR" | "USD",
  "net": number,
  "vat": number,
  "gross": number,
  "category": "Tobacco"|"Drinks"|"Grocery"|"Alcohol"|"Newspaper"|"Fuel"|"Cleaning"|"Stationery"|"Services"|"Other",
  "line_items": [{ "description": string, "qty": number, "unit_price": number, "amount": number, "vat_rate": number }],
  "notes": string
}
Numbers must be plain numbers, never strings. If a field is unreadable use null.`;

async function callOpenAI(apiKey: string, model: string, base64: string, mime: string) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYS_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the invoice data from this document." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

async function callGemini(apiKey: string, model: string, base64: string, mime: string) {
  const m = model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      { role: "user", parts: [
        { text: SYS_PROMPT + "\nReturn JSON only, no prose." },
        { inline_data: { mime_type: mime, data: base64 } },
      ] },
    ],
    generationConfig: { response_mime_type: "application/json" },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const txt = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(txt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const provider = (body.provider || "openai").toLowerCase();
    const model = body.model || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");

    let apiKey = body.api_key as string | undefined;
    if (!apiKey) apiKey = provider === "gemini" ? Deno.env.get("GEMINI_API_KEY") : Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error(`Missing API key for ${provider}`);

    let base64 = body.file_base64 as string | undefined;
    let mime = body.mime_type as string | undefined;
    if (!base64 && body.storage_path) {
      const { data, error } = await supa.storage.from("niza-invoices").download(body.storage_path);
      if (error) throw error;
      const buf = new Uint8Array(await data.arrayBuffer());
      // base64 encode
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      base64 = btoa(bin);
      mime = data.type || (body.storage_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    }
    if (!base64 || !mime) throw new Error("No file data provided");

    const extracted = provider === "gemini"
      ? await callGemini(apiKey, model, base64, mime)
      : await callOpenAI(apiKey, model, base64, mime);

    if (body.invoice_id) {
      await supa.from("niza_invoices").update({
        supplier: extracted.supplier ?? null,
        invoice_number: extracted.invoice_number ?? null,
        invoice_date: extracted.invoice_date ?? null,
        net: extracted.net ?? null,
        vat: extracted.vat ?? null,
        gross: extracted.gross ?? null,
        currency: extracted.currency ?? "GBP",
        category: extracted.category ?? null,
        raw_extracted: extracted,
        extraction_status: "extracted",
        ai_model: `${provider}:${model}`,
      }).eq("id", body.invoice_id);
    }

    return new Response(JSON.stringify({ ok: true, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (body_id_log(req)) {}
    if ((globalThis as any).__lastInvoiceId) {
      try {
        const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supa.from("niza_invoices").update({ extraction_status: "failed", extraction_error: msg })
          .eq("id", (globalThis as any).__lastInvoiceId);
      } catch {}
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function body_id_log(_: Request) { return false; }
