// src/components/auth/ResetPasswordPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import {
  Eye,
  EyeOff,
  CheckCircle,
  Lock,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { debugAuth } from "../../utils/authDebug";
import "../auth.css";

function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [recoveryFlow, setRecoveryFlow] = useState(false);
  const [tokenInfo, setTokenInfo] = useState({});

  const navigate = useNavigate();
  const location = useLocation();

  // Process the URL parameters to detect reset tokens
  useEffect(() => {
    const processRecoveryParams = async () => {
      try {
        setIsLoading(true);
        debugAuth.log("ResetPassword", "Analyzing reset password parameters");

        // Set a flag to prevent navigation interruptions
        localStorage.setItem("password_reset_in_progress", "true");
        sessionStorage.setItem("password_reset_in_progress", "true");

        // Collect all potential token identifiers
        const hash = window.location.hash;
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const token = params.get("token");
        const type = params.get("type");
        const accessToken = params.get("access_token");

        // Log for debugging
        const info = {
          hasHash: !!hash,
          hashContainsRecovery: hash && hash.includes("recovery"),
          hasCode: !!code,
          hasToken: !!token,
          hasType: !!type,
          hasAccessToken: !!accessToken,
          path: location.pathname,
          search: location.search,
        };

        setTokenInfo(info);
        debugAuth.log(
          "ResetPassword",
          `Reset parameters detected: ${JSON.stringify(info)}`
        );

        // Determine if we have any token parameters
        const hasAnyToken =
          code ||
          token ||
          (hash && hash.includes("recovery")) ||
          (type && type === "recovery") ||
          accessToken;

        if (hasAnyToken) {
          debugAuth.log(
            "ResetPassword",
            "Valid reset token parameters detected"
          );
          setHasToken(true);
          setRecoveryFlow(true);

          // If we have a code, try to exchange it for a session
          if (code) {
            try {
              debugAuth.log(
                "ResetPassword",
                "Attempting to exchange code for session"
              );
              const { error } = await supabase.auth.exchangeCodeForSession(
                code
              );
              if (error) {
                debugAuth.log(
                  "ResetPassword",
                  `Code exchange error: ${error.message}`
                );
              }
            } catch (err) {
              console.error("Code exchange error:", err);
              // We'll continue without throwing here
            }
          }

          // Let Supabase process the hash if present
          if (hash) {
            try {
              // Wait a short time for Supabase to process the hash
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (err) {
              console.error("Hash processing error:", err);
            }
          }
        } else {
          debugAuth.log(
            "ResetPassword",
            "No valid reset token parameters found"
          );
          setHasToken(false);
          setError(
            "No valid password reset token found. Please request a new password reset link."
          );
        }
      } catch (err) {
        console.error("Error processing reset parameters:", err);
        setError(`Error processing reset link: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    processRecoveryParams();
  }, [location]);

  // Handle successful password reset
  const handleSuccessfulReset = () => {
    // Clear reset state
    localStorage.removeItem("password_reset_in_progress");
    sessionStorage.removeItem("password_reset_in_progress");

    // Set flags for login page
    localStorage.setItem("passwordChanged", "true");
    localStorage.setItem("passwordChangedAt", new Date().toISOString());

    setSuccess(true);

    // Redirect to login after short delay
    setTimeout(() => {
      navigate("/login?passwordChanged=true", { replace: true });
    }, 3000);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="loading-state">
            <Loader2 className="spinner" size={36} />
            <p>Validating your password reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show success message after password reset
  if (success) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={36} />
            </div>
            <h3>Password Reset Successful</h3>
            <p>
              Your password has been reset successfully. You can now login with
              your new password.
            </p>
            <p className="redirect-note">
              You will be redirected to the login page shortly...
            </p>
            <button
              onClick={() => navigate("/login")}
              className="primary-button"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (!hasToken && !recoveryFlow) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="token-error">
            <div className="error-icon-container">
              <AlertCircle className="error-icon" size={36} />
            </div>
            <h3>Invalid or Expired Link</h3>
            <p>
              The password reset link you clicked is invalid or has expired.
              Please request a new password reset link.
            </p>
            <div className="debug-info">
              <p>Debugging Info: {JSON.stringify(tokenInfo)}</p>
            </div>
            <button
              onClick={() => navigate("/forgot-password")}
              className="primary-button"
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show the Supabase Auth UI in update password mode
  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <div className="card-header">
          <Lock size={24} />
          <h3>Create New Password</h3>
          <p>Please enter your new password below.</p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <div className="auth-wrapper">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#4f46e5",
                    brandAccent: "#4338ca",
                  },
                  borderWidths: {
                    buttonBorderWidth: "1px",
                    inputBorderWidth: "1px",
                  },
                  radii: {
                    borderRadiusButton: "6px",
                    buttonBorderRadius: "6px",
                    inputBorderRadius: "6px",
                  },
                },
              },
              className: {
                container: "auth-form-container",
                button: "auth-button",
                label: "auth-label",
                input: "auth-input",
                message: "auth-message",
              },
            }}
            theme="light"
            view="update_password"
            onSuccess={handleSuccessfulReset}
          />
        </div>

        <div className="reset-footer">
          <button
            onClick={() => navigate("/forgot-password")}
            className="text-link"
          >
            <ArrowLeft size={16} style={{ marginRight: "4px" }} />
            Request a new password reset link
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
