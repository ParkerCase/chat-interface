// src/components/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, ArrowLeft, CheckCircle, Send } from "lucide-react";
import "./ForgotPassword.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    requestPasswordReset,
    error: authError,
    setError: setAuthError,
  } = useAuth();
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setAuthError("");

    // Validate email
    if (!email.trim()) {
      setFormError("Email is required");
      return;
    }

    try {
      setIsLoading(true);

      // Call the password reset request function
      const success = await requestPasswordReset(email);

      if (success) {
        setIsSuccess(true);
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Password reset request error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // If request was successful, show success message
  if (isSuccess) {
    return (
      <div className="forgot-password-container">
        <div className="success-message">
          <div className="success-icon-container">
            <CheckCircle className="success-icon" />
          </div>
          <h2>Check Your Email</h2>
          <p>
            If an account exists for {email}, we've sent instructions to reset
            your password. Please check your email inbox and follow the
            instructions provided.
          </p>
          <p className="email-note">
            If you don't receive an email within a few minutes, check your spam
            folder or make sure you entered the correct email address.
          </p>
          <Link to="/login" className="back-to-login-link">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <h2>Reset Password</h2>
        <p className="forgot-password-description">
          Enter your email address and we'll send you instructions to reset your
          password.
        </p>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle className="error-icon" />
            <p>{formError || authError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="forgot-password-form">
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
              disabled={isLoading}
              required
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="reset-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Sending...
              </>
            ) : (
              <>
                Send Reset Instructions
                <Send size={16} />
              </>
            )}
          </button>
        </form>

        <div className="forgot-password-footer">
          <Link to="/login" className="back-link">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
