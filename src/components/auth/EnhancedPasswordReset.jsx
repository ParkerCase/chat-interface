// src/components/auth/EnhancedPasswordReset.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";
import {
  Mail,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  Info,
} from "lucide-react";
import "../auth.css";

/**
 * Enhanced password reset request component with better error handling and user feedback
 */
function EnhancedPasswordReset() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});

  const navigate = useNavigate();
  const location = useLocation();

  // Check URL parameters (e.g., from failed reset attempts)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    const errorParam = params.get("error");

    if (emailParam) {
      setEmail(emailParam);
    }

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }

    // If this is development environment, allow debug features
    if (process.env.NODE_ENV === "development") {
      setShowDebugInfo(true);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // First, verify if the email exists in the system
      const {
        data: { users },
        error: userCheckError,
      } = await supabase.auth.admin.listUsers({
        filter: {
          email: email.toLowerCase().trim(),
        },
      });

      if (userCheckError) {
        // Silent fail and continue with reset - don't reveal if email exists for security
        debugAuth.log(
          "PasswordReset",
          `Error checking for user: ${userCheckError.message}`
        );
      }

      // Record debug info for potential troubleshooting
      const debugData = {
        timestamp: new Date().toISOString(),
        userExists: users && users.length > 0,
        email: email,
        origin: window.location.origin,
      };
      setDebugInfo(debugData);

      // Send password reset email through Supabase
      debugAuth.log("PasswordReset", `Sending password reset for ${email}`);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      // Show success message
      setIsSuccess(true);

      // Log success for debugging
      debugAuth.log(
        "PasswordReset",
        `Password reset email sent successfully to ${email}`
      );
    } catch (error) {
      debugAuth.log(
        "PasswordReset",
        `Error sending reset email: ${error.message}`
      );

      // Provide user-friendly error message
      if (error.message?.includes("rate limit")) {
        setError("Too many reset attempts. Please try again later.");
      } else if (error.message?.includes("Invalid login credentials")) {
        // Generic message to avoid revealing if email exists
        setError(
          "If this email is registered, you'll receive a reset link shortly."
        );
        setIsSuccess(true); // Show success anyway for security
      } else {
        setError(`Error sending password reset email: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Account creation form
  const handleCreateAccount = () => {
    navigate("/register");
  };

  // Return to login form
  const handleBackToLogin = () => {
    navigate("/login");
  };

  if (isSuccess) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="success-message">
            <CheckCircle className="success-icon" size={48} />
            <h3>Check Your Email</h3>
            <p>We've sent a password reset link to:</p>
            <p className="email-highlight">{email}</p>
            <div className="instructions">
              <p>
                Please check your email inbox and click the link to reset your
                password.
              </p>
              <p className="note">
                If you don't see the email, check your spam/junk folder.
              </p>
            </div>
            <button onClick={handleBackToLogin} className="back-to-login">
              Return to Login
            </button>

            {showDebugInfo && (
              <div className="debug-section">
                <h4>Debug Info</h4>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <Mail size={28} className="login-icon" />
          <h2>Reset Your Password</h2>
          <p>
            Enter your email address and we'll send you a link to reset your
            password
          </p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form-fields">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="form-input"
              required
              disabled={isLoading}
            />
          </div>

          <div className="info-box">
            <Info size={18} />
            <p>
              Make sure to check your spam/junk folder if you don't see the
              reset email in your inbox.
            </p>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spinner" size={16} />
                Sending...
              </>
            ) : (
              <>
                Send Reset Link
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <a href="#" onClick={handleBackToLogin}>
              Back to Login
            </a>
          </p>
          <p>
            Don't have an account?{" "}
            <a href="#" onClick={handleCreateAccount}>
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default EnhancedPasswordReset;
