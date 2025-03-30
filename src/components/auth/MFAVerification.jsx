// src/components/auth/MFAVerification.jsx - Complete replacement

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
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
  redirectUrl = null,
}) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const navigate = useNavigate();
  const { verifyMfa, getCurrentUser } = useAuth();
  const codeInputRef = useRef(null);
  const timerRef = useRef(null);

  // For direct testing/development
  const TEST_EMAIL = "itsus@tatt2away.com";
  const TEST_CODE = "123456";

  // Focus code input when component mounts
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Log important information for debugging
  useEffect(() => {
    console.log("MFA Verification initialized with data:", {
      factorId: mfaData.factorId || "Not provided",
      methodId: mfaData.methodId || "Not provided",
      type: mfaData.type || "Not provided",
      email: mfaData.email || "Not provided",
      standalone,
      redirectUrl,
    });
  }, [mfaData, standalone, redirectUrl]);

  /**
   * Handle verification code submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Attempting MFA verification with code:", verificationCode);

      // Special handling for test user
      if (mfaData.email === TEST_EMAIL) {
        console.log("Test user detected, bypassing MFA verification");

        // For testing, allow any 6-digit code for test user
        if (verificationCode.length === 6) {
          setVerificationSuccess(true);
          console.log("Test user MFA verification successful");

          // If onSuccess callback is provided, call it after brief delay
          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
            }, 1000);
            return;
          }

          // Otherwise, handle redirect ourselves
          const currentUser = await getCurrentUser();
          const isAdmin =
            currentUser?.roles?.includes("admin") ||
            currentUser?.roles?.includes("super_admin");

          setTimeout(() => {
            navigate(redirectUrl || (isAdmin ? "/admin" : "/"));
          }, 1500);

          return;
        } else {
          throw new Error("Invalid verification code");
        }
      }

      // Try Supabase MFA verification
      let success = false;

      if (mfaData.factorId) {
        try {
          console.log(
            "Using Supabase MFA verification with factorId:",
            mfaData.factorId
          );

          // Create MFA challenge
          const { data: challengeData, error: challengeError } =
            await supabase.auth.mfa.challenge({
              factorId: mfaData.factorId,
            });

          if (challengeError) {
            console.error("Challenge creation error:", challengeError);
            throw challengeError;
          }

          console.log("Challenge created successfully:", challengeData);

          // Verify the challenge
          const { data: verifyData, error: verifyError } =
            await supabase.auth.mfa.verify({
              factorId: mfaData.factorId,
              challengeId: challengeData.id,
              code: verificationCode,
            });

          if (verifyError) {
            console.error("MFA verification error:", verifyError);
            throw verifyError;
          }

          console.log("Supabase MFA verification successful");
          success = true;
        } catch (supabaseError) {
          console.error("Supabase MFA verification error:", supabaseError);

          // Try using the verifyMfa function from AuthContext as fallback
          if (verifyMfa) {
            try {
              console.log("Trying fallback MFA verification");
              success = await verifyMfa(
                mfaData.factorId || mfaData.methodId,
                verificationCode
              );
            } catch (error) {
              console.error("Fallback MFA verification error:", error);
              throw error;
            }
          } else {
            throw supabaseError;
          }
        }
      } else if (mfaData.methodId) {
        // Try using the verifyMfa function from AuthContext
        if (verifyMfa) {
          console.log("Using methodId for verification:", mfaData.methodId);
          success = await verifyMfa(mfaData.methodId, verificationCode);
        } else {
          throw new Error("No MFA verification method available");
        }
      } else {
        throw new Error("Missing MFA factor or method ID");
      }

      if (success) {
        console.log("MFA verification successful");
        setVerificationSuccess(true);

        // If onSuccess callback is provided, call it after brief delay
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1000);
          return;
        }

        // Otherwise, handle redirect ourselves
        const currentUser = await getCurrentUser();
        const isAdmin =
          currentUser?.roles?.includes("admin") ||
          currentUser?.roles?.includes("super_admin");

        setTimeout(() => {
          navigate(redirectUrl || (isAdmin ? "/admin" : "/"));
        }, 1500);
      } else {
        throw new Error("Verification failed");
      }
    } catch (err) {
      console.error("MFA verification error:", err);
      setError(err.message || "Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Request a new MFA challenge/code
   */
  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      // For email verification, we would call an API to send a new code
      if (mfaData.type === "email") {
        // Call backend API to send new email code
        // Implementation depends on your backend
        console.log("Requesting new email verification code");
      }
      // For TOTP, we just generate a new challenge
      else if (mfaData.factorId) {
        const { data, error } = await supabase.auth.mfa.challenge({
          factorId: mfaData.factorId,
        });

        if (error) throw error;
        console.log("New TOTP challenge created");
      }

      // Reset countdown
      setCountdown(30);
      setCanResend(false);

      // Show success message
      setError("New verification code requested.");
    } catch (err) {
      console.error("Error resending code:", err);
      setError("Failed to resend verification code. Please try again.");
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
        {mfaData.email === TEST_EMAIL && (
          <div className="test-mode-notice">
            <p>Test mode active - use code: {TEST_CODE}</p>
          </div>
        )}
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
            disabled={isLoading}
            autoComplete="one-time-code"
          />
          <div className="code-hint">
            <p>Enter the 6-digit code from your authenticator app or email</p>
          </div>
        </div>

        <div className="mfa-actions">
          <button
            type="button"
            className="resend-code-button"
            onClick={handleResendCode}
            disabled={!canResend || isLoading}
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
                disabled={isLoading}
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="verify-button"
              disabled={verificationCode.length !== 6 || isLoading}
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
