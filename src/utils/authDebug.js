// src/utils/authDebug.js
/**
 * Utility for debugging authentication issues
 * Provides consistent logging for auth-related events
 */

// Enable/disable debug logging
const DEBUG_ENABLED = process.env.NODE_ENV === "development" || true;

// Log to browser console and optionally store in session storage
const log = (component, message, data = null) => {
  if (!DEBUG_ENABLED) return;

  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [AuthDebug] [${component}]`;

  if (data) {
    console.log(`${logPrefix} ${message}`, data);
  } else {
    console.log(`${logPrefix} ${message}`);
  }

  // Store logs in session storage for debugging across page reloads
  try {
    const logs = JSON.parse(sessionStorage.getItem("authDebugLogs") || "[]");
    logs.push({
      timestamp,
      component,
      message,
      data: data ? JSON.stringify(data) : undefined,
    });

    // Keep only the most recent 100 logs to avoid storage limits
    if (logs.length > 100) {
      logs.shift();
    }

    sessionStorage.setItem("authDebugLogs", JSON.stringify(logs));
  } catch (e) {
    console.error("Error storing auth debug log:", e);
  }
};

// Save current auth state for debugging
const captureAuthState = () => {
  if (!DEBUG_ENABLED) return;

  try {
    const authState = {
      timestamp: new Date().toISOString(),
      localStorage: {},
      sessionStorage: {},
      url: window.location.href,
      pathname: window.location.pathname,
    };

    // Capture auth-related localStorage items
    [
      "authToken",
      "refreshToken",
      "currentUser",
      "isAuthenticated",
      "authStage",
      "mfa_verified",
      "passwordChanged",
      "forceLogout",
    ].forEach((key) => {
      authState.localStorage[key] = localStorage.getItem(key);
    });

    // Capture auth-related sessionStorage items
    [
      "mfa_verified",
      "mfaSuccess",
      "mfaVerifiedAt",
      "mfaRedirectPending",
      "mfaRedirectTarget",
      "lastMfaCodeSent",
    ].forEach((key) => {
      authState.sessionStorage[key] = sessionStorage.getItem(key);
    });

    // Store in session storage
    sessionStorage.setItem("authStateSnapshot", JSON.stringify(authState));

    return authState;
  } catch (e) {
    console.error("Error capturing auth state:", e);
    return null;
  }
};

// Get all stored logs
const getLogs = () => {
  try {
    return JSON.parse(sessionStorage.getItem("authDebugLogs") || "[]");
  } catch (e) {
    console.error("Error retrieving auth debug logs:", e);
    return [];
  }
};

// Clear stored logs
const clearLogs = () => {
  try {
    sessionStorage.removeItem("authDebugLogs");
    sessionStorage.removeItem("authStateSnapshot");
  } catch (e) {
    console.error("Error clearing auth debug logs:", e);
  }
};

// Log and capture state when auth errors occur
const logError = (component, error) => {
  if (!DEBUG_ENABLED) return;

  log(component, `ERROR: ${error.message || "Unknown error"}`, error);
  captureAuthState();
};

// Export the debug utilities
export const debugAuth = {
  log,
  captureAuthState,
  getLogs,
  clearLogs,
  logError,
  isEnabled: DEBUG_ENABLED,
};

// Debug auth state on load
if (DEBUG_ENABLED) {
  log("Init", "Auth debug initialized");
  captureAuthState();
}

export default debugAuth;
