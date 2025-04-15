// src/components/auth/MFAVerification.jsx - FIXED VERSION
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase, enhancedAuth } from "../../lib/supabase";
import { debugAuth } from "../../utils/authDebug";

import {
  Shield,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import "./MFAVerification.css";

function MFAVerification({
  onSuccess,
  onCancel,
  mfaData = {},
  standalone = false,
  redirectUrl = "/admin",
}) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { verifyMfa, currentUser, mfaState } = useAuth();
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

  // Focus code input when component mounts but DO NOT automatically send verification code
  // The login process already sends the verification code
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }

    // REMOVED automatic code sending to prevent duplicate emails
    // We rely on the code already sent during login in AuthContext.jsx
    console.log(
      "MFA verification component mounted - using code already sent during login"
    );
  }, [mfaData, currentUser]);

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

  // Handle verification success state with explicit window.location.href for reliable navigation
  useEffect(() => {
    if (verificationSuccess) {
      console.log("MFA verification success detected, preparing redirect");

      // Set all the necessary flags
      localStorage.setItem("authStage", "post-mfa");
      localStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfaSuccess", "true");
      sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

      // Use multiple redirect approaches for reliability
      if (onSuccess) {
        console.log("Calling onSuccess callback");
        try {
          onSuccess();
        } catch (err) {
          console.error("Error in onSuccess callback:", err);
        }
      }

      // Set a backup timer for redirect if callback doesn't work
      redirectTimeoutRef.current = setTimeout(() => {
        console.log("Backup redirect timer triggered");
        if (redirectUrl) {
          console.log(`Redirecting to ${redirectUrl}`);
          // Force a complete page reload to ensure state is refreshed properly
          window.location.href = redirectUrl;
        }
      }, 500); // Reduced timeout for faster fallback
    }
  }, [verificationSuccess, onSuccess, redirectUrl]);

  /**
   * Handle verification code submission - FIXED
   */
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Prevent multiple submissions
    if (isSubmitting) return;

    setError("");

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);
      setIsSubmitting(true);

      // Determine the appropriate method ID to use
      const methodId = mfaData.methodId || mfaData.factorId;
      const userEmail = mfaData.email || currentUser?.email;

      if (!methodId) {
        throw new Error("Missing authentication method ID");
      }

      debugAuth.log(
        "MFAVerification",
        `Verifying code ${verificationCode} for method ${methodId}`
      );

      // Use the verifyMfa function from the auth context
      const success = await verifyMfa(methodId, verificationCode);

      if (success) {
        debugAuth.log("MFAVerification", "Verification successful");

        // Set success state in this component
        setVerificationSuccess(true);

        // No need to call onSuccess here - the useEffect will handle it
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

      // Show success message
      setError("");
      setVerificationCode("");

      // Focus the input field again
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
      </div>
    );
  }

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
            <p>Enter the 6-digit code from your email</p>
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
                Cancel
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
    </div>
  );
}

export default MFAVerification;
