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

  // Process the hash or code from URL
  useEffect(() => {
    const processRecoveryParameters = async () => {
      try {
        setProcessingHash(true);
        console.log("Starting to process recovery parameters");

        // Get hash and query parameters
        const hash = window.location.hash;
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const token = params.get("token");
        const type = params.get("type");

        // Collect debug info
        const info = {
          hasHash: !!hash,
          hashContainsRecovery: hash && hash.includes("recovery"),
          hasCode: !!code,
          hasToken: !!token,
          hasType: !!type,
          path: location.pathname,
          search: location.search,
        };

        setDebugInfo(info);
        console.log("Reset parameters:", info);

        // IMPORTANT: Add timeout protection to prevent hanging
        const processPromise = async () => {
          // If we have a code parameter, explicitly exchange it
          if (code) {
            console.log("Found code parameter, exchanging for session");
            try {
              const { data, error } =
                await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                console.warn("Code exchange warning:", error);
              } else {
                console.log("Code exchange successful");
                return true;
              }
            } catch (err) {
              console.warn("Code exchange error:", err);
              // Continue to next approach
            }
          }

          // Check for existing session
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn("Session check error:", error);
          } else if (data.session) {
            console.log("Found active session");
            return true;
          }

          // If we have a hash, let Supabase process it
          if (hash && hash.includes("type=recovery")) {
            console.log(
              "Found recovery hash, waiting for Supabase to process it"
            );
            // Supabase automatically processes the hash
            // Wait a moment and check session again
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const { data: refreshedData } = await supabase.auth.getSession();
            if (refreshedData.session) {
              console.log("Session established after hash processing");
              return true;
            }
          }

          // If we have a token parameter, try to use it directly
          if (token) {
            console.log("Found token parameter");
            return true;
          }

          return false;
        };

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => {
            console.log("Parameter processing timed out");
            return false;
          }, 5000)
        );

        // Race the processing against the timeout
        const validToken = await Promise.race([
          processPromise(),
          timeoutPromise,
        ]);

        if (code || hash || token) {
          // If we have any token indicator, show the form
          // Even if processing failed, the user can try to reset
          console.log("Found recovery parameters, allowing reset");
          setHasResetToken(true);
        } else {
          console.log("No valid reset parameters found");
          setHasResetToken(false);
          setError(
            "No valid password reset token found. Please request a new password reset link."
          );
        }
      } catch (error) {
        console.error("Error processing reset parameters:", error);
        setError(`Error processing reset link: ${error.message}`);
      } finally {
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
      console.log("⏳ Waiting to ensure session is ready...");

      // 🔐 Add delay and refresh session to avoid Supabase lock issues
      await new Promise((res) => setTimeout(res, 600)); // Small delay
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        throw new Error("⚠️ No valid session. Reset link may have expired.");
      }

      console.log("✅ Session confirmed. Attempting to update password...");

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("❌ Password update error:", updateError);
        throw new Error(updateError.message || "Password update failed.");
      }

      console.log("✅ Password updated. Signing out...");

      await supabase.auth.signOut();

      setIsSuccess(true);

      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
      navigate("/login?passwordChanged=true");
    } catch (err) {
      console.error("⚠️ Password reset error:", err);
      setError(
        err.message || "An error occurred while resetting your password."
      );
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
