import React, { createContext, useContext, useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  Bell,
  Info,
  AlertTriangle,
} from "lucide-react";
import "../styles/Notifications.css"; // We'll create this next

// Create context
const NotificationContext = createContext(null);

// Custom hook to use the notification context
export const useNotifications = () => useContext(NotificationContext);

// Provider component
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);

  // Add notification
  const addNotification = (notification) => {
    const id = Date.now().toString();
    const newNotification = {
      id,
      duration: notification.duration || 5000, // Default to 5 seconds
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove after duration (unless pinned)
    if (!notification.pinned && notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    // If it's a security event, add to history
    if (notification.category === "security") {
      const securityEvent = {
        id,
        timestamp: new Date().toISOString(),
        ...notification,
      };

      // Add to local state
      setSecurityEvents((prev) => [securityEvent, ...prev].slice(0, 50)); // Keep last 50

      // Also store in localStorage for persistence
      try {
        const stored = JSON.parse(
          localStorage.getItem("securityEvents") || "[]"
        );
        localStorage.setItem(
          "securityEvents",
          JSON.stringify([securityEvent, ...stored].slice(0, 50))
        );
      } catch (e) {
        console.warn("Failed to store security event:", e);
      }
    }

    return id;
  };

  // Remove notification
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Security notifications
  const addSecurityAlert = (message, details = {}) => {
    return addNotification({
      title: "Security Alert",
      message,
      type: "warning",
      icon: AlertTriangle,
      category: "security",
      details,
      duration: 10000, // Security alerts stay longer
    });
  };

  const addSecurityInfo = (message, details = {}) => {
    return addNotification({
      title: "Security Info",
      message,
      type: "info",
      icon: Info,
      category: "security",
      details,
    });
  };

  const addSecuritySuccess = (message, details = {}) => {
    return addNotification({
      title: "Security Update",
      message,
      type: "success",
      icon: CheckCircle,
      category: "security",
      details,
    });
  };

  // Load security events from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("securityEvents") || "[]");
      setSecurityEvents(stored);
    } catch (e) {
      console.warn("Failed to load security events:", e);
    }
  }, []);

  // Check for security flags from auth operations
  useEffect(() => {
    // Password change notification
    const passwordChanged = localStorage.getItem("passwordChanged");
    if (passwordChanged === "true") {
      addSecuritySuccess(
        "Your password was changed successfully. If you did not make this change, contact support immediately.",
        {
          event: "password_change",
          time:
            localStorage.getItem("passwordChangedAt") ||
            new Date().toISOString(),
        }
      );
      localStorage.removeItem("passwordChanged");
      localStorage.removeItem("passwordChangedAt");
    }

    // New device login
    const newDeviceLogin = localStorage.getItem("newDeviceLogin");
    if (newDeviceLogin === "true") {
      addSecurityAlert(
        "New device login detected. If this wasn't you, please change your password immediately.",
        {
          event: "new_device_login",
          time:
            localStorage.getItem("newDeviceLoginAt") ||
            new Date().toISOString(),
          ip: localStorage.getItem("newDeviceLoginIp") || "Unknown",
        }
      );
      localStorage.removeItem("newDeviceLogin");
      localStorage.removeItem("newDeviceLoginAt");
      localStorage.removeItem("newDeviceLoginIp");
    }

    // Failed login attempts
    const failedLoginAttempts = localStorage.getItem("failedLoginAttempts");
    if (failedLoginAttempts && parseInt(failedLoginAttempts) > 3) {
      addSecurityAlert(
        `Multiple failed login attempts detected (${failedLoginAttempts}). Your account security may be at risk.`,
        {
          event: "multiple_failed_logins",
          count: failedLoginAttempts,
          time: new Date().toISOString(),
        }
      );
      localStorage.removeItem("failedLoginAttempts");
    }

    // MFA enabled
    const mfaEnabled = localStorage.getItem("mfaEnabled");
    if (mfaEnabled === "true") {
      addSecuritySuccess(
        "Two-factor authentication has been enabled for your account.",
        {
          event: "mfa_enabled",
          time: new Date().toISOString(),
        }
      );
      localStorage.removeItem("mfaEnabled");
    }

    // MFA disabled
    const mfaDisabled = localStorage.getItem("mfaDisabled");
    if (mfaDisabled === "true") {
      addSecurityAlert(
        "Two-factor authentication has been disabled for your account. This reduces your account security.",
        {
          event: "mfa_disabled",
          time: new Date().toISOString(),
        }
      );
      localStorage.removeItem("mfaDisabled");
    }
  }, []);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    addSecurityAlert,
    addSecurityInfo,
    addSecuritySuccess,
    securityEvents,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
    </NotificationContext.Provider>
  );
}

// Notification container component
function NotificationContainer({ notifications, removeNotification }) {
  if (notifications.length === 0) return null;

  return (
    <div className="notifications-container">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

// Individual notification component
function NotificationItem({ notification, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Allow animation to complete
  };

  // Icon selection based on type
  const Icon =
    notification.icon ||
    {
      success: CheckCircle,
      error: AlertCircle,
      warning: AlertTriangle,
      info: Info,
    }[notification.type] ||
    Info;

  return (
    <div
      className={`notification-item ${notification.type} ${
        isExiting ? "exiting" : ""
      }`}
    >
      <div className="notification-icon">
        <Icon size={20} />
      </div>
      <div className="notification-content">
        {notification.title && <h4>{notification.title}</h4>}
        <p>{notification.message}</p>
        {notification.details && notification.showDetails && (
          <div className="notification-details">
            {Object.entries(notification.details).map(([key, value]) => (
              <div key={key} className="detail-item">
                <span className="detail-key">{key}:</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="notification-close" onClick={handleClose}>
        <span>×</span>
      </button>
    </div>
  );
}

export default NotificationContext;
