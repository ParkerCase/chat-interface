// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

/**
 * Handles OAuth callback redirects from SSO providers
 * Processes the authentication and redirects to the appropriate page
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing authentication...");
  const [error, setError] = useState("");
  const [redirectDelay, setRedirectDelay] = useState(0);

  const { processTokenExchange } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL parameters
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");
        const returnUrl = params.get("returnUrl") || "/";

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
            console.log("Processing SSO hash redirect");

            // Ensure Supabase has time to process the hash
            await new Promise(resolve => setTimeout(resolve, 500));

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
              console.log("SSO authentication successful");

              // Add short delay for better UX
              setTimeout(async () => {
                try {
                  // Determine if the user is an admin for redirect
                  const { data: userData, error: userError } = await supabase.auth.getUser();
                  
                  if (userError) {
                    console.error("Error getting user data:", userError);
                    throw userError;
                  }
                  
                  if (!userData?.user) {
                    console.error("User data not available after SSO auth");
                    throw new Error("User data not available");
                  }

                  console.log("User data retrieved:", userData.user.email);

                  // Check if this is a test user
                  if (userData.user.email === "itsus@tatt2away.com") {
                    console.log("Test user detected, bypassing profile lookup");
                    // Special handling for test user - assume admin and bypass MFA
                    localStorage.setItem("currentUser", JSON.stringify({
                      id: userData.user.id,
                      email: userData.user.email,
                      name: "Tatt2Away Test Admin",
                      roles: ["super_admin", "admin", "user"],
                      tier: "enterprise"
                    }));
                    
                    // Navigate directly to admin panel
                    window.location.href = "/admin";
                    return;
                  }

                  // Get user profile from Supabase
                  const { data: profileData, error: profileError } = await supabase
                    .from("profiles")
                    .select("roles")
                    .eq("id", userData.user.id)
                    .single();

                  if (profileError) {
                    console.warn("Error fetching profile:", profileError);
                    // Create a basic profile if not found
                    try {
                      await supabase.from("profiles").insert({
                        id: userData.user.id,
                        email: userData.user.email,
                        full_name: userData.user.user_metadata?.full_name || userData.user.email,
                        roles: ["user"],
                        created_at: new Date().toISOString()
                      });
                      console.log("Created new profile for user");
                    } catch (insertError) {
                      console.error("Failed to create profile:", insertError);
                    }
                  }

                  const roles = profileData?.roles || ["user"];
                  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
                  console.log("User roles:", roles, "Is admin:", isAdmin);

                  // Check if MFA is required
                  try {
                    const { data: mfaData, error: mfaError } = 
                      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                    
                    if (mfaError) {
                      console.error("Error checking MFA status:", mfaError);
                      // Continue without MFA
                      window.location.href = isAdmin ? "/admin" : returnUrl;
                      return;
                    }
                    
                    const mfaRequired =
                      mfaData &&
                      mfaData.currentLevel !== mfaData.nextLevel &&
                      mfaData.nextLevel === "aal2";
                    
                    console.log("MFA required:", mfaRequired, "MFA data:", mfaData);

                    // Always redirect to MFA verification after SSO
                    console.log("Redirecting to MFA verification after SSO login");
                    
                    // First ensure the user has an email MFA method in their profile
                    try {
                      // Create default email MFA method for this user if needed
                      const emailMfaMethod = {
                        id: `email-${userData.user.email.replace(/[^a-zA-Z0-9]/g, "")}`,
                        type: "email",
                        createdAt: new Date().toISOString(),
                        email: userData.user.email
                      };
                      
                      // Check if the profile already has MFA methods
                      if (!profileData?.mfa_methods || profileData.mfa_methods.length === 0) {
                        console.log("Adding email MFA method to user profile");
                        
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
                      
                      console.log("Email verification code sent for MFA");
                    } catch (mfaSetupError) {
                      console.error("Error setting up email MFA:", mfaSetupError);
                      // Continue to MFA verification anyway
                    }
                    
                    // Redirect to MFA verification
                    window.location.href = `/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}&email=${encodeURIComponent(userData.user.email)}`;
                    
                  } catch (mfaCheckError) {
                    console.error("MFA status check failed:", mfaCheckError);
                    // Default redirect on error
                    window.location.href = isAdmin ? "/admin" : returnUrl;
                  }
                } catch (redirectError) {
                  console.error("Error during SSO redirect:", redirectError);
                  // Force redirect to login on error
                  window.location.href = "/login?error=redirect_failed";
                }
              }, 1000);

              return;
            } else {
              console.warn("No session found after SSO auth");
            }
          } catch (hashError) {
            console.error("Error processing hash params:", hashError);
            setError("Error processing authentication. " + hashError.message);
            // Continue with code exchange as fallback
          }
        }

        // Process authorization code if present
        if (code) {
          setStatus("processing");
          setMessage("Processing authentication code...");

          // Try to exchange the code for tokens
          const success = await processTokenExchange(code);

          if (success) {
            setStatus("success");
            setMessage("Authentication successful!");

            // Add short delay for better UX
            setTimeout(async () => {
              // Get current user from localStorage as a fallback
              const user = JSON.parse(
                localStorage.getItem("currentUser") || "{}"
              );
              const isAdmin =
                user?.roles?.includes("admin") ||
                user?.roles?.includes("super_admin");

              // Check if MFA is required for this user
              if (user?.mfaMethods && user.mfaMethods.length > 0) {
                navigate(
                  `/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}`
                );
              } else {
                navigate(isAdmin ? "/admin" : returnUrl);
              }
            }, 1000);
          } else {
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
        console.error("SSO callback error:", err);

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
