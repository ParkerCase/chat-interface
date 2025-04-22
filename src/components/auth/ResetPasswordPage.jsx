// src/components/auth/ResetPasswordPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import {
  CheckCircle,
  Lock,
  AlertCircle,
  Loader,
  ArrowLeft,
} from "lucide-react";
import "../auth.css";

function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Process the URL parameters to detect reset tokens
  useEffect(() => {
    const processRecoveryParams = async () => {
      try {
        setIsLoading(true);
        console.log("Analyzing reset password parameters");

        // Set a flag to prevent auth redirects during reset
        localStorage.setItem("password_reset_in_progress", "true");
        sessionStorage.setItem("password_reset_in_progress", "true");

        // Check for reset parameters
        const hash = window.location.hash;
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const token = params.get("token");
        const type = params.get("type");
        const accessToken = params.get("access_token");

        // Determine if we have any token parameters
        const hasAnyToken =
          code ||
          token ||
          (hash && hash.includes("recovery")) ||
          (type && type === "recovery") ||
          accessToken;

        if (hasAnyToken) {
          console.log("Valid reset token parameters detected");
          setHasToken(true);

          // If we have a code, try to exchange it
          if (code) {
            try {
              console.log("Exchanging code for session");
              await supabase.auth.exchangeCodeForSession(code);
            } catch (err) {
              console.error("Code exchange error:", err);
            }
          }

          // Let Supabase process hash parameters if present
          if (hash) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } else {
          console.log("No valid reset token parameters found");
          setHasToken(false);
          setError(
            "No valid password reset token found. Please request a new password reset link."
          );
        }
      } catch (err) {
        console.error("Error processing reset parameters:", err);
        setError("Error processing reset link: " + err.message);
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

    // Redirect to login after delay
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
            <Loader className="spinner" size={36} />
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
  if (!hasToken) {
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
          <button onClick={() => navigate("/login")} className="text-link">
            <ArrowLeft size={16} style={{ marginRight: "4px" }} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
