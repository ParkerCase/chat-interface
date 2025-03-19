// src/components/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Save,
  X,
} from "lucide-react";
import "./ResetPassword.css";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  const { resetPassword, error: authError, setError: setAuthError } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Extract token from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get("token");

    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      // No token found
      setIsTokenValid(false);
    }
  }, [location]);

  // Update password validation checks on password change
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setAuthError("");

    // All validation checks should pass
    const allChecksPass = Object.values(passwordChecks).every((check) => check);

    if (!allChecksPass) {
      setFormError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);

      // Call the password reset function
      const success = await resetPassword(password, token);

      if (success) {
        setIsSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // If token is invalid, show error message
  if (!isTokenValid) {
    return (
      <div className="reset-password-container">
        <div className="token-error-message">
          <div className="error-icon-container">
            <X className="error-icon" />
          </div>
          <h2>Invalid or Expired Link</h2>
          <p>
            The password reset link is invalid or has expired. Please request a
            new password reset link.
          </p>
          <Link to="/forgot-password" className="new-request-link">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  // If reset was successful, show success message
  if (isSuccess) {
    return (
      <div className="reset-password-container">
        <div className="success-message">
          <div className="success-icon-container">
            <CheckCircle className="success-icon" />
          </div>
          <h2>Password Reset Successful</h2>
          <p>
            Your password has been reset successfully. You can now login with
            your new password.
          </p>
          <p className="redirect-note">
            You will be redirected to the login page shortly...
          </p>
          <Link to="/login" className="back-to-login-link">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <h2>Create New Password</h2>
        <p className="reset-password-description">
          Enter a new password for your account.
        </p>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle className="error-icon" />
            <p>{formError || authError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="reset-password-form">
          {/* New Password Field */}
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a new password"
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
              <p className="requirements-title">Password must contain:</p>
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
                placeholder="Confirm your password"
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
          <button type="submit" className="reset-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Resetting...
              </>
            ) : (
              <>
                Reset Password
                <Save size={16} />
              </>
            )}
          </button>
        </form>

        <div className="reset-password-footer">
          <Link to="/login" className="back-link">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
