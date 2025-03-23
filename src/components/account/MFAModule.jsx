// src/components/account/MFAModule.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Smartphone,
  Mail,
  QrCode,
  Copy,
  CheckCircle,
  X,
  AlertCircle,
  Trash2,
  Plus,
  ArrowRight,
  Loader,
  RefreshCw,
} from "lucide-react";
import "./MFAModule.css"; // Use your existing CSS file

function MFAModule({
  isStandalone = false,
  setSuccessMessage,
  setError: setParentError,
}) {
  const { currentUser, setupMfa, confirmMfa, removeMfa } = useAuth();
  const navigate = useNavigate();

  // State for MFA methods display
  const [userMfaMethods, setUserMfaMethods] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  // State for setup flow
  const [showSetupFlow, setShowSetupFlow] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // State for deletion confirmation
  const [deletingMethodId, setDeletingMethodId] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const codeInputRef = useRef(null);

  // Set local error and propagate to parent if available
  const setErrorMessage = (message) => {
    setLocalError(message);
    if (setParentError) {
      setParentError(message);
    }
  };

  // Load MFA methods from current user
  useEffect(() => {
    if (currentUser && currentUser.mfaMethods) {
      setUserMfaMethods(currentUser.mfaMethods);
    }
  }, [currentUser]);

  // Focus the verification code input when it becomes visible
  useEffect(() => {
    if (activeStep === 2 && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [activeStep]);

  // Clear copy state after 3 seconds
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const startSetup = () => {
    setShowSetupFlow(true);
    setActiveStep(0);
    setSelectedMethod(null);
    setSetupData(null);
    setVerificationCode("");
    setLocalError("");
    setIsSuccess(false);
  };

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setActiveStep(1);
  };

  const initiateSetup = async () => {
    if (!selectedMethod) {
      setErrorMessage("Please select an authentication method");
      return;
    }

    try {
      setIsLoading(true);
      setLocalError("");

      // Call the setupMfa method from the AuthContext
      const result = await setupMfa(selectedMethod);

      if (result && result.data) {
        setSetupData(result.data);
        setActiveStep(2);
      } else {
        setErrorMessage("Failed to set up MFA. Please try again.");
      }
    } catch (error) {
      setErrorMessage(
        "Failed to set up MFA: " + (error.message || "Unknown error")
      );
      console.error("MFA setup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!verificationCode) {
      setErrorMessage("Please enter the verification code");
      return;
    }

    if (!setupData?.methodId) {
      setErrorMessage("Setup data is missing. Please try again.");
      return;
    }

    try {
      setIsLoading(true);
      setLocalError("");

      // Call the confirmMfa method from the AuthContext
      const success = await confirmMfa(setupData.methodId, verificationCode);

      if (success) {
        // Success! Update UI and possibly the list of methods
        setIsSuccess(true);
        if (setSuccessMessage) {
          setSuccessMessage(
            `${getMethodName(selectedMethod)} successfully set up`
          );
        }

        // Add the new method to the list if not already present
        const newMethod = {
          id: setupData.methodId,
          type: selectedMethod,
          identifier: selectedMethod === "email" ? setupData.email : null,
        };

        setUserMfaMethods((prev) => {
          // Check if this method already exists
          const exists = prev.some((m) => m.id === newMethod.id);
          if (exists) return prev;
          return [...prev, newMethod];
        });

        setActiveStep(3);
      } else {
        setErrorMessage("Invalid verification code. Please try again.");
      }
    } catch (error) {
      setErrorMessage(
        "Failed to verify code: " + (error.message || "Unknown error")
      );
      console.error("MFA verification error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMfa = async (methodId) => {
    try {
      setIsLoading(true);
      setLocalError("");

      // Call the removeMfa method from the AuthContext
      const success = await removeMfa(methodId);

      if (success) {
        if (setSuccessMessage) {
          setSuccessMessage("MFA method removed successfully");
        }

        // Remove the method from the list
        setUserMfaMethods((prevMethods) =>
          prevMethods.filter((method) => method.id !== methodId)
        );
      } else {
        setErrorMessage("Failed to remove MFA method");
      }
    } catch (error) {
      setErrorMessage(
        "Failed to remove MFA method: " + (error.message || "Unknown error")
      );
      console.error("MFA removal error:", error);
    } finally {
      setIsLoading(false);
      setDeletingMethodId(null);
      setShowDeleteConfirmation(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
      })
      .catch(() => {
        setErrorMessage("Failed to copy to clipboard");
      });
  };

  const resetSetupFlow = () => {
    setShowSetupFlow(false);
    setActiveStep(0);
    setSelectedMethod(null);
    setSetupData(null);
    setVerificationCode("");
    setLocalError("");
    setIsSuccess(false);
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

  // If this is used in a standalone page and setup was successful, show success message
  if (isStandalone && isSuccess) {
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
          <button onClick={() => navigate("/security")} className="done-button">
            Go to Security Settings
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mfa-module-container">
      {/* Header section */}
      <div className="mfa-header">
        <div className="mfa-title">
          <Shield className="shield-icon" />
          <h2>Two-Factor Authentication</h2>
        </div>
        {!showSetupFlow && (
          <button className="mfa-add-button" onClick={startSetup}>
            <Plus size={16} />
            <span>Add Method</span>
          </button>
        )}
      </div>

      {/* Error message */}
      {localError && (
        <div className="mfa-alert error">
          <AlertCircle size={16} />
          <p>{localError}</p>
        </div>
      )}

      {/* Main content */}
      {showSetupFlow ? (
        <div className="mfa-setup-flow">
          {/* Setup Step Indicator */}
          <div className="mfa-setup-stepper">
            <div
              className={`stepper-step ${activeStep >= 0 ? "active" : ""} ${
                activeStep > 0 ? "completed" : ""
              }`}
            >
              <div className="step-indicator">
                {activeStep > 0 ? <CheckCircle size={18} /> : <span>1</span>}
              </div>
              <div className="step-label">Select Method</div>
            </div>

            <div className="stepper-connector"></div>

            <div
              className={`stepper-step ${activeStep >= 1 ? "active" : ""} ${
                activeStep > 1 ? "completed" : ""
              }`}
            >
              <div className="step-indicator">
                {activeStep > 1 ? <CheckCircle size={18} /> : <span>2</span>}
              </div>
              <div className="step-label">Setup</div>
            </div>

            <div className="stepper-connector"></div>

            <div
              className={`stepper-step ${activeStep >= 2 ? "active" : ""} ${
                activeStep > 2 ? "completed" : ""
              }`}
            >
              <div className="step-indicator">
                {activeStep > 2 ? <CheckCircle size={18} /> : <span>3</span>}
              </div>
              <div className="step-label">Verify</div>
            </div>
          </div>

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
                      Receive verification codes via email at{" "}
                      {currentUser?.email}
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
                <button onClick={resetSetupFlow} className="cancel-button">
                  Cancel
                </button>
                <button
                  onClick={initiateSetup}
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
                        After verifying the code, your email address will be
                        used for authentication each time you sign in.
                      </li>
                    </ol>
                  </div>
                </>
              )}

              <div className="mfa-setup-actions">
                <button
                  onClick={() => setActiveStep(0)}
                  className="cancel-button"
                >
                  Back
                </button>
                <button
                  onClick={initiateSetup}
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

              <div className="verification-code-container">
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
                  onClick={() => setActiveStep(1)}
                  className="cancel-button"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerification}
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
            </div>
          )}

          {/* Step 4: Success */}
          {activeStep === 3 && (
            <div className="mfa-setup-step">
              <div className="mfa-setup-success">
                <CheckCircle size={48} className="success-icon" />
                <h3>Setup Complete!</h3>
                <p>
                  Your {getMethodName(selectedMethod)} has been successfully set
                  up. You will now be prompted for a verification code when you
                  log in.
                </p>
                <button onClick={resetSetupFlow} className="done-button">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mfa-content">
          <div className="mfa-info">
            <p>
              Two-factor authentication adds an extra layer of security to your
              account. In addition to your password, you'll need to provide a
              verification code when signing in.
            </p>
          </div>

          {userMfaMethods.length === 0 ? (
            <div className="no-methods">
              <p>You haven't set up any authentication methods yet.</p>
              <button className="setup-mfa-button" onClick={startSetup}>
                <Shield size={16} />
                <span>Set Up Two-Factor Authentication</span>
              </button>
            </div>
          ) : (
            <div className="mfa-methods-list">
              <h3>Your Authentication Methods</h3>

              {userMfaMethods.map((method) => (
                <div key={method.id} className="mfa-method-item">
                  <div className="method-icon-container">
                    {method.type === "totp" ? (
                      <Smartphone className="method-icon totp" />
                    ) : method.type === "email" ? (
                      <Mail className="method-icon email" />
                    ) : (
                      <Shield className="method-icon" />
                    )}
                  </div>

                  <div className="method-details">
                    <div className="method-type">
                      <span className="method-name">
                        {getMethodName(method.type)}
                      </span>
                      <span className="verified-badge">
                        <CheckCircle size={14} />
                        Verified
                      </span>
                    </div>

                    <div className="method-info">
                      {method.identifier && <span>{method.identifier}</span>}
                      <span className="method-date">
                        Added:{" "}
                        {new Date(
                          method.createdAt || Date.now()
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="method-actions">
                    {showDeleteConfirmation &&
                    deletingMethodId === method.id ? (
                      <div className="delete-confirm">
                        <button
                          className="delete-confirm-button"
                          onClick={() => handleRemoveMfa(method.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader size={14} className="spinner" />
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          className="delete-cancel-button"
                          onClick={() => {
                            setShowDeleteConfirmation(false);
                            setDeletingMethodId(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="delete-method-button"
                        onClick={() => {
                          setDeletingMethodId(method.id);
                          setShowDeleteConfirmation(true);
                        }}
                        title="Remove MFA method"
                      >
                        <Trash2 size={16} />
                        <span className="sr-only">Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirmation && (
        <div className="confirmation-dialog-overlay">
          <div className="confirmation-dialog">
            <h3>Remove Authentication Method?</h3>
            <p>Are you sure you want to remove this authentication method?</p>
            {userMfaMethods.length === 1 && (
              <p className="warning-text">
                This is your only MFA method. Removing it will disable
                two-factor authentication completely, reducing your account
                security.
              </p>
            )}
            <div className="confirmation-actions">
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setDeletingMethodId(null);
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveMfa(deletingMethodId)}
                className="confirm-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader size={16} className="spinner" />
                ) : (
                  <>
                    <Trash2 size={16} />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MFAModule;
