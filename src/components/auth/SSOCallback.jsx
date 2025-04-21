// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import { handleOAuthCallback } from "../../utils/ssoDebugger";

import {
  Shield,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Lock,
  X,
  Clock,
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
        // Get provider from session if available
        const providerFromSession =
          sessionStorage.getItem("ssoProvider") || "google";
        setProvider(providerFromSession);

        debugAuth.log(
          "SSOCallback",
          `Processing ${providerFromSession} callback`
        );

        // Get URL parameters
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");
        const returnUrl = params.get("returnUrl") || "/admin";

        // Handle errors from OAuth provider
        if (error) {
          setStatus("error");
          setMessage(`${providerFromSession} authentication failed: ${error}`);
          setError(
            errorDescription || "There was an error during authentication"
          );
          setRedirectDelay(5000); // 5 seconds before redirecting back to login

          // Schedule redirect
          setTimeout(() => {
            navigate("/login");
          }, 5000);

          return;
        }

        // Check if this is a Supabase redirect with hash parameters
        if (window.location.hash) {
          try {
            setStatus("processing");
            setMessage(`Finalizing ${providerFromSession} authentication...`);
            debugAuth.log(
              "SSOCallback",
              `Processing ${providerFromSession} hash redirect`
            );

            // Ensure Supabase has time to process the hash
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Supabase will handle the hash params automatically
            const { data, error } = await supabase.auth.getSession();

            if (error) {
              debugAuth.log("SSOCallback", `Session error: ${error.message}`);
              throw error;
            }

            if (data.session) {
              // Success! Show success and redirect
              setStatus("success");
              setMessage("Authentication successful!");
              debugAuth.log(
                "SSOCallback",
                `${providerFromSession} authentication successful`
              );

              // Add short delay for better UX
              setTimeout(async () => {
                try {
                  // Determine if the user is an admin for redirect
                  const { data: userData, error: userError } =
                    await supabase.auth.getUser();

                  if (userError) {
                    debugAuth.log(
                      "SSOCallback",
                      `Error getting user data: ${userError.message}`
                    );
                    throw userError;
                  }

                  if (!userData?.user) {
                    debugAuth.log(
                      "SSOCallback",
                      "User data not available after SSO auth"
                    );
                    throw new Error("User data not available");
                  }

                  debugAuth.log(
                    "SSOCallback",
                    `User data retrieved: ${userData.user.email}`
                  );

                  // Handle super admin case
                  if (userData.user.email === "itsus@tatt2away.com") {
                    debugAuth.log(
                      "SSOCallback",
                      "Super admin user detected, ensuring proper access"
                    );

                    // Ensure the user has a profile with super_admin role
                    try {
                      // First check if profile exists
                      const { data: profileData, error: profileError } =
                        await supabase
                          .from("profiles")
                          .select("*")
                          .eq("id", userData.user.id)
                          .single();

                      // If profile doesn't exist or error, create it
                      if (profileError || !profileData) {
                        debugAuth.log(
                          "SSOCallback",
                          "Creating super admin profile"
                        );

                        // Create profile with super_admin role
                        await supabase.from("profiles").upsert({
                          id: userData.user.id,
                          email: userData.user.email,
                          full_name: "Tatt2Away Admin",
                          roles: ["super_admin", "admin", "user"],
                          tier: "enterprise",
                          created_at: new Date().toISOString(),
                          auth_provider: providerFromSession,
                        });
                      }
                      // If profile exists but doesn't have super_admin role, update it
                      else if (!profileData.roles?.includes("super_admin")) {
                        debugAuth.log(
                          "SSOCallback",
                          "Updating profile to add super_admin role"
                        );

                        await supabase
                          .from("profiles")
                          .update({
                            roles: ["super_admin", "admin", "user"],
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", userData.user.id);
                      }

                      // Store in localStorage for immediate access
                      localStorage.setItem(
                        "currentUser",
                        JSON.stringify({
                          id: userData.user.id,
                          email: userData.user.email,
                          name: "Tatt2Away Admin",
                          roles: ["super_admin", "admin", "user"],
                          tier: "enterprise",
                        })
                      );

                      // Set auth tokens
                      localStorage.setItem(
                        "authToken",
                        data.session.access_token
                      );
                      localStorage.setItem(
                        "refreshToken",
                        data.session.refresh_token
                      );
                      localStorage.setItem("isAuthenticated", "true");

                      // Bypass MFA for super admin
                      localStorage.setItem("authStage", "post-mfa");
                      localStorage.setItem("mfa_verified", "true");
                      sessionStorage.setItem("mfa_verified", "true");
                      sessionStorage.setItem("mfaSuccess", "true");

                      // Navigate directly to admin panel
                      window.location.href = "/admin";
                      return;
                    } catch (adminError) {
                      debugAuth.log(
                        "SSOCallback",
                        `Error processing super admin: ${adminError.message}`
                      );
                      // Continue with normal flow if error occurs
                    }
                  }

                  // Get user profile from Supabase for regular users
                  const { data: profileData, error: profileError } =
                    await supabase
                      .from("profiles")
                      .select("*")
                      .eq("id", userData.user.id)
                      .single();

                  // If profile doesn't exist, create it
                  if (profileError) {
                    debugAuth.log(
                      "SSOCallback",
                      `Error fetching profile: ${profileError.message}`
                    );

                    // Create a basic profile
                    try {
                      await supabase.from("profiles").insert({
                        id: userData.user.id,
                        email: userData.user.email,
                        full_name:
                          userData.user.user_metadata?.full_name ||
                          userData.user.email,
                        roles: ["user"],
                        created_at: new Date().toISOString(),
                        auth_provider: providerFromSession,
                      });

                      debugAuth.log("SSOCallback", "Created user profile");
                    } catch (insertError) {
                      debugAuth.log(
                        "SSOCallback",
                        `Failed to create profile: ${insertError.message}`
                      );
                    }
                  }

                  // Determine user roles
                  const roles = profileData?.roles || ["user"];
                  const isAdmin =
                    roles.includes("admin") || roles.includes("super_admin");

                  // Store authentication info
                  localStorage.setItem(
                    "currentUser",
                    JSON.stringify({
                      id: userData.user.id,
                      email: userData.user.email,
                      name:
                        profileData?.full_name ||
                        userData.user.user_metadata?.full_name ||
                        userData.user.email,
                      roles: roles,
                      tier: "enterprise",
                    })
                  );

                  localStorage.setItem("authToken", data.session.access_token);
                  localStorage.setItem(
                    "refreshToken",
                    data.session.refresh_token
                  );
                  localStorage.setItem("isAuthenticated", "true");
                  localStorage.setItem("authStage", "pre-mfa"); // Mark as needing MFA

                  // Always redirect to MFA verification for regular users
                  debugAuth.log(
                    "SSOCallback",
                    "Redirecting to MFA verification after SSO login"
                  );

                  // Send verification code for email-based MFA
                  try {
                    await supabase.auth.signInWithOtp({
                      email: userData.user.email,
                      options: {
                        shouldCreateUser: false,
                        emailRedirectTo: null,
                      },
                    });

                    // Record when the code was sent
                    sessionStorage.setItem(
                      "lastMfaCodeSent",
                      Date.now().toString()
                    );
                    debugAuth.log(
                      "SSOCallback",
                      "Email verification code sent for MFA"
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
                } catch (redirectError) {
                  debugAuth.log(
                    "SSOCallback",
                    `Error during SSO redirect: ${redirectError.message}`
                  );
                  // Force redirect to login on error
                  window.location.href = "/login?error=redirect_failed";
                }
              }, 1000);

              return;
            } else {
              debugAuth.log("SSOCallback", "No session found after SSO auth");
            }
          } catch (hashError) {
            debugAuth.log(
              "SSOCallback",
              `Error processing hash params: ${hashError.message}`
            );
            setError("Error processing authentication. " + hashError.message);
          }
        }

        // Process authorization code if present
        if (code) {
          setStatus("processing");
          setMessage(
            `Processing ${providerFromSession} authentication code...`
          );

          // Use our improved handler to handle the callback
          try {
            const result = await handleOAuthCallback(code);

            if (result.success) {
              setStatus("success");
              setMessage("Authentication successful!");

              // Handle special admin case if needed
              if (result.adminHandled) {
                // If backend handled the admin creation
                setTimeout(() => {
                  navigate(result.redirectTo || "/login");
                }, 1000);
                return;
              }

              // Regular success case
              setTimeout(() => {
                navigate("/admin");
              }, 1000);
              return;
            } else {
              // Authentication failed but in a handled way
              setStatus("error");
              setMessage(
                result.linkingFlow
                  ? "Account Linking Required"
                  : "Authentication failed"
              );
              setError(result.error || "Failed to process authentication");

              // Special handling for user that needs linking
              if (result.linkingFlow) {
                setError(
                  result.message ||
                    "Please check your email to complete the account linking process"
                );
                setRedirectDelay(5000);

                setTimeout(() => {
                  navigate(
                    "/login?link=true&email=" +
                      encodeURIComponent(result.email || "")
                  );
                }, 5000);
                return;
              }

              // Regular error case
              setRedirectDelay(3000);
              setTimeout(() => {
                navigate("/login");
              }, 3000);
              return;
            }
          } catch (handlerError) {
            console.error("OAuth handler error:", handlerError);

            // Fall back to direct Supabase exchange as last resort
            try {
              const { data, error } =
                await supabase.auth.exchangeCodeForSession(code);

              if (error) {
                throw error;
              }

              setStatus("success");
              setMessage("Authentication successful!");

              // Add short delay for better UX
              setTimeout(() => {
                // Navigate to admin panel
                navigate("/admin");
              }, 1000);

              return;
            } catch (fallbackError) {
              console.error("Fallback exchange error:", fallbackError);
              setError(
                "Failed to exchange authentication code: " +
                  fallbackError.message
              );
              setStatus("error");
              setRedirectDelay(3000);
              setTimeout(() => {
                navigate("/login");
              }, 3000);
            }
          }
        } else if (!error && !code && !window.location.hash) {
          // No code or error - invalid callback state
          setStatus("error");
          setMessage("Invalid authentication callback");
          setError(
            "Missing authentication parameters. Please try logging in again."
          );
          setRedirectDelay(3000);

          // Schedule redirect
          setTimeout(() => {
            navigate("/login");
          }, 3000);
        }
      } catch (err) {
        debugAuth.log("SSOCallback", `Unexpected error: ${err.message}`);

        setStatus("error");
        setMessage("Authentication error");
        setError(
          err.message || "An unexpected error occurred during authentication."
        );
        setRedirectDelay(3000);

        // Schedule redirect
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };

    handleCallback();
  }, [location, navigate]);

  // Display provider-specific branding
  const getProviderName = () => {
    return provider === "apple" ? "Apple" : "Google";
  };

  // Get provider-specific icon (not implemented here but could be)
  const getProviderIcon = () => {
    return <LogIn size={24} />;
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
            Redirecting to login page{" "}
            {redirectDelay > 0
              ? `in ${Math.round(redirectDelay / 1000)} seconds`
              : ""}
            ...
          </p>
          <button onClick={() => navigate("/login")} className="login-button">
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}

export default SSOCallback;
