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
  const [hasToken, setHasToken] = useState(false);

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

  // Check for token in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasRecoveryToken = params.has("token") || params.has("type");
    setHasToken(hasRecoveryToken);

    if (!hasRecoveryToken) {
      setError(
        "Invalid or missing password reset token. Please request a new password reset link."
      );
    }
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

    // Validate password
    const allChecksPass = Object.values(passwordChecks).every((check) => check);
    if (!allChecksPass) {
      setError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);

      // Update password via Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // Mark success
      setIsSuccess(true);

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show success message
  if (isSuccess) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="success-message">
            <CheckCircle size={48} className="success-icon" />
            <h2>Password Reset Successful!</h2>
            <p>Your password has been changed successfully.</p>
            <p>You will be redirected to the homepage shortly...</p>
            <button onClick={() => navigate("/")} className="primary-button">
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show main form
  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <div className="card-header">
          <Lock size={24} />
          <h2>Create New Password</h2>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        {!hasToken ? (
          <div className="token-error">
            <p>
              No valid reset token found. Please request a new password reset
              link.
            </p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="secondary-button"
            >
              Request New Link
            </button>
          </div>
        ) : (
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
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
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
                  <span className="spinner"></span>
                  Resetting Password...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Reset Password
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
