// src/components/auth/DirectResetPassword.jsx - FIXED VERSION
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
  const [debugInfo, setDebugInfo] = useState({});
  const [tokenType, setTokenType] = useState(null);
  const [recoveryToken, setRecoveryToken] = useState(null);

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

  // Process the hash or code from URL - FIXED for all Supabase token formats
  useEffect(() => {
    const processRecoveryParameters = async () => {
      try {
        setProcessingHash(true);
        console.log("Starting to process recovery parameters");

        // Flag to prevent navigation interruptions
        localStorage.setItem("password_reset_in_progress", "true");
        sessionStorage.setItem("password_reset_in_progress", "true");

        // Get hash and query parameters
        const hash = window.location.hash;
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const token = params.get("token");
        const type = params.get("type");
        const accessToken = params.get("access_token");

        // Collect debug info
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

        setDebugInfo(info);
        console.log("Reset parameters:", info);

        // Try each possible token type in order

        // 1. Check for code parameter (most common in newer Supabase)
        if (code) {
          console.log("Found code parameter, exchanging for session");
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(
              code
            );
            if (error) {
              console.warn("Code exchange warning:", error);
            } else {
              console.log("Code exchange successful");
              setTokenType("code");
              setRecoveryToken(code);
              setHasResetToken(true);
              setProcessingHash(false);
              return;
            }
          } catch (err) {
            console.warn("Code exchange error:", err);
            // Continue to next approach
          }
        }

        // 2. Check for hash recovery flow
        if (
          hash &&
          (hash.includes("type=recovery") || hash.includes("recovery_token"))
        ) {
          console.log("Found recovery hash");

          // Let Supabase process the hash
          try {
            // Wait a moment for Supabase to process the hash automatically
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Check if we got a session
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
              console.log("Session established via hash");
              setTokenType("hash");
              setHasResetToken(true);
              setProcessingHash(false);
              return;
            }
          } catch (err) {
            console.warn("Hash processing error:", err);
          }
        }

        // 3. Check for token parameter (older flow)
        if (token) {
          console.log("Found token parameter");
          setTokenType("token");
          setRecoveryToken(token);
          setHasResetToken(true);
          setProcessingHash(false);
          return;
        }

        // 4. Check for existing session (fallback)
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log("Found existing session that may be usable for reset");
          setTokenType("session");
          setHasResetToken(true);
          setProcessingHash(false);
          return;
        }

        // If we reached here, no valid token was found
        console.log("No valid reset parameters found");
        setHasResetToken(false);
        setError(
          "No valid password reset token found. Please request a new password reset link."
        );
        setProcessingHash(false);
      } catch (error) {
        console.error("Error processing reset parameters:", error);
        setError(`Error processing reset link: ${error.message}`);
        setProcessingHash(false);
      }
    };

    processRecoveryParameters();
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

  // Handle form submission - FIXED to handle all token types
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
      console.log(`Attempting password reset with token type: ${tokenType}`);

      // Different approaches based on token type
      let success = false;

      // For code or hash-based flows, we should already have a session
      if (
        tokenType === "code" ||
        tokenType === "hash" ||
        tokenType === "session"
      ) {
        console.log("Using session-based password update");

        // Ensure we have a session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          throw new Error(
            "No valid session. Reset link may have expired. Please request a new one."
          );
        }

        // Update password using session
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) {
          throw updateError;
        }

        success = true;
      }
      // Token-based flow (older method)
      else if (tokenType === "token" && recoveryToken) {
        console.log("Using direct token-based password reset");

        // Use recovery token directly
        const { error: recoveryError } = await supabase.auth.verifyOtp({
          token_hash: recoveryToken,
          type: "recovery",
        });

        if (recoveryError) {
          throw recoveryError;
        }

        // After verification, update password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) {
          throw updateError;
        }

        success = true;
      }

      if (success) {
        console.log("Password updated successfully");

        // Clear reset state
        localStorage.removeItem("password_reset_in_progress");
        sessionStorage.removeItem("password_reset_in_progress");

        // Sign out from all devices for security
        await supabase.auth.signOut({ scope: "global" });

        // Set flags for login page
        localStorage.setItem("passwordChanged", "true");
        localStorage.setItem("passwordChangedAt", new Date().toISOString());

        // Get email if available
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.email) {
            localStorage.setItem("passwordChangedEmail", userData.user.email);
          }
        } catch (e) {
          console.error("Error getting user email:", e);
        }

        setIsSuccess(true);

        // Redirect to login after short delay
        setTimeout(() => {
          navigate("/login?passwordChanged=true", { replace: true });
        }, 2000);
      } else {
        throw new Error("Failed to update password. Please try again.");
      }
    } catch (err) {
      console.error("Password reset error:", err);

      if (
        err.message?.includes("session expired") ||
        err.message?.includes("JWT expired") ||
        err.message?.includes("invalid token")
      ) {
        setError(
          "Your password reset link has expired. Please request a new one."
        );
      } else {
        setError(
          err.message ||
            "An error occurred. Please try again or request a new reset link."
        );
      }
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
            <div className="debug-info">
              <p>Debug Info: {JSON.stringify(debugInfo)}</p>
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
