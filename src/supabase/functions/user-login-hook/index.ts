// Edge Function: user-login-hook.js
export async function handler(event, context) {
    const { user, client_ip, session, user_agent } = event.request.body;
    const supabaseAdmin = context.supabaseAdmin;
  
    // Log login attempt to audit table
    await supabaseAdmin.from("security_audit_logs").insert({
      event_type: "user_login",
      user_id: user.id,
      email: user.email,
      ip_address: client_ip,
      user_agent: user_agent,
      timestamp: new Date().toISOString(),
    });
  
    // Get user's profile and previous login info
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, last_login_ip, known_ips, requires_approval")
      .eq("id", user.id)
      .single();
  
    // Check for login from new location
    let knownIPs = profile?.known_ips || [];
    const isNewLocation = !knownIPs.includes(client_ip);
  
    // Update known IPs and last login info
    await supabaseAdmin
      .from("profiles")
      .update({
        last_login: new Date().toISOString(),
        last_login_ip: client_ip,
        known_ips: isNewLocation ? [...knownIPs, client_ip] : knownIPs,
      })
      .eq("id", user.id);
  
    // If login from new location, notify user and security
    if (isNewLocation) {
      // Send email to user about new login location
      await supabaseAdmin.functions.invoke("send-notification-email", {
        body: {
          to: user.email,
          subject: "New login location detected",
          template: "new-location-login",
          data: {
            ip: client_ip,
            time: new Date().toISOString(),
            location: "Unknown", // In production, use IP geolocation
            userAgent: user_agent,
          },
        },
      });
  
      // Force MFA for new location logins
      return {
        statusCode: 200,
        session: { ...session, requires_mfa: true },
      };
    }
  
    return { statusCode: 200 };
  }
  