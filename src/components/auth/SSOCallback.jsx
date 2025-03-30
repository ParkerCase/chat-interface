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

            // Supabase will handle the hash params automatically
            const { data, error } = await supabase.auth.getSession();

            if (error) throw error;

            if (data.session) {
              // Success! Show success and redirect
              setStatus("success");
              setMessage("Authentication successful!");

              // Add short delay for better UX
              setTimeout(async () => {
                // Determine if the user is an admin for redirect
                const { data: userData } = await supabase.auth.getUser();
                if (!userData?.user) {
                  throw new Error("User data not available");
                }

                // Get user profile from Supabase
                const { data: profileData } = await supabase
                  .from("profiles")
                  .select("roles")
                  .eq("id", userData.user.id)
                  .single();

                const roles = profileData?.roles || ["user"];
                const isAdmin =
                  roles.includes("admin") || roles.includes("super_admin");

                // Check if MFA is required
                const { data: mfaData } =
                  await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                const mfaRequired =
                  mfaData &&
                  mfaData.currentLevel !== mfaData.nextLevel &&
                  mfaData.nextLevel === "aal2";

                // Navigate based on MFA status
                if (mfaRequired) {
                  navigate(
                    `/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}`
                  );
                } else {
                  // Navigate based on role
                  navigate(isAdmin ? "/admin" : returnUrl);
                }
              }, 1000);

              return;
            }
          } catch (hashError) {
            console.error("Error processing hash params:", hashError);
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
