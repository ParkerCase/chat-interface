import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import {
  Loader2,
  Shield,
  Lock,
  Smartphone,
  Mail,
  QrCode,
  Plus,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Trash2,
} from "lucide-react";
import "./MFAManagement.css";

function MFAManagement() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Setup state
  const [showSetup, setShowSetup] = useState(false);
  const [setupType, setSetupType] = useState("totp");
  const [setupStep, setSetupStep] = useState(1);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchMFAMethods();
  }, []);

  // Reset setup state when closing dialog
  useEffect(() => {
    if (!showSetup) {
      setSetupStep(1);
      setSetupData(null);
      setVerificationCode("");
      setPhoneNumber("");
      setEmail("");
      setError("");
      setSuccess("");
    }
  }, [showSetup]);

  // Initialize email with user's email
  useEffect(() => {
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  const fetchMFAMethods = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/mfa/methods");

      if (response.data.success) {
        setMethods(response.data.methods || []);
      } else {
        setError("Failed to load MFA methods");
      }
    } catch (error) {
      console.error("Error fetching MFA methods:", error);
      setError("Failed to load MFA methods");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMFA = async () => {
    try {
      setError("");
      setSuccess("");

      const payload = { type: setupType };

      // Add type-specific data
      if (setupType === "sms") {
        if (!phoneNumber) {
          setError("Phone number is required");
          return;
        }
        payload.phoneNumber = phoneNumber;
      } else if (setupType === "email") {
        if (!email) {
          setError("Email address is required");
          return;
        }
        payload.email = email;
      }

      const response = await api.post("/api/mfa/setup", payload);

      if (response.data.success) {
        setSetupData(response.data);
        setSetupStep(2);

        if (setupType === "totp") {
          setSuccess("Scan the QR code with your authenticator app");
        } else {
          setSuccess(response.data.message);
        }
      } else {
        setError(response.data.error);
      }
    } catch (error) {
      console.error("Error setting up MFA:", error);
      setError(error.response?.data?.error || "Failed to set up MFA");
    }
  };

  const handleVerifySetup = async () => {
    try {
      setError("");
      setSuccess("");

      if (!verificationCode) {
        setError("Verification code is required");
        return;
      }

      if (!setupData?.methodId) {
        setError("Invalid setup state. Please try again.");
        return;
      }

      const response = await api.post("/api/mfa/verify-setup", {
        methodId: setupData.methodId,
        code: verificationCode,
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setSetupStep(3);

        // Refresh methods list
        await fetchMFAMethods();
      } else {
        setError(response.data.error);
      }
    } catch (error) {
      console.error("Error verifying MFA setup:", error);
      setError(error.response?.data?.error || "Failed to verify MFA setup");
    }
  };

  const handleDeleteMethod = async (methodId) => {
    try {
      setError("");
      setSuccess("");

      if (deleteConfirm !== methodId) {
        setDeleteConfirm(methodId);
        return;
      }

      const response = await api.delete(`/api/mfa/methods/${methodId}`);

      if (response.data.success) {
        setSuccess("MFA method deleted successfully");
        setDeleteConfirm(null);

        // Update methods list
        setMethods(methods.filter((m) => m.id !== methodId));
      } else {
        setError(response.data.error);
      }
    } catch (error) {
      console.error("Error deleting MFA method:", error);
      setError(error.response?.data?.error || "Failed to delete MFA method");
    }
  };

  const resendVerificationCode = async () => {
    try {
      setError("");
      setSuccess("");

      if (!setupData?.methodId) {
        setError("Invalid setup state. Please try again.");
        return;
      }

      const response = await api.post("/api/mfa/challenge", {
        methodId: setupData.methodId,
      });

      if (response.data.success) {
        setSuccess(response.data.message);
      } else {
        setError(response.data.error);
      }
    } catch (error) {
      console.error("Error resending verification code:", error);
      setError(
        error.response?.data?.error || "Failed to resend verification code"
      );
    }
  };

  const renderMethodTypeIcon = (type) => {
    switch (type) {
      case "totp":
        return <QrCode className="method-icon totp" />;
      case "sms":
        return <Smartphone className="method-icon sms" />;
      case "email":
        return <Mail className="method-icon email" />;
      default:
        return <Lock className="method-icon" />;
    }
  };

  const getMethodTypeName = (type) => {
    switch (type) {
      case "totp":
        return "Authenticator App";
      case "sms":
        return "SMS";
      case "email":
        return "Email";
      default:
        return type.toUpperCase();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";

    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const renderSetupDialog = () => {
    if (!showSetup) return null;

    return (
      <div className="mfa-setup-overlay">
        <div className="mfa-setup-dialog">
          <div className="dialog-header">
            <h3>
              {setupStep === 1
                ? "Set Up Two-Factor Authentication"
                : setupStep === 2
                ? "Verify Your MFA Method"
                : "Setup Complete"}
            </h3>
            <button
              className="close-button"
              onClick={() => setShowSetup(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="dialog-content">
            {error && (
              <div className="setup-alert error">
                <AlertCircle size={16} />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="setup-alert success">
                <CheckCircle size={16} />
                <p>{success}</p>
              </div>
            )}

            {setupStep === 1 && (
              <div className="setup-step-1">
                <div className="mfa-type-selection">
                  <button
                    className={`mfa-type-button ${
                      setupType === "totp" ? "active" : ""
                    }`}
                    onClick={() => setSetupType("totp")}
                  >
                    <QrCode size={24} />
                    <span>Authenticator App</span>
                  </button>

                  <button
                    className={`mfa-type-button ${
                      setupType === "email" ? "active" : ""
                    }`}
                    onClick={() => setSetupType("email")}
                  >
                    <Mail size={24} />
                    <span>Email</span>
                  </button>

                  <button
                    className={`mfa-type-button ${
                      setupType === "sms" ? "active" : ""
                    }`}
                    onClick={() => setSetupType("sms")}
                  >
                    <Smartphone size={24} />
                    <span>SMS</span>
                  </button>
                </div>

                {setupType === "sms" && (
                  <div className="setup-form-field">
                    <label htmlFor="phoneNumber">Phone Number</label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                    <p className="field-hint">
                      Include country code (e.g., +1 for US)
                    </p>
                  </div>
                )}

                {setupType === "email" && (
                  <div className="setup-form-field">
                    <label htmlFor="email">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                )}

                {setupType === "totp" && (
                  <div className="setup-info">
                    <p>
                      An authenticator app generates time-based verification
                      codes that you'll use whenever you sign in. This is the
                      most secure MFA option.
                    </p>
                    <p className="setup-note">
                      You'll need an authenticator app like Google
                      Authenticator, Microsoft Authenticator, or Authy installed
                      on your mobile device.
                    </p>
                  </div>
                )}

                <button className="setup-button" onClick={handleSetupMFA}>
                  Continue
                </button>
              </div>
            )}

            {setupStep === 2 && (
              <div className="setup-step-2">
                {setupType === "totp" && setupData?.qrCode && (
                  <div className="qrcode-container">
                    <img
                      src={setupData.qrCode}
                      alt="QR Code"
                      className="qr-code"
                    />
                    <p className="setup-note">
                      Scan this QR code with your authenticator app, or enter
                      the code manually:
                    </p>
                    <div className="secret-key">
                      <code>{setupData.secret}</code>
                    </div>
                  </div>
                )}

                {(setupType === "email" || setupType === "sms") && (
                  <div className="verification-info">
                    <p>
                      A verification code has been sent to your{" "}
                      {setupType === "email" ? "email address" : "phone"}.
                    </p>
                    <button
                      className="resend-button"
                      onClick={resendVerificationCode}
                    >
                      <RefreshCw size={16} />
                      <span>Resend Code</span>
                    </button>
                  </div>
                )}

                <div className="verification-code-input">
                  <label htmlFor="verificationCode">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    id="verificationCode"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\s+/g, ""))
                    }
                    placeholder="000000"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>

                <button className="setup-button" onClick={handleVerifySetup}>
                  Verify
                </button>
              </div>
            )}

            {setupStep === 3 && (
              <div className="setup-step-3">
                <div className="setup-success">
                  <CheckCircle size={48} className="success-icon" />
                  <h4>Setup Complete!</h4>
                  <p>
                    Your {getMethodTypeName(setupType)} has been successfully
                    configured as a two-factor authentication method.
                  </p>
                </div>

                <button
                  className="setup-button"
                  onClick={() => setShowSetup(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && methods.length === 0) {
    return (
      <div className="mfa-management">
        <div className="loading-indicator">
          <Loader2 className="spinner" />
          <p>Loading authentication methods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mfa-management">
      <div className="mfa-header">
        <div className="mfa-title">
          <Shield className="shield-icon" />
          <h2>Two-Factor Authentication</h2>
        </div>
        <button className="mfa-add-button" onClick={() => setShowSetup(true)}>
          <Plus size={16} />
          <span>Add Method</span>
        </button>
      </div>

      {error && (
        <div className="mfa-alert error">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="mfa-alert success">
          <CheckCircle size={16} />
          <p>{success}</p>
        </div>
      )}

      <div className="mfa-content">
        <div className="mfa-info">
          <p>
            Two-factor authentication adds an extra layer of security to your
            account. In addition to your password, you'll need to provide a
            verification code when signing in.
          </p>
        </div>

        {methods.length === 0 ? (
          <div className="no-methods">
            <p>You haven't set up any authentication methods yet.</p>
            <button
              className="setup-mfa-button"
              onClick={() => setShowSetup(true)}
            >
              <Shield size={16} />
              <span>Set Up Two-Factor Authentication</span>
            </button>
          </div>
        ) : (
          <div className="mfa-methods-list">
            <h3>Your Authentication Methods</h3>

            {methods.map((method) => (
              <div key={method.id} className="mfa-method-item">
                <div className="method-icon-container">
                  {renderMethodTypeIcon(method.type)}
                </div>

                <div className="method-details">
                  <div className="method-type">
                    <span className="method-name">
                      {getMethodTypeName(method.type)}
                    </span>
                    {method.verified ? (
                      <span className="verified-badge">
                        <CheckCircle size={14} />
                        Verified
                      </span>
                    ) : (
                      <span className="unverified-badge">
                        <AlertCircle size={14} />
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="method-info">
                    <span>{method.identifier}</span>
                    <span className="method-date">
                      Last Used: {formatDate(method.last_used)}
                    </span>
                  </div>
                </div>

                <div className="method-actions">
                  {deleteConfirm === method.id ? (
                    <div className="delete-confirm">
                      <button
                        className="delete-confirm-button"
                        onClick={() => handleDeleteMethod(method.id)}
                      >
                        Confirm
                      </button>
                      <button
                        className="delete-cancel-button"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="delete-method-button"
                      onClick={() => handleDeleteMethod(method.id)}
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

      {renderSetupDialog()}
    </div>
  );
}

export default MFAManagement;
