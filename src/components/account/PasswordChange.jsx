// src/components/account/PasswordChange.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  Eye,
  EyeOff,
  CheckCircle,
  X,
  Key,
  Save,
  Loader,
  Mail,
  AlertCircle,
  Info,
} from "lucide-react";

function PasswordChange({ setError, setSuccessMessage }) {
  const { currentUser } = useAuth();
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
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // State for password validation
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [redirectTimer]);

  // Validate password as the user types
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

  // Request password reset via email
  const requestPasswordReset = async () => {
    try {
      setIsLoading(true);
      setError && setError("");

      // Get current user email
      const userEmail = currentUser?.email;
      if (!userEmail) {
        setError &&
          setError(
            "No user email found. Please try again or log out and back in."
          );
        return false;
      }

      console.log("Requesting password reset for:", userEmail);

      // Send the reset email through Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Show success message
      setSuccessMessage &&
        setSuccessMessage(
          `Password reset link sent to ${userEmail}. Please check your email to complete the process.`
        );
      setIsSuccess(true);

      return true;
    } catch (error) {
      console.error("Password reset request error:", error);
      setError &&
        setError(
          error.message ||
            "Failed to send password reset email. Please try again."
        );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Direct password change with Supabase
  const changePassword = async (e) => {
    if (e) e.preventDefault();

    // Clear messages
    setError && setError("");
    setSuccessMessage && setSuccessMessage("");

    // Validate inputs
    if (!formData.currentPassword) {
      setError && setError("Current password is required");
      return;
    }

    if (!formData.newPassword) {
      setError && setError("New password is required");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError && setError("New passwords do not match");
      return;
    }

    // Check if new password is same as current (bad practice)
    if (formData.newPassword === formData.currentPassword) {
      setError &&
        setError("New password must be different from current password");
      return;
    }

    // Ensure all password requirements are met
    const allChecksPass = Object.values(passwordChecks).every((check) => check);
    if (!allChecksPass) {
      setError && setError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Starting password change process");

      // Store email in local storage for use on login page
      localStorage.setItem("userEmail", currentUser?.email || "");

      // Step 1: Verify current password by attempting a sign-in
      console.log("Verifying current password...");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: formData.currentPassword,
      });

      if (signInError) {
        console.error("Current password validation failed:", signInError);
        setError && setError("Current password is incorrect");
        return;
      }

      console.log("Current password verified, updating password...");

      // Step 2: Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateError) {
        console.error("Password update failed:", updateError);
        throw updateError;
      }

      console.log("Password updated successfully!");

      // Set success state
      setIsSuccess(true);
      setSuccessMessage &&
        setSuccessMessage(
          "Password changed successfully. You will be redirected to login with your new password momentarily."
        );

      // Store success markers
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
      localStorage.setItem("passwordChangedEmail", currentUser.email);
      localStorage.setItem("forceLogout", "true");

      // Clear form data for security
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Wait 3 seconds then perform a complete logout and redirect
      const timer = setTimeout(() => {
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

          // 3. Use window.location for a complete page refresh
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
      setError &&
        setError(
          error.message || "Failed to change password. Please try again."
        );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle toggle between forms
  const togglePasswordForm = () => {
    setShowPasswordForm(!showPasswordForm);
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="success-message">
        <CheckCircle className="success-icon" />
        <h4>Password Change Successful!</h4>
        <p>
          Your password has been changed. You will be logged out and redirected
          to the login page to sign in with your new password.
        </p>
      </div>
    );
  }

  return (
    <div className="password-change-container">
      <h3>Change Your Password</h3>
      <p className="tab-description">
        Update your password to maintain account security
      </p>

      <div className="password-change-options">
        <div
          className={`password-change-option ${
            !showPasswordForm ? "active" : ""
          }`}
        >
          <button
            onClick={() => setShowPasswordForm(false)}
            className="option-button"
          >
            <Mail size={18} />
            <span>Reset via Email</span>
          </button>
        </div>

        <div
          className={`password-change-option ${
            showPasswordForm ? "active" : ""
          }`}
        >
          <button
            onClick={() => setShowPasswordForm(true)}
            className="option-button"
          >
            <Key size={18} />
            <span>Change Directly</span>
          </button>
        </div>
      </div>

      {!showPasswordForm ? (
        <div className="password-reset-section">
          <p>
            To reset your password, we'll send a password reset link to your
            email: <strong>{currentUser?.email}</strong>
          </p>

          <p className="reset-info">
            <Info size={16} />
            Once you receive the email, click the link to set a new password of
            your choice.
          </p>

          <button
            onClick={requestPasswordReset}
            className="reset-password-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className="spinner-sm" />
                Sending Reset Link...
              </>
            ) : (
              <>
                <Mail size={18} />
                Send Password Reset Link
              </>
            )}
          </button>
        </div>
      ) : (
        <form onSubmit={changePassword} className="password-form">
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
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                aria-label={
                  showCurrentPassword ? "Hide password" : "Show password"
                }
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
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password requirements */}
            <div className="password-requirements">
              <p className="requirements-title">Password requirements:</p>
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
            {formData.confirmPassword && !passwordChecks.match && (
              <p className="password-mismatch-text">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="change-password-button"
            disabled={
              isLoading ||
              !formData.currentPassword ||
              !Object.values(passwordChecks).every((check) => check)
            }
          >
            {isLoading ? (
              <>
                <Loader className="spinner-sm" />
                Changing Password...
              </>
            ) : (
              <>
                <Key size={18} />
                Change Password
              </>
            )}
          </button>
        </form>
      )}

      <div className="password-security-tips">
        <h4>Password Security Tips</h4>
        <ul>
          <li>
            <Key size={16} />
            <span>
              Use at least 8 characters with uppercase, lowercase, numbers, and
              special characters
            </span>
          </li>
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
        </ul>
      </div>
    </div>
  );
}

export default PasswordChange;
