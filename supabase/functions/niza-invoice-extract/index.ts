// Extract invoice fields from a PDF/image using OpenAI or Gemini.
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

function bytesToBase64(buf: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

async function callOpenAI(apiKey: string, model: string, base64: string, mime: string) {
  const body = {
    model: model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYS_PROMPT },
      { role: "user", content: [
        { type: "text", text: "Extract the invoice data from this document." },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
      ] },
    ],
  };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
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
    contents: [{ role: "user", parts: [
      { text: SYS_PROMPT + "\nReturn JSON only, no prose." },
      { inline_data: { mime_type: mime, data: base64 } },
    ] }],
    generationConfig: { response_mime_type: "application/json" },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let invoiceId: string | undefined;
  try {
    const body = await req.json();
    invoiceId = body.invoice_id;
    const provider = (body.provider || "openai").toLowerCase();
    const model = body.model || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");

    let apiKey = body.api_key as string | undefined;
    if (!apiKey) apiKey = provider === "gemini" ? Deno.env.get("GEMINI_API_KEY") : Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error(`Missing API key for ${provider}. Configure it on an AI Agent or as a project secret.`);

    let base64 = body.file_base64 as string | undefined;
    let mime = body.mime_type as string | undefined;
    if (!base64 && body.storage_path) {
      const { data, error } = await supa.storage.from("niza-invoices").download(body.storage_path);
      if (error) throw error;
      base64 = bytesToBase64(new Uint8Array(await data.arrayBuffer()));
      mime = data.type || (body.storage_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    }
    if (!base64 || !mime) throw new Error("No file data provided");

    const extracted = provider === "gemini"
      ? await callGemini(apiKey, model, base64, mime)
      : await callOpenAI(apiKey, model, base64, mime);

    if (invoiceId) {
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
        extraction_error: null,
        ai_model: `${provider}:${model}`,
      }).eq("id", invoiceId);
    }

    return new Response(JSON.stringify({ ok: true, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (invoiceId) {
      try {
        await supa.from("niza_invoices").update({
          extraction_status: "failed", extraction_error: msg,
        }).eq("id", invoiceId);
      } catch {}
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
