// src/components/MfaVerify.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, CheckCircle, Shield } from "lucide-react";
import "./auth.css";

function MfaVerify() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaMethods, setMfaMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const codeInputRef = useRef(null);
  const timerRef = useRef(null);

  const { verifyMfa, error: authError, currentUser } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Get MFA methods and initialize component
  useEffect(() => {
    const fetchMfaMethods = async () => {
      try {
        // If currentUser is not set, we need to wait or redirect
        if (!currentUser) {
          // Check if we're in the middle of authentication
          const params = new URLSearchParams(location.search);
          const pendingAuth = params.get("pending");

          if (!pendingAuth) {
            // No user and not pending auth, redirect to login
            navigate("/login");
            return;
          }
        }

        // Normally we'd fetch MFA methods from the backend
        // For this example, we'll use mock data if not available
        // In a real implementation, you would get this data during login
        if (currentUser?.mfaMethods) {
          setMfaMethods(currentUser.mfaMethods);
          // Set first method as selected
          if (currentUser.mfaMethods.length > 0) {
            setSelectedMethod(currentUser.mfaMethods[0].id);
          }
        } else {
          // Mock data for demonstration
          const mockMethods = [
            {
              id: "totp-1",
              type: "totp",
              identifier: null,
            },
          ];
          setMfaMethods(mockMethods);
          setSelectedMethod("totp-1");
        }
      } catch (error) {
        console.error("Error fetching MFA methods:", error);
        setFormError("Unable to load MFA methods. Please try again.");
      }
    };

    fetchMfaMethods();
  }, [currentUser, navigate, location]);

  // Focus the code input when component mounts
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

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

    if (!code) {
      setFormError("Please enter verification code");
      return;
    }

    try {
      setIsLoading(true);
      const success = await verifyMfa(code, selectedMethod);

      if (success) {
        // Get redirect URL from query params or use default
        const params = new URLSearchParams(location.search);
        const redirectTo = params.get("redirect") || "/";
        navigate(redirectTo);
      } else {
        setFormError("Invalid verification code. Please try again.");
      }
    } catch (error) {
      setFormError("Failed to verify code. Please try again.");
      console.error("MFA verification error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    // Only for email/SMS MFA types
    const method = mfaMethods.find((m) => m.id === selectedMethod);

    if (!method || method.type === "totp") {
      return; // Can't resend TOTP codes
    }

    try {
      setIsResending(true);

      // We'd make an API call here to resend the code
      // For demo purposes we'll just simulate success
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

  // Determine which type of MFA method is selected
  const selectedMfaType =
    mfaMethods.find((m) => m.id === selectedMethod)?.type || "totp";

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
          {/* MFA Method Selector (if multiple methods) */}
          {mfaMethods.length > 1 && (
            <div className="form-group">
              <label htmlFor="mfa-method">Verification Method</label>
              <select
                id="mfa-method"
                value={selectedMethod || ""}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="mfa-method-select"
                disabled={isLoading}
              >
                {mfaMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.type === "totp"
                      ? "Authenticator App"
                      : method.type === "email"
                      ? `Email (${method.identifier})`
                      : `SMS (${method.identifier})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Code Field */}
          <div className="form-group">
            <label htmlFor="verification-code">
              {selectedMfaType === "totp"
                ? "Enter code from your authenticator app"
                : "Enter verification code"}
            </label>
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
              {selectedMfaType === "totp"
                ? "Open your authenticator app to view your verification code"
                : "We sent a verification code to your " + selectedMfaType}
            </p>
          </div>

          {/* Resend option for email/SMS */}
          {selectedMfaType !== "totp" && (
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
          )}

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
