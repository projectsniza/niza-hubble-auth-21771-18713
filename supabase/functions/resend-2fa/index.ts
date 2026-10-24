import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL =
  "https://bnxlmeilekynzadjbsrx.supabase.co/storage/v1/object/public/template-assets/niza-cloud-logo.png";

type Purpose = "login" | "password_reset" | "admin_password_change" | "store_scheduling";

interface SendCodeBody {
  action: "send_code";
  email: string;
  purpose: Purpose;
  metadata?: Record<string, unknown>;
}

interface VerifyCodeBody {
  action: "verify_code";
  challengeToken: string;
  code: string;
  newPassword?: string;
}

// Helper: derive crypto key from secret string
async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Helper: base64url encoding
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// SHA256 string hash helper
async function sha256Hex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Sign payload into challenge token
async function createChallengeToken(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = enc.encode(payloadJson);
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getHmacKey(secret);
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64))
  );
  const signatureB64 = base64UrlEncode(signatureBytes);

  return `${payloadB64}.${signatureB64}`;
}

// Verify and decode challenge token
async function verifyChallengeToken(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, signatureB64] = parts;

    const enc = new TextEncoder();
    const key = await getHmacKey(secret);
    const signatureBytes = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      enc.encode(payloadB64)
    );
    if (!isValid) return null;

    const payloadBytes = base64UrlDecode(payloadB64);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

// Build purpose labels & description
function getPurposeDetails(purpose: Purpose) {
  switch (purpose) {
    case "password_reset":
      return {
        title: "Password Reset Verification",
        badge: "Password Recovery",
        description:
          "We received a request to reset your Niza account password. Use the verification code below to authorize your password change.",
        actionNote: "This code will allow you to choose a new password.",
      };
    case "admin_password_change":
      return {
        title: "Super Admin Security Verification",
        badge: "Admin Security",
        description:
          "A request to update the Super Admin password has been initiated. Complete 2-step verification using the code below.",
        actionNote: "Only share this code if you personally requested the password change.",
      };
    case "store_scheduling":
      return {
        title: "Store Scheduling Access Verification",
        badge: "Store Access",
        description:
          "A store account scheduling session is being accessed for the Weekly View. Please enter this verification code to proceed.",
        actionNote: "Authorizes weekly rota & timesheet scheduling for your store.",
      };
    case "login":
    default:
      return {
        title: "Sign-In Verification Code",
        badge: "2-Step Authentication",
        description:
          "A login attempt requires 2-step email verification. Enter this code to securely sign into your account.",
        actionNote: "Never disclose this code to anyone.",
      };
  }
}

// Generate luxury light-themed HTML email
function renderEmailHtml(code: string, purpose: Purpose, email: string): string {
  const details = getPurposeDetails(purpose);
  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${details.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f8; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 38px 30px 22px 30px; background: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <img src="${LOGO_URL}" alt="Niza Cloud" width="165" style="display: block; max-width: 165px; height: auto; border: 0;" />
              <div style="margin-top: 16px;">
                <span style="display: inline-block; padding: 5px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background-color: #f0fdf4; color: #15803d; border-radius: 9999px; border: 1px solid #bbf7d0;">
                  ${details.badge}
                </span>
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 38px 28px 38px; background-color: #ffffff;">
              <h1 style="margin: 0 0 12px 0; font-size: 23px; font-weight: 700; color: #0f172a; text-align: center; letter-spacing: -0.02em;">
                ${details.title}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569; text-align: center;">
                ${details.description}
              </p>

              <!-- Verification Code Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 26px 0; background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px;">
                <tr>
                  <td align="center" style="padding: 24px 16px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin-bottom: 8px; font-weight: 700;">
                      Verification Code
                    </div>
                    <div style="font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 0.28em; color: #0f172a;">
                      ${formattedCode}
                    </div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 10px;">
                      ⏱ Valid for <strong style="color: #0f172a;">10 minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice Details -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 18px; background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 8px; padding: 14px 16px;">
                <tr>
                  <td style="font-size: 13px; line-height: 1.6; color: #334155;">
                    <strong style="color: #0f172a;">Account:</strong> ${email}<br/>
                    <strong style="color: #0f172a;">Purpose:</strong> ${details.actionNote}
                  </td>
                </tr>
              </table>

              <!-- Security Warning -->
              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
                🔒 If you did not make this request, you can safely ignore this email or contact your administrator immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #475569;">
                Niza Group &bull; Secure Authentication Service
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Automated notification from <span style="color: #64748b;">alerts@nizagroup.uk</span>. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom =
      Deno.env.get("RESEND_FROM_EMAIL") || "Niza Group <alerts@nizagroup.uk>";

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing Supabase or Resend configuration");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = body.action;

    // -----------------------------------------------------------------
    // ACTION: GET 2FA CONFIGURATION
    // -----------------------------------------------------------------
    if (action === "get_2fa_config") {
      const { data } = await supabaseAdmin
        .from("message_settings")
        .select("setting_value, updated_at, description")
        .eq("setting_key", "two_factor_auth_enabled")
        .maybeSingle();

      let enabled = true;
      if (data) {
        const v = data.setting_value;
        if (v === false || v === "false" || v === "0") {
          enabled = false;
        } else if (
          typeof v === "object" &&
          v !== null &&
          (v as Record<string, unknown>).enabled === false
        ) {
          enabled = false;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          twoFactorEnabled: enabled,
          updatedAt: data?.updated_at || null,
          description: data?.description || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // -----------------------------------------------------------------
    // ACTION: SET 2FA CONFIGURATION (Super Admin)
    // -----------------------------------------------------------------
    if (action === "set_2fa_config") {
      const { enabled, updatedBy = "Super Admin" } = body;
      const isEnabled = Boolean(enabled);
      const nowIso = new Date().toISOString();

      await supabaseAdmin
        .from("message_settings")
        .upsert(
          {
            setting_key: "two_factor_auth_enabled",
            setting_value: String(isEnabled),
            description: `2FA ${isEnabled ? "enabled" : "disabled"} by ${updatedBy}`,
            updated_at: nowIso,
          },
          { onConflict: "setting_key" }
        );

      return new Response(
        JSON.stringify({
          success: true,
          twoFactorEnabled: isEnabled,
          updatedAt: nowIso,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // -----------------------------------------------------------------
    // ACTION: SEND 2FA CODE
    // -----------------------------------------------------------------
    if (action === "send_code") {
      const { email, purpose, metadata = {} } = body as SendCodeBody;

      if (!email || !purpose) {
        throw new Error("Missing required fields: email and purpose");
      }

      // Check if 2FA is globally disabled by Super Admin
      if (purpose === "login" || purpose === "store_scheduling" || purpose === "admin_password_change") {
        const { data: configData } = await supabaseAdmin
          .from("message_settings")
          .select("setting_value")
          .eq("setting_key", "two_factor_auth_enabled")
          .maybeSingle();

        if (
          configData &&
          (configData.setting_value === false || configData.setting_value === "false")
        ) {
          return new Response(
            JSON.stringify({
              success: true,
              disabled: true,
              message: "Two-factor authentication is currently disabled by administrator.",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }

      const normalizedEmail = email.trim().toLowerCase();

      // For password_reset, ensure the user exists
      if (purpose === "password_reset") {
        const { data: usersData, error: listError } =
          await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        const exists = usersData.users.some(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );
        if (!exists) {
          throw new Error("No account found with this email address");
        }
      }

      // Generate secure 6-digit random code
      const randomArr = new Uint32Array(1);
      crypto.getRandomValues(randomArr);
      const codeNumber = (randomArr[0] % 900000) + 100000;
      const code = codeNumber.toString();

      // Compute code hash with salt
      const salt = "niza-2fa-salt-2026";
      const codeHash = await sha256Hex(`${code}:${salt}:${normalizedEmail}`);

      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Build signed challenge token
      const challengePayload = {
        email: normalizedEmail,
        purpose,
        codeHash,
        expiresAt,
        attempts: 0,
        metadata,
      };

      const challengeToken = await createChallengeToken(
        challengePayload,
        supabaseServiceKey
      );

      // Render beautiful HTML email
      const html = renderEmailHtml(code, purpose, normalizedEmail);
      const details = getPurposeDetails(purpose);

      // Send via Resend API
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [normalizedEmail],
          subject: `${details.title}: ${code}`,
          html,
        }),
      });

      if (!resendResponse.ok) {
        const errText = await resendResponse.text();
        console.error("Resend API error:", errText);
        throw new Error(`Failed to send verification email: ${errText}`);
      }

      // Log verification send to activity_logs if possible (non-blocking)
      try {
        await supabaseAdmin.from("activity_logs").insert({
          activity_type: "two_factor_code_sent",
          activity_category: "security",
          title: `2FA code sent for ${purpose}`,
          description: `Verification code sent to ${normalizedEmail}`,
          user_id: "00000000-0000-0000-0000-000000000000",
          user_name: normalizedEmail,
          user_role: "system",
          metadata: { purpose, email: normalizedEmail },
          is_read: false,
        });
      } catch (logErr) {
        console.warn("Activity log insert skipped:", logErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          challengeToken,
          email: normalizedEmail,
          purpose,
          expiresInSeconds: 600,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // -----------------------------------------------------------------
    // ACTION: VERIFY 2FA CODE
    // -----------------------------------------------------------------
    if (action === "verify_code") {
      const { challengeToken, code, newPassword } = body as VerifyCodeBody;

      if (!challengeToken || !code) {
        throw new Error("Missing challengeToken or code");
      }

      const payload = await verifyChallengeToken(
        challengeToken,
        supabaseServiceKey
      );

      if (!payload) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid or tampered verification challenge",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      const { email, purpose, codeHash, expiresAt, attempts = 0 } = payload as {
        email: string;
        purpose: Purpose;
        codeHash: string;
        expiresAt: number;
        attempts: number;
      };

      if (Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Verification code has expired. Please request a new one.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (attempts >= 5) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Too many incorrect attempts. Please request a new code.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      // Check code hash
      const cleanCode = code.trim().replace(/\s+/g, "");
      const salt = "niza-2fa-salt-2026";
      const checkHash = await sha256Hex(`${cleanCode}:${salt}:${email}`);

      if (checkHash !== codeHash) {
        const nextAttempts = attempts + 1;
        const updatedPayload = { ...payload, attempts: nextAttempts };
        const updatedToken = await createChallengeToken(
          updatedPayload,
          supabaseServiceKey
        );

        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid code. ${5 - nextAttempts} attempt(s) remaining.`,
            challengeToken: updatedToken,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      // CODE IS VALID! Handle purpose-specific completion
      if (purpose === "password_reset") {
        if (!newPassword || newPassword.length < 6) {
          // If no new password was submitted yet, return an authorization token for the new password step
          const resetAuthToken = await createChallengeToken(
            {
              email,
              purpose: "password_reset_authorized",
              expiresAt: Date.now() + 15 * 60 * 1000,
            },
            supabaseServiceKey
          );

          return new Response(
            JSON.stringify({
              success: true,
              verified: true,
              resetAuthToken,
              message: "Code verified. You may now enter your new password.",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }

        // Apply new password
        const { data: usersData, error: listError } =
          await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        const targetUser = usersData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (!targetUser) {
          throw new Error("User account not found");
        }

        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
            password: newPassword,
          });

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({
            success: true,
            verified: true,
            message: "Password reset successfully",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (purpose === "admin_password_change") {
        if (newPassword && newPassword.length >= 6) {
          const { data: usersData, error: listError } =
            await supabaseAdmin.auth.admin.listUsers();
          if (listError) throw listError;
          const targetUser = usersData.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
          );

          if (targetUser) {
            const { error: updateError } =
              await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
                password: newPassword,
              });
            if (updateError) throw updateError;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            verified: true,
            message: "Super admin password verified and updated",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (purpose === "store_scheduling") {
        // Issue an authorization token valid for the scheduling session (8 hours)
        const schedulingAccessToken = await createChallengeToken(
          {
            email,
            purpose: "store_scheduling_authorized",
            expiresAt: Date.now() + 8 * 60 * 60 * 1000,
          },
          supabaseServiceKey
        );

        return new Response(
          JSON.stringify({
            success: true,
            verified: true,
            schedulingAccessToken,
            message: "Store scheduling session verified",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (purpose === "login") {
        const loginAccessToken = await createChallengeToken(
          {
            email,
            purpose: "login_authorized",
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          },
          supabaseServiceKey
        );

        return new Response(
          JSON.stringify({
            success: true,
            verified: true,
            loginAccessToken,
            message: "Login verified",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          message: "Verification successful",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("2FA Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
