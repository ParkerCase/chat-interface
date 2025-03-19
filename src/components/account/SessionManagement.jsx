// src/components/account/SessionManagement.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Smartphone,
  Laptop,
  Globe,
  Clock,
  Trash,
  RefreshCw,
  Shield,
  AlertTriangle,
} from "lucide-react";

function SessionManagement({ setError, setSuccessMessage }) {
  const { getSessions, terminateSession, terminateAllSessions } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTerminating, setIsTerminating] = useState(false);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const sessionData = await getSessions();
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
        setSuccessMessage("Session terminated successfully");
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
        setSuccessMessage("All other sessions terminated successfully");
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

  // Helper function to get device icon
  const getDeviceIcon = (session) => {
    const { device, browser } = session;

    if (
      device.toLowerCase().includes("mobile") ||
      device.toLowerCase().includes("phone")
    ) {
      return <Smartphone size={20} />;
    } else if (
      device.toLowerCase().includes("laptop") ||
      device.toLowerCase().includes("macbook") ||
      browser.toLowerCase().includes("chrome") ||
      browser.toLowerCase().includes("firefox") ||
      browser.toLowerCase().includes("safari")
    ) {
      return <Laptop size={20} />;
    } else {
      return <Globe size={20} />;
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
          <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
          <span>{isLoading ? "Loading..." : "Refresh"}</span>
        </button>

        {sessions.length > 1 && (
          <button
            className="terminate-all-sessions"
            onClick={handleTerminateAllSessions}
            disabled={isTerminatingAll}
          >
            {isTerminatingAll ? (
              <>
                <span className="spinner-sm"></span>
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
              <div className="session-icon">{getDeviceIcon(session)}</div>

              <div className="session-details">
                <div className="session-device">
                  <h5>
                    {session.browser} on {session.device}
                  </h5>
                  {session.isCurrent && (
                    <span className="current-badge">Current</span>
                  )}
                  {session.mfaVerified && (
                    <span className="mfa-badge">
                      <Shield size={12} />
                      MFA Verified
                    </span>
                  )}
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

                  {!session.mfaVerified && (
                    <div className="session-warning">
                      <AlertTriangle size={14} />
                      <span>No MFA verification</span>
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
                    <span className="spinner-sm"></span>
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

export default SessionManagement;
