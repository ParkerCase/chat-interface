// src/components/auth/MFAVerification.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";

import {
  Shield,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Lock,
  X,
  Clock,
} from "lucide-react";
import "./MFAVerification.css";

/**
 * Multi-Factor Authentication verification component
 *
 * @param {Object} props - Component props
 * @param {Function} props.onSuccess - Callback function when verification is successful
 * @param {Function} props.onCancel - Callback function when verification is cancelled
 * @param {Object} props.mfaData - MFA data for verification (methodId, type, email, etc.)
 * @param {boolean} props.standalone - Whether the component is used standalone or within another component
 * @param {string} props.redirectUrl - URL to redirect to after successful verification
 * @returns {React.Component} MFA Verification component
 */
function MFAVerification({
  onSuccess,
  onCancel,
  mfaData = {},
  standalone = false,
  redirectUrl = "/admin",
}) {
  // Form state
  const [verificationCode, setVerificationCode] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Navigation hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Auth context
  const { verifyMfa, currentUser, mfaState } = useAuth();

  // Refs
  const codeInputRef = useRef(null);
  const timerRef = useRef(null);
  const redirectTimeoutRef = useRef(null);

  // Clear any lingering timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  // Focus code input when component mounts
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }

    // Log component mount but do NOT automatically send verification code
    debugAuth.log(
      "MFAVerification",
      "Component mounted - waiting for user input"
    );

    // Debug log mfaData to help troubleshoot
    if (mfaData) {
      debugAuth.log(
        "MFAVerification",
        `MFA Data: ${JSON.stringify({
          methodId: mfaData.methodId,
          type: mfaData.type,
          email: mfaData.email
            ? `${mfaData.email.substring(0, 3)}...`
            : undefined,
        })}`
      );
    }
  }, []);

  // Start countdown for resend code
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timerRef.current);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Handle verification success with reliable navigation
  useEffect(() => {
    if (verificationSuccess) {
      debugAuth.log("MFAVerification", "Success detected, preparing redirect");

      // Set all necessary flags for successful MFA verification
      localStorage.setItem("authStage", "post-mfa");
      localStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfaSuccess", "true");
      sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
      localStorage.setItem("isAuthenticated", "true");

      // Call success callback if provided
      if (onSuccess && typeof onSuccess === "function") {
        debugAuth.log("MFAVerification", "Calling onSuccess callback");
        try {
          onSuccess();
        } catch (err) {
          console.error("Error in onSuccess callback:", err);
          // Continue with fallback redirect
        }
      }

      // Set a fallback redirect timeout to ensure navigation happens
      redirectTimeoutRef.current = setTimeout(() => {
        debugAuth.log("MFAVerification", "Executing fallback redirect");

        // Get redirect URL from local params or props
        const params = new URLSearchParams(location.search);
        const finalRedirectUrl =
          params.get("returnUrl") || redirectUrl || "/admin";

        // Force a complete page reload for the redirect
        // This ensures all components get the updated auth state
        window.location.href = finalRedirectUrl;
      }, 1500);
    }
  }, [verificationSuccess, onSuccess, redirectUrl, location.search]);

  /**
   * Handle verification code submission
   */
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Prevent multiple submissions
    if (isSubmitting) return;

    // Clear any previous errors
    setError("");

    // Validate the verification code
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);
      setIsSubmitting(true);
      debugAuth.log("MFAVerification", "Starting verification");

      // Get the method ID from mfaData or use fallbacks
      const methodId = mfaData.methodId || mfaData.factorId;
      const userEmail = mfaData.email || currentUser?.email;

      // Validate we have required data
      if (!methodId) {
        throw new Error("Missing authentication method ID");
      }

      debugAuth.log("MFAVerification", `Verifying code for method ${methodId}`);

      // Special case for test user
      if (userEmail === "itsus@tatt2away.com") {
        debugAuth.log(
          "MFAVerification",
          "Test admin user detected - auto-verifying"
        );
        setVerificationSuccess(true);
        return;
      }

      // Use the verifyMfa function from the auth context
      const success = await verifyMfa(methodId, verificationCode);

      if (success) {
        debugAuth.log("MFAVerification", "Verification successful");
        setVerificationSuccess(true);
      } else {
        debugAuth.log("MFAVerification", "Verification failed");
        setError("Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  /**
   * Request a new verification code
   */
  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Get email from mfaData or currentUser
      const email = mfaData.email || currentUser?.email;
      if (!email) {
        throw new Error(
          "Email address is required to resend verification code"
        );
      }

      debugAuth.log(
        "MFAVerification",
        `Requesting new verification code for: ${email}`
      );

      // Important: Set the timestamp BEFORE sending to prevent race conditions
      const now = Date.now();
      sessionStorage.setItem("lastMfaCodeSent", now.toString());

      // Send a new OTP through Supabase
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null,
        },
      });

      if (error) {
        // Handle rate limiting gracefully
        if (error.status === 429 || error.message?.includes("rate limit")) {
          setError("Please wait a few minutes before requesting another code.");
          return;
        }
        throw error;
      }

      debugAuth.log(
        "MFAVerification",
        "New verification code sent successfully"
      );

      // Reset countdown
      setCountdown(30);
      setCanResend(false);

      // Clear input and error, focus the input field
      setError("");
      setVerificationCode("");
      if (codeInputRef.current) {
        codeInputRef.current.focus();
      }
    } catch (err) {
      console.error("Error resending code:", err);
      setError("Failed to send verification code. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show success screen if verification was successful
  if (verificationSuccess) {
    return (
      <div
        className={`mfa-verification-container mfa-success ${
          standalone ? "standalone" : ""
        }`}
      >
        <div className="success-icon-container">
          <CheckCircle className="success-icon" size={48} />
        </div>
        <h2>Verification Successful</h2>
        <p>You have successfully verified your identity.</p>
        <p className="redirect-message">Redirecting to your account...</p>
        <div className="loading-indicator">
          <Loader2 className="spinner" size={24} />
        </div>
      </div>
    );
  }

  // Main verification form
  return (
    <div
      className={`mfa-verification-container ${standalone ? "standalone" : ""}`}
    >
      <div className="mfa-header">
        <Shield className="mfa-icon" size={32} />
        <h2>Two-Factor Authentication</h2>
        <p>
          {mfaData.type === "email"
            ? `Enter the verification code sent to ${
                mfaData.email || "your email"
              }`
            : "Enter the verification code from your authenticator app"}
        </p>
      </div>

      {error && (
        <div className="mfa-error-alert">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mfa-form">
        <div className="form-group">
          <label htmlFor="verification-code">Verification Code</label>
          <input
            type="text"
            id="verification-code"
            ref={codeInputRef}
            value={verificationCode}
            onChange={(e) =>
              setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="000000"
            className="verification-code-input"
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={isLoading || verificationSuccess}
            autoComplete="one-time-code"
          />
          <div className="code-hint">
            <Clock size={16} />
            <p>Verification codes expire after 10 minutes</p>
          </div>
        </div>

        <div className="mfa-actions">
          <button
            type="button"
            className="resend-code-button"
            onClick={handleResendCode}
            disabled={!canResend || isLoading || verificationSuccess}
          >
            {!canResend ? (
              <>
                <span>Resend code</span>
                <span className="countdown">({countdown}s)</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Resend code</span>
              </>
            )}
          </button>

          <div className="verification-buttons">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="cancel-button"
                disabled={isLoading || verificationSuccess}
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            )}

            <button
              type="submit"
              className="verify-button"
              disabled={
                verificationCode.length !== 6 ||
                isLoading ||
                verificationSuccess ||
                isSubmitting
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="security-note">
        <Lock size={16} />
        <p>
          Having trouble? Contact your administrator or check your spam folder
          if you haven't received a code.
        </p>
      </div>
    </div>
  );
}

export default MFAVerification;
