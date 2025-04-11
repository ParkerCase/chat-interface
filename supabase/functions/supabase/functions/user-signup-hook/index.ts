// Edge Function: user-signup-hook.js
export async function handler(event, context) {
    const { user, client_ip, user_agent } = event.request.body;
    const supabaseAdmin = context.supabaseAdmin;
  
    // Log to audit table
    await supabaseAdmin.from("security_audit_logs").insert({
      event_type: "user_signup",
      user_id: user.id,
      email: user.email,
      ip_address: client_ip,
      user_agent: user_agent,
      timestamp: new Date().toISOString(),
    });
  
    // Check if email domain matches company domain
    const emailDomain = user.email.split("@")[1];
    const isInternalUser = emailDomain === "tatt2away.com";
  
    // For external users, trigger additional verification or notification
    if (!isInternalUser) {
      // Send alert to security team
      await supabaseAdmin.functions.invoke("send-security-alert", {
        body: {
          type: "external_signup",
          user: user.email,
          timestamp: new Date().toISOString(),
        },
      });
  
      // Create default profile with restricted access
      await supabaseAdmin.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
        roles: ["user"],
        requires_approval: true,
        tier: "basic",
        created_at: new Date().toISOString(),
      });
    } else {
      // Internal user - create profile with standard access
      await supabaseAdmin.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
        roles: ["user"],
        tier: "enterprise",
        created_at: new Date().toISOString(),
      });
    }
  
    return { statusCode: 200 };
  }
  