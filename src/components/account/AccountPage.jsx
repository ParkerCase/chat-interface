// src/components/account/AccountPage.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import SecurityCenter from "../security/SecurityCenter";
import AuthDebugHelper from "../../utils/AuthDebugHelper";
import { useNavigate } from "react-router-dom";
import {
  User,
  Shield,
  Key,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Settings,
  Save,
  AlertCircle,
  CheckCircle,
  X,
  Globe,
  Clock,
  Trash2,
  Loader,
} from "lucide-react";
import MFAModule from "./MFAModule";
import "./AccountSettings.css";

function AccountPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setError("Failed to log out. Please try again.");
    }
  };

  if (!currentUser) {
    return (
      <div className="account-loading">
        <div className="spinner"></div>
        <p>Loading account information...</p>
      </div>
    );
  }

  return (
    <div className="account-settings-container">
      <div className="account-settings-header">
        <div className="account-info">
          <div className="account-avatar">
            <User size={28} />
          </div>
          <div className="account-details">
            <h2>{currentUser.name}</h2>
            <p>{currentUser.email}</p>
          </div>
        </div>

        <button onClick={handleLogout} className="logout-button">
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="success-message">
          <CheckCircle className="success-icon" />
          <p>{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <AlertCircle className="error-icon" />
          <p>{error}</p>
        </div>
      )}

      <div className="account-settings-content">
        <div className="account-tabs">
          <button
            className={`account-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={20} />
            <span>Profile</span>
          </button>

          <button
            className={`account-tab ${
              activeTab === "security" ? "active" : ""
            }`}
            onClick={() => setActiveTab("security")}
          >
            <Shield size={20} />
            <span>Security</span>
          </button>

          <button
            className={`account-tab ${
              activeTab === "password" ? "active" : ""
            }`}
            onClick={() => setActiveTab("password")}
          >
            <Key size={20} />
            <span>Password</span>
          </button>

          <button
            className={`account-tab ${
              activeTab === "sessions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("sessions")}
          >
            <Globe size={20} />
            <span>Sessions</span>
          </button>
        </div>

        <div className="account-tab-content">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <ProfileSection setSuccess={setSuccess} setError={setError} />
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="security-section">
              <h3>Two-Factor Authentication</h3>
              <p className="tab-description">
                Add an extra layer of security to your account
              </p>

              <MFAModule setSuccessMessage={setSuccess} setError={setError} />

              {/* Add Security Center */}
              <SecurityCenter />
            </div>
          )}

          {/* Password Tab */}
          {activeTab === "password" && (
            <PasswordSection setSuccess={setSuccess} setError={setError} />
          )}

          {/* Sessions Tab */}
          {activeTab === "sessions" && (
            <SessionsSection setSuccess={setSuccess} setError={setError} />
          )}
        </div>
      </div>
    </div>
  );
}

// Profile Information Section
function ProfileSection({ setSuccess, setError }) {
  const { currentUser, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when user data is available
  useEffect(() => {
    if (currentUser) {
      console.log("ProfileSection received updated currentUser:", currentUser);
      setFormData({
        name: currentUser.name || "",
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        email: currentUser.email || "",
      });
    }
  }, [currentUser]); // This will re-run whenever currentUser changes

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setIsLoading(true);
      console.log("Starting profile update with current form data:", formData);
      console.log("Current user data:", currentUser);

      // Only include fields that have changed
      const updates = {};
      if (formData.name !== currentUser.name) updates.name = formData.name;
      if (formData.firstName !== currentUser.firstName)
        updates.firstName = formData.firstName;
      if (formData.lastName !== currentUser.lastName)
        updates.lastName = formData.lastName;

      console.log("Detected changes:", updates);

      // Only call API if there are changes
      if (Object.keys(updates).length > 0) {
        console.log("Calling updateProfile with changes:", updates);
        const success = await updateProfile(updates);

        if (success) {
          // Force refresh current user data to ensure UI is in sync
          console.log("Profile update reported success");
          setSuccess("Profile updated successfully");

          // Manually update the form with the latest changes to ensure UI reflects changes
          setFormData((prevData) => ({
            ...prevData,
            ...updates,
          }));

          // Force page refresh to ensure all components reflect the updated name
          // This is important for the header/navbar that displays the user name
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setError("Profile update failed. Please try again.");
        }
      } else {
        setSuccess("No changes to save");
      }
    } catch (error) {
      setError("Failed to update profile. Please try again.");
      console.error("Profile update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="profile-settings">
      <h3>Profile Information</h3>
      <p className="tab-description">Update your personal information</p>

      <form onSubmit={handleProfileUpdate} className="profile-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="form-input"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            className="form-input"
            disabled
          />
          <p className="input-help">Email address cannot be changed</p>
        </div>

        <button type="submit" className="save-button" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader className="spinner-sm" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// Password Change Section
function PasswordSection({ setSuccess, setError }) {
  const { changePassword } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  // Update password validation checks on password changes
  useEffect(() => {
    setPasswordChecks({
      length: formData.newPassword.length >= 8,
      uppercase: /[A-Z]/.test(formData.newPassword),
      lowercase: /[a-z]/.test(formData.newPassword),
      number: /[0-9]/.test(formData.newPassword),
      special: /[^A-Za-z0-9]/.test(formData.newPassword),
      match:
        formData.newPassword === formData.confirmPassword &&
        formData.newPassword !== "",
    });
  }, [formData.newPassword, formData.confirmPassword]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate form
    if (!formData.currentPassword) {
      setError("Current password is required");
      return;
    }

    if (!formData.newPassword) {
      setError("New password is required");
      return;
    }

    // All validation checks should pass
    const allChecksPass = Object.values(passwordChecks).every((check) => check);

    if (!allChecksPass) {
      setError("Please ensure all password requirements are met");
      return;
    }

    // Ensure passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      setIsLoading(true);

      console.log("Changing password - submitting to AuthContext");
      const success = await changePassword(
        formData.currentPassword,
        formData.newPassword
      );

      if (success) {
        console.log("Password change reported as successful");
        setSuccess("Password changed successfully");

        // Reset form
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Show completion message for longer
        setTimeout(() => {
          setSuccess(
            "Password change complete. Your new password is now active."
          );
        }, 1000);
      } else {
        console.error("Password change returned false");
        setError("Password change failed. Please try again.");
      }
    } catch (error) {
      console.error("Password change error:", error);
      setError(
        error.message ||
          "Failed to change password. Please verify your current password is correct."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="password-change-container">
      <h3>Change Password</h3>
      <p className="tab-description">
        Update your password to maintain account security
      </p>

      <form onSubmit={handleSubmit} className="password-change-form">
        {/* Current Password */}
        <div className="form-group">
          <label htmlFor="currentPassword">Current Password</label>
          <div className="password-input-wrapper">
            <input
              type={showCurrentPassword ? "text" : "password"}
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleInputChange}
              className="form-input"
              disabled={isLoading}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              aria-label={
                showCurrentPassword ? "Hide password" : "Show password"
              }
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="form-group">
          <label htmlFor="newPassword">New Password</label>
          <div className="password-input-wrapper">
            <input
              type={showNewPassword ? "text" : "password"}
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              className="form-input"
              disabled={isLoading}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowNewPassword(!showNewPassword)}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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

        {/* Confirm Password */}
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm New Password</label>
          <div className="password-input-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`form-input ${
                formData.confirmPassword && !passwordChecks.match
                  ? "password-mismatch"
                  : ""
              }`}
              disabled={isLoading}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formData.confirmPassword && !passwordChecks.match && (
            <p className="password-mismatch-text">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          className="password-change-button"
          disabled={
            isLoading || !Object.values(passwordChecks).every((check) => check)
          }
        >
          {isLoading ? (
            <>
              <Loader className="spinner-sm" />
              Changing Password...
            </>
          ) : (
            <>
              <Save size={18} />
              Change Password
            </>
          )}
        </button>
      </form>

      <div className="password-security-tips">
        <h4>Password Security Tips</h4>
        <ul>
          <li>
            <Key size={16} />
            <span>Don't reuse passwords across multiple sites</span>
          </li>
          <li>
            <Key size={16} />
            <span>
              Consider using a password manager to generate and store strong
              passwords
            </span>
          </li>
          <li>
            <Key size={16} />
            <span>
              Change your password regularly, especially if you suspect your
              account has been compromised
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Active Sessions Section
function SessionsSection({ setSuccess, setError }) {
  const { getActiveSessions, terminateSession, terminateAllSessions } =
    useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTerminating, setIsTerminating] = useState(null);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);
  const [showConfirmTerminate, setShowConfirmTerminate] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState(null);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const sessionData = await getActiveSessions();
      setSessions(sessionData || []);
    } catch (error) {
      setError("Failed to load sessions. Please try again.");
      console.error("Session fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId) => {
    try {
      setIsTerminating(sessionId);

      const success = await terminateSession(sessionId);

      if (success) {
        // Remove session from the list
        setSessions(sessions.filter((session) => session.id !== sessionId));
        setSuccess("Session terminated successfully");
      } else {
        setError("Failed to terminate session");
      }
    } catch (error) {
      setError("Failed to terminate session");
      console.error("Session termination error:", error);
    } finally {
      setIsTerminating(false);
      setShowConfirmTerminate(false);
      setSessionToTerminate(null);
    }
  };

  const handleTerminateAllSessions = async () => {
    try {
      setIsTerminatingAll(true);

      const success = await terminateAllSessions();

      if (success) {
        // Keep only current session
        const currentSession = sessions.find((session) => session.isCurrent);
        setSessions(currentSession ? [currentSession] : []);
        setSuccess("All other sessions terminated successfully");
      } else {
        setError("Failed to terminate sessions");
      }
    } catch (error) {
      setError("Failed to terminate sessions");
      console.error("All sessions termination error:", error);
    } finally {
      setIsTerminatingAll(false);
    }
  };

  // Helper function to format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "Unknown";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="session-management-container">
      <h3>Active Sessions</h3>
      <p className="tab-description">
        Manage all devices that are currently logged into your account
      </p>

      <div className="sessions-header">
        <button
          className="refresh-sessions"
          onClick={fetchSessions}
          disabled={isLoading}
        >
          <Loader className={isLoading ? "spinning" : ""} size={16} />
          <span>{isLoading ? "Loading..." : "Refresh"}</span>
        </button>

        {sessions.length > 1 && (
          <button
            className="terminate-all-button"
            onClick={handleTerminateAllSessions}
            disabled={isTerminatingAll}
          >
            {isTerminatingAll ? (
              <>
                <Loader className="spinner-sm" />
                Terminating...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Terminate All Other Sessions
              </>
            )}
          </button>
        )}
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="sessions-loading">
          <div className="spinner"></div>
          <p>Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="no-sessions">
          <p>No active sessions found</p>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${
                session.isCurrent ? "current-session" : ""
              }`}
            >
              <div className="session-icon">
                <Globe size={20} />
              </div>

              <div className="session-details">
                <div className="session-device">
                  <h5>
                    {session.browser} on {session.device}
                    {session.isCurrent && (
                      <span className="current-badge">Current</span>
                    )}
                  </h5>
                </div>

                <div className="session-meta">
                  <div className="session-ip">
                    <span className="meta-label">IP Address:</span>
                    <span>{session.ipAddress}</span>
                  </div>

                  <div className="session-time">
                    <Clock size={14} />
                    <span>Last active {formatTime(session.lastActive)}</span>
                  </div>

                  {session.mfaVerified && (
                    <div className="session-mfa-verified">
                      <Shield size={14} />
                      <span>2FA Verified</span>
                    </div>
                  )}
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => {
                    setSessionToTerminate(session.id);
                    setShowConfirmTerminate(true);
                  }}
                  className="terminate-session"
                  disabled={isTerminating === session.id}
                  title="Terminate Session"
                >
                  {isTerminating === session.id ? (
                    <Loader className="spinner-sm" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="sessions-info">
        <h4>About Sessions</h4>
        <ul>
          <li>
            <strong>Current Session:</strong> This is the device you're
            currently using.
          </li>
          <li>
            <strong>Session Expiry:</strong> Sessions expire after 24 hours of
            inactivity.
          </li>
          <li>
            <strong>Security Tip:</strong> Regularly review your active sessions
            and terminate any that you don't recognize.
          </li>
        </ul>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmTerminate && (
        <div className="confirmation-dialog-overlay">
          <div className="confirmation-dialog">
            <h3>Terminate Session</h3>
            <p>Are you sure you want to terminate this session?</p>
            <p>This will log the device out immediately.</p>

            <div className="confirmation-actions">
              <button
                onClick={() => {
                  setShowConfirmTerminate(false);
                  setSessionToTerminate(null);
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTerminateSession(sessionToTerminate)}
                className="confirm-button"
                disabled={isTerminating}
              >
                {isTerminating ? (
                  <Loader className="spinner-sm" />
                ) : (
                  "Terminate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {process.env.NODE_ENV !== "production" && <AuthDebugHelper />}
    </div>
  );
}

export default AccountPage;
