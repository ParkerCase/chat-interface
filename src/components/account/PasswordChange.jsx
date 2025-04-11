// src/components/account/PasswordChange.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
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

  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

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

    try {
      setIsLoading(true);

      console.log("Initiating password change");
      const success = await changePassword(
        formData.currentPassword,
        formData.newPassword
      );

      if (success) {
        console.log("Password change successful");
        setSuccessMessage("Password changed successfully!");

        // Clear form data for security
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Set flags for post-password-change handling
        localStorage.setItem("passwordChanged", "true");

        // Alert the user that they'll need to log in again
        setSuccessMessage(
          "Password changed successfully. Please log in again with your new password."
        );

        // Redirect to login after a delay
        setTimeout(() => {
          // Force logout and redirect to login
          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          sessionStorage.clear();
          window.location.href = "/login?pw_changed=true";
        }, 3000);
      }
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.message || "Failed to change password. Please try again.");
    } finally {
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
              disabled={isLoading}
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
              disabled={isLoading}
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

        <button
          type="submit"
          className="password-change-button"
          disabled={
            isLoading || !Object.values(passwordChecks).every((check) => check)
          }
        >
          {isLoading ? (
            <>
              <span className="spinner-sm"></span>
              Changing Password...
            </>
          ) : (
            <>
              <Save size={18} />
              Change Password
            </>
          )}
        </button>
      </form>

      {isSuccess && (
        <div className="success-message">
          <CheckCircle className="success-icon" />
          <p>Password changed successfully!</p>
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
