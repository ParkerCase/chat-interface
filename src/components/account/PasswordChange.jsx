// src/components/account/PasswordChange.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Eye, EyeOff, CheckCircle, X, Key, Save, Loader } from "lucide-react";

function PasswordChange({ setError, setSuccessMessage }) {
  const { changePassword } = useAuth();

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
    
    // Step 1: Comprehensive input validation
    
    // Check for empty current password
    if (!formData.currentPassword) {
      setError("Current password is required");
      return;
    }

    // Check for empty new password
    if (!formData.newPassword) {
      setError("New password is required");
      return;
    }
    
    // Ensure all password requirements are met with detailed feedback
    const failedChecks = Object.entries(passwordChecks)
      .filter(([_, isPassing]) => !isPassing)
      .map(([checkName, _]) => {
        switch (checkName) {
          case 'length': return 'must be at least 8 characters';
          case 'uppercase': return 'must include at least one uppercase letter';
          case 'lowercase': return 'must include at least one lowercase letter';
          case 'number': return 'must include at least one number';
          case 'special': return 'must include at least one special character';
          case 'match': return 'passwords must match';
          default: return checkName;
        }
      });
    
    if (failedChecks.length > 0) {
      setError(`Password ${failedChecks.join(', ')}`);
      return;
    }

    // Ensure passwords match (double check even though it's in passwordChecks)
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
      // Step 2: UI preparation for password change
      setIsLoading(true);
      setIsSuccess(false);
      
      console.log("Password change initiated");

      // Set audit flags for tracking the operation
      localStorage.setItem("passwordChangeAttempt", "true");
      localStorage.setItem("passwordChangeStartTime", Date.now().toString());

      // Step 3: Execute the password change operation
      console.log("Calling password change function");
      const success = await changePassword(
        formData.currentPassword,
        formData.newPassword
      );
      console.log("Password change result:", success);

      if (success) {
        // Step 4: Handle successful password change with GUARANTEED success approach
        console.log("Password change successful - implementing foolproof approach");
        
        // Update UI state
        setIsSuccess(true);
        setSuccessMessage("Password changed successfully!");
        
        // Clear sensitive form data
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        
        // Store the new credentials in session storage for auto-login (CRITICAL FIX)
        sessionStorage.setItem("temp_password", newPassword);
        sessionStorage.setItem("temp_email", currentUser?.email || "");
        
        // DIRECT APPROACH: Instead of counting down, immediately force a full page reload
        // This is the most reliable way to clear all Supabase state
        setSuccessMessage("Password changed successfully! Page will refresh to apply changes...");
        
        // First, ensure complete cache/storage clearing
        console.log("Performing radical cleanup of all browser storage");
        
        // Clear ALL browser storage (this is the most reliable approach)
        localStorage.clear();
        sessionStorage.clear();
        
        try {
          // Try to clear all cookies too (belt and suspenders approach)
          document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });
        } catch (e) {
          console.warn("Cookie clear attempt failed (non-critical):", e);
        }
        
        // Store minimal recovery information
        localStorage.setItem("passwordChanged", "true");
        localStorage.setItem("passwordChangedAt", Date.now().toString());
        localStorage.setItem("passwordChangedEmail", currentUser?.email || "");
        sessionStorage.setItem("temp_password", newPassword);
        sessionStorage.setItem("temp_email", currentUser?.email || "");
        
        // Force a complete page reload after a short delay
        setTimeout(() => {
          // Use the most radical approach: window.location.reload(true) forces a bypass of the cache
          console.log("EXECUTING COMPLETE BROWSER REFRESH");
          
          // Rather than redirecting to login directly, use a special recovery page
          window.location.href = "/login?pw_reset=true&t=" + Date.now();
        }, 1500);
        
        // Set a failsafe timeout with last-resort approach
        setTimeout(() => {
          console.log("EXECUTING FAILSAFE REDIRECT");
          window.location.href = "/login?pw_reset=true&failsafe=true&t=" + Date.now();
        }, 3000);
      } else {
        // Handle generic failure
        console.log("Password change returned failure");
        setError("Failed to change password. Please try again.");
      }
    } catch (error) {
      // Step 5: Comprehensive error handling with user-friendly messages
      console.error("Password change error caught:", error);
      
      // Map error messages to user-friendly text
      if (error.message) {
        if (error.message.includes("incorrect") || error.message.includes("wrong password")) {
          setError("Your current password is incorrect");
        } else if (error.message.includes("authentication") || error.message.includes("auth")) {
          setError("Authentication failed. Please try logging in again.");
        } else if (error.message.includes("network") || error.message.includes("connection")) {
          setError("Network error. Please check your internet connection and try again.");
        } else if (error.message.includes("weak")) {
          setError("Your new password is too weak. Please choose a stronger password.");
        } else if (error.message.includes("permission") || error.message.includes("access")) {
          setError("You don't have permission to change your password. Please contact an administrator.");
        } else if (error.message.includes("timeout")) {
          setError("Request timed out. Please try again.");
        } else {
          // Use the error message directly if it's user-friendly
          setError(error.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again later.");
      }
    } finally {
      // Step 6: Cleanup regardless of outcome
      setIsLoading(false);
      localStorage.removeItem("passwordChangeAttempt");
      console.log("Password change operation completed");
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
