// src/context/AuthContext.jsx - Enhanced with tier support
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
  const [userTier, setUserTier] = useState("basic");
  const [tierFeatures, setTierFeatures] = useState({});

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

    console.log(
      `Token refresh scheduled in ${Math.round(refreshTime / 1000)} seconds`
    );
  }, [token, tokenExpiry]);

  // Extract user from token
  const extractUserFromToken = useCallback((token) => {
    try {
      const decodedToken = jwtDecode(token);
      setTokenExpiry(decodedToken.exp * 1000);

      // Extract tier information
      const tier = decodedToken.tier || "basic";
      setUserTier(tier);

      // Extract features
      if (decodedToken.features) {
        setTierFeatures(decodedToken.features);
      } else {
        // Set default features based on tier
        setTierFeatures(getDefaultFeaturesForTier(tier));
      }

      return {
        id: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name,
        roles: decodedToken.roles || ["user"],
        tenantId: decodedToken.tenantId,
        exp: decodedToken.exp,
        mfaMethods: decodedToken.mfaMethods || [],
        tier: tier,
        features: decodedToken.features || {},
        passwordLastChanged: decodedToken.passwordLastChanged,
      };
    } catch (error) {
      console.error("Token decode error:", error);
      return null;
    }
  }, []);

  // Get default features for a tier
  const getDefaultFeaturesForTier = (tier) => {
    // Basic tier features
    const basicFeatures = {
      chatbot: true,
      basic_search: true,
      file_upload: true,
      image_analysis: true,
    };

    // Professional tier features
    const professionalFeatures = {
      ...basicFeatures,
      advanced_search: true,
      image_search: true,
      custom_branding: true,
      multi_user: true,
      data_export: true,
      analytics_basic: true,
    };

    // Enterprise tier features
    const enterpriseFeatures = {
      ...professionalFeatures,
      custom_workflows: true,
      advanced_analytics: true,
      multi_department: true,
      automated_alerts: true,
      custom_integrations: true,
      advanced_security: true,
      sso: true,
      advanced_roles: true,
    };

    switch (tier.toLowerCase()) {
      case "enterprise":
        return enterpriseFeatures;
      case "professional":
        return professionalFeatures;
      case "basic":
      default:
        return basicFeatures;
    }
  };

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

  // Passcode login function (simplified)
  const loginWithPasscode = async (passcode) => {
    try {
      setError("");
      const response = await apiService.auth.verifyPasscode(passcode);

      if (response.data && response.data.success) {
        localStorage.setItem("isAuthenticated", "true");
        // Typically we'd still set a token or session, but for passcode login
        // it might just be a Boolean flag that allows basic access
        return true;
      } else {
        setError(response.data?.error || "Invalid passcode");
        return false;
      }
    } catch (error) {
      console.error("Passcode login error:", error);
      setError("Invalid passcode. Please try again.");
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
    localStorage.removeItem("isAuthenticated");

    // Clear state
    setToken(null);
    setRefreshToken(null);
    setSessionId(null);
    setCurrentUser(null);
    setTokenExpiry(null);
    setUserTier("basic");
    setTierFeatures({});
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
  const getSessions = async () => {
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

  // Terminate session
  const terminateSession = async (sessionId) => {
    try {
      const response = await apiService.auth.terminateSession(sessionId);
      return response.data?.success || false;
    } catch (error) {
      console.error("Terminate session error:", error);
      setError(error.response?.data?.error || "Failed to terminate session");
      return false;
    }
  };

  // Terminate all other sessions
  const terminateAllSessions = async () => {
    try {
      const response = await apiService.auth.terminateAllSessions();
      return response.data?.success || false;
    } catch (error) {
      console.error("Terminate all sessions error:", error);
      setError(error.response?.data?.error || "Failed to terminate sessions");
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

  // Verify MFA during login
  const verifyMfa = async (verificationCode, methodId) => {
    try {
      const response = await apiService.mfa.login(methodId, verificationCode);

      if (response.data && response.data.success) {
        // If MFA verification returns new tokens, update them
        if (response.data.token) {
          localStorage.setItem("authToken", response.data.token);
          setToken(response.data.token);

          const user = extractUserFromToken(response.data.token);
          setCurrentUser(user);

          if (response.data.refreshToken) {
            localStorage.setItem("refreshToken", response.data.refreshToken);
            setRefreshToken(response.data.refreshToken);
          }

          scheduleTokenRefresh();
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.response?.data?.error || "Failed to verify MFA");
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
    return tierFeatures[featureName] === true;
  };

  // Check user tier level
  const getUserTier = () => {
    return userTier;
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      setError("");
      const response = await apiService.user.updateProfile(profileData);

      if (response.data && response.data.success) {
        // Update user data in state
        setCurrentUser((prev) => ({
          ...prev,
          ...profileData,
        }));
        return true;
      } else {
        setError(response.data?.error || "Failed to update profile");
        return false;
      }
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.response?.data?.error || "Failed to update profile");
      return false;
    }
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
    loginWithPasscode,
    logout,
    register,
    isAdmin,
    isSuperAdmin,
    hasPermission,
    hasRole,
    hasFeatureAccess,
    getUserTier,
    tierFeatures,
    refreshUserToken,
    processTokenExchange,
    requestPasswordReset,
    resetPassword,
    changePassword,
    getSessions,
    terminateSession,
    terminateAllSessions,
    setupMfa,
    confirmMfa,
    removeMfa,
    verifyMfa,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
