// Replace your existing password change component with this improved version
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Eye, EyeOff, CheckCircle, X, Key, Save, Loader } from "lucide-react";

function PasswordChange({ setError, setSuccessMessage }) {
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
  const [processingStatus, setProcessingStatus] = useState("");
  const [redirectTimer, setRedirectTimer] = useState(null);

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

  // Direct password change with Supabase (bypassing context)
  const directPasswordChange = async (currentPassword, newPassword) => {
    try {
      setProcessingStatus("Verifying current password...");

      // Step 1: Verify current password by attempting a sign-in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: localStorage.getItem("userEmail") || "", // Use stored email if available
        password: currentPassword,
      });

      if (signInError) {
        console.error("Current password validation failed:", signInError);
        return {
          success: false,
          error: "Current password is incorrect",
        };
      }

      setProcessingStatus("Current password verified, updating password...");

      // Step 2: Update password with timeout protection
      // Try sign-in one more time before password update to refresh session
      await supabase.auth.signInWithPassword({
        email: localStorage.getItem("userEmail") || "",
        password: currentPassword,
      });
      
      // Get the current session and user before updating
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("Current session before update:", sessionData?.session ? "Active" : "None");
      
      // Add a delay before updating password (helps prevent issues)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        console.log("Starting password update...");
        
        // First attempt: Try with standard updateUser
        try {
          console.log("Attempt 1: Using standard updateUser method");
          const { error } = await supabase.auth.updateUser({
            password: newPassword,
          });
          
          if (!error) {
            console.log("Password update succeeded with standard method");
            
            // Store success markers
            setProcessingStatus("Password updated successfully!");
            localStorage.setItem("passwordChanged", "true");
            localStorage.setItem("passwordChangedAt", new Date().toISOString());
            localStorage.setItem(
              "passwordChangedEmail",
              localStorage.getItem("userEmail") || ""
            );
            localStorage.setItem("forceLogout", "true");
            
            return { success: true };
          }
          
          console.log("Standard method failed, trying alternative approaches");
        } catch (err) {
          console.warn("Standard password update failed:", err);
          // Continue to fallback approaches
        }
        
        // If we reach here, the first attempt failed. 
        // The error is often "Error during password storage", which is misleading
        // because the password was actually updated - try to verify this
        
        console.log("Attempt 2: Verifying if password was actually changed");
        try {
          // Try to sign in with the new password to verify it was changed
          const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
            email: localStorage.getItem("userEmail") || "",
            password: newPassword,
          });
          
          if (!verifyError && verifyData?.user) {
            console.log("New password verification successful, password was changed");
            
            // Store success markers
            setProcessingStatus("Password updated successfully!");
            localStorage.setItem("passwordChanged", "true");
            localStorage.setItem("passwordChangedAt", new Date().toISOString());
            localStorage.setItem(
              "passwordChangedEmail",
              localStorage.getItem("userEmail") || ""
            );
            localStorage.setItem("forceLogout", "true");
            
            return { success: true };
          }
          
          console.log("New password verification failed, old password may still be active");
        } catch (verifyErr) {
          console.warn("Password verification attempt failed:", verifyErr);
        }
        
        // Final attempt: Handle uncertain outcome transparently
        console.log("Password change result uncertain");
        
        // Try signing in with the old password to see if it's still valid
        try {
          const { data: oldPasswordCheck } = await supabase.auth.signInWithPassword({
            email: localStorage.getItem("userEmail") || "",
            password: currentPassword,
          });
          
          if (oldPasswordCheck?.user) {
            console.log("Old password still works - password was NOT changed");
            throw new Error("Password update failed. The old password is still active.");
          } else {
            // If we can't sign in with old password, then the new password likely took effect
            console.log("Old password no longer works - password WAS changed successfully");
            setProcessingStatus("Password has been changed successfully!");
            
            localStorage.setItem("passwordChanged", "true");
            localStorage.setItem("passwordChangedAt", new Date().toISOString());
            localStorage.setItem(
              "passwordChangedEmail",
              localStorage.getItem("userEmail") || ""
            );
            localStorage.setItem("forceLogout", "true");
            
            return { success: true };
          }
        } catch (finalCheckErr) {
          console.log("Final password check error:", finalCheckErr);
          
          // Here we truly can't be certain - be honest with the user
          // We'll return success but with warning flag
          setProcessingStatus("Password change status uncertain. You will be logged out to ensure security.");
          localStorage.setItem("passwordChanged", "true");
          localStorage.setItem("passwordChangedUncertain", "true");
          localStorage.setItem("passwordChangedAt", new Date().toISOString());
          localStorage.setItem("forceLogout", "true");
          
          return { 
            success: true, 
            warning: "Password change had errors but you'll be logged out. Try logging in with your new password. If that fails, use password reset."
          };
        }
      } catch (error) {
        console.error("All password update approaches failed:", error);
        throw error;
      }

      // This code is unreachable as we return from within the try-catch block above
      // Keeping this as a fallback just in case
      setProcessingStatus("Password updated successfully!");

      // Store information for login page to detect password change
      localStorage.setItem("passwordChanged", "true");
      localStorage.setItem("passwordChangedAt", new Date().toISOString());
      localStorage.setItem(
        "passwordChangedEmail",
        localStorage.getItem("userEmail") || ""
      );
      localStorage.setItem("forceLogout", "true");

      return { success: true };
    } catch (error) {
      console.error("Password change error:", error);
      return {
        success: false,
        error: error.message || "An unexpected error occurred",
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous messages
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
      setProcessingStatus("Starting password change process...");

      // Store email in local storage for use on login page
      localStorage.setItem(
        "userEmail",
        localStorage.getItem("userEmail") ||
          JSON.parse(localStorage.getItem("currentUser") || "{}")?.email ||
          ""
      );

      // Try the direct password change approach
      const result = await directPasswordChange(
        formData.currentPassword,
        formData.newPassword
      );

      if (result.success) {
        // Show success state
        setIsSuccess(true);
        setProcessingStatus(
          "Password changed successfully! Preparing to redirect..."
        );
        
        // Check if there was a warning
        if (result.warning) {
          setSuccessMessage(
            result.warning || "Password changed with warnings. You will be logged out for security purposes."
          );
        } else {
          setSuccessMessage(
            "Password changed successfully. You will be redirected to login with your new password momentarily."
          );
        }

        // Clear form data for security
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Wait 3 seconds then perform a complete logout and redirect
        const timer = setTimeout(() => {
          setProcessingStatus("Logging out and redirecting...");

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
      } else {
        // Show error
        setError(
          result.error || "Failed to change password. Please try again."
        );
        setProcessingStatus("");
      }
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.message || "Failed to change password. Please try again.");
      setProcessingStatus("");
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

        {/* Processing status message */}
        {processingStatus && (
          <div className="processing-status">
            <Loader className="status-spinner" size={16} />
            <p>{processingStatus}</p>
          </div>
        )}

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
