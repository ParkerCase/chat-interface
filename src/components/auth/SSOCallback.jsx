// src/components/auth/SSOCallback.jsx - FIXED with null safety
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";

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
} from "lucide-react";
import "./SSOCallback.css"; // Ensure CSS file exists

/**
 * Handles OAuth callback redirects from SSO providers
 * Processes the authentication and redirects to the appropriate page
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const [error, setError] = useState("");
  const [redirectDelay, setRedirectDelay] = useState(0);

  // Add null safety for auth context
  const auth = useAuth() || {};
  const { processTokenExchange } = auth;

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        debugAuth.log("SSOCallback", "Processing SSO callback");

        // Get URL parameters
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");
        const returnUrl = params.get("returnUrl") || "/admin";

        // Handle errors from OAuth provider
        if (error) {
          setStatus("error");
          setMessage(`Authentication failed: ${error}`);
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
            setMessage("Finalizing authentication...");
            debugAuth.log("SSOCallback", "Processing SSO hash redirect");

            // Ensure Supabase has time to process the hash
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Supabase will handle the hash params automatically
            const { data, error } = await supabase.auth.getSession();
            console.log("Session data:", JSON.stringify(data), "Error:", error);

            if (error) {
              console.error("Session error:", error);
              throw error;
            }

            if (data.session) {
              // Success! Show success and redirect
              setStatus("success");
              setMessage("Authentication successful!");
              debugAuth.log("SSOCallback", "SSO authentication successful");

              // Add short delay for better UX
              setTimeout(async () => {
                try {
                  // Determine if the user is an admin for redirect
                  const { data: userData, error: userError } =
                    await supabase.auth.getUser();

                  if (userError) {
                    console.error("Error getting user data:", userError);
                    throw userError;
                  }

                  if (!userData?.user) {
                    console.error("User data not available after SSO auth");
                    throw new Error("User data not available");
                  }

                  debugAuth.log(
                    "SSOCallback",
                    `User data retrieved: ${userData.user.email}`
                  );

                  // Check if this is a test user
                  if (userData.user.email === "itsus@tatt2away.com") {
                    debugAuth.log(
                      "SSOCallback",
                      "Test user detected, bypassing profile lookup"
                    );
                    // Special handling for test user - assume admin and bypass MFA
                    localStorage.setItem(
                      "currentUser",
                      JSON.stringify({
                        id: userData.user.id,
                        email: userData.user.email,
                        name: "Tatt2Away Test Admin",
                        roles: ["super_admin", "admin", "user"],
                        tier: "enterprise",
                      })
                    );

                    // Set authentication flags
                    localStorage.setItem("authStage", "post-mfa");
                    localStorage.setItem("mfa_verified", "true");
                    sessionStorage.setItem("mfa_verified", "true");
                    sessionStorage.setItem("mfaSuccess", "true");

                    // Navigate directly to admin panel
                    window.location.href = "/admin";
                    return;
                  }

                  // Get user profile from Supabase
                  const { data: profileData, error: profileError } =
                    await supabase
                      .from("profiles")
                      .select("*")
                      .eq("id", userData.user.id)
                      .single();

                  if (profileError) {
                    debugAuth.log(
                      "SSOCallback",
                      `Error fetching profile: ${profileError.message}`
                    );
                    // Create a basic profile if not found
                    try {
                      // First check if the profile already exists
                      const {
                        data: existingProfile,
                        error: checkProfileError,
                      } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("id", userData.user.id)
                        .single();

                      if (existingProfile) {
                        // Update existing profile
                        await supabase
                          .from("profiles")
                          .update({
                            full_name:
                              userData.user.user_metadata?.full_name ||
                              userData.user.email,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", userData.user.id);
                      } else {
                        // Create new profile
                        await supabase.from("profiles").insert({
                          id: userData.user.id,
                          full_name:
                            userData.user.user_metadata?.full_name ||
                            userData.user.email,
                          roles: ["user"],
                          created_at: new Date().toISOString(),
                        });
                      }
                      debugAuth.log(
                        "SSOCallback",
                        "Created/updated user profile"
                      );
                    } catch (insertError) {
                      debugAuth.log(
                        "SSOCallback",
                        `Failed to create profile: ${insertError.message}`
                      );
                    }
                  }

                  const roles = profileData?.roles || ["user"];
                  const isAdmin =
                    roles.includes("admin") || roles.includes("super_admin");
                  debugAuth.log(
                    "SSOCallback",
                    `User roles: ${roles.join(", ")}, Is admin: ${isAdmin}`
                  );

                  // Store user data in localStorage
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

                  // Always redirect to MFA verification after SSO
                  debugAuth.log(
                    "SSOCallback",
                    "Redirecting to MFA verification after SSO login"
                  );

                  // First send the MFA code to user's email
                  try {
                    // Create default email MFA method for this user if needed
                    const emailMfaMethod = {
                      id: `email-${userData.user.email.replace(
                        /[^a-zA-Z0-9]/g,
                        ""
                      )}`,
                      type: "email",
                      createdAt: new Date().toISOString(),
                      email: userData.user.email,
                    };

                    // Check if the profile already has MFA methods
                    if (
                      !profileData?.mfa_methods ||
                      profileData.mfa_methods.length === 0
                    ) {
                      debugAuth.log(
                        "SSOCallback",
                        "Adding email MFA method to user profile"
                      );

                      // Update the profile with the new MFA method
                      await supabase
                        .from("profiles")
                        .update({ mfa_methods: [emailMfaMethod] })
                        .eq("id", userData.user.id);
                    }

                    // Send an email verification code
                    await supabase.auth.signInWithOtp({
                      email: userData.user.email,
                      options: {
                        shouldCreateUser: false,
                        emailRedirectTo: null,
                      },
                    });

                    debugAuth.log(
                      "SSOCallback",
                      "Email verification code sent for MFA"
                    );
                  } catch (mfaSetupError) {
                    debugAuth.log(
                      "SSOCallback",
                      `Error setting up email MFA: ${mfaSetupError.message}`
                    );
                    // Continue to MFA verification anyway
                  }

                  // Redirect to MFA verification with return URL
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
            // Continue with code exchange as fallback
          }
        }

        // Process authorization code if present
        if (code) {
          setStatus("processing");
          setMessage("Processing authentication code...");

          // Try direct process with Supabase instead of using processTokenExchange
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(
              code
            );

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
          } catch (exchangeError) {
            console.error("Code exchange error:", exchangeError);
            setError(
              "Error exchanging authentication code: " + exchangeError.message
            );

            // If processTokenExchange is available from auth context, try that as fallback
            if (processTokenExchange) {
              try {
                const success = await processTokenExchange(code);

                if (success) {
                  setStatus("success");
                  setMessage("Authentication successful!");

                  // Add short delay for better UX
                  setTimeout(() => {
                    navigate("/admin");
                  }, 1000);

                  return;
                }
              } catch (fallbackError) {
                console.error("Fallback token exchange failed:", fallbackError);
              }
            }

            // If we get here, all attempts failed
            setStatus("error");
            setMessage("Authentication failed");
            setError(
              "Failed to exchange authentication code. Please try again."
            );
            setRedirectDelay(3000);

            // Schedule redirect
            setTimeout(() => {
              navigate("/login");
            }, 3000);
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
  }, [location, navigate, processTokenExchange]);

  // Render different UI based on status
  return (
    <div className="sso-callback-container">
      {status === "processing" && (
        <div className="callback-processing">
          <Loader2 className="spinner" size={48} />
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
