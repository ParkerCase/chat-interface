// src/components/MfaVerify.jsx
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  Shield,
  AlertCircle,
  Loader,
  CheckCircle,
  RefreshCw,
  Clock,
} from "lucide-react";
import "./auth.css";

function MfaVerify() {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [email, setEmail] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { currentUser, verifyMfa } = useAuth();
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize component
  useEffect(() => {
    const initVerification = async () => {
      // Get return URL from query params
      const returnUrl = searchParams.get("returnUrl") || "/admin";

      // Get email from query params or current user
      const emailParam = searchParams.get("email");
      const userEmail = emailParam || currentUser?.email;

      if (userEmail) {
        setEmail(userEmail);
      }

      // Check if MFA is already verified
      const mfaVerified =
        localStorage.getItem("mfa_verified") === "true" ||
        sessionStorage.getItem("mfa_verified") === "true";

      if (mfaVerified) {
        console.log("MFA already verified, redirecting");
        navigate(returnUrl);
        return;
      }

      // Focus the input field
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    initVerification();
  }, [currentUser, navigate, searchParams]);

  // Countdown for resend button
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

  // Handle verification code submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Validate code
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Special case for admin user
      if (email === "itsus@tatt2away.com") {
        // Set MFA as verified
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");

        setIsSuccess(true);

        // Redirect after a delay
        setTimeout(() => {
          const returnUrl = searchParams.get("returnUrl") || "/admin";
          navigate(returnUrl);
        }, 1500);

        return;
      }

      // Verify MFA code using Auth context
      const success = await verifyMfa("email", verificationCode);

      if (success) {
        setIsSuccess(true);

        // Redirect after a delay
        setTimeout(() => {
          const returnUrl = searchParams.get("returnUrl") || "/admin";
          navigate(returnUrl);
        }, 1500);
      } else {
        setError("Invalid verification code. Please try again.");
      }
    } catch (err) {
      console.error("MFA verification error:", err);
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Do nothing for admin user
      if (email === "itsus@tatt2away.com") {
        setCanResend(false);
        setCountdown(30);
        return;
      }

      // Send new verification code
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: null,
        },
      });

      if (error) throw error;

      // Reset countdown
      setCanResend(false);
      setCountdown(30);

      // Clear input field
      setVerificationCode("");
      if (inputRef.current) {
        inputRef.current.focus();
      }

      // Set timestamp to prevent duplicate sends
      sessionStorage.setItem("lastMfaCodeSent", Date.now().toString());
    } catch (err) {
      console.error("Error resending code:", err);
      setError(err.message || "Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show success state
  if (isSuccess) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-content mfa-success">
            <div className="success-icon-container">
              <CheckCircle className="success-icon" size={48} />
            </div>
            <h2>Verification Successful</h2>
            <p>You have successfully verified your identity.</p>
            <p className="redirect-message">Redirecting to your account...</p>
            <div className="loading-indicator">
              <Loader className="spinner" size={24} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-branding">
          <img src="/logo.png" alt="Tatt2Away Logo" className="auth-logo" />
        </div>

        <div className="auth-content">
          <div className="mfa-header">
            <Shield className="mfa-icon" size={32} />
            <h2>Two-Factor Authentication</h2>
            <p>Enter the verification code sent to {email}</p>
          </div>

          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mfa-form">
            <div className="form-group">
              <label htmlFor="verification-code">Verification Code</label>
              <input
                type="text"
                id="verification-code"
                ref={inputRef}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="000000"
                className="verification-code-input"
                maxLength={6}
                required
                disabled={isLoading}
                inputMode="numeric"
                pattern="[0-9]*"
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

              <button
                type="submit"
                className="verify-button"
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="spinner" size={16} />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default MfaVerify;
