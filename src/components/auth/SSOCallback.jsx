// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { Loader, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../auth.css";

/**
 * Enhanced callback handler for Supabase auth
 * Handles code exchange and ensures proper state setting
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [redirectTarget, setRedirectTarget] = useState("/admin");

  // Helper function for debugging
  const logCallback = (message, data = null) => {
    const logMsg = `SSOCallback: ${message}`;
    console.log(logMsg, data || "");

    // Store logs in sessionStorage for debugging
    try {
      const logs = JSON.parse(
        sessionStorage.getItem("sso_callback_logs") || "[]"
      );
      logs.push({
        timestamp: new Date().toISOString(),
        message,
        data: data ? JSON.stringify(data) : null,
      });

      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }

      sessionStorage.setItem("sso_callback_logs", JSON.stringify(logs));
    } catch (e) {
      console.error("Error saving log:", e);
    }
  };

  // Run immediately on render
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const redirectTo = urlParams.get("returnUrl") || "/admin";

    setRedirectTarget(redirectTo);
    logCallback("Processing callback", {
      code: code ? `${code.substring(0, 5)}...` : null,
    });

    if (!code) {
      logCallback("No code parameter found");
      setError("Authentication failed: No code parameter found");
      setStatus("error");

      // Add fallback redirect for no-code scenario
      const fallbackTimeout = setTimeout(() => {
        window.location.href = "/login";
      }, 3000);

      return () => clearTimeout(fallbackTimeout);
    }

    // Add a meta refresh tag as a backup redirect method
    const meta = document.createElement("meta");
    meta.httpEquiv = "refresh";
    meta.content = `10;url=${redirectTo}`;
    document.head.appendChild(meta);

    // Function to process the code exchange
    const exchangeCode = async () => {
      try {
        logCallback("Exchanging code for session");

        // Exchange the code for a session
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          logCallback("Code exchange error:", exchangeError);
          setError(`Authentication failed: ${exchangeError.message}`);
          setStatus("error");
          return;
        }

        if (!data || !data.session) {
          logCallback("No session returned");
          setError("Authentication failed: No session data returned");
          setStatus("error");
          return;
        }

        const email = data.session.user.email;
        setUserEmail(email);
        logCallback("Session created successfully for", email);

        // Special handling for admin accounts
        if (
          email === "itsus@tatt2away.com" ||
          email === "parker@tatt2away.com"
        ) {
          logCallback("Admin account detected, setting special flags");

          // Create admin user
          const adminUser = {
            id: data.session.user.id,
            email: email,
            name:
              email === "itsus@tatt2away.com"
                ? "Tatt2Away Admin"
                : "Parker Admin",
            roles: ["super_admin", "admin", "user"],
            tier: "enterprise",
          };

          // Set admin in localStorage
          localStorage.setItem("currentUser", JSON.stringify(adminUser));
        } else {
          // For regular users, we'll need to get or create their profile
          try {
            logCallback("Fetching user profile");

            // Use the safe RPC function to get user profile
            let { data: profileData, error: profileError } = await supabase
              .rpc("get_user_profile", { user_id: data.session.user.id });

            // Check if profile exists
            const { data: profileExists, error: checkError } = await supabase
              .rpc("check_profile_exists", { user_email: email });
              
            if (checkError) {
              logCallback("Error checking if profile exists:", checkError);
            }

            if (!profileExists || profileError) {
              logCallback("Creating new user profile");

              // Create a new profile using safe RPC function
              const { data: newProfile, error: insertError } = await supabase
                .rpc("create_admin_profile", {
                  profile_id: data.session.user.id,
                  profile_email: email,
                  profile_name: email,
                  profile_roles: ["user"]
                });

              if (insertError) {
                logCallback("Error creating profile:", insertError);
              } else {
                profileData = newProfile[0];
              }
            } else if (profileError) {
              logCallback("Error fetching profile:", profileError);
            }

            // Create user object from profile data
            if (profileData) {
              const user = {
                id: data.session.user.id,
                email: email,
                name: profileData.full_name || email,
                roles: profileData.roles || ["user"],
                tier: profileData.tier || "basic",
              };

              localStorage.setItem("currentUser", JSON.stringify(user));
              logCallback("User profile saved to localStorage", user);
            } else {
              // Fallback if profile couldn't be fetched
              const basicUser = {
                id: data.session.user.id,
                email: email,
                name: email,
                roles: ["user"],
                tier: "basic",
              };

              localStorage.setItem("currentUser", JSON.stringify(basicUser));
              logCallback("Basic user saved to localStorage");
            }
          } catch (profileErr) {
            logCallback("Error processing user profile:", profileErr);
          }
        }

        // Set all required auth flags
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");

        logCallback("Auth flags set, preparing redirect to:", redirectTo);
        setStatus("success");

        // Execute redirect with delays to ensure state is properly set
        executeRedirect(redirectTo);
      } catch (err) {
        logCallback("Unexpected error during code exchange:", err);
        setError(`Authentication failed: ${err.message}`);
        setStatus("error");

        // Redirect to login as fallback
        setTimeout(() => {
          window.location.href = "/login?error=callback_failed";
        }, 3000);
      }
    };

    // Helper function to handle redirection with multiple fallbacks
    const executeRedirect = (url) => {
      // First attempt after 1 second
      setTimeout(() => {
        logCallback("Executing first redirect attempt");
        try {
          window.location.href = url;

          // Second attempt after 2 seconds if still here
          setTimeout(() => {
            logCallback("Executing second redirect attempt");
            try {
              window.location.replace(url);

              // Third attempt after 1 more second
              setTimeout(() => {
                logCallback("Executing third redirect attempt");
                window.open(url, "_self");
              }, 1000);
            } catch (e) {
              logCallback("Second redirect failed:", e.message);
            }
          }, 2000);
        } catch (e) {
          logCallback("First redirect failed:", e.message);
        }
      }, 1000);
    };

    // Start the code exchange process
    exchangeCode();

    // Global timeout fallback
    const globalFallback = setTimeout(() => {
      logCallback("Global fallback redirect triggered");
      window.location.href = redirectTo;
    }, 8000);

    return () => {
      clearTimeout(globalFallback);
    };
  }, []);

  // Success state
  if (status === "success") {
    return (
      <div className="sso-callback-container">
        <div className="success-icon-container">
          <CheckCircle className="success-icon" size={48} />
        </div>
        <h2>Authentication Successful</h2>
        <p>
          {userEmail ? `Signed in as ${userEmail}` : "Authentication completed"}
        </p>
        <p className="redirect-message">Redirecting to your account...</p>
        <div className="loading-indicator">
          <Loader className="spinner" size={24} />
        </div>
        <div className="manual-redirect">
          If you are not redirected automatically,{" "}
          <a href={redirectTarget} className="manual-link">
            click here
          </a>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="sso-callback-container">
        <div className="error-icon-container">
          <AlertCircle className="error-icon" size={48} />
        </div>
        <h2>Authentication Failed</h2>
        <p>{error || "An unexpected error occurred"}</p>
        <div className="manual-redirect">
          <a href="/login" className="manual-link">
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  // Processing state (default)
  return (
    <div className="sso-callback-container">
      <Loader className="spinner" size={48} />
      <h2>Authentication in Progress</h2>
      <p>Please wait while we complete your sign-in...</p>
    </div>
  );
}

export default SSOCallback;
