// src/components/account/AccountPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  User,
  Shield,
  Key,
  LogOut,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  CheckCircle,
  Globe,
  Clock,
  Trash,
  Loader,
  RefreshCw,
} from "lucide-react";
import "./AccountSettings.css";
import { supabase } from "../../lib/supabase";

function AccountPage({ tab = "profile" }) {
  const [activeTab, setActiveTab] = useState(tab);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Set initial tab from prop
  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab]);

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
            {currentUser.name?.charAt(0) || "U"}
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
                Your account is secured with email-based two-factor
                authentication
              </p>

              <div className="security-status-card">
                <div className="security-status-icon">
                  <Shield size={24} className="security-icon secure" />
                </div>
                <div className="security-status-content">
                  <h4>Two-Factor Authentication</h4>
                  <p className="status-text">
                    <span className="status-badge enabled">Enabled</span>
                    Email verification is required each time you sign in
                  </p>
                </div>
              </div>

              <div className="security-info">
                <h4>About Two-Factor Authentication</h4>
                <p>
                  Two-factor authentication adds an extra layer of security to
                  your account. When you sign in, you'll receive a verification
                  code via email that you'll need to enter to complete the
                  sign-in process.
                </p>
                <p>
                  This helps ensure that even if someone obtains your password,
                  they won't be able to access your account without access to
                  your email.
                </p>
              </div>
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
    firstName: "",
    lastName: "",
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when user data is available
  useEffect(() => {
    if (currentUser) {
      setFormData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        email: currentUser.email || "",
      });
    }
  }, [currentUser]);

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

      // Only include fields that have changed
      const updates = {};
      if (formData.firstName !== currentUser.firstName)
        updates.firstName = formData.firstName;
      if (formData.lastName !== currentUser.lastName)
        updates.lastName = formData.lastName;

      // Combine first and last name for display purposes
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      if (
        fullName !==
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
      ) {
        updates.name = fullName;
      }

      // Only call API if there are changes
      if (Object.keys(updates).length > 0) {
        const success = await updateProfile(updates);

        if (success) {
          setSuccess("Profile updated successfully");
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
              required
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
              required
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
  const [isRequestSent, setIsRequestSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();

  const requestPasswordReset = async () => {
    if (!currentUser?.email) {
      setError("Email address not found. Please try again later.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const { error } = await supabase.auth.resetPasswordForEmail(
        currentUser.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      setIsRequestSent(true);
      setSuccess(
        `Password reset link sent to ${currentUser.email}. Please check your email.`
      );
    } catch (error) {
      console.error("Password reset request error:", error);
      setError("Failed to send password reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="password-settings">
      <h3>Change Your Password</h3>
      <p className="tab-description">
        Update your password to maintain account security
      </p>

      <div className="password-reset-section">
        <p>
          To reset your password, we'll send a password reset link to your
          email:
          <strong> {currentUser?.email}</strong>
        </p>

        <p className="reset-info">
          Once you receive the email, click the link to set a new password of
          your choice.
        </p>

        <button
          onClick={requestPasswordReset}
          className="reset-password-button"
          disabled={isLoading || isRequestSent}
        >
          {isLoading ? (
            <>
              <Loader className="spinner-sm" />
              Sending Reset Link...
            </>
          ) : isRequestSent ? (
            <>
              <CheckCircle size={18} />
              Reset Link Sent
            </>
          ) : (
            "Send Password Reset Link"
          )}
        </button>
      </div>

      <div className="password-security-tips">
        <h4>Password Security Tips</h4>
        <ul>
          <li>
            <Key size={16} />
            <span>
              Use at least 8 characters with uppercase, lowercase, numbers, and
              special characters
            </span>
          </li>
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
    }
  };

  const handleTerminateAllSessions = async () => {
    if (
      !window.confirm("Are you sure you want to terminate all other sessions?")
    ) {
      return;
    }

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
          <RefreshCw
            style={{ marginBottom: "0" }}
            className={isLoading ? "spinning" : ""}
            size={16}
          />
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
                <Trash size={16} />
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
                  onClick={() => handleTerminateSession(session.id)}
                  className="terminate-session"
                  disabled={isTerminating === session.id}
                  title="Terminate Session"
                >
                  {isTerminating === session.id ? (
                    <Loader className="spinner-sm" />
                  ) : (
                    <Trash size={16} />
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
    </div>
  );
}

export default AccountPage;
