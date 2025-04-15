// src/components/auth/ResetPasswordPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  Eye,
  EyeOff,
  CheckCircle,
  X,
  Key,
  Save,
  Lock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import "../auth.css";

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [recoveryFlow, setRecoveryFlow] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenDebugInfo, setTokenDebugInfo] = useState({});
  const [isValidating, setIsValidating] = useState(true);

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

  // CRITICAL: This effect runs once on mount to prevent the user from being
  // automatically redirected to their account when they have a reset token
  useEffect(() => {
    // Check for any type of reset flow indicators in the URL
    const params = new URLSearchParams(location.search);
    const hasResetParams =
      params.has("token") ||
      params.has("type") ||
      params.has("access_token") ||
      window.location.hash;

    if (hasResetParams) {
      // Immediately mark that we're in a recovery flow and prevent navigation
      setRecoveryFlow(true);
      localStorage.setItem("password_reset_in_progress", "true");
      console.log("Reset parameters detected in URL, enabling recovery flow");
    }

    // Remove any flags that would redirect to login
    localStorage.removeItem("passwordChanged");

    // Force logout if a user is detected during password reset
    const performInitialCheck = async () => {
      try {
        // Check if we have a session (user is logged in)
        const { data } = await supabase.auth.getSession();

        if (data?.session && hasResetParams) {
          console.log(
            "User is logged in but reset parameters detected - proceeding with reset flow"
          );
          // Don't log them out yet - we need the session for password reset
          setRecoveryFlow(true);
        }
      } catch (error) {
        console.error("Initial session check error:", error);
      }
    };

    performInitialCheck();
  }, [location.search]);

  // Validate password reset token and setup
  useEffect(() => {
    const validateResetToken = async () => {
      try {
        console.log("Starting password reset token validation");
        setIsValidating(true);
        setTokenDebugInfo({});

        // Get all possible reset parameters from URL
        const params = new URLSearchParams(location.search);
        const token = params.get("token") || "";
        const type = params.get("type") || "";
        const accessToken = params.get("access_token") || "";
        const refreshToken = params.get("refresh_token") || "";
        const hash = window.location.hash || "";

        // Debug info for troubleshooting
        const debugInfo = {
          hasToken: !!token,
          hasType: !!type,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasHash: !!hash,
        };
        setTokenDebugInfo(debugInfo);

        console.log("Reset parameters:", debugInfo);

        // Check if we have any reset token indicators
        const hasAnyToken =
          token || type === "recovery" || hash || (accessToken && refreshToken);

        if (hasAnyToken) {
          console.log("Reset token indicators found, enabling reset form");
          setHasToken(true);
          setRecoveryFlow(true);
        } else {
          console.log("No token indicators found, showing error");
          setHasToken(false);
          setRecoveryFlow(false);
        }
      } catch (error) {
        console.error("Token validation error:", error);
        setHasToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateResetToken();
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
      console.log("Submitting password change...");

      // Update password via Supabase
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      console.log("Password changed successfully");

      // Mark success
      setIsSuccess(true);

      // Force logout after password change and clean up any auth sessions
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch (logoutError) {
        console.warn("Logout after password change failed:", logoutError);
      }

      // Store information for login detection
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
      localStorage.removeItem("password_reset_in_progress");

      // Get email from session if possible for pre-filling login
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email) {
          localStorage.setItem("passwordChangedEmail", userData.user.email);
        }
      } catch (e) {
        console.error("Error getting user email:", e);
      }

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login?passwordChanged=true");
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);

      if (
        error.message.includes("session expired") ||
        error.message.includes("Invalid JWT") ||
        error.message.includes("JWTExpired")
      ) {
        setError(
          "Your password reset link has expired. Please request a new one."
        );
      } else if (error.message.includes("User not found")) {
        setError(
          "We couldn't find your account. Please request a new password reset link."
        );
      } else {
        setError(
          error.message ||
            "Failed to reset password. Please try again or request a new reset link."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state during validation
  if (isValidating) {
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

  // Show error if token is invalid
  if (!hasToken && !recoveryFlow) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="token-error">
            <div className="error-icon-container">
              <X className="error-icon" size={36} />
            </div>
            <h3>Invalid or Expired Link</h3>
            <p>
              The password reset link you clicked is invalid or has expired.
              Please request a new password reset link.
            </p>
            <div
              className="debug-info"
              style={{ fontSize: "11px", color: "#666", margin: "10px 0" }}
            >
              <p>Debug Info: {JSON.stringify(tokenDebugInfo)}</p>
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

  // Show success message after password reset
  if (isSuccess) {
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

  // Show the password reset form
  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <div className="card-header">
          <Lock size={24} />
          <h3>Create New Password</h3>
          <p>Please enter and confirm your new password below.</p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
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
                placeholder="Enter new password"
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
                placeholder="Confirm new password"
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
          <button
            type="submit"
            className="reset-button"
            disabled={
              isLoading ||
              !Object.values(passwordChecks).every((check) => check)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="spinner" size={18} />
                <span>Resetting Password...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Reset Password</span>
              </>
            )}
          </button>
        </form>

        <div className="reset-footer">
          <p>
            <a href="/forgot-password">Request a new password reset link</a> if
            you're having trouble with this one.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
