// Edge Function: password-change-hook.js
export async function handler(event, context) {
    const { user, client_ip } = event.request.body;
    const supabaseAdmin = context.supabaseAdmin;
  
    // Log password change to audit table
    await supabaseAdmin.from("security_audit_logs").insert({
      event_type: "password_change",
      user_id: user.id,
      email: user.email,
      ip_address: client_ip,
      timestamp: new Date().toISOString(),
    });
  
    // Notify user about password change
    await supabaseAdmin.functions.invoke("send-notification-email", {
      body: {
        to: user.email,
        subject: "Your password was changed",
        template: "password-changed",
        data: {
          time: new Date().toLocaleString(),
          ip: client_ip,
        },
      },
    });
  
    // Update password last changed date in profile
    await supabaseAdmin
      .from("profiles")
      .update({
        password_last_changed: new Date().toISOString(),
      })
      .eq("id", user.id);
  
    // Invalidate all other sessions for this user
    // This forces logout on all other devices after password change
    if (user.id) {
      await supabaseAdmin.auth.admin.signOut(user.id, { scope: "others" });
    }
  
    return { statusCode: 200 };
  }
  