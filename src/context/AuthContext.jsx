// src/context/AuthContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import apiService from "../services/apiService";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("authToken"));
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refreshToken")
  );
  const [sessionId, setSessionId] = useState(localStorage.getItem("sessionId"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const refreshTimerRef = useRef(null);

  // Check if token is expired
  const isTokenExpired = useCallback(() => {
    return apiService.utils.isTokenExpired(token);
  }, [token]);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback(() => {
    // Clear any existing timers
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // If no token or no expiry, don't schedule
    if (!token || !tokenExpiry) {
      return;
    }

    // Calculate time until refresh (75% of time until expiry)
    const now = Date.now();
    const timeUntilExpiry = tokenExpiry - now;
    const refreshTime = Math.max(timeUntilExpiry * 0.75, 0);

    // Set timer to refresh token before it expires
    refreshTimerRef.current = setTimeout(() => {
      refreshUserToken();
    }, refreshTime);

    // For debugging
    console.log(
      `Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`
    );
  }, [token, tokenExpiry]);

  // Extract user from token
  const extractUserFromToken = useCallback((token) => {
    try {
      const decodedToken = jwtDecode(token);

      setTokenExpiry(decodedToken.exp * 1000);

      return {
        id: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name,
        roles: decodedToken.roles || ["user"],
        tenantId: decodedToken.tenantId,
        exp: decodedToken.exp,
        mfaMethods: decodedToken.mfaMethods || [],
        tier: decodedToken.tier || "basic",
        features: decodedToken.features || {},
        passwordLastChanged: decodedToken.passwordLastChanged,
      };
    } catch (error) {
      console.error("Token decode error:", error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Check if token is expired
        if (isTokenExpired()) {
          // Try to refresh token
          const refreshed = await refreshUserToken();
          if (!refreshed) {
            logout();
            return;
          }
        } else {
          // Extract user from token
          const user = extractUserFromToken(token);

          if (user) {
            setCurrentUser(user);
            scheduleTokenRefresh();
          } else {
            logout();
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
        logout();
        setError("Session expired. Please login again.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Cleanup refresh timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [token, isTokenExpired, extractUserFromToken, scheduleTokenRefresh]);

  // Refresh token
  const refreshUserToken = async () => {
    try {
      if (!refreshToken) {
        return false;
      }

      const response = await apiService.auth.refreshToken(
        refreshToken,
        sessionId
      );

      if (response.data && response.data.success) {
        // Save new tokens
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem("authToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken || refreshToken);
        if (response.data.sessionId) {
          localStorage.setItem("sessionId", response.data.sessionId);
          setSessionId(response.data.sessionId);
        }

        // Update state
        setToken(accessToken);
        if (newRefreshToken) setRefreshToken(newRefreshToken);

        // Extract and set user
        const user = extractUserFromToken(accessToken);
        setCurrentUser(user);

        // Schedule next refresh
        scheduleTokenRefresh();

        return true;
      } else {
        throw new Error(response.data?.error || "Token refresh failed");
      }
    } catch (error) {
      console.error("Token refresh error:", error);

      // If refresh fails, clear auth state
      logout(false); // Don't call server logout
      setError("Your session has expired. Please login again.");

      return false;
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      setError("");

      // Validate email domain
      if (!email.endsWith("@tatt2away.com")) {
        setError("Only @tatt2away.com email addresses are allowed");
        return false;
      }

      const response = await apiService.auth.login(email, password);

      if (response.data && response.data.success) {
        // Save tokens and session ID to localStorage
        const {
          token: accessToken,
          refreshToken: newRefreshToken,
          sessionId: newSessionId,
        } = response.data;

        localStorage.setItem("authToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken || "");
        localStorage.setItem("sessionId", newSessionId || "");

        // Update state
        setToken(accessToken);
        setRefreshToken(newRefreshToken || "");
        setSessionId(newSessionId || "");

        // Set user from token
        const user = extractUserFromToken(accessToken);
        setCurrentUser(user);

        // Schedule token refresh
        scheduleTokenRefresh();

        return true;
      } else {
        setError(response.data?.error || "Login failed");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(
        error.response?.data?.error || "Login failed. Please try again."
      );
      return false;
    }
  };

  // Process token exchange from SSO
  const processTokenExchange = async (code) => {
    try {
      setError("");
      setLoading(true);

      const response = await apiService.auth.exchangeToken(code);

      if (response.data && response.data.success) {
        // Save tokens and session ID to localStorage
        const {
          accessToken,
          refreshToken: newRefreshToken,
          sessionId: newSessionId,
        } = response.data;

        localStorage.setItem("authToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken || "");
        localStorage.setItem("sessionId", newSessionId || "");

        // Update state
        setToken(accessToken);
        setRefreshToken(newRefreshToken || "");
        setSessionId(newSessionId || "");

        // Extract and set user
        const user = extractUserFromToken(accessToken);
        setCurrentUser(user);

        // Schedule token refresh
        scheduleTokenRefresh();

        return true;
      } else {
        throw new Error(response.data?.error || "Token exchange failed");
      }
    } catch (error) {
      console.error("Token exchange error:", error);
      setError(
        error.response?.data?.error ||
          "Authentication failed. Please try again."
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async (serverSide = true) => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (serverSide && refreshToken) {
      try {
        // Call server to invalidate token
        await apiService.auth.logout();
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    // Clear local storage
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("sessionId");

    // Clear state
    setToken(null);
    setRefreshToken(null);
    setSessionId(null);
    setCurrentUser(null);
    setTokenExpiry(null);
  };

  // Register function (admin only)
  const register = async (userData) => {
    try {
      setError("");

      // Validate email domain
      if (!userData.email.endsWith("@tatt2away.com")) {
        setError("Only @tatt2away.com email addresses are allowed");
        return false;
      }

      const response = await apiService.auth.register(userData);

      if (response.data && response.data.success) {
        return response.data;
      } else {
        setError(response.data?.error || "Registration failed");
        return false;
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError(
        error.response?.data?.error || "Registration failed. Please try again."
      );
      return false;
    }
  };

  // Request password reset
  const requestPasswordReset = async (email) => {
    try {
      setError("");

      if (!email) {
        setError("Email is required");
        return false;
      }

      const response = await apiService.auth.requestPasswordReset(email);

      // Usually returns success whether email exists or not to prevent enumeration
      return response.data?.success || true;
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(
        error.response?.data?.error || "Failed to request password reset"
      );
      return false;
    }
  };

  // Reset password with token
  const resetPassword = async (password, token) => {
    try {
      setError("");

      if (!password || !token) {
        setError("Password and token are required");
        return false;
      }

      const response = await apiService.auth.resetPassword(token, password);

      if (response.data && response.data.success) {
        return true;
      } else {
        setError(response.data?.error || "Password reset failed");
        return false;
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error.response?.data?.error || "Password reset failed");
      return false;
    }
  };

  // Change password (authenticated)
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError("");

      if (!currentPassword || !newPassword) {
        setError("Current password and new password are required");
        return false;
      }

      const response = await apiService.auth.changePassword(
        currentPassword,
        newPassword
      );

      if (response.data && response.data.success) {
        return true;
      } else {
        setError(response.data?.error || "Password change failed");
        return false;
      }
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.response?.data?.error || "Password change failed");
      return false;
    }
  };

  // Get active sessions
  const getActiveSessions = async () => {
    try {
      const response = await apiService.auth.getSessions();

      if (response.data && response.data.success) {
        return response.data.sessions;
      } else {
        throw new Error(response.data?.error || "Failed to retrieve sessions");
      }
    } catch (error) {
      console.error("Get sessions error:", error);
      setError(error.response?.data?.error || "Failed to retrieve sessions");
      return [];
    }
  };

  // Revoke session
  const revokeSession = async (sessionId) => {
    try {
      const response = await apiService.auth.terminateSession(sessionId);
      return response.data?.success || false;
    } catch (error) {
      console.error("Revoke session error:", error);
      setError(error.response?.data?.error || "Failed to revoke session");
      return false;
    }
  };

  // Revoke all other sessions
  const revokeAllOtherSessions = async () => {
    try {
      const response = await apiService.auth.terminateAllSessions();
      return response.data?.success || false;
    } catch (error) {
      console.error("Revoke all sessions error:", error);
      setError(error.response?.data?.error || "Failed to revoke sessions");
      return false;
    }
  };

  // MFA setup functions
  const setupMfa = async (type, data = {}) => {
    try {
      const response = await apiService.mfa.setup(type, data);
      return response.data;
    } catch (error) {
      console.error("MFA setup error:", error);
      setError(error.response?.data?.error || "Failed to set up MFA");
      return null;
    }
  };

  const confirmMfa = async (methodId, verificationCode) => {
    try {
      const response = await apiService.mfa.verify(methodId, verificationCode);

      if (response.data && response.data.success) {
        // Refresh user data to get updated MFA methods
        refreshUserToken();
        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.response?.data?.error || "Failed to verify MFA");
      return false;
    }
  };

  const removeMfa = async (methodId) => {
    try {
      const response = await apiService.mfa.remove(methodId);

      if (response.data && response.data.success) {
        // Refresh user data to get updated MFA methods
        refreshUserToken();
        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA removal error:", error);
      setError(error.response?.data?.error || "Failed to remove MFA method");
      return false;
    }
  };

  // Check if user has specific permission
  const hasPermission = (permissionCode) => {
    if (!currentUser || !currentUser.roles) {
      return false;
    }

    // Super admin has all permissions
    if (currentUser.roles.includes("super_admin")) {
      return true;
    }

    // Admin has most permissions except system level ones
    if (currentUser.roles.includes("admin")) {
      return !permissionCode.startsWith("system.");
    }

    // Basic role-based permission check
    if (
      permissionCode.startsWith("user.") &&
      currentUser.roles.includes("user")
    ) {
      return true;
    }

    // Check feature access based on tier
    if (permissionCode.startsWith("feature.")) {
      const featureName = permissionCode.substring("feature.".length);
      return hasFeatureAccess(featureName);
    }

    return false;
  };

  // Check if feature is available based on subscription tier
  const hasFeatureAccess = (featureName) => {
    if (!currentUser) return false;

    // Super admin and admin have access to all features
    if (
      currentUser.roles.includes("super_admin") ||
      currentUser.roles.includes("admin")
    ) {
      return true;
    }

    // Check if feature is explicitly enabled for this user
    if (currentUser.features && currentUser.features[featureName] === true) {
      return true;
    }

    // Check based on tier
    const tier = currentUser.tier || "basic";

    switch (tier.toLowerCase()) {
      case "enterprise":
        // Enterprise tier has all features
        return true;

      case "professional":
        // Professional has most features except enterprise-only
        return !ENTERPRISE_ONLY_FEATURES.includes(featureName);

      case "basic":
      default:
        // Basic tier has limited features
        return BASIC_FEATURES.includes(featureName);
    }
  };

  // Check user tier level
  const getUserTier = () => {
    return currentUser?.tier || "basic";
  };

  // Check if user has specific role
  const hasRole = (roleCode) => {
    if (!currentUser || !currentUser.roles) {
      return false;
    }

    // Super admin can act as any role
    if (currentUser.roles.includes("super_admin")) {
      return true;
    }

    return currentUser.roles.includes(roleCode);
  };

  // Feature configuration
  const BASIC_FEATURES = [
    "chatbot",
    "basic_search",
    "file_upload",
    "image_analysis",
  ];

  const ENTERPRISE_ONLY_FEATURES = [
    "custom_workflows",
    "advanced_analytics",
    "multi_department",
    "automated_alerts",
    "custom_integrations",
    "advanced_security",
  ];

  const isAdmin =
    currentUser?.roles?.includes("admin") ||
    currentUser?.roles?.includes("super_admin") ||
    false;

  const isSuperAdmin = currentUser?.roles?.includes("super_admin") || false;

  const value = {
    currentUser,
    loading,
    error,
    setError,
    login,
    logout,
    register,
    isAdmin,
    isSuperAdmin,
    hasPermission,
    hasRole,
    hasFeatureAccess,
    getUserTier,
    refreshUserToken,
    processTokenExchange,
    requestPasswordReset,
    resetPassword,
    changePassword,
    getActiveSessions,
    revokeSession,
    revokeAllOtherSessions,
    tokenExpiry,
    setupMfa,
    confirmMfa,
    removeMfa,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
