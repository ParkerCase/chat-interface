// src/components/MfaVerify.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, CheckCircle, Shield } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./auth.css";

function MfaVerify() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [factorId, setFactorId] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const codeInputRef = useRef(null);
  const timerRef = useRef(null);

  const {
    verifyMfa,
    error: authError,
    setError: setAuthError,
    currentUser,
  } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Extract MFA parameters from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const factorIdParam = params.get("factorId");
    if (factorIdParam) {
      setFactorId(factorIdParam);
    }

    // Check if we're in the middle of authentication
    const pendingAuth = params.get("pending");
    if (!pendingAuth && !currentUser) {
      // No user and not pending auth, redirect to login
      navigate("/login");
    }
  }, [location, navigate, currentUser]);

  // Focus the code input when component mounts
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

  // Create MFA challenge when factor ID is available
  useEffect(() => {
    const createChallenge = async () => {
      if (!factorId) return;

      try {
        setIsLoading(true);

        // Create MFA challenge with Supabase
        const { data, error } = await supabase.auth.mfa.challenge({
          factorId: factorId,
        });

        if (error) throw error;

        setChallengeId(data.id);
      } catch (err) {
        console.error("Error creating MFA challenge:", err);
        setFormError("Failed to start verification. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    createChallenge();
  }, [factorId]);

  // Countdown timer for resend code
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setAuthError("");

    if (!code) {
      setFormError("Please enter verification code");
      return;
    }

    try {
      setIsLoading(true);

      // For Supabase MFA verification
      if (factorId && challengeId) {
        const { data, error } = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code,
        });

        if (error) throw error;

        // Get redirect URL from query params or use default
        const params = new URLSearchParams(location.search);
        const redirectTo = params.get("redirect") || "/";
        navigate(redirectTo);
        return;
      }

      // Fallback to our custom MFA verification
      const success = await verifyMfa(code, factorId);

      if (success) {
        // Get redirect URL from query params or use default
        const params = new URLSearchParams(location.search);
        const redirectTo = params.get("redirect") || "/";
        navigate(redirectTo);
      } else {
        setFormError("Invalid verification code. Please try again.");
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      setFormError(error.message || "Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setIsResending(true);

      if (factorId) {
        // Create a new challenge for the factor
        const { data, error } = await supabase.auth.mfa.challenge({
          factorId: factorId,
        });

        if (error) throw error;

        setChallengeId(data.id);
      }

      setResendSuccess(true);
      setCountdown(30);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setResendSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error resending code:", error);
      setFormError("Failed to resend verification code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="mfa-verify-container">
      <div className="mfa-verify-card">
        <div className="mfa-verify-header">
          <Shield className="mfa-icon" />
          <h2>Two-Factor Authentication</h2>
          <p>Please enter the verification code to continue</p>
        </div>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="mfa-error-alert">
            <AlertCircle className="error-icon" />
            <p>{formError || authError}</p>
          </div>
        )}

        {/* Display resend success message */}
        {resendSuccess && (
          <div className="mfa-success-alert">
            <CheckCircle className="success-icon" />
            <p>Verification code resent successfully!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mfa-verify-form">
          {/* Code Field */}
          <div className="form-group">
            <label htmlFor="verification-code">Enter verification code</label>
            <input
              type="text"
              id="verification-code"
              ref={codeInputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="000000"
              className="mfa-code-input"
              maxLength={6}
              autoComplete="one-time-code"
              disabled={isLoading}
              inputMode="numeric"
              pattern="[0-9]*"
            />

            {/* Helper text */}
            <p className="mfa-helper-text">
              Open your authenticator app to view your verification code
            </p>
          </div>

          {/* Resend option */}
          <div className="mfa-resend-container">
            <button
              type="button"
              className="mfa-resend-button"
              onClick={handleResendCode}
              disabled={isResending || countdown > 0}
            >
              {isResending
                ? "Sending..."
                : countdown > 0
                ? `Resend code (${countdown}s)`
                : "Resend code"}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="mfa-verify-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default MfaVerify;
