// src/components/auth/InvitationHandler.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import {
  Key,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ArrowRight,
} from "lucide-react";
import "../auth.css";

/**
 * Handles the flow when a user clicks an invitation link from Supabase
 */
function InvitationHandler() {
  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [processingInvitation, setProcessingInvitation] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  // Password validation
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Validate password when it changes
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

  // Process the invitation when component mounts
  useEffect(() => {
    const processInvitation = async () => {
      try {
        setProcessingInvitation(true);
        debugAuth.log("InvitationHandler", "Processing invitation link");

        // Get parameters from URL
        const params = new URLSearchParams(location.search);
        const inviteToken =
          params.get("token") || params.get("invitation_token");
        const inviteCode = params.get("code");
        const inviteType = params.get("type");

        // If hash contains token, extract it
        let hashToken = null;
        if (window.location.hash) {
          const hashParams = new URLSearchParams(
            window.location.hash.substring(1)
          );
          if (hashParams.get("token")) {
            hashToken = hashParams.get("token");
          }
        }

        // Check for any type of token
        const token = inviteToken || inviteCode || hashToken;

        if (!token) {
          throw new Error("No invitation token found in URL");
        }

        // Get user email from token (depends on token type)
        let userEmail = "";
        if (inviteCode) {
          // Try to get session from code
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            inviteCode
          );

          if (error) {
            debugAuth.log(
              "InvitationHandler",
              `Code exchange error: ${error.message}`
            );
            // Continue anyway, we'll try other methods
          } else if (data?.session?.user?.email) {
            userEmail = data.session.user.email;
            debugAuth.log(
              "InvitationHandler",
              `Got email from session: ${userEmail}`
            );
          }
        }

        // If we couldn't get email from session, try token
        if (!userEmail) {
          try {
            // This is a more direct approach to get info from the token
            const tokenData = JSON.parse(atob(token.split(".")[1]));
            if (tokenData.email) {
              userEmail = tokenData.email;
              debugAuth.log(
                "InvitationHandler",
                `Got email from token: ${userEmail}`
              );
            }
          } catch (e) {
            debugAuth.log(
              "InvitationHandler",
              `Error parsing token: ${e.message}`
            );
            // Unable to parse token, continue with flow
          }
        }

        // Store email for the form
        if (userEmail) {
          setEmail(userEmail);
        }

        // Set flag to indicate we're handling invitation
        localStorage.setItem("invitation_flow", "true");

        debugAuth.log(
          "InvitationHandler",
          "Invitation processing complete, ready for password setup"
        );
        setProcessingInvitation(false);
      } catch (error) {
        debugAuth.log(
          "InvitationHandler",
          `Error processing invitation: ${error.message}`
        );
        setError(error.message || "Error processing invitation link");
        setProcessingInvitation(false);
      } finally {
        setIsLoading(false);
      }
    };

    processInvitation();
  }, [location]);

  // Handle password submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate password
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!Object.values(passwordChecks).every((check) => check)) {
      setError("Please ensure all password requirements are met");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      debugAuth.log("InvitationHandler", "Setting password for invited user");

      // Update user password via Supabase
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      // Success!
      setIsSuccess(true);
      debugAuth.log("InvitationHandler", "Password set successfully");

      // Store in localStorage for other components to detect
      localStorage.setItem("invitation_complete", "true");

      // Clear invitation flow flag
      localStorage.removeItem("invitation_flow");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login?setup=complete");
      }, 3000);
    } catch (error) {
      debugAuth.log(
        "InvitationHandler",
        `Error setting password: ${error.message}`
      );
      setError(error.message || "Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (processingInvitation) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="loading-state">
            <Loader2 className="spinner" size={36} />
            <h3>Processing Invitation</h3>
            <p>Please wait while we set up your account...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="success-message">
            <CheckCircle className="success-icon" size={48} />
            <h3>Account Setup Complete!</h3>
            <p>Your password has been set successfully.</p>
            <p>You can now log in with your email and new password.</p>
            <p className="redirect-message">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show password creation form
  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <Lock className="login-icon" size={28} />
          <h2>Complete Your Account Setup</h2>
          {email && <p>Please create a password for {email}</p>}
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-fields">
          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Create Password</label>
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
                    <AlertCircle size={14} />
                  )}
                  <span>At least 8 characters</span>
                </li>
                <li className={passwordChecks.uppercase ? "passed" : ""}>
                  {passwordChecks.uppercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  <span>At least one uppercase letter</span>
                </li>
                <li className={passwordChecks.lowercase ? "passed" : ""}>
                  {passwordChecks.lowercase ? (
                    <CheckCircle size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  <span>At least one lowercase letter</span>
                </li>
                <li className={passwordChecks.number ? "passed" : ""}>
                  {passwordChecks.number ? (
                    <CheckCircle size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  <span>At least one number</span>
                </li>
                <li className={passwordChecks.special ? "passed" : ""}>
                  {passwordChecks.special ? (
                    <CheckCircle size={14} />
                  ) : (
                    <AlertCircle size={14} />
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
          <button
            type="submit"
            className="login-button"
            disabled={
              isLoading ||
              !passwordChecks.match ||
              !Object.values(passwordChecks).every((check) => check)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="spinner" size={16} />
                Setting Password...
              </>
            ) : (
              <>
                Complete Setup
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default InvitationHandler;
