// src/components/Profile.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { Loader2, LogOut, Key, AlertCircle, Lock, Shield } from "lucide-react";
import "./Profile.css";

function Profile() {
  const {
    currentUser,
    logout,
    changePassword,
    getActiveSessions,
    revokeSession,
    revokeAllOtherSessions,
  } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Fetch active sessions
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setSessionLoading(true);
      const sessions = await getActiveSessions();
      setSessions(sessions || []);
    } catch (error) {
      setError("Failed to load active sessions");
    } finally {
      setSessionLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    // Validate passwords
    if (!currentPassword) {
      setPasswordError("Current password is required");
      return;
    }

    if (!newPassword) {
      setPasswordError("New password is required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    try {
      setLoading(true);
      const success = await changePassword(currentPassword, newPassword);

      if (success) {
        setPasswordSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setPasswordError("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      setSessionLoading(true);
      const success = await revokeSession(sessionId);

      if (success) {
        setSessions(sessions.filter((s) => s.id !== sessionId));
        setSuccess("Session revoked successfully");
      }
    } catch (error) {
      setError("Failed to revoke session");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      setSessionLoading(true);
      const success = await revokeAllOtherSessions();

      if (success) {
        await fetchSessions();
        setSuccess("All other sessions revoked successfully");
      }
    } catch (error) {
      setError("Failed to revoke sessions");
    } finally {
      setSessionLoading(false);
    }
  };

  if (!currentUser) {
    return <div>Loading user profile...</div>;
  }

  return (
    <div className="profile-container">
      <h1 className="profile-title">My Profile</h1>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <Shield size={16} />
          <span>{success}</span>
        </div>
      )}

      <div className="profile-section">
        <div className="account-info">
          <h2>Account Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{currentUser.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Name:</span>
              <span className="info-value">{currentUser.name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Roles:</span>
              <div className="roles-list">
                {currentUser.roles?.map((role) => (
                  <span key={role} className="role-badge">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button onClick={logout} className="logout-button">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        <div className="password-section">
          <h2>Change Password</h2>

          {passwordError && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="alert alert-success">
              <Shield size={16} />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <div className="input-wrapper">
                <Lock size={16} />
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="input-wrapper">
                <Key size={16} />
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="input-wrapper">
                <Key size={16} />
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="change-password-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Changing...</span>
                </>
              ) : (
                <span>Change Password</span>
              )}
            </button>
          </form>
        </div>

        <div className="sessions-section">
          <div className="sessions-header">
            <h2>Active Sessions</h2>
            <button
              onClick={fetchSessions}
              className="refresh-button"
              disabled={sessionLoading}
            >
              <Loader2
                size={16}
                className={sessionLoading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>
          </div>

          {sessions.length > 1 && (
            <button
              onClick={handleRevokeAllSessions}
              className="revoke-all-button"
              disabled={sessionLoading}
            >
              Revoke All Other Sessions
            </button>
          )}

          {sessions.length === 0 ? (
            <div className="no-sessions">No active sessions found</div>
          ) : (
            <ul className="sessions-list">
              {sessions.map((session) => (
                <li key={session.id} className="session-item">
                  <div className="session-info">
                    <div className="device-info">
                      {/* Customize icon based on device info */}
                      <span className="browser-os">
                        {session.device_info?.browser || "Unknown"} on{" "}
                        {session.device_info?.os || "Unknown Device"}
                      </span>
                    </div>
                    <div className="session-details">
                      <div className="location">
                        {session.geo_info?.city
                          ? `${session.geo_info.city}, ${session.geo_info.country}`
                          : "Unknown location"}
                      </div>
                      <div className="timestamp">
                        Last active:{" "}
                        {new Date(session.last_active).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="session-actions">
                    {/* Don't show revoke button for current session */}
                    {!session.current && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="revoke-session-button"
                        disabled={sessionLoading}
                      >
                        Revoke
                      </button>
                    )}

                    {session.current && (
                      <span className="current-session-badge">Current</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
