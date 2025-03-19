// src/components/SecuritySettings.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Shield,
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Globe,
  Trash2,
  Clock,
  Plus,
  X,
  Loader,
  Save,
} from "lucide-react";
import "./SecuritySettings.css";

function SecuritySettings() {
  // MFA section state
  const [userMfaMethods, setUserMfaMethods] = useState([]);
  const [deletingMethod, setDeletingMethod] = useState(null);
  const [showMfaConfirmation, setShowMfaConfirmation] = useState(false);

  // Password section state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  // Sessions section state
  const [activeSessions, setActiveSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [terminatingSession, setTerminatingSession] = useState(null);
  const [terminatingAllSessions, setTerminatingAllSessions] = useState(false);

  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const {
    currentUser,
    getSessions,
    terminateSession,
    terminateAllSessions,
    changePassword,
    removeMfa,
    error: authError,
    setError: setAuthError,
  } = useAuth();
  const [formError, setFormError] = useState("");

  const navigate = useNavigate();

  // Load MFA methods from current user
  useEffect(() => {
    if (currentUser && currentUser.mfaMethods) {
      setUserMfaMethods(currentUser.mfaMethods);
    }
  }, [currentUser]);

  // Update password validation checks on password change
  useEffect(() => {
    setPasswordChecks({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
      match: newPassword === confirmPassword && newPassword !== "",
    });
  }, [newPassword, confirmPassword]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle password change form submission
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setFormError("");
    setAuthError("");

    // All validation checks should pass
    const allChecksPass = Object.values(passwordChecks).every((check) => check);

    if (!allChecksPass) {
      setFormError("Please ensure all password requirements are met");
      return;
    }

    try {
      setIsLoading(true);

      // Call the change password function
      const success = await changePassword(currentPassword, newPassword);

      if (success) {
        setSuccessMessage("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
      }
    } catch (error) {
      setFormError("Failed to change password. Please try again.");
      console.error("Password change error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA removal
  const handleRemoveMfa = async (methodId) => {
    try {
      setDeletingMethod(methodId);

      // Call the remove MFA function
      const success = await removeMfa(methodId);

      if (success) {
        // Update the list of MFA methods
        setUserMfaMethods(
          userMfaMethods.filter((method) => method.id !== methodId)
        );
        setSuccessMessage("MFA method removed successfully");
      }
    } catch (error) {
      setFormError("Failed to remove MFA method. Please try again.");
      console.error("MFA removal error:", error);
    } finally {
      setDeletingMethod(null);
      setShowMfaConfirmation(false);
    }
  };

  // Load active sessions
  const loadActiveSessions = async () => {
    try {
      setIsLoadingSessions(true);

      // Call the getSessions function
      const sessions = await getSessions();

      if (sessions) {
        setActiveSessions(sessions);
      }
    } catch (error) {
      setFormError("Failed to load active sessions. Please try again.");
      console.error("Load sessions error:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Toggle sessions section and load sessions if not loaded
  const toggleSessionsSection = () => {
    const newState = !showSessions;
    setShowSessions(newState);

    if (newState && activeSessions.length === 0) {
      loadActiveSessions();
    }
  };

  // Handle session termination
  const handleTerminateSession = async (sessionId) => {
    try {
      setTerminatingSession(sessionId);

      // Call the terminateSession function
      const success = await terminateSession(sessionId);

      if (success) {
        // Update the list of sessions
        setActiveSessions(
          activeSessions.filter((session) => session.id !== sessionId)
        );
        setSuccessMessage("Session terminated successfully");
      }
    } catch (error) {
      setFormError("Failed to terminate session. Please try again.");
      console.error("Terminate session error:", error);
    } finally {
      setTerminatingSession(null);
    }
  };

  // Handle all sessions termination
  const handleTerminateAllSessions = async () => {
    try {
      setTerminatingAllSessions(true);

      // Call the terminateAllSessions function
      const success = await terminateAllSessions();

      if (success) {
        // Keep only current session
        setActiveSessions(
          activeSessions.filter((session) => session.isCurrent)
        );
        setSuccessMessage("All other sessions terminated successfully");
      }
    } catch (error) {
      setFormError("Failed to terminate all sessions. Please try again.");
      console.error("Terminate all sessions error:", error);
    } finally {
      setTerminatingAllSessions(false);
    }
  };

  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";

    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get human-readable MFA method type
  const getMfaMethodName = (type) => {
    switch (type) {
      case "totp":
        return "Authenticator App";
      case "email":
        return "Email";
      case "sms":
        return "SMS";
      default:
        return type;
    }
  };

  // Get MFA method icon
  const getMfaMethodIcon = (type) => {
    switch (type) {
      case "totp":
        return <Smartphone size={20} />;
      case "email":
        return <Mail size={20} />;
      case "sms":
        return <Smartphone size={20} />;
      default:
        return <Shield size={20} />;
    }
  };

  return (
    <div className="security-settings-container">
      <div className="security-page-header">
        <h1>
          <Shield className="page-icon" />
          Security Settings
        </h1>
        <p>Manage your account security settings and devices</p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="success-message-container">
          <div className="success-alert">
            <CheckCircle className="success-icon" />
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {(formError || authError) && (
        <div className="error-alert">
          <AlertCircle className="error-icon" />
          <p>{formError || authError}</p>
        </div>
      )}

      <div className="security-sections">
        {/* Two-Factor Authentication Section */}
        <section className="security-section">
          <div className="section-header">
            <h2>
              <Shield size={20} />
              Two-Factor Authentication
            </h2>
            <p>
              Add an extra layer of security to your account by requiring a
              verification code in addition to your password.
            </p>
          </div>

          <div className="section-content">
            {userMfaMethods && userMfaMethods.length > 0 ? (
              <div className="mfa-methods-list">
                {userMfaMethods.map((method) => (
                  <div key={method.id} className="mfa-method-item">
                    <div className="method-info">
                      <div className="method-icon">
                        {getMfaMethodIcon(method.type)}
                      </div>
                      <div className="method-details">
                        <h4>{getMfaMethodName(method.type)}</h4>
                        {method.identifier && <p>{method.identifier}</p>}
                        {method.lastUsed && (
                          <p className="method-last-used">
                            Last used: {formatDate(method.lastUsed)}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setDeletingMethod(method.id);
                        setShowMfaConfirmation(true);
                      }}
                      className="method-delete-button"
                      disabled={deletingMethod === method.id}
                      aria-label={`Remove ${getMfaMethodName(method.type)}`}
                    >
                      {deletingMethod === method.id ? (
                        <Loader className="spinner" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => navigate("/mfa/setup")}
                  className="add-method-button"
                >
                  <Plus size={16} />
                  Add Another Method
                </button>
              </div>
            ) : (
              <div className="mfa-not-enabled">
                <p>
                  You don't have two-factor authentication enabled. We strongly
                  recommend enabling this feature to enhance your account
                  security.
                </p>
                <button
                  onClick={() => navigate("/mfa/setup")}
                  className="enable-mfa-button"
                >
                  Enable Two-Factor Authentication
                </button>
              </div>
            )}
          </div>

          {/* MFA Removal Confirmation Dialog */}
          {showMfaConfirmation && (
            <div className="confirmation-dialog">
              <div className="confirmation-content">
                <h3>Remove MFA Method?</h3>
                <p>
                  Are you sure you want to remove this authentication method?
                  This will reduce the security of your account.
                </p>
                {userMfaMethods.length === 1 && (
                  <p className="warning-text">
                    This is your only MFA method. Removing it will disable
                    two-factor authentication completely.
                  </p>
                )}
                <div className="confirmation-actions">
                  <button
                    onClick={() => setShowMfaConfirmation(false)}
                    className="cancel-button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRemoveMfa(deletingMethod)}
                    className="confirm-button"
                    disabled={deletingMethod === null}
                  >
                    {deletingMethod !== null &&
                    userMfaMethods.find((m) => m.id === deletingMethod)?.id ===
                      deletingMethod ? (
                      <>
                        <Trash2 size={16} />
                        Remove
                      </>
                    ) : (
                      <>
                        <Loader className="spinner" size={16} />
                        Removing...
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Password Section */}
        <section className="security-section">
          <div className="section-header">
            <h2>
              <Lock size={20} />
              Password
            </h2>
            <p>
              Change your password to keep your account secure. Use a strong,
              unique password that you don't use elsewhere.
            </p>
          </div>

          <div className="section-content">
            {showPasswordSection ? (
              <form onSubmit={handlePasswordChange} className="password-form">
                {/* Current Password Field */}
                <div className="form-group">
                  <label htmlFor="current-password">Current Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      id="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="form-input"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      aria-label={
                        showCurrentPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showCurrentPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password Field */}
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="form-input"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={
                        showNewPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>

                  {/* Password requirements */}
                  <div className="password-requirements">
                    <p className="requirements-title">Password must contain:</p>
                    <ul>
                      <li className={passwordChecks.length ? "passed" : ""}>
                        {passwordChecks.length ? (
                          <CheckCircle size={14} />
                        ) : (
                          <X size={14} />
                        )}
                        <span>At least 8 characters</span>
                      </li>
                      <li className={passwordChecks.uppercase ? "passed" : ""}>
                        {passwordChecks.uppercase ? (
                          <CheckCircle size={14} />
                        ) : (
                          <X size={14} />
                        )}
                        <span>At least one uppercase letter</span>
                      </li>
                      <li className={passwordChecks.lowercase ? "passed" : ""}>
                        {passwordChecks.lowercase ? (
                          <CheckCircle size={14} />
                        ) : (
                          <X size={14} />
                        )}
                        <span>At least one lowercase letter</span>
                      </li>
                      <li className={passwordChecks.number ? "passed" : ""}>
                        {passwordChecks.number ? (
                          <CheckCircle size={14} />
                        ) : (
                          <X size={14} />
                        )}
                        <span>At least one number</span>
                      </li>
                      <li className={passwordChecks.special ? "passed" : ""}>
                        {passwordChecks.special ? (
                          <CheckCircle size={14} />
                        ) : (
                          <X size={14} />
                        )}
                        <span>At least one special character</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Confirm New Password Field */}
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`form-input ${
                        confirmPassword && !passwordChecks.match
                          ? "password-mismatch"
                          : ""
                      }`}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {confirmPassword && !passwordChecks.match && (
                    <p className="password-mismatch-text">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordSection(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="cancel-button"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="save-button"
                    disabled={
                      isLoading ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword ||
                      !Object.values(passwordChecks).every((check) => check)
                    }
                  >
                    {isLoading ? (
                      <>
                        <Loader className="spinner" size={16} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="password-change-prompt">
                <p>
                  It's a good practice to change your password regularly. Your
                  password was last changed on{" "}
                  <strong>
                    {currentUser?.passwordLastChanged
                      ? formatDate(currentUser.passwordLastChanged)
                      : "Unknown date"}
                  </strong>
                  .
                </p>
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="change-password-button"
                >
                  Change Password
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Active Sessions Section */}
        <section className="security-section">
          <div
            className="section-header clickable"
            onClick={toggleSessionsSection}
          >
            <h2>
              <Globe size={20} />
              Active Sessions
            </h2>
            <button
              className="toggle-section-button"
              aria-label={showSessions ? "Hide sessions" : "Show sessions"}
            >
              {showSessions ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>

          {showSessions && (
            <div className="section-content">
              {isLoadingSessions ? (
                <div className="sessions-loading">
                  <Loader className="spinner" size={24} />
                  <p>Loading active sessions...</p>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="no-sessions">
                  <p>No active sessions found.</p>
                </div>
              ) : (
                <>
                  <div className="sessions-intro">
                    <p>
                      These are your currently active sessions. If you don't
                      recognize a session, you can terminate it to secure your
                      account.
                    </p>
                    {activeSessions.length > 1 && (
                      <button
                        onClick={handleTerminateAllSessions}
                        className="terminate-all-button"
                        disabled={terminatingAllSessions}
                      >
                        {terminatingAllSessions ? (
                          <>
                            <Loader className="spinner" size={16} />
                            Terminating All...
                          </>
                        ) : (
                          <>
                            <LogOut size={16} />
                            Logout from All Other Devices
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="sessions-list">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`session-item ${
                          session.isCurrent ? "current-session" : ""
                        }`}
                      >
                        <div className="session-info">
                          <div className="session-device">
                            <div className="device-icon">
                              <Globe size={20} />
                            </div>
                            <div className="device-details">
                              <h4>
                                {session.browser} on {session.device}
                                {session.isCurrent && (
                                  <span className="current-badge">Current</span>
                                )}
                              </h4>
                              <p className="session-location">
                                {session.ipAddress}
                                {session.location && ` • ${session.location}`}
                              </p>
                              <p className="session-time">
                                <Clock size={14} />
                                <span>
                                  Last active: {formatDate(session.lastActive)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {!session.isCurrent && (
                            <button
                              onClick={() => handleTerminateSession(session.id)}
                              className="terminate-button"
                              disabled={terminatingSession === session.id}
                              aria-label="Terminate session"
                            >
                              {terminatingSession === session.id ? (
                                <Loader className="spinner" size={16} />
                              ) : (
                                <LogOut size={16} />
                              )}
                            </button>
                          )}
                        </div>

                        {session.mfaVerified && (
                          <div className="session-mfa-verified">
                            <Shield size={14} />
                            <span>2FA Verified</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SecuritySettings;
