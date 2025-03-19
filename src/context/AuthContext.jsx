// src/context/AuthContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import api from "../services/api";
import { jwtDecode } from "jwt-decode"; // Add this dependency

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
  const [refreshTimer, setRefreshTimer] = useState(null);

  // Check if token is expired
  const isTokenExpired = useCallback(() => {
    if (!token) return true;

    try {
      const decodedToken = jwtDecode(token);
      // Return true if token expires in less than 60 seconds or is already expired
      return decodedToken.exp * 1000 < Date.now() + 60000;
    } catch (error) {
      console.error("Token decode error:", error);
      return true;
    }
  }, [token]);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback(() => {
    // Clear any existing timers
    if (refreshTimer) {
      clearTimeout(refreshTimer);
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
    const timer = setTimeout(() => {
      refreshUserToken();
    }, refreshTime);

    setRefreshTimer(timer);

    // For debugging
    console.log(
      `Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`
    );
  }, [token, tokenExpiry, refreshTimer]);

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

            // Set authorization header for all requests
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            // Schedule token refresh
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
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [
    token,
    isTokenExpired,
    extractUserFromToken,
    scheduleTokenRefresh,
    refreshTimer,
  ]);

  // Refresh token
  const refreshUserToken = async () => {
    try {
      if (!refreshToken) {
        return false;
      }

      const response = await api.post("/api/auth/refresh", {
        refreshToken,
        sessionId,
      });

      if (response.data.success) {
        // Save new tokens
        localStorage.setItem("authToken", response.data.accessToken);
        localStorage.setItem("refreshToken", response.data.refreshToken);

        // Update state
        setToken(response.data.accessToken);
        setRefreshToken(response.data.refreshToken);

        // Extract and set user
        const user = extractUserFromToken(response.data.accessToken);
        setCurrentUser(user);

        // Set authorization header for all requests
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.accessToken}`;

        // Schedule next refresh
        scheduleTokenRefresh();

        return true;
      } else {
        throw new Error(response.data.error || "Token refresh failed");
      }
    } catch (error) {
      console.error("Token refresh error:", error);

      // If refresh fails, clear auth state
      logout();
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

      const response = await api.post("/api/auth/login", { email, password });

      if (response.data.success) {
        // Save tokens and session ID to localStorage
        localStorage.setItem("authToken", response.data.token);
        localStorage.setItem("refreshToken", response.data.refreshToken || "");
        localStorage.setItem("sessionId", response.data.sessionId || "");

        // Update state
        setToken(response.data.token);
        setRefreshToken(response.data.refreshToken || "");
        setSessionId(response.data.sessionId || "");
        setCurrentUser(response.data.user);

        // Set default auth header for future requests
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;

        // Extract token expiry for refresh scheduling
        const user = extractUserFromToken(response.data.token);
        scheduleTokenRefresh();

        return true;
      } else {
        setError(response.data.error || "Login failed");
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

      const response = await api.post("/api/auth/exchange", { code });

      if (response.data.success) {
        // Save tokens and session ID to localStorage
        localStorage.setItem("authToken", response.data.accessToken);
        localStorage.setItem("refreshToken", response.data.refreshToken || "");
        localStorage.setItem("sessionId", response.data.sessionId || "");

        // Update state
        setToken(response.data.accessToken);
        setRefreshToken(response.data.refreshToken || "");
        setSessionId(response.data.sessionId || "");

        // Extract and set user
        const user = extractUserFromToken(response.data.accessToken);
        setCurrentUser(user);

        // Set authorization header for all requests
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.accessToken}`;

        // Schedule token refresh
        scheduleTokenRefresh();

        return true;
      } else {
        throw new Error(response.data.error || "Token exchange failed");
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
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      setRefreshTimer(null);
    }

    if (serverSide) {
      try {
        // Call server to invalidate token
        await api.post("/api/auth/logout", { refreshToken });
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

    // Clear authorization header
    delete api.defaults.headers.common["Authorization"];
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

      const response = await api.post("/api/auth/register", userData);

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.error || "Registration failed");
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

      const response = await api.post("/api/auth/password/reset-request", {
        email,
      });

      // Usually returns success whether email exists or not to prevent enumeration
      return response.data.success;
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

      const response = await api.post("/api/auth/password/reset", {
        password,
        token,
      });

      if (response.data.success) {
        return true;
      } else {
        setError(response.data.error || "Password reset failed");
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

      const response = await api.post("/api/auth/password/change", {
        currentPassword,
        newPassword,
      });

      if (response.data.success) {
        return true;
      } else {
        setError(response.data.error || "Password change failed");
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
      const response = await api.get("/api/auth/sessions");

      if (response.data.success) {
        return response.data.sessions;
      } else {
        throw new Error(response.data.error || "Failed to retrieve sessions");
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
      const response = await api.delete(`/api/auth/sessions/${sessionId}`);

      return response.data.success;
    } catch (error) {
      console.error("Revoke session error:", error);
      setError(error.response?.data?.error || "Failed to revoke session");
      return false;
    }
  };

  // Revoke all other sessions
  const revokeAllOtherSessions = async () => {
    try {
      const response = await api.post("/api/auth/sessions/terminate-all");

      return response.data.success;
    } catch (error) {
      console.error("Revoke all sessions error:", error);
      setError(error.response?.data?.error || "Failed to revoke sessions");
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

    // This is a simplified check - the actual permission check is done server-side
    // For UX purposes, we can implement a more complex check that mirrors the server logic
    // For now, we only check common permissions based on role

    // Admin has most permissions
    if (currentUser.roles.includes("admin")) {
      // Block only critical super_admin permissions
      return !permissionCode.startsWith("system.");
    }

    // Basic role-based permission check
    if (
      permissionCode.startsWith("user.") &&
      currentUser.roles.includes("user")
    ) {
      return true;
    }

    return false;
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

  const value = {
    currentUser,
    loading,
    error,
    setError,
    login,
    logout,
    register,
    isAdmin:
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin") ||
      false,
    isSuperAdmin: currentUser?.roles?.includes("super_admin") || false,
    hasPermission,
    hasRole,
    refreshUserToken,
    processTokenExchange,
    requestPasswordReset,
    resetPassword,
    changePassword,
    getActiveSessions,
    revokeSession,
    revokeAllOtherSessions,
    tokenExpiry,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
