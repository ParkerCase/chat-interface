// src/components/account/MfaSetup.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Shield,
  QrCode,
  AlertCircle,
  CheckCircle,
  Smartphone,
  Mail,
  Plus,
  Trash,
  Lock,
  Unlock,
} from "lucide-react";

function MfaSetup({ setError, setSuccessMessage }) {
  const { currentUser, setupMfa, confirmMfa, removeMfa } = useAuth();

  const [mfaMethods, setMfaMethods] = useState([]);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupMethod, setSetupMethod] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Load current MFA methods
  useEffect(() => {
    if (currentUser && currentUser.mfaMethods) {
      setMfaMethods(currentUser.mfaMethods);
    } else {
      setMfaMethods([]);
    }
  }, [currentUser]);

  const startMfaSetup = async (type) => {
    setIsSettingUp(true);
    setSetupMethod(type);
    setSetupData(null);
    setVerificationCode("");
    setError("");

    try {
      setIsLoading(true);
      const result = await setupMfa(type);

      if (result && result.data) {
        setSetupData(result.data);
      } else {
        setError("Failed to set up MFA. Please try again.");
        setIsSettingUp(false);
      }
    } catch (error) {
      setError("Failed to set up MFA. Please try again.");
      console.error("MFA setup error:", error);
      setIsSettingUp(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setIsSettingUp(false);
    setSetupMethod(null);
    setSetupData(null);
    setVerificationCode("");
  };

  const handleConfirmSetup = async () => {
    if (!verificationCode) {
      setError("Please enter verification code");
      return;
    }

    try {
      setIsConfirming(true);

      const success = await confirmMfa(setupData.methodId, verificationCode);

      if (success) {
        setSuccessMessage(`${getMethodName(setupMethod)} successfully set up`);

        // Refresh MFA methods
        if (currentUser && currentUser.mfaMethods) {
          // Add new method to the list
          const newMethod = {
            id: setupData.methodId,
            type: setupMethod,
            identifier: setupMethod === "email" ? setupData.email : null,
          };

          setMfaMethods([...mfaMethods, newMethod]);
        }

        // Reset setup state
        setIsSettingUp(false);
        setSetupMethod(null);
        setSetupData(null);
        setVerificationCode("");
      } else {
        setError("Invalid verification code. Please try again.");
      }
    } catch (error) {
      setError("Failed to confirm MFA. Please try again.");
      console.error("MFA confirmation error:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRemoveMfa = async (methodId) => {
    if (!methodId) return;

    if (
      !window.confirm(
        "Are you sure you want to remove this authentication method?"
      )
    ) {
      return;
    }

    try {
      setIsRemoving(true);

      const success = await removeMfa(methodId);

      if (success) {
        setSuccessMessage("Authentication method removed successfully");

        // Remove from the list
        setMfaMethods(mfaMethods.filter((method) => method.id !== methodId));
      } else {
        setError("Failed to remove authentication method");
      }
    } catch (error) {
      setError("Failed to remove authentication method");
      console.error("MFA removal error:", error);
    } finally {
      setIsRemoving(false);
    }
  };

  // Helper function to get method name
  const getMethodName = (type) => {
    switch (type) {
      case "totp":
        return "Authenticator App";
      case "email":
        return "Email Authentication";
      case "sms":
        return "SMS Authentication";
      default:
        return "Two-Factor Authentication";
    }
  };

  // Helper function to get method icon
  const getMethodIcon = (type) => {
    switch (type) {
      case "totp":
        return <Smartphone size={20} />;
      case "email":
        return <Mail size={20} />;
      default:
        return <Shield size={20} />;
    }
  };

  return (
    <div className="mfa-setup-container">
      <h3>Two-Factor Authentication</h3>
      <p className="tab-description">
        Add an extra layer of security to your account
      </p>

      {/* Current MFA Methods */}
      {mfaMethods.length > 0 && (
        <div className="mfa-methods-list">
          <h4>Your Authentication Methods</h4>

          {mfaMethods.map((method) => (
            <div key={method.id} className="mfa-method-item">
              <div className="mfa-method-info">
                {getMethodIcon(method.type)}
                <div>
                  <h5>{getMethodName(method.type)}</h5>
                  {method.identifier && <p>{method.identifier}</p>}
                  {method.lastUsed && (
                    <p className="method-last-used">
                      Last used:{" "}
                      {new Date(method.lastUsed).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRemoveMfa(method.id)}
                className="remove-method-button"
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <span className="spinner-sm"></span>
                ) : (
                  <Trash size={16} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MFA Setup Flow */}
      {isSettingUp ? (
        <div className="mfa-setup-flow">
          <h4>Set Up {getMethodName(setupMethod)}</h4>

          {/* TOTP Setup */}
          {setupMethod === "totp" && setupData && (
            <div className="totp-setup">
              <div className="qr-code-container">
                <img src={setupData.qrCode} alt="QR Code" className="qr-code" />
              </div>

              <p className="setup-instructions">
                1. Install an authenticator app (like Google Authenticator,
                Authy, or Microsoft Authenticator)
                <br />
                2. Scan the QR code with your authenticator app
                <br />
                3. Enter the 6-digit code from your app below
              </p>

              <div className="manual-entry">
                <p>If you can't scan the QR code, enter this code manually:</p>
                <div className="secret-key">
                  <code>{setupData.secret}</code>
                </div>
              </div>
            </div>
          )}

          {/* Email Setup */}
          {setupMethod === "email" && setupData && (
            <div className="email-setup">
              <div className="email-icon-container">
                <Mail size={48} />
              </div>

              <p className="setup-instructions">
                We've sent a verification code to your email address:
                <br />
                <strong>{setupData.email}</strong>
                <br />
                Enter the 6-digit code from the email below.
              </p>
            </div>
          )}

          {/* Verification Code Input */}
          <div className="verification-code-container">
            <label htmlFor="verification-code">Verification Code</label>
            <input
              type="text"
              id="verification-code"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="000000"
              className="verification-code-input"
              maxLength={6}
              disabled={isConfirming}
            />
          </div>

          <div className="setup-actions">
            <button
              onClick={handleCancelSetup}
              className="cancel-button"
              disabled={isConfirming}
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmSetup}
              className="confirm-button"
              disabled={!verificationCode || isConfirming}
            >
              {isConfirming ? (
                <>
                  <span className="spinner-sm"></span>
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Add New Method Section */}
          <div className="add-mfa-section">
            <h4>Add a new authentication method</h4>

            <div className="mfa-methods-grid">
              <div className="mfa-method-card">
                <div className="method-icon">
                  <Smartphone size={24} />
                </div>
                <h5>Authenticator App</h5>
                <p>Use an authenticator app to generate verification codes</p>
                <button
                  onClick={() => startMfaSetup("totp")}
                  className="setup-method-button"
                  disabled={isLoading}
                >
                  {isLoading && setupMethod === "totp" ? (
                    <>
                      <span className="spinner-sm"></span>
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Set Up
                    </>
                  )}
                </button>
              </div>

              <div className="mfa-method-card">
                <div className="method-icon">
                  <Mail size={24} />
                </div>
                <h5>Email Authentication</h5>
                <p>Receive verification codes via email</p>
                <button
                  onClick={() => startMfaSetup("email")}
                  className="setup-method-button"
                  disabled={
                    isLoading || mfaMethods.some((m) => m.type === "email")
                  }
                >
                  {isLoading && setupMethod === "email" ? (
                    <>
                      <span className="spinner-sm"></span>
                      Setting up...
                    </>
                  ) : mfaMethods.some((m) => m.type === "email") ? (
                    <>
                      <CheckCircle size={16} />
                      Set Up
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Set Up
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Security Recommendations */}
          <div className="security-recommendations">
            <h4>Security Recommendations</h4>

            <div className="recommendation-item">
              <div
                className={`recommendation-status ${
                  mfaMethods.length > 0 ? "secure" : "insecure"
                }`}
              >
                {mfaMethods.length > 0 ? (
                  <Lock size={20} />
                ) : (
                  <Unlock size={20} />
                )}
              </div>
              <div className="recommendation-content">
                <h5>Enable Two-Factor Authentication</h5>
                <p>
                  {mfaMethods.length > 0
                    ? "Great! Your account is protected with two-factor authentication."
                    : "We strongly recommend setting up two-factor authentication to secure your account."}
                </p>
              </div>
            </div>

            <div className="recommendation-item">
              <div
                className={`recommendation-status ${
                  mfaMethods.length > 1 ? "secure" : "insecure"
                }`}
              >
                {mfaMethods.length > 1 ? (
                  <Lock size={20} />
                ) : (
                  <Unlock size={20} />
                )}
              </div>
              <div className="recommendation-content">
                <h5>Set Up Multiple Authentication Methods</h5>
                <p>
                  {mfaMethods.length > 1
                    ? "Great! You have multiple authentication methods configured."
                    : "We recommend setting up multiple authentication methods as a backup."}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default MfaSetup;
