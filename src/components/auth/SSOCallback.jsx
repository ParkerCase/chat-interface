// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Loader, AlertCircle, CheckCircle, LogIn } from "lucide-react";
import "../auth.css";

/**
 * Handles OAuth callback redirects from SSO providers (Google, Apple)
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const [error, setError] = useState("");
  const [redirectDelay, setRedirectDelay] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("Processing OAuth callback");

        // Get URL parameters
        const hashParams = window.location.hash;
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const errorParam = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");
        const returnUrl = urlParams.get("returnUrl") || "/admin";

        // Process Supabase hash parameters if present
        if (hashParams) {
          console.log(
            "Hash parameters detected, waiting for Supabase processing"
          );

          // Wait a short time for Supabase to process the hash
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Handle errors from OAuth provider
        if (errorParam) {
          setStatus("error");
          setMessage(`Authentication failed: ${errorParam}`);
          setError(
            errorDescription || "There was an error during authentication"
          );
          setRedirectDelay(5000);

          setTimeout(() => {
            navigate("/login");
          }, 5000);

          return;
        }

        // Check if a session was created during processing
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          console.log("Session detected after OAuth sign-in");

          // Success!
          setStatus("success");
          setMessage("Authentication successful!");

          // Get user data
          const { data: userData } = await supabase.auth.getUser();

          // Special case for admin
          if (userData?.user?.email === "itsus@tatt2away.com") {
            console.log("Admin user detected, setting MFA as verified");

            // Set admin as MFA verified
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");
            localStorage.setItem("isAuthenticated", "true");

            // Redirect to admin after a short delay (IMPORTANT FIX)
            setTimeout(() => {
              console.log("Redirecting admin to /admin");
              window.location.href = "/admin"; // Use window.location for full page reload
            }, 1000);

            return;
          }

          // For regular users, get or create profile and redirect to MFA verification
          try {
            // Check if profile exists
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // If no profile exists, create one
            if (
              profileError &&
              profileError.message.includes("No rows found")
            ) {
              console.log("Creating new profile for user");

              const { error: insertError } = await supabase
                .from("profiles")
                .insert({
                  id: userData.user.id,
                  email: userData.user.email,
                  full_name:
                    userData.user.user_metadata?.full_name ||
                    userData.user.email,
                  roles: ["user"],
                  created_at: new Date().toISOString(),
                });

              if (insertError) {
                console.warn("Error creating profile:", insertError);
              }
            }

            // Set auth state
            localStorage.setItem("authStage", "pre-mfa");
            localStorage.setItem("isAuthenticated", "true");

            // Send verification email for MFA
            if (userData?.user?.email) {
              try {
                await supabase.auth.signInWithOtp({
                  email: userData.user.email,
                  options: {
                    shouldCreateUser: false,
                    emailRedirectTo: null,
                  },
                });

                sessionStorage.setItem(
                  "lastMfaCodeSent",
                  Date.now().toString()
                );
              } catch (e) {
                console.warn("Error sending MFA code:", e);
              }
            }

            // Redirect to MFA verification (IMPORTANT FIX)
            console.log("Redirecting to MFA verification");
            setTimeout(() => {
              window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(
                returnUrl
              )}`;
            }, 1000);
          } catch (error) {
            console.error("Error processing user data:", error);
            setStatus("error");
            setMessage("Authentication error");
            setError("Error processing user data. Please try again.");
            setRedirectDelay(3000);

            setTimeout(() => {
              navigate("/login");
            }, 3000);
          }

          return;
        }

        // Handle the authorization code if present
        if (code) {
          console.log("Authorization code detected, exchanging for session");

          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            code
          );

          if (error) {
            console.error("Code exchange error:", error);
            throw error;
          }

          if (data?.session) {
            console.log("Session created successfully");

            // Success - show success message and set up MFA verification
            setStatus("success");
            setMessage("Authentication successful!");

            // Get user information
            const { data: userData } = await supabase.auth.getUser();

            // Same logic as above - for admin users
            if (userData?.user?.email === "itsus@tatt2away.com") {
              console.log("Admin user detected, setting MFA as verified");

              // Set admin as MFA verified
              localStorage.setItem("mfa_verified", "true");
              sessionStorage.setItem("mfa_verified", "true");
              localStorage.setItem("authStage", "post-mfa");
              localStorage.setItem("isAuthenticated", "true");

              // Redirect to admin (IMPORTANT FIX)
              setTimeout(() => {
                console.log("Redirecting admin to /admin");
                window.location.href = "/admin";
              }, 1000);

              return;
            }

            // For regular users, redirect to MFA verification
            console.log("Regular user, proceeding to MFA verification");

            // Set auth stage to pre-MFA
            localStorage.setItem("authStage", "pre-mfa");
            localStorage.setItem("isAuthenticated", "true");

            // Send verification email
            if (userData?.user?.email) {
              try {
                await supabase.auth.signInWithOtp({
                  email: userData.user.email,
                  options: {
                    shouldCreateUser: false,
                    emailRedirectTo: null,
                  },
                });

                sessionStorage.setItem(
                  "lastMfaCodeSent",
                  Date.now().toString()
                );
              } catch (e) {
                console.warn("Error sending MFA code:", e);
              }
            }

            // Redirect to MFA verification (IMPORTANT FIX)
            setTimeout(() => {
              window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(
                returnUrl
              )}`;
            }, 1000);

            return;
          }
        }

        // No session created - show error
        setStatus("error");
        setMessage("Authentication failed");
        setError("Could not create a session. Please try logging in again.");
        setRedirectDelay(3000);

        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } catch (err) {
        console.error("Error handling callback:", err);

        setStatus("error");
        setMessage("Authentication error");
        setError(
          err.message || "An unexpected error occurred during authentication."
        );
        setRedirectDelay(3000);

        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  // Render different UI based on status
  return (
    <div className="sso-callback-container">
      {status === "processing" && (
        <div className="callback-processing">
          <Loader className="spinner" size={48} />
          <h2>{message}</h2>
          <p>Please wait while we complete your sign-in...</p>
        </div>
      )}

      {status === "success" && (
        <div className="callback-success">
          <CheckCircle className="success-icon" size={48} />
          <h2>{message}</h2>
          <p>You'll be redirected to your account in a moment...</p>
        </div>
      )}

      {status === "error" && (
        <div className="callback-error">
          <AlertCircle className="error-icon" size={48} />
          <h2>{message}</h2>
          <p>{error}</p>
          <p className="redirect-message">
            Redirecting to login page in {Math.round(redirectDelay / 1000)}{" "}
            seconds...
          </p>
          <button onClick={() => navigate("/login")} className="login-button">
            <LogIn size={18} />
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}

export default SSOCallback;
