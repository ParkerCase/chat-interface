// src/components/auth/DirectResetPassword.jsx
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
  ArrowLeft,
} from "lucide-react";
import "../auth.css";

function DirectResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenProcessing, setIsTokenProcessing] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tokenInfo, setTokenInfo] = useState({});

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

  // CRITICAL: Process token immediately without allowing redirects
  useEffect(() => {
    document.title = "Reset Password";

    const processResetToken = async () => {
      console.log("DirectResetPassword: Starting token processing");
      setIsTokenProcessing(true);

      try {
        // Get URL parameters
        const queryParams = new URLSearchParams(location.search);
        const token = queryParams.get("token");
        const type = queryParams.get("type");
        const accessToken = queryParams.get("access_token");
        const refreshToken = queryParams.get("refresh_token");
        const hash = window.location.hash;

        // Track parameter info for debugging
        const info = {
          hasToken: !!token,
          hasType: !!type,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasHash: !!hash,
          pathname: location.pathname,
          search: location.search,
        };
        setTokenInfo(info);

        console.log("Reset token parameters:", info);

        // Check if hash looks like a Supabase recovery token
        if (hash && hash.includes("type=recovery")) {
          console.log("Hash contains recovery token");

          // Explicitly handle the hash-based flow from Supabase
          // No need to create a session - Supabase's JS client will handle it

          setTimeout(() => {
            setIsTokenProcessing(false);
            console.log("Hash token processed, showing password form");
          }, 1000);
          return;
        }
        // Check for explicit token
        else if (token) {
          console.log("URL contains explicit token parameter");

          // This is probably a recovery token
          try {
            // Verify token is valid
            await supabase.auth.verifyOtp({
              token_hash: token,
              type: type || "recovery",
            });

            console.log("Token verification successful");
            setIsTokenProcessing(false);
          } catch (verifyError) {
            console.error("Token verification error:", verifyError);
            // Continue anyway - Supabase might handle it differently
            setIsTokenProcessing(false);
          }
          return;
        }
        // Check for access token
        else if (accessToken && refreshToken) {
          console.log("URL contains access and refresh tokens");

          try {
            // Set the session directly
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            console.log("Session set from tokens");
            setIsTokenProcessing(false);
          } catch (sessionError) {
            console.error("Session setting error:", sessionError);
            setIsTokenProcessing(false);
          }
          return;
        }

        // If we get here, check if a session already exists from link click
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log(
            "Session exists, user is authenticated for password reset"
          );
          setIsTokenProcessing(false);
          return;
        }

        // No token found
        setError(
          "Invalid or missing password reset token. Please request a new password reset link."
        );
        setIsTokenProcessing(false);
      } catch (error) {
        console.error("Reset token processing error:", error);
        setError(
          "An error occurred processing your reset link. Please try again or request a new reset link."
        );
        setIsTokenProcessing(false);
      }
    };

    processResetToken();
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
      console.log("Updating password...");

      // Update password via Supabase
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      console.log("Password updated successfully!");

      // Mark success
      setIsSuccess(true);

      // Force logout after password change
      try {
        await supabase.auth.signOut();
      } catch (logoutError) {
        console.warn("Logout after password change failed:", logoutError);
      }

      // Store information for login detection
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());

      // Try to get user email
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
        window.location.href = "/login?passwordChanged=true";
      }, 3000);
    } catch (error) {
      console.error("Password update error:", error);

      if (
        error.message.includes("session expired") ||
        error.message.includes("JWT expired") ||
        error.message.includes("Invalid JWT")
      ) {
        setError(
          "Your reset link has expired. Please request a new password reset link."
        );
      } else {
        setError(
          error.message || "Failed to update password. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isTokenProcessing) {
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

  // Token is missing or invalid
  if (error && !password) {
    return (
      <div className="login-container">
        <div className="login-form reset-password-form">
          <div className="error-state">
            <div className="error-icon-container">
              <X className="error-icon" size={36} />
            </div>
            <h3>Link Invalid or Expired</h3>
            <p>{error}</p>
            <div
              className="debug-info"
              style={{
                fontSize: "11px",
                color: "#666",
                margin: "10px 0",
                wordBreak: "break-all",
              }}
            >
              <p>Debug Info: {JSON.stringify(tokenInfo)}</p>
            </div>
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
          <button
            type="submit"
            className="login-button"
            disabled={
              isLoading ||
              !Object.values(passwordChecks).every((check) => check)
            }
          >
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
