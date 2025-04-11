// Edge Function: mfa-event-hook.js
export async function handler(event, context) {
    const { user, client_ip, type, factor_id, factor_type } = event.request.body;
    const supabaseAdmin = context.supabaseAdmin;
  
    // Log MFA activity
    await supabaseAdmin.from("security_audit_logs").insert({
      event_type: `mfa_${type}`, // enrolled, verified, etc.
      user_id: user.id,
      email: user.email,
      ip_address: client_ip,
      details: JSON.stringify({ factor_id, factor_type }),
      timestamp: new Date().toISOString(),
    });
  
    // If MFA was newly enrolled
    if (type === "enrolled") {
      // Update profile with MFA status
      await supabaseAdmin
        .from("profiles")
        .update({
          mfa_enabled: true,
          mfa_enrolled_at: new Date().toISOString(),
          security_level: "enhanced",
        })
        .eq("id", user.id);
  
      // Send confirmation email to user
      await supabaseAdmin.functions.invoke("send-notification-email", {
        body: {
          to: user.email,
          subject: "Two-Factor Authentication Enabled",
          template: "mfa-enabled",
          data: {
            method: factor_type === "totp" ? "Authenticator App" : "Email",
            time: new Date().toLocaleString(),
          },
        },
      });
    }
  
    return { statusCode: 200 };
  }
  