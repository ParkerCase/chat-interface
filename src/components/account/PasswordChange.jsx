// src/components/account/PasswordChange.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import {
  Key,
  Mail,
  Info,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import "./AccountSettings.css";

function PasswordChange({ setSuccessMessage, setError }) {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectTimer, setRedirectTimer] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [localSuccess, setLocalSuccess] = useState("");
  const [localError, setLocalError] = useState("");

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [redirectTimer]);

  // Request password reset via email
  const requestPasswordReset = async () => {
    try {
      setIsLoading(true);
      setLocalError("");
      setResetEmailSent(false);

      if (setError) setError("");

      // Get current user email
      const userEmail = currentUser?.email;
      if (!userEmail) {
        const errorMsg =
          "No user email found. Please try again or log out and back in.";
        setLocalError(errorMsg);
        if (setError) setError(errorMsg);
        return false;
      }

      console.log("Requesting password reset for:", userEmail);

      // Send the reset email through Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Show success message
      setResetEmailSent(true);
      const successMsg = `Password reset link sent to ${userEmail}. Please check your email inbox and spam folder.`;
      setLocalSuccess(successMsg);
      if (setSuccessMessage) setSuccessMessage(successMsg);

      return true;
    } catch (error) {
      console.error("Password reset request error:", error);
      const errorMsg =
        error.message ||
        "Failed to send password reset email. Please try again.";
      setLocalError(errorMsg);
      if (setError) setError(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful password change
  const handlePasswordChangeSuccess = async () => {
    try {
      setIsLoading(true);
      const successMsg =
        "Password changed successfully! You'll be redirected to login again.";
      setLocalSuccess(successMsg);
      if (setSuccessMessage) setSuccessMessage(successMsg);
      setIsSuccess(true);

      // Store information for login detection
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
      localStorage.setItem("forceLogout", "true");

      // Wait 3 seconds then perform a complete logout and redirect
      const timer = setTimeout(() => {
        // Force a complete logout
        try {
          // 1. Sign out from Supabase
          supabase.auth.signOut();

          // 2. Clear all auth tokens and session data
          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
          sessionStorage.clear();

          // 3. Use window.location for a complete page refresh
          window.location.href = "/login?passwordChanged=true";
        } catch (redirectError) {
          console.error("Error during redirect:", redirectError);
          // Fallback direct navigation as last resort
          window.location.replace("/login?passwordChanged=true");
        }
      }, 3000);

      // Store timer reference for cleanup
      setRedirectTimer(timer);
    } finally {
      setIsLoading(false);
    }
  };

  // Show success state
  if (isSuccess) {
    return (
      <div className="success-message">
        <CheckCircle className="success-icon" />
        <h4>Password Change Successful!</h4>
        <p>
          Your password has been changed. You will be logged out and redirected
          to the login page to sign in with your new password.
        </p>
        <div className="loading-indicator">
          <Loader className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="password-change-container">
      <h3>Change Your Password</h3>
      <p className="tab-description">
        Update your password to maintain account security
      </p>

      {localError && (
        <div className="error-alert">
          <AlertCircle size={18} />
          <p>{localError}</p>
        </div>
      )}

      {localSuccess && (
        <div className="success-alert">
          <CheckCircle size={18} />
          <p>{localSuccess}</p>
        </div>
      )}

      {!showPasswordForm ? (
        <div className="password-reset-section">
          <p>
            To reset your password, we'll send a password reset link to your
            email: <strong>{currentUser?.email}</strong>
          </p>

          <p className="reset-info">
            <Info size={16} />
            Once you receive the email, click the link to set a new password of
            your choice.
          </p>

          {resetEmailSent && (
            <div className="success-alert">
              <CheckCircle size={18} />
              <p>
                Password reset email sent! Please check your inbox and spam
                folder. If you don't see it within a few minutes, you can try
                sending again.
              </p>
            </div>
          )}

          <button
            onClick={requestPasswordReset}
            className="reset-password-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className="spinner-sm" />
                Sending Reset Link...
              </>
            ) : (
              <>
                <Mail size={18} />
                Send Password Reset Link
              </>
            )}
          </button>

          <button
            onClick={() => setShowPasswordForm(true)}
            className="toggle-form-button"
            style={{
              marginTop: "16px",
              background: "transparent",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "8px 16px",
              cursor: "pointer",
              color: "#4b5563",
              display: "block",
              width: "100%",
            }}
          >
            Or change password directly
          </button>
        </div>
      ) : (
        <div className="password-form-container">
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
              view="update_password"
              theme="light"
              showLinks={false}
              onSuccess={handlePasswordChangeSuccess}
            />
          </div>

          <button
            onClick={() => setShowPasswordForm(false)}
            className="back-button"
            style={{
              marginTop: "16px",
              background: "transparent",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              cursor: "pointer",
              color: "#4b5563",
              display: "block",
              width: "100%",
              textAlign: "center",
            }}
          >
            Back to email reset option
          </button>
        </div>
      )}

      <div className="password-security-tips">
        <h4>Password Security Tips</h4>
        <ul>
          <li>
            <Key size={16} />
            <span>
              Use at least 8 characters with uppercase, lowercase, numbers, and
              special characters
            </span>
          </li>
          <li>
            <Key size={16} />
            <span>Don't reuse passwords across multiple sites</span>
          </li>
          <li>
            <Key size={16} />
            <span>
              Consider using a password manager to generate and store strong
              passwords
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default PasswordChange;
