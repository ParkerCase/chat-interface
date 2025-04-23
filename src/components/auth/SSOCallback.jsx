// src/components/auth/SSOCallback.jsx
import React, { useEffect } from "react";
import { Loader } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../auth.css";

/**
 * Ultra-simplified callback handler with forced redirect
 */
function SSOCallback() {
  // Run immediately on render
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      console.error("No code parameter found");
      window.location.href = "/login";
      return;
    }

    console.log("SSOCallback: Processing code", code.substring(0, 5) + "...");

    // Add a meta refresh tag as a backup redirect method
    const meta = document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = "5;url=/admin";
    document.head.appendChild(meta);

    // Handle the code exchange
    const exchangeCode = async () => {
      try {
        console.log("SSOCallback: Exchanging code for session");

        // Exchange the code
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          code
        );

        if (error) {
          console.error("SSOCallback: Code exchange error:", error);
          window.location.href = "/login";
          return;
        }

        if (!data || !data.session) {
          console.error("SSOCallback: No session returned");
          window.location.href = "/login";
          return;
        }

        console.log(
          "SSOCallback: Session created successfully for",
          data.session.user.email
        );

        // Set all needed flags
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");

        console.log(
          "SSOCallback: Auth flags set, redirecting to /admin in 2 seconds"
        );

        // Use multiple redirect methods to ensure one works
        setTimeout(() => {
          console.log("SSOCallback: Executing redirect now");
          try {
            // Method 1
            window.location.href = "/admin";

            // If we're still here after 500ms, try method 2
            setTimeout(() => {
              console.log("SSOCallback: Trying redirect method 2");
              window.location.replace("/admin");

              // If still here after another 500ms, try method 3
              setTimeout(() => {
                console.log("SSOCallback: Trying redirect method 3");
                window.open("/admin", "_self");
              }, 500);
            }, 500);
          } catch (e) {
            console.error("SSOCallback: Redirect error:", e);
          }
        }, 2000);
      } catch (err) {
        console.error("SSOCallback: Unexpected error:", err);
        // Force redirect to login as fallback
        window.location.href = "/login?error=callback_failed";
      }
    };

    // Start the process
    exchangeCode();

    // Set a global timeout fallback
    const fallbackTimeout = setTimeout(() => {
      console.log("SSOCallback: Fallback redirect triggered");
      window.location.href = "/admin";
    }, 8000);

    return () => {
      clearTimeout(fallbackTimeout);
    };
  }, []);

  // Simple UI with no state
  return (
    <div
      className="sso-callback-container"
      style={{ textAlign: "center", padding: "50px" }}
    >
      <Loader className="spinner" size={48} style={{ margin: "0 auto 20px" }} />
      <h2>Authentication Successful</h2>
      <p>Redirecting to your dashboard...</p>
      <div style={{ marginTop: "30px", fontSize: "14px", color: "#666" }}>
        If you are not redirected automatically,
        <a
          href="/admin"
          style={{
            marginLeft: "5px",
            color: "#4f46e5",
            textDecoration: "underline",
          }}
        >
          click here
        </a>
      </div>
    </div>
  );
}

export default SSOCallback;
