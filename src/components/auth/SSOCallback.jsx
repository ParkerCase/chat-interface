// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { Loader, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../auth.css";
import { useNavigate } from "react-router-dom";

/**
 * Enhanced callback handler for Supabase auth
 * Handles code exchange and ensures proper state setting
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [redirectTarget, setRedirectTarget] = useState("/admin");
  const navigate = useNavigate();

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

    if (!code) {
      // Only redirect to login if code is missing (not after a successful sign-in)
      setError("Authentication failed: No code parameter found");
      setStatus("error");
      return;
    }

    const exchangeCode = async () => {
      try {
        setStatus("processing");
        // Exchange the code for a session
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession();

        if (exchangeError) {
          setError(`Authentication failed: ${exchangeError.message}`);
          setStatus("error");
          // Clear all auth state on error
          localStorage.clear();
          sessionStorage.clear();
          setTimeout(() => navigate("/login"), 1000);
          return;
        }

        if (!data || !data.session) {
          setError("Authentication failed: No session data returned");
          setStatus("error");
          // Clear all auth state on error
          localStorage.clear();
          sessionStorage.clear();
          setTimeout(() => navigate("/login"), 1000);
          return;
        }

        setUserEmail(data.session.user.email);
        setStatus("success");

        // Wait for Supabase session to be fully established before redirecting
        let attempts = 0;
        const maxAttempts = 10;
        const waitForSession = async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            // Auth state is established, redirect to target
            window.location.replace(redirectTo);
          } else if (attempts < maxAttempts) {
            attempts += 1;
            setTimeout(waitForSession, 200);
          } else {
            // If session never appears, show error and redirect to login
            setError(
              "Authentication failed: Session could not be established."
            );
            setStatus("error");
            localStorage.clear();
            sessionStorage.clear();
            setTimeout(() => navigate("/login"), 1000);
          }
        };
        waitForSession();
      } catch (err) {
        setError(`Authentication failed: ${err.message}`);
        setStatus("error");
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => navigate("/login"), 1000);
      }
    };

    exchangeCode();
  }, [navigate]);

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
