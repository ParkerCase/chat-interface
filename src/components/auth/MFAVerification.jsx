// src/components/auth/MFAVerification.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Shield, AlertCircle, Loader2 } from "lucide-react";
import apiService from "../../services/apiService";

function MFAVerification({ onCancel, mfaData, onSuccess }) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const codeInputRef = useRef(null);
  const { verifyMfa } = useAuth();

  // Focus code input when component mounts
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

  // Start countdown for resend code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);

      // Call the MFA verification endpoint
      const success = await verifyMfa(mfaData.methodId, verificationCode);

      if (success) {
        onSuccess();
      } else {
        setError("Invalid verification code. Please try again.");
      }
    } catch (err) {
      console.error("MFA verification error:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Request a new challenge
      await apiService.mfa.challenge(mfaData.methodId);

      // Reset countdown
      setCountdown(30);
      setCanResend(false);

      // Show success message
      setError("");
    } catch (err) {
      console.error("Error resending code:", err);
      setError("Failed to resend verification code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mfa-verification-container">
      <div className="mfa-header">
        <Shield className="mfa-icon" />
        <h2>Two-Factor Authentication</h2>
        <p>
          Please enter the verification code
          {mfaData.type === "totp"
            ? " from your authenticator app"
            : ` sent to ${mfaData.email || "your email"}`}
        </p>
      </div>

      {error && (
        <div className="error-alert">
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
          />
        </div>

        <div className="mfa-actions">
          <button
            type="button"
            className="resend-code-button"
            onClick={handleResendCode}
            disabled={!canResend || isLoading}
          >
            {canResend ? "Resend code" : `Resend code (${countdown}s)`}
          </button>

          <div className="verification-buttons">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-button"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="verify-button"
              disabled={verificationCode.length !== 6 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default MFAVerification;
