// src/components/auth/DirectInvitationHandler.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";
import "../auth.css";

function DirectInvitationHandler() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const navigate = useNavigate();

  // Check for existing session on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log("Checking session for invitation flow");

        // Check if we have a valid session
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          console.log("Valid session found for invitation");

          // Get user email
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.email) {
            setUserEmail(userData.user.email);
            console.log("User email:", userData.user.email);
          }
        } else {
          console.log("No valid session for invitation");
          setError(
            "Invalid or expired invitation link. Please request a new invitation."
          );
        }
      } catch (err) {
        console.error("Error checking session:", err);
        setError("Error processing invitation");
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Handle form submission
  const handleSetPassword = async (e) => {
    e.preventDefault();

    // Validate passwords
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      console.log("Setting password for invited user");

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      console.log("Password set successfully");
      setSuccess(true);

      // Redirect to admin page after a short delay
      setTimeout(() => {
        navigate("/admin", { replace: true });
      }, 2000);
    } catch (err) {
      console.error("Password set error:", err);
      setError(err.message || "Failed to set password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="loading-state">
            <Loader2 className="spinner" size={36} />
            <h3>Processing Invitation</h3>
            <p>Please wait while we process your invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="success-message">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={48} />
            </div>
            <h3>Account Setup Complete!</h3>
            <p>Your password has been set successfully.</p>
            <p className="redirect-message">Redirecting to your account...</p>
            <div className="loading-indicator">
              <Loader2 className="spinner" size={24} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show password set form
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <User size={28} className="auth-icon" />
          <h2>Complete Your Account Setup</h2>
          <p>Please create a password for your account.</p>
          {userEmail && <p className="email-display">Email: {userEmail}</p>}
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSetPassword} className="login-form-fields">
          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Create Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="form-input"
                disabled={isSubmitting}
                required
                minLength={8}
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
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className={`form-input ${
                  confirmPassword && password !== confirmPassword
                    ? "password-mismatch"
                    : ""
                }`}
                disabled={isSubmitting}
                required
                minLength={8}
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
            {confirmPassword && password !== confirmPassword && (
              <p className="password-mismatch-text">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="spinner" size={16} />
                Setting Password...
              </>
            ) : (
              "Set Password & Complete Setup"
            )}
          </button>
        </form>

        {/* Password Requirements */}
        <div className="password-info">
          <h4>Password Requirements:</h4>
          <ul>
            <li>At least 8 characters long</li>
            <li>Include uppercase and lowercase letters</li>
            <li>Include at least one number</li>
            <li>Include at least one special character</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DirectInvitationHandler;
