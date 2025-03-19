// src/components/MfaSetup.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Shield,
  Smartphone,
  Mail,
  ArrowRight,
  QrCode,
  Copy,
  X,
  Loader,
} from "lucide-react";
import "./MfaSetup.css";

function MfaSetup() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const codeInputRef = useRef(null);

  const {
    currentUser,
    setupMfa,
    confirmMfa,
    error: authError,
    setError: setAuthError,
  } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();

  // Focus the verification code input when it becomes visible
  useEffect(() => {
    if (activeStep === 2 && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [activeStep]);

  // Reset copy state after 3 seconds
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setActiveStep(1);
  };

  const startSetup = async () => {
    setFormError("");
    setAuthError("");

    try {
      setIsLoading(true);

      // Call the MFA setup function
      const result = await setupMfa(selectedMethod);

      if (result && result.data) {
        setSetupData(result.data);
        setActiveStep(2);
      } else {
        setFormError("Failed to set up MFA. Please try again.");
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("MFA setup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();
    setFormError("");
    setAuthError("");

    if (!verificationCode) {
      setFormError("Please enter the verification code");
      return;
    }

    try {
      setIsLoading(true);

      // Call the MFA confirmation function
      const success = await confirmMfa(setupData.methodId, verificationCode);

      if (success) {
        setIsSuccess(true);

        // Redirect to security settings after 3 seconds
        setTimeout(() => {
          navigate("/security");
        }, 3000);
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

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  const cancelSetup = () => {
    setActiveStep(0);
    setSelectedMethod(null);
    setSetupData(null);
    setVerificationCode("");
    setFormError("");
    setAuthError("");
  };

  // Helper function to get step status class
  const getStepStatus = (stepIndex) => {
    if (activeStep > stepIndex) return "completed";
    if (activeStep === stepIndex) return "active";
    return "pending";
  };

  // If setup was successful, show success message
  if (isSuccess) {
    return (
      <div className="mfa-setup-container">
        <div className="success-message">
          <div className="success-icon-container">
            <CheckCircle className="success-icon" />
          </div>
          <h2>MFA Setup Complete</h2>
          <p>
            Two-factor authentication has been successfully set up for your
            account. You'll now be asked to enter a verification code when
            signing in.
          </p>
          <p className="redirect-note">
            You will be redirected to security settings shortly...
          </p>
          <button onClick={() => navigate("/security")} className="done-button">
            Go to Security Settings
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mfa-setup-container">
      <div className="mfa-setup-card">
        <div className="mfa-setup-header">
          <Shield className="mfa-icon" />
          <h2>Set Up Two-Factor Authentication</h2>
          <p>
            Add an extra layer of security to your account by requiring a
            verification code in addition to your password.
          </p>
        </div>

        {/* Stepper */}
        <div className="mfa-setup-stepper">
          <div className={`stepper-step ${getStepStatus(0)}`}>
            <div className="step-indicator">
              {activeStep > 0 ? (
                <CheckCircle size={18} />
              ) : activeStep === 0 ? (
                <span>1</span>
              ) : (
                <span>1</span>
              )}
            </div>
            <div className="step-label">Select Method</div>
          </div>

          <div className="stepper-connector"></div>

          <div className={`stepper-step ${getStepStatus(1)}`}>
            <div className="step-indicator">
              {activeStep > 1 ? (
                <CheckCircle size={18} />
              ) : activeStep === 1 ? (
                <span>2</span>
              ) : (
                <span>2</span>
              )}
            </div>
            <div className="step-label">Setup</div>
          </div>

          <div className="stepper-connector"></div>

          <div className={`stepper-step ${getStepStatus(2)}`}>
            <div className="step-indicator">
              {activeStep > 2 ? (
                <CheckCircle size={18} />
              ) : activeStep === 2 ? (
                <span>3</span>
              ) : (
                <span>3</span>
              )}
            </div>
            <div className="step-label">Verify</div>
          </div>
        </div>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle className="error-icon" />
            <p>{formError || authError}</p>
          </div>
        )}

        {/* Step 1: Select Method */}
        {activeStep === 0 && (
          <div className="mfa-setup-step">
            <h3>Choose Authentication Method</h3>

            <div className="mfa-method-options">
              <div
                className={`mfa-method-card ${
                  selectedMethod === "totp" ? "selected" : ""
                }`}
                onClick={() => handleMethodSelect("totp")}
              >
                <div className="method-icon">
                  <Smartphone size={24} />
                </div>
                <div className="method-content">
                  <h4>Authenticator App</h4>
                  <p>
                    Use an app like Google Authenticator, Microsoft
                    Authenticator, or Authy to get verification codes.
                  </p>
                </div>
                {selectedMethod === "totp" && (
                  <div className="method-selected-indicator">
                    <CheckCircle size={20} />
                  </div>
                )}
              </div>

              <div
                className={`mfa-method-card ${
                  selectedMethod === "email" ? "selected" : ""
                }`}
                onClick={() => handleMethodSelect("email")}
              >
                <div className="method-icon">
                  <Mail size={24} />
                </div>
                <div className="method-content">
                  <h4>Email</h4>
                  <p>
                    Receive verification codes via email at {currentUser?.email}
                    .
                  </p>
                </div>
                {selectedMethod === "email" && (
                  <div className="method-selected-indicator">
                    <CheckCircle size={20} />
                  </div>
                )}
              </div>
            </div>

            <div className="mfa-setup-actions">
              <button
                onClick={() => navigate("/security")}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={startSetup}
                className="next-button"
                disabled={!selectedMethod || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="spinner" size={16} />
                    Setting Up...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Setup */}
        {activeStep === 1 && (
          <div className="mfa-setup-step">
            {selectedMethod === "totp" ? (
              <>
                <h3>Set Up Authenticator App</h3>
                <div className="setup-instructions">
                  <p>
                    To set up two-factor authentication with an authenticator
                    app:
                  </p>
                  <ol>
                    <li>
                      Download and install an authenticator app like Google
                      Authenticator, Microsoft Authenticator, or Authy.
                    </li>
                    <li>
                      In the next step, you'll see a QR code and a setup key.
                      Scan the QR code with your authenticator app or manually
                      enter the setup key.
                    </li>
                    <li>
                      After scanning the QR code or entering the key, your app
                      will show a 6-digit code that changes every 30 seconds.
                    </li>
                    <li>Enter that code to complete the setup.</li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                <h3>Set Up Email Authentication</h3>
                <div className="setup-instructions">
                  <p>To set up two-factor authentication with email:</p>
                  <ol>
                    <li>
                      We'll send a verification code to your email address:
                      <div className="email-highlight">
                        {currentUser?.email}
                      </div>
                    </li>
                    <li>
                      In the next step, you'll need to check your email and
                      enter the 6-digit verification code you receive.
                    </li>
                    <li>
                      After verifying the code, your email address will be used
                      for authentication each time you sign in.
                    </li>
                  </ol>
                </div>
              </>
            )}

            <div className="mfa-setup-actions">
              <button onClick={cancelSetup} className="cancel-button">
                Cancel
              </button>
              <button
                onClick={startSetup}
                className="next-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="spinner" size={16} />
                    Setting Up...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Verify */}
        {activeStep === 2 && setupData && (
          <div className="mfa-setup-step">
            {selectedMethod === "totp" ? (
              <>
                <h3>Scan QR Code</h3>
                <p className="setup-description">
                  Scan this QR code with your authenticator app or manually
                  enter the setup key.
                </p>

                <div className="qr-container">
                  {setupData.qrCode && (
                    <img
                      src={setupData.qrCode}
                      alt="QR Code for Authenticator App"
                      className="qr-code"
                    />
                  )}
                </div>

                <div className="setup-key-container">
                  <div className="setup-key-label">
                    <QrCode size={16} />
                    <span>Setup Key</span>
                  </div>
                  <div className="setup-key-value">
                    <code>{setupData.secret}</code>
                    <button
                      onClick={() => copyToClipboard(setupData.secret)}
                      className="copy-button"
                      aria-label="Copy setup key"
                    >
                      {isCopied ? (
                        <CheckCircle size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                  {isCopied && (
                    <div className="copied-message">Copied to clipboard!</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3>Check Your Email</h3>
                <p className="setup-description">
                  We've sent a verification code to {setupData.email}. Please
                  check your inbox and enter the 6-digit code below.
                </p>

                <div className="email-sent-indicator">
                  <Mail size={24} />
                  <div className="email-sent-message">
                    <p>Code sent to:</p>
                    <p className="email-address">{setupData.email}</p>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleVerification} className="verification-form">
              <div className="form-group">
                <label htmlFor="verification-code">
                  Enter verification code
                </label>
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
                  required
                  disabled={isLoading}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>

              <div className="mfa-setup-actions">
                <button
                  type="button"
                  onClick={cancelSetup}
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
                      <Loader className="spinner" size={16} />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default MfaSetup;
