// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import { handleOAuthCallback } from "../../utils/ssoDebugger";
import {
  checkLinkingStatus,
  clearLinkingState,
} from "../../utils/identityLinking";
import { getLinkingState } from "../../utils/enhancedIdentityLinking";

import {
  Shield,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  LogIn,
} from "lucide-react";
import "./SSOCallback.css";

/**
 * Handles OAuth callback redirects from SSO providers (Google, Apple)
 * Processes the authentication and redirects to the appropriate page
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const [error, setError] = useState("");
  const [redirectDelay, setRedirectDelay] = useState(0);
  const [provider, setProvider] = useState(""); // Track which provider is being used

  const auth = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        debugAuth.log("SSOCallback", "Processing OAuth callback");
        console.log("OAuth callback URL:", window.location.href);
        console.log(
          "Query parameters:",
          new URLSearchParams(location.search).toString()
        );
        // Get URL parameters
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");
        const returnUrl = params.get("returnUrl") || "/admin";
        const isLinking = params.get("linking") === "true";

        // Get provider from session or default to Google
        const providerFromSession =
          sessionStorage.getItem("ssoProvider") || "google";
        setProvider(providerFromSession);

        // Check if this is a linking flow using the enhanced utils
        const linkingStatus = getLinkingState();
        const isInLinkingFlow = isLinking || linkingStatus.isLinking;

        // If this is an invitation flow, detect and handle it
        const isInvitation =
          params.get("invitation_token") ||
          params.get("type") === "invite" ||
          window.location.hash.includes("type=invite");

        if (isInvitation) {
          debugAuth.log(
            "SSOCallback",
            "Detected invitation flow, redirecting to invitation handler"
          );
          localStorage.setItem("invitation_flow", "true");

          // Extract and store token
          const inviteToken =
            params.get("invitation_token") || params.get("token");
          if (inviteToken) {
            sessionStorage.setItem("invitation_token", inviteToken);
          }

          // Redirect to invitation handler
          setTimeout(() => {
            navigate("/invitation" + location.search);
          }, 500);
          return;
        }

        // Handle errors from OAuth provider
        if (error) {
          setStatus("error");
          setMessage(`${providerFromSession} authentication failed: ${error}`);
          setError(
            errorDescription || "There was an error during authentication"
          );
          setRedirectDelay(5000);

          // Schedule redirect
          setTimeout(() => {
            navigate("/login");
          }, 5000);

          return;
        }

        // Special handling for linking flow
        if (isInLinkingFlow) {
          debugAuth.log("SSOCallback", "Detected identity linking flow");

          // Process the linking flow
          if (code) {
            // Exchange code for session in a linking context
            const { data, error } = await supabase.auth.exchangeCodeForSession(
              code
            );
            console.log(
              "Auth exchange response:",
              JSON.stringify(data, null, 2)
            );

            if (error) {
              debugAuth.log(
                "SSOCallback",
                `Error in linking flow: ${error.message}`
              );
              setStatus("error");
              setMessage("Account linking failed");
              setError(error.message);
              setRedirectDelay(3000);

              setTimeout(() => navigate("/login"), 3000);
              return;
            }

            if (data?.session) {
              debugAuth.log("SSOCallback", "Session created in linking flow");

              // Success - clear linking state and show success
              clearLinkingState();
              setStatus("success");
              setMessage("Account linked successfully!");

              setTimeout(() => {
                navigate("/login?linked=true");
              }, 2000);

              return;
            }
          }

          // No code parameter but in linking flow - something went wrong
          if (!code && !window.location.hash) {
            setStatus("error");
            setMessage("Account linking failed");
            setError("Missing authentication parameters");
            setRedirectDelay(3000);

            setTimeout(() => navigate("/login"), 3000);
            return;
          }
        }

        // Handle hash params (used by some Supabase flows)
        if (window.location.hash) {
          debugAuth.log("SSOCallback", "Processing hash parameters");

          // Give Supabase time to process the hash
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Check if session was created
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData?.session) {
            debugAuth.log(
              "SSOCallback",
              "Session created from hash parameters"
            );

            // Success! Show success and redirect
            setStatus("success");
            setMessage("Authentication successful!");

            // Give a moment to process the success state
            setTimeout(async () => {
              try {
                // Get the user data
                const { data: userData } = await supabase.auth.getUser();

                if (userData?.user) {
                  debugAuth.log(
                    "SSOCallback",
                    `User authenticated: ${userData.user.email}`
                  );

                  // Handle the admin user special case
                  if (userData.user.email === "itsus@tatt2away.com") {
                    debugAuth.log("SSOCallback", "Admin user detected");

                    // Set admin flags
                    localStorage.setItem("mfa_verified", "true");
                    sessionStorage.setItem("mfa_verified", "true");
                    localStorage.setItem("authStage", "post-mfa");

                    // Redirect to admin
                    window.location.href = "/admin";
                    return;
                  }

                  // For regular users, redirect to MFA verification
                  debugAuth.log(
                    "SSOCallback",
                    "Redirecting to MFA verification"
                  );

                  // Send verification email
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
                  } catch (mfaError) {
                    debugAuth.log(
                      "SSOCallback",
                      `Error sending MFA code: ${mfaError.message}`
                    );
                  }

                  // Redirect to MFA verification
                  window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(
                    returnUrl
                  )}&email=${encodeURIComponent(userData.user.email)}`;
                }
              } catch (err) {
                debugAuth.log(
                  "SSOCallback",
                  `Error after authentication: ${err.message}`
                );
                window.location.href = "/login";
              }
            }, 1000);

            return;
          }

          // No session created with hash params
          setStatus("error");
          setMessage("Authentication failed");
          setError("Could not create session from authentication parameters");
          setRedirectDelay(3000);

          setTimeout(() => navigate("/login"), 3000);
          return;
        }

        // Process authorization code
        if (code) {
          debugAuth.log("SSOCallback", "Processing authorization code");

          // Use our improved handler for the callback
          const result = await handleOAuthCallback(code);

          if (result.success) {
            setStatus("success");
            setMessage("Authentication successful!");

            // For admin users
            if (result.user?.email === "itsus@tatt2away.com") {
              debugAuth.log(
                "SSOCallback",
                "Admin authenticated, redirecting to admin panel"
              );

              setTimeout(() => {
                window.location.href = "/admin";
              }, 1000);

              return;
            }

            // For regular users, handle MFA verification
            debugAuth.log("SSOCallback", "Redirecting to MFA verification");

            // Redirect to MFA verification after a brief delay
            setTimeout(() => {
              window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(
                returnUrl
              )}&email=${encodeURIComponent(result.user?.email || "")}`;
            }, 1000);

            return;
          } else {
            // Authentication failed
            setStatus("error");
            setMessage(
              result.linkingFlow
                ? "Account Linking Required"
                : "Authentication failed"
            );
            setError(result.error || "Failed to process authentication");

            // Special case for linking requirement
            if (result.linkingFlow) {
              setError("Please check your email to complete account linking");
              setRedirectDelay(5000);

              setTimeout(() => {
                navigate(
                  `/login?link=true&email=${encodeURIComponent(
                    result.email || ""
                  )}`
                );
              }, 5000);

              return;
            }

            // Regular error
            setRedirectDelay(3000);

            setTimeout(() => {
              navigate("/login");
            }, 3000);

            return;
          }
        }

        // No code or hash parameters - invalid callback
        setStatus("error");
        setMessage("Invalid authentication callback");
        setError(
          "Missing authentication parameters. Please try logging in again."
        );
        setRedirectDelay(3000);

        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } catch (err) {
        debugAuth.log("SSOCallback", `Unexpected error: ${err.message}`);

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
  }, [location, navigate]);

  // Get provider-specific name
  const getProviderName = () => {
    return provider === "apple" ? "Apple" : "Google";
  };

  // Render different UI based on status
  return (
    <div className="sso-callback-container">
      {status === "processing" && (
        <div className="callback-processing">
          <Loader2 className="spinner" size={48} />
          <h2>{message}</h2>
          <p>
            Please wait while we complete your {getProviderName()} sign-in...
          </p>
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
