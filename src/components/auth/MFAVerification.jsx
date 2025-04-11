// src/components/auth/MFAVerification.jsx - Complete replacement

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

  // For direct testing/development (disabled - using real auth)
  const TEST_EMAIL = "";
  const TEST_CODE = "";

  // Setup auth state change listener for direct handling of verification events
  useEffect(() => {
    // Listen for Supabase auth events directly in the MFA component
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("MFA component detected auth event:", event);

      // If we get a SIGNED_IN event while on this screen, treat it as successful verification
      if (event === "SIGNED_IN" || event === "MFA_CHALLENGE_VERIFIED") {
        console.log("Auth event indicates successful verification");
        setVerificationSuccess(true);

        // Set all the necessary session flags
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
        sessionStorage.setItem("mfaRedirectPending", "true");
        sessionStorage.setItem("mfaRedirectTarget", "/admin");

        // Trigger onSuccess callback as a backup
        if (onSuccess) {
          setTimeout(() => onSuccess(), 300);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [onSuccess]);

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

  // In src/components/auth/MFAVerification.jsx
  useEffect(() => {
    if (verificationSuccess) {
      console.log(
        "Verification success detected in effect - applying fallback redirect"
      );

      // Fallback redirect after a short delay if the immediate redirect fails
      const redirectTimer = setTimeout(() => {
        window.location.href = "/admin";
      }, 1000);

      return () => clearTimeout(redirectTimer);
    }
  }, [verificationSuccess]);

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
      console.log(`Verifying code for ${mfaData.email}`);

      // For email verification - use proper verification for ALL users
      if (mfaData.type === "email") {
        console.log("Starting email OTP verification");

        // Try multiple verification methods since Supabase can be inconsistent
        let verified = false;

        // First try with magiclink type
        try {
          const { error } = await supabase.auth.verifyOtp({
            email: mfaData.email,
            token: verificationCode,
            type: "magiclink",
          });

          if (!error) {
            console.log("Magiclink verification successful");
            verified = true;
          } else if (
            error.message &&
            (error.message.includes("already confirmed") ||
              error.message.includes("already logged in"))
          ) {
            console.log("User already verified (benign error):", error.message);
            verified = true;
          } else {
            console.log("Magiclink verification failed, trying email type");
          }
        } catch (err) {
          console.warn(
            "Error in magiclink verification, trying next method:",
            err
          );
        }

        // Try email type if magiclink failed
        if (!verified) {
          try {
            const { error } = await supabase.auth.verifyOtp({
              email: mfaData.email,
              token: verificationCode,
              type: "email",
            });

            if (!error) {
              console.log("Email type verification successful");
              verified = true;
            } else if (
              error.message &&
              (error.message.includes("already confirmed") ||
                error.message.includes("already logged in"))
            ) {
              console.log(
                "User already verified (benign error):",
                error.message
              );
              verified = true;
            } else {
              console.log("Email verification failed, trying recovery type");
            }
          } catch (err) {
            console.warn(
              "Error in email verification, trying next method:",
              err
            );
          }
        }

        // Try recovery type as last resort
        if (!verified) {
          try {
            const { error } = await supabase.auth.verifyOtp({
              email: mfaData.email,
              token: verificationCode,
              type: "recovery",
            });

            if (!error) {
              console.log("Recovery type verification successful");
              verified = true;
            } else if (
              error.message &&
              (error.message.includes("already confirmed") ||
                error.message.includes("already logged in"))
            ) {
              console.log(
                "User already verified (benign error):",
                error.message
              );
              verified = true;
            } else {
              console.error("All verification methods failed:", error);
              throw new Error(
                "Verification failed. Please check the code and try again."
              );
            }
          } catch (err) {
            if (!verified) {
              console.error("Final verification attempt failed:", err);
              throw err;
            }
          }
        }

        if (verified) {
          // Set success and force redirect
          console.log("Email verification successful");
          setVerificationSuccess(true);

          // Set session flags
          sessionStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfaSuccess", "true");
          sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

          // Force redirect
          setTimeout(() => {
            if (onSuccess) {
              onSuccess();
            } else {
              window.location.href = "/admin";
            }
          }, 500);
        } else {
          throw new Error(
            "Verification failed. Please check the code and try again."
          );
        }
      }
      // Handle other verification types if needed
    } catch (error) {
      console.error("Verification error:", error);
      setError(
        error.message ||
          "Verification failed. Please check the code and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      // Get the appropriate factor or method ID
      const factorId = mfaData.factorId || mfaData.methodId;
      if (!factorId) {
        throw new Error("Missing authentication factor ID");
      }

      console.log(`Verifying code ${verificationCode} for factor ${factorId}`);

      // Use the verifyMfa function from auth context if available
      if (verifyMfa) {
        const success = await verifyMfa(factorId, verificationCode);

        if (success) {
          console.log("MFA verification successful");
          setVerificationSuccess(true);

          // Call the onSuccess callback provided by parent component
          if (onSuccess) {
            onSuccess();
          }
          return;
        } else {
          throw new Error("Verification failed");
        }
      } else {
        // Direct verification as fallback
        // Step 1: Create a challenge for this factor
        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({
            factorId: factorId,
          });

        if (challengeError) {
          throw challengeError;
        }

        // Step 2: Verify the challenge with the user's code
        const { data, error } = await supabase.auth.mfa.verify({
          factorId: factorId,
          challengeId: challengeData.id,
          code: verificationCode,
        });

        if (error) throw error;

        console.log("MFA verification successful");
        setVerificationSuccess(true);

        // Call the onSuccess callback provided by parent component
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("MFA verification error:", error);

      // Format error message for user
      let errorMessage = "Verification failed. Please try again.";
      if (error.message) {
        if (error.message.includes("Invalid code")) {
          errorMessage = "Invalid verification code. Please try again.";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Request a new MFA challenge/code with multiple attempts
   */
  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      // For email verification, send a new code using OTP
      if (mfaData.type === "email") {
        console.log(
          "Requesting new email verification code for:",
          mfaData.email
        );

        // Send OTP via Supabase
        const { error } = await supabase.auth.signInWithOtp({
          email: mfaData.email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: null,
          },
        });

        if (error) {
          // Handle rate limiting errors gracefully
          if (
            error.status === 429 ||
            (error.message && error.message.includes("rate limit"))
          ) {
            console.log("Rate limited when sending verification code");
            setError(
              "Please wait a few minutes before requesting another code."
            );
            return;
          }

          throw error;
        }

        console.log("New verification code sent successfully");

        // Reset countdown
        setCountdown(30);
        setCanResend(false);

        // Show success message
        setError("Verification code has been sent to your email.");
      }
      // For TOTP (if implemented), create new challenge
    } catch (err) {
      console.error("Error resending code:", err);
      setError("Failed to resend verification code. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const testEmailSending = async (email) => {
    try {
      console.log("Testing email sending to:", email);

      const { data, error } = await supabase.auth.signInWithOtp({
        email: email || mfaData.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null,
        },
      });

      if (error) {
        console.error("Test email error:", error);
        alert(`Error sending test email: ${error.message}`);
      } else {
        console.log("Test email sent successfully:", data);
        alert("Test email sent successfully! Check your inbox.");
      }
    } catch (e) {
      console.error("Exception in test email:", e);
      alert(`Exception sending test email: ${e.message}`);
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
