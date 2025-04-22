// src/components/auth/EnhancedPasswordReset.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import {
  Eye,
  EyeOff,
  CheckCircle,
  X,
  Save,
  Lock,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Mail,
} from "lucide-react";
import "../auth.css";

function EnhancedPasswordReset() {
  // State for request password reset screen
  const [email, setEmail] = useState("");
  const [isRequestSent, setIsRequestSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // State for setting new password screen
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetSuccess, setIsResetSuccess] = useState(false);

  // Password validation state
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  const navigate = useNavigate();
  const location = useLocation();

  // On load, check if we're coming from a password reset email
  useEffect(() => {
    const checkForResetParams = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(location.search);
      const token = params.get("token");
      const code = params.get("code");
      const type = params.get("type");

      // If we have reset parameters, redirect to reset-password page
      if (
        token ||
        code ||
        type === "recovery" ||
        (hash && hash.includes("type=recovery"))
      ) {
        debugAuth.log(
          "PasswordReset",
          "Reset parameters detected, redirecting to reset page"
        );

        // Set flag to prevent auth redirects during reset flow
        localStorage.setItem("password_reset_in_progress", "true");
        sessionStorage.setItem("password_reset_in_progress", "true");

        // Redirect to the dedicated reset password page
        navigate("/reset-password", { replace: true });
      }
    };

    checkForResetParams();
  }, [location, navigate]);

  // Update password validation checks
  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: password === confirmPassword && password !== "",
    });
  }, [password, confirmPassword]);

  // Request password reset
  const handleRequestReset = async (e) => {
    e.preventDefault();

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      debugAuth.log("PasswordReset", `Requesting password reset for ${email}`);

      // Request password reset from Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Success - show success message
      setIsRequestSent(true);
      setSuccess(
        `Password reset link sent to ${email}. Please check your inbox and spam folder.`
      );

      // Log for debugging
      debugAuth.log("PasswordReset", "Password reset email sent successfully");
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(
        error.message ||
          "Failed to send password reset email. Please try again."
      );
      debugAuth.log(
        "PasswordReset",
        `Error sending reset email: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Show success state if request was sent
  if (isRequestSent) {
    return (
      <div className="login-container">
        <div className="login-form reset-password-form">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={48} />
            </div>
            <h3>Check Your Email</h3>
            <p>{success}</p>
            <div className="email-info">
              <Mail size={24} className="email-icon" />
              <p>
                We've sent a link to <strong>{email}</strong> with instructions
                to reset your password.
              </p>
            </div>
            <p className="email-check-note">
              Please check your email inbox and spam folder. The link is valid
              for 24 hours.
            </p>
            <button onClick={() => navigate("/login")} className="login-button">
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Request password reset form
  return (
    <div className="login-container">
      <div className="login-form reset-password-form">
        <div className="login-header">
          <Lock size={28} className="reset-icon" />
          <h2>Reset Your Password</h2>
          <p>
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleRequestReset} className="login-form-fields">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="form-input"
              disabled={isLoading}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spinner" size={16} />
                Sending Reset Link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="quick-access-link">
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              navigate("/login");
            }}
          >
            <ArrowLeft size={14} style={{ marginRight: "5px" }} />
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}

export default EnhancedPasswordReset;
