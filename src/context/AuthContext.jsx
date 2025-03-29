// src/context/AuthContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import {
  supabase,
  getUserData,
  getDefaultFeaturesForTier,
} from "../lib/supabase";
import apiService from "../services/apiService";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [userTier, setUserTier] = useState("basic");
  const [tierFeatures, setTierFeatures] = useState(
    getDefaultFeaturesForTier("basic")
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Login function
  // Update the login function in AuthContext.jsx
  // Update your login function in AuthContext.jsx
  const login = async (email, password) => {
    try {
      setError("");
      setLoading(true);
      console.log("Attempting login with:", email);

      // Call the backend login endpoint
      const response = await fetch(
        `${apiService.utils.getBaseUrl()}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        }
      );

      const data = await response.json();
      console.log("Login response:", data);

      if (data.success) {
        // Store auth tokens
        localStorage.setItem("authToken", data.token);
        if (data.refreshToken)
          localStorage.setItem("refreshToken", data.refreshToken);
        if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);

        // Store the user object - crucial for role checks in AdminRoute
        localStorage.setItem("currentUser", JSON.stringify(data.user));

        // Check for MFA methods - force MFA check if methods exist
        const hasMfaMethods =
          data.user && data.user.mfaMethods && data.user.mfaMethods.length > 0;

        console.log("MFA check:", {
          hasMfaMethods,
          methods: data.user?.mfaMethods || [],
        });

        if (hasMfaMethods) {
          // MFA required
          return {
            success: true,
            mfaRequired: true,
            mfaData: {
              methodId: data.user.mfaMethods[0].id,
              type: data.user.mfaMethods[0].type,
              email: data.user.email,
            },
          };
        }

        // No MFA needed, complete login by setting current user
        setCurrentUser(data.user);

        return {
          success: true,
          mfaRequired: false,
        };
      } else {
        setError(data.error || "Login failed");
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "An unexpected error occurred");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Login with passcode (basic auth)
  const loginWithPasscode = async (passcode) => {
    try {
      setError("");

      // Verify passcode against the expected value
      // This is a simple implementation. In a real app, you'd verify this against the backend
      const TEAM_PASSCODE =
        process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$";

      if (passcode === TEAM_PASSCODE) {
        localStorage.setItem("isAuthenticated", "true");
        return true;
      } else {
        setError("Invalid passcode");
        return false;
      }
    } catch (error) {
      console.error("Passcode login error:", error);
      setError("Invalid passcode. Please try again.");
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("sessionId");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isAuthenticated");
      setCurrentUser(null);
      setSession(null);
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      setError("An error occurred during logout");
      return false;
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setError("");
      setLoading(true);

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password || undefined,
        options: {
          data: {
            name: userData.name,
          },
        },
      });

      if (authError) {
        setError(authError.message || "Registration failed");
        return { success: false, error: authError.message };
      }

      // Return success
      return {
        success: true,
        message: "User registered successfully",
        requiresEmailVerification: true,
      };
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.message || "Registration failed. Please try again.");
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Request password reset
  const requestPasswordReset = async (email) => {
    try {
      setError("");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(error.message || "Failed to request password reset");
      return false;
    }
  };

  // Reset password with token
  const resetPassword = async (password, token) => {
    try {
      setError("");

      // In Supabase, the token is handled automatically via the URL
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error.message || "Password reset failed");
      return false;
    }
  };

  // Change password (authenticated)
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError("");

      // First verify the current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (signInError) {
        setError("Current password is incorrect");
        return false;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.message || "Password change failed");
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
        // Store tokens
        localStorage.setItem("authToken", response.data.token);
        localStorage.setItem("isAuthenticated", "true");
        if (response.data.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        if (response.data.sessionId) {
          localStorage.setItem("sessionId", response.data.sessionId);
        }

        // Store user info
        if (response.data.user) {
          localStorage.setItem(
            "currentUser",
            JSON.stringify(response.data.user)
          );
          setCurrentUser(response.data.user);
        }

        return true;
      }

      setError(response.data?.error || "Authentication failed");
      return false;
    } catch (error) {
      console.error("Token exchange error:", error);
      setError(error.message || "Authentication failed. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // SSO login
  const signInWithSSO = async (provider, options = {}) => {
    try {
      setError("");
      setLoading(true);

      // Default redirect URL
      const redirectTo =
        options.redirectTo || `${window.location.origin}/auth/callback`;

      // Build SSO URL with proper redirects
      const encodedRedirect = encodeURIComponent(
        `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(
          options.returnUrl || "/"
        )}`
      );

      // Redirect to appropriate SSO provider
      if (provider === "google") {
        window.location.href = `${apiService.utils.getBaseUrl()}/api/auth/sso/google?redirectTo=${encodedRedirect}`;
        return true;
      } else if (provider === "microsoft") {
        window.location.href = `${apiService.utils.getBaseUrl()}/api/auth/sso/microsoft?redirectTo=${encodedRedirect}`;
        return true;
      } else if (provider === "custom_saml") {
        window.location.href = `${apiService.utils.getBaseUrl()}/api/auth/sso/custom?redirectTo=${encodedRedirect}`;
        return true;
      }

      throw new Error(`Unsupported SSO provider: ${provider}`);
    } catch (error) {
      console.error("SSO sign in error:", error);
      setError(error.message || "Failed to sign in with SSO");
      setLoading(false);
      return false;
    }
  };

  // MFA Functions
  const setupMfa = async (type) => {
    try {
      let response;

      if (type === "totp") {
        // Enroll TOTP with Supabase
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: "Tatt2Away",
        });

        if (error) throw error;

        // Return data in the expected format
        response = {
          data: {
            methodId: data.id,
            secret: data.secret,
            qrCode: data.totp.qr_code,
          },
        };
      } else if (type === "email") {
        // For email verification, we'll use Supabase's OTP feature
        const { error } = await supabase.auth.signInWithOtp({
          email: currentUser.email,
          options: {
            shouldCreateUser: false,
          },
        });

        if (error) throw error;

        // Return data in the expected format
        response = {
          data: {
            methodId: "email",
            email: currentUser.email,
          },
        };
      }

      return response;
    } catch (error) {
      console.error("MFA setup error:", error);
      setError(error.message || "Failed to set up MFA");
      return null;
    }
  };

  // Confirm MFA setup
  const confirmMfa = async (methodId, verificationCode) => {
    try {
      if (methodId === "totp") {
        // Verify TOTP with Supabase
        const { data, error } = await supabase.auth.mfa.challenge({
          factorId: methodId,
        });

        if (error) throw error;

        const { data: verifyData, error: verifyError } =
          await supabase.auth.mfa.verify({
            factorId: methodId,
            challengeId: data.id,
            code: verificationCode,
          });

        if (verifyError) throw verifyError;

        // Update user's MFA methods in the context
        updateMfaMethods(methodId, "totp");

        return true;
      } else if (methodId === "email") {
        // Verify email OTP
        const { error } = await supabase.auth.verifyOtp({
          email: currentUser.email,
          token: verificationCode,
          type: "email",
        });

        if (error) throw error;

        // Update user's MFA methods
        updateMfaMethods(methodId, "email");

        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Failed to verify MFA");
      return false;
    }
  };

  // Helper function to update MFA methods in the user object
  const updateMfaMethods = (methodId, type) => {
    if (!currentUser) return;

    const mfaMethods = [...(currentUser.mfaMethods || [])];
    const existingIndex = mfaMethods.findIndex((m) => m.id === methodId);

    if (existingIndex >= 0) {
      // Update existing method
      mfaMethods[existingIndex] = {
        ...mfaMethods[existingIndex],
        type,
        lastUsed: new Date().toISOString(),
      };
    } else {
      // Add new method
      mfaMethods.push({
        id: methodId,
        type,
        createdAt: new Date().toISOString(),
      });
    }

    // Update current user
    setCurrentUser({
      ...currentUser,
      mfaMethods,
    });

    // Update localStorage backup
    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        ...currentUser,
        mfaMethods,
      })
    );
  };

  // Remove MFA method
  const removeMfa = async (methodId) => {
    try {
      // If it's a TOTP factor, unenroll it from Supabase
      if (methodId !== "email") {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: methodId,
        });

        if (error) throw error;
      }

      // Update user's MFA methods
      if (currentUser) {
        const mfaMethods = (currentUser.mfaMethods || []).filter(
          (method) => method.id !== methodId
        );

        setCurrentUser({
          ...currentUser,
          mfaMethods,
        });

        // Update localStorage backup
        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            ...currentUser,
            mfaMethods,
          })
        );
      }

      return true;
    } catch (error) {
      console.error("MFA removal error:", error);
      setError(error.message || "Failed to remove MFA method");
      return false;
    }
  };

  // Verify MFA during login
  const verifyMfa = async (methodId, verificationCode) => {
    try {
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: methodId,
        code: verificationCode,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Failed to verify MFA");
      return false;
    }
  };

  // Initialize auth state from Supabase session or localStorage
  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Supabase auth state change:", event);

      if (session) {
        setSession(session);
        try {
          // Get user data from profiles table
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          // Create user object
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name:
              data?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email,
            roles: data?.roles || ["user"],
            mfaMethods: data?.mfa_methods || [],
            tier: data?.tier || "basic",
          };

          // Update state
          setCurrentUser(userData);
          setUserTier(userData.tier);
          setTierFeatures(getDefaultFeaturesForTier(userData.tier));

          // Update localStorage backup
          localStorage.setItem("currentUser", JSON.stringify(userData));
          localStorage.setItem("isAuthenticated", "true");
        } catch (error) {
          console.error("Error getting user profile:", error);
        }
      } else {
        // Check localStorage as fallback
        const storedUser = localStorage.getItem("currentUser");
        const isAuthenticated =
          localStorage.getItem("isAuthenticated") === "true";

        if ((storedUser && isAuthenticated) || isAuthenticated) {
          try {
            if (storedUser) {
              const userData = JSON.parse(storedUser);
              setCurrentUser(userData);
              setUserTier(userData.tier || "basic");
              setTierFeatures(
                getDefaultFeaturesForTier(userData.tier || "basic")
              );
            }
          } catch (e) {
            console.error("Error parsing stored user:", e);
            setCurrentUser(null);
            setSession(null);
          }
        } else {
          setCurrentUser(null);
          setSession(null);
        }
      }

      setLoading(false);
      setIsInitialized(true);
    });

    // Initial session check
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        console.log("Initial session found");
      } else {
        console.log("No initial session, checking localStorage");
        // Check localStorage backup
        const storedUser = localStorage.getItem("currentUser");
        const isAuthenticated =
          localStorage.getItem("isAuthenticated") === "true";

        if ((storedUser && isAuthenticated) || isAuthenticated) {
          try {
            if (storedUser) {
              const userData = JSON.parse(storedUser);
              setCurrentUser(userData);
              setUserTier(userData.tier || "basic");
              setTierFeatures(
                getDefaultFeaturesForTier(userData.tier || "basic")
              );
            }
          } catch (e) {
            console.error("Error parsing stored user:", e);
          }
        }
      }

      setLoading(false);
      setIsInitialized(true);
    };

    initSession();

    // Cleanup
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Get active sessions
  const getSessions = async () => {
    try {
      // This is a placeholder - implement according to your backend
      const response = await apiService.sessions.getSessions();
      return response.data.sessions || [];
    } catch (error) {
      console.error("Get sessions error:", error);
      return [];
    }
  };

  // Terminate session
  const terminateSession = async (sessionId) => {
    try {
      const response = await apiService.sessions.terminateSession(sessionId);
      return response.data.success;
    } catch (error) {
      console.error("Terminate session error:", error);
      return false;
    }
  };

  // Terminate all other sessions
  const terminateAllSessions = async () => {
    try {
      const response = await apiService.sessions.terminateAllSessions();
      return response.data.success;
    } catch (error) {
      console.error("Terminate all sessions error:", error);
      return false;
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      setError("");

      // Update user metadata in Supabase Auth
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          name: profileData.name,
        },
      });

      if (metadataError) throw metadataError;

      // Update local state
      setCurrentUser((prev) => {
        const updated = {
          ...prev,
          name: profileData.name,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
        };

        // Update localStorage backup
        localStorage.setItem("currentUser", JSON.stringify(updated));

        return updated;
      });

      return true;
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Failed to update profile");
      return false;
    }
  };

  // Check if user has specific permission
  const hasPermission = useCallback(
    (permissionCode) => {
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

      // Check if user has the specific permission from their roles
      if (
        currentUser.permissions &&
        currentUser.permissions.includes(permissionCode)
      ) {
        return true;
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
    },
    [currentUser]
  );

  // Check if feature is available based on subscription tier
  const hasFeatureAccess = useCallback(
    (featureName) => {
      if (!currentUser) return false;

      // Super admin and admin have access to all features
      if (
        currentUser.roles?.includes("super_admin") ||
        currentUser.roles?.includes("admin")
      ) {
        return true;
      }

      // Check if feature is explicitly enabled for this user
      if (currentUser.features && currentUser.features[featureName] === true) {
        return true;
      }

      // Check based on tier
      return tierFeatures[featureName] === true;
    },
    [currentUser, tierFeatures]
  );

  // Get user tier level
  const getUserTier = useCallback(() => {
    return userTier;
  }, [userTier]);

  // Check if user has specific role
  const hasRole = useCallback(
    (roleCode) => {
      if (!currentUser || !currentUser.roles) {
        return false;
      }

      // Super admin can act as any role
      if (currentUser.roles.includes("super_admin")) {
        return true;
      }

      return currentUser.roles.includes(roleCode);
    },
    [currentUser]
  );

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
    requestPasswordReset,
    resetPassword,
    changePassword,
    signInWithSSO,
    getSessions,
    terminateSession,
    terminateAllSessions,
    setupMfa,
    confirmMfa,
    removeMfa,
    verifyMfa,
    updateProfile,
    processTokenExchange,
    isInitialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
