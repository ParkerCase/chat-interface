// src/components/auth/DirectResetPassword.jsx - SIMPLIFIED VERSION
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
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
} from "lucide-react";
import "../auth.css";

function DirectResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [processingHash, setProcessingHash] = useState(true);
  const [hasResetToken, setHasResetToken] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Password validation state
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  // First, process the hash or code if present - this is crucial for Supabase auth
  useEffect(() => {
    const initializeReset = async () => {
      try {
        setProcessingHash(true);

        // Check for hash, which is how Supabase recovery flow works
        const hash = window.location.hash;
        const params = new URLSearchParams(location.search);
        const hasCode = params.has("code");
        const hashContainsRecovery = hash && hash.includes("type=recovery");

        console.log("Reset parameters:", {
          hasHash: !!hash,
          hashContainsRecovery,
          hasCode,
          hash: hash || "none",
          searchParams: location.search,
        });

        // If we have a hash or code, we should be in a valid reset flow
        if (hashContainsRecovery || hasCode) {
          setHasResetToken(true);

          // IMPORTANT: Let Supabase process the hash/code by checking the session
          // This automatically processes the recovery flow parameters
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.warn("Session check error:", error);
            // Even with an error, we'll show the form as the hash/code may still be valid
          } else {
            console.log("Session status:", data.session ? "Active" : "None");
          }
        } else {
          // No valid reset parameters
          setHasResetToken(false);
          setError(
            "No valid password reset token found. Please request a new password reset link."
          );
        }
      } catch (error) {
        console.error("Reset initialization error:", error);
        setError("An error occurred while processing your reset link.");
        setHasResetToken(false);
      } finally {
        setProcessingHash(false);
      }
    };

    initializeReset();
  }, [location]);

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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate password requirements
    const allChecksPass = Object.values(passwordChecks).every((check) => check);
    if (!allChecksPass) {
      setError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Attempting to update password");

      // For Supabase, simply call updateUser - the session should be set from the hash/code
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Password update error:", updateError);

        if (updateError.message.includes("Auth session missing")) {
          throw new Error(
            "Your reset link has expired or is invalid. Please request a new password reset link."
          );
        } else {
          throw updateError;
        }
      }

      console.log("Password updated successfully!");
      setIsSuccess(true);

      // Force logout after password change for security
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn("Sign out after password change failed:", signOutError);
      }

      // Set flags for login detection
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (processingHash) {
    return (
      <div className="login-container">
        <div className="login-form reset-password-form">
          <div className="loading-state">
            <Loader2 className="spinner" size={36} />
            <h3>Processing Reset Link</h3>
            <p>Please wait while we validate your password reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show success message
  if (isSuccess) {
    return (
      <div className="login-container">
        <div className="login-form reset-password-form">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={48} />
            </div>
            <h3>Password Reset Successful</h3>
            <p>
              Your password has been reset successfully. You can now login with
              your new password.
            </p>
            <p className="redirect-message">
              You will be redirected to the login page shortly...
            </p>
            <button onClick={() => navigate("/login")} className="login-button">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error if no valid token
  if (!hasResetToken) {
    return (
      <div className="login-container">
        <div className="login-form reset-password-form">
          <div className="error-state">
            <div className="error-icon-container">
              <X className="error-icon" size={36} />
            </div>
            <h3>Link Invalid or Expired</h3>
            <p>{error}</p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="login-button"
            >
              Request New Link
            </button>
            <button onClick={() => navigate("/login")} className="back-link">
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show password reset form
  return (
    <div className="login-container">
      <div className="login-form reset-password-form">
        <div className="login-header">
          <Lock size={28} className="reset-icon" />
          <h2>Create New Password</h2>
          <p>Please enter and confirm your new password</p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-fields">
          {/* New Password Field */}
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password requirements */}
            <div className="password-requirements">
              <p className="requirements-title">Password must have:</p>
              <ul>
                <li className={passwordChecks.length ? "passed" : ""}>
                  {passwordChecks.length ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least 8 characters</span>
                </li>
                <li className={passwordChecks.uppercase ? "passed" : ""}>
                  {passwordChecks.uppercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one uppercase letter</span>
                </li>
                <li className={passwordChecks.lowercase ? "passed" : ""}>
                  {passwordChecks.lowercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one lowercase letter</span>
                </li>
                <li className={passwordChecks.number ? "passed" : ""}>
                  {passwordChecks.number ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one number</span>
                </li>
                <li className={passwordChecks.special ? "passed" : ""}>
                  {passwordChecks.special ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  <span>At least one special character</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`form-input ${
                  confirmPassword && !passwordChecks.match
                    ? "password-mismatch"
                    : ""
                }`}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && !passwordChecks.match && (
              <p className="password-mismatch-text">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spinner" size={16} />
                Resetting Password...
              </>
            ) : (
              <>
                <Save size={16} />
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className="quick-access-link">
          <a
            href="/forgot-password"
            onClick={(e) => {
              e.preventDefault();
              navigate("/forgot-password");
            }}
          >
            Request a new password reset link
          </a>
        </div>
      </div>
    </div>
  );
}

export default DirectResetPassword;
