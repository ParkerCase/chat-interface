// src/components/Register.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
  X,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import "./Register.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });
  const [isCodeRequired, setIsCodeRequired] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const { register, error: authError, setError: setAuthError } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Parse invite code from URL if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl) {
      setInviteCode(codeFromUrl);
    }

    // Check if invite code is required - would normally come from an API
    // For this example, we'll set it based on an env variable
    // In reality, you'd fetch this from the server
    setIsCodeRequired(process.env.REACT_APP_REQUIRE_INVITATION === "true");
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

    // Validate input
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }

    if (!email.trim()) {
      setFormError("Email is required");
      return;
    }

    // Additional email validation
    if (!validateEmail(email)) {
      setFormError("Please enter a valid email address");
      return;
    }

    // Validate invite code if required
    if (isCodeRequired && !inviteCode.trim()) {
      setFormError("Invitation code is required");
      return;
    }

    try {
      setIsLoading(true);

      // Prepare registration data
      const userData = {
        name: name.trim(),
        email: email.trim(),
        password,
        inviteCode: inviteCode.trim() || undefined,
      };

      const result = await register(userData);

      if (result && result.success) {
        setRegistrationSuccess(true);

        // If email verification is required, show success message
        // Otherwise, redirect to login
        if (!result.requiresEmailVerification) {
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate("/login");
          }, 3000);
        }
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to validate email
  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  // If registration was successful, show success message
  if (registrationSuccess) {
    return (
      <div className="register-container">
        <div className="register-success-card">
          <div className="success-icon-container">
            <CheckCircle className="success-icon" />
          </div>
          <h2>Registration Successful!</h2>

          <p>
            Your account has been created successfully.
            {process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION === "true"
              ? " Please check your email to verify your account before logging in."
              : " You will be redirected to the login page shortly."}
          </p>

          <Link to="/login" className="success-login-link">
            Go to Login
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <UserPlus className="register-icon" />
          <h2>Create Account</h2>
          <p>Fill in the details below to create your account</p>
        </div>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle className="error-icon" />
            <p>{formError || authError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          {/* Name Field */}
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="form-input"
              disabled={isLoading}
              required
            />
          </div>

          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="form-input"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="form-input"
                autoComplete="new-password"
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
                autoComplete="new-password"
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

          {/* Invitation Code Field (shown if required or present in URL) */}
          {(isCodeRequired || inviteCode) && (
            <div className="form-group">
              <label htmlFor="invite-code">
                Invitation Code
                {isCodeRequired && (
                  <span className="required-indicator">*</span>
                )}
              </label>
              <input
                type="text"
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invitation code"
                className="form-input"
                disabled={
                  isLoading ||
                  (!!inviteCode && inviteCode === location.search.get("code"))
                }
                required={isCodeRequired}
              />
              {!isCodeRequired && (
                <p className="invite-code-hint">
                  If you don't have an invitation code, leave this field empty
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Creating Account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="register-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
