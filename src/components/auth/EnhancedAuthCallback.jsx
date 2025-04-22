// src/components/auth/EnhancedAuthCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";
import "./SSOCallback.css"; // Reuse existing styles

function EnhancedAuthCallback() {
  const [message, setMessage] = useState("Processing authentication...");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log("Processing callback URL:", window.location.href);

        // Get URL parameters and hash fragments
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const hash = window.location.hash;

        // Check for password reset flow
        if (
          hash.includes("type=recovery") ||
          params.get("type") === "recovery"
        ) {
          console.log("Password reset flow detected");
          // Force redirect to reset-password
          window.location.href = "/reset-password";
          return;
        }

        // Check for invitation flow
        if (
          hash.includes("type=invite") ||
          params.get("type") === "invite" ||
          params.get("invitation_token")
        ) {
          console.log("Invitation flow detected");
          // Force redirect to password setup
          window.location.href = "/invitation";
          return;
        }

        // Process authorization code (if exists)
        if (code) {
          console.log("Processing authorization code");

          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(
              code
            );

            if (error) {
              console.error("Code exchange error:", error);
              // Redirect to login even on error
              window.location.href = "/login?error=auth_error";
              return;
            }

            if (data?.session) {
              console.log("Session created, redirecting to admin");
              // Successfully authenticated, redirect to admin
              window.location.href = "/admin";
              return;
            }
          } catch (err) {
            console.error("Exchange error:", err);
            window.location.href = "/login?error=auth_error";
            return;
          }
        }

        // Process hash parameters
        if (hash) {
          console.log("Processing hash parameters");

          // Give Supabase time to process the hash
          setTimeout(() => {
            // Check if we need to go to password reset
            if (hash.includes("type=recovery")) {
              window.location.href = "/reset-password";
              return;
            }

            // Otherwise redirect to admin
            window.location.href = "/admin";
          }, 2000);

          return;
        }

        // Fallback - redirect to login
        console.log("No recognizable auth parameters, redirecting to login");
        window.location.href = "/login";
      } catch (err) {
        console.error("Error processing callback:", err);
        // Redirect to login on error
        window.location.href = "/login?error=auth_error";
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="sso-callback-container">
      <div className="callback-processing">
        <Loader2 className="spinner" size={48} />
        <h2>{message}</h2>
        <p>Please wait while we complete your authentication...</p>
      </div>
    </div>
  );
}

export default EnhancedAuthCallback;
