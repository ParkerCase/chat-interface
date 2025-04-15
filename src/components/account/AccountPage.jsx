// src/components/account/AccountPage.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import SecurityCenter from "../security/SecurityCenter";
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
import PasswordChange from "./PasswordChange"; // Import the dedicated PasswordChange component
import "./AccountSettings.css";

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
                Add an extra layer of security to your account
              </p>

              <MFAModule setSuccessMessage={setSuccess} setError={setError} />

              {/* Add Security Center */}
              <SecurityCenter />
            </div>
          )}

          {/* Password Tab - Use the dedicated PasswordChange component */}
          {activeTab === "password" && (
            <PasswordChange
              setSuccessMessage={setSuccess}
              setError={setError}
            />
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
      console.log("ProfileSection received updated currentUser:", currentUser);
      setFormData({
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
    </div>
  );
}

export default AccountPage;
