// src/components/account/PasswordChange.jsx - FIXED VERSION
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase, enhancedAuth } from "../../lib/supabase";
import { Eye, EyeOff, CheckCircle, X, Key, Save, Loader } from "lucide-react";

function PasswordChange({ setError, setSuccessMessage }) {
  const { changePassword, currentUser } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectTimer, setRedirectTimer] = useState(null);

  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  // Clear redirect timer when component unmounts
  useEffect(() => {
    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [redirectTimer]);

  // Update password validation checks on password changes
  useEffect(() => {
    setPasswordChecks({
      length: formData.newPassword.length >= 8,
      uppercase: /[A-Z]/.test(formData.newPassword),
      lowercase: /[a-z]/.test(formData.newPassword),
      number: /[0-9]/.test(formData.newPassword),
      special: /[^A-Za-z0-9]/.test(formData.newPassword),
      match:
        formData.newPassword === formData.confirmPassword &&
        formData.newPassword !== "",
    });
  }, [formData.newPassword, formData.confirmPassword]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear any previous error and success messages
    setError("");
    setSuccessMessage("");

    // Validate inputs
    if (!formData.currentPassword) {
      setError("Current password is required");
      return;
    }

    if (!formData.newPassword) {
      setError("New password is required");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    // Check if new password is same as current (bad practice)
    if (formData.newPassword === formData.currentPassword) {
      setError("New password must be different from current password");
      return;
    }

    // Ensure all password requirements are met
    const allChecksPass = Object.values(passwordChecks).every((check) => check);
    if (!allChecksPass) {
      setError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Starting password change process");

      // Step 1: Validate current password using Supabase
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        console.error("Current password validation failed:", signInError);
        setError("Current password is incorrect");
        setIsLoading(false);
        return;
      }

      console.log("Current password validated successfully");

      // Step 2: Update password with enhanced auth for better reliability
      try {
        console.log("Updating password with enhanced auth client");
        const { data, error } = await enhancedAuth.updateUser({
          password: formData.newPassword,
        });

        if (error) {
          console.error("Enhanced auth password update failed:", error);
          throw error;
        }

        console.log("Password updated successfully with enhanced auth");
      } catch (enhancedAuthError) {
        console.warn(
          "Enhanced auth failed, falling back to standard method:",
          enhancedAuthError
        );

        // Fallback to standard Supabase auth
        const { error: standardError } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });

        if (standardError) {
          console.error("Standard password update failed:", standardError);
          throw standardError;
        }

        console.log("Password updated successfully with standard auth");
      }

      // Step 3: Set success state and prepare persistent flags for the redirect flow
      setIsSuccess(true);
      console.log("Password change successful, preparing for redirect");

      // Store important flags for login page to detect password change
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
      localStorage.setItem("passwordChangedEmail", currentUser.email);

      // Show success message
      setSuccessMessage(
        "Password changed successfully. You will be redirected to login with your new password momentarily."
      );

      // Clear form data for security
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Step 4: Force logout and redirect with reliable approach
      const timer = setTimeout(() => {
        console.log("Executing redirect after password change");

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

          // 3. Use window.location for a complete page refresh to ensure clean state
          window.location.href = "/login?passwordChanged=true";
        } catch (redirectError) {
          console.error("Error during redirect:", redirectError);
          // Fallback direct navigation as last resort
          window.location.replace("/login?passwordChanged=true");
        }
      }, 3000);

      // Store timer reference for cleanup
      setRedirectTimer(timer);
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.message || "Failed to change password. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="password-change-container">
      <h3>Change Password</h3>
      <p className="tab-description">
        Update your password to maintain account security
      </p>

      <form onSubmit={handleSubmit} className="password-change-form">
        {/* Current Password */}
        <div className="form-group">
          <label htmlFor="currentPassword">Current Password</label>
          <div className="password-input-wrapper">
            <input
              type={showCurrentPassword ? "text" : "password"}
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleInputChange}
              className="form-input"
              disabled={isLoading || isSuccess}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              aria-label={
                showCurrentPassword ? "Hide password" : "Show password"
              }
              disabled={isLoading || isSuccess}
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="form-group">
          <label htmlFor="newPassword">New Password</label>
          <div className="password-input-wrapper">
            <input
              type={showNewPassword ? "text" : "password"}
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              className="form-input"
              disabled={isLoading || isSuccess}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowNewPassword(!showNewPassword)}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
              disabled={isLoading || isSuccess}
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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

        {/* Confirm Password */}
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm New Password</label>
          <div className="password-input-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`form-input ${
                formData.confirmPassword && !passwordChecks.match
                  ? "password-mismatch"
                  : ""
              }`}
              disabled={isLoading || isSuccess}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
              disabled={isLoading || isSuccess}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formData.confirmPassword && !passwordChecks.match && (
            <p className="password-mismatch-text">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          className="password-change-button"
          disabled={
            isLoading ||
            isSuccess ||
            !Object.values(passwordChecks).every((check) => check)
          }
        >
          {isLoading ? (
            <>
              <Loader className="spinner-sm" />
              <span>Changing Password...</span>
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle size={18} />
              <span>Password Changed!</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Change Password</span>
            </>
          )}
        </button>
      </form>

      {isSuccess && (
        <div className="success-message">
          <CheckCircle className="success-icon" />
          <p>Password changed successfully! Redirecting to login page...</p>
        </div>
      )}

      <div className="password-security-tips">
        <h4>Password Security Tips</h4>
        <ul>
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
          <li>
            <Key size={16} />
            <span>
              Change your password regularly, especially if you suspect your
              account has been compromised
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default PasswordChange;
