// src/context/AuthContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../lib/supabase";
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
  const [userTier, setUserTier] = useState("enterprise"); // Default to enterprise tier
  const [userFeatures, setUserFeatures] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const supabaseListenerRef = useRef(null);

  // Login function with MFA support
  const login = async (email, password) => {
    try {
      setError("");
      setLoading(true);
      console.log("Attempting login with:", email);

      // Special case for test admin user
      if (email === "itsus@tatt2away.com" && password === "password") {
        console.log("Using test admin login");

        // Create admin user object
        const adminUser = {
          id: "admin-user-123",
          name: "Tatt2Away Admin",
          email: "itsus@tatt2away.com",
          roles: ["super_admin", "admin", "user"],
          tier: "enterprise",
          mfaMethods: [], // Skip MFA for testing
          features: getEnterpriseFeatures(),
        };

        // Store auth state in localStorage
        localStorage.setItem("authToken", "demo-admin-token-123");
        localStorage.setItem("refreshToken", "demo-refresh-token-456");
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("currentUser", JSON.stringify(adminUser));

        // Update context
        setCurrentUser(adminUser);
        setUserTier("enterprise");
        setUserFeatures(adminUser.features);

        return {
          success: true,
          mfaRequired: false,
          isAdmin: true,
        };
      }

      // Regular login flow with Supabase
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) throw authError;

      console.log("Supabase login successful:", authData);

      // Check for MFA requirements
      let mfaRequired = false;
      let mfaDetail = null;

      try {
        const { data: mfaData, error: mfaError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (!mfaError && mfaData) {
          console.log("MFA status:", mfaData);

          // If MFA is required and not already satisfied
          if (
            mfaData.currentLevel !== mfaData.nextLevel &&
            mfaData.nextLevel === "aal2"
          ) {
            console.log("MFA verification required");
            mfaRequired = true;
            mfaDetail = {
              factorId: mfaData.currentFactorId || null,
              type: "totp", // Default to TOTP
              email,
            };
          }
        }
      } catch (mfaErr) {
        console.warn("Error checking MFA status:", mfaErr);
        // Continue with sign-in even if MFA check fails
      }

      // Get user profile data from Supabase
      let userData = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || authData.user.email,
        roles: ["user"], // Default role
        tier: "enterprise", // Default to enterprise tier
        mfaMethods: [],
      };

      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (!profileError && profileData) {
          userData = {
            ...userData,
            name: profileData.full_name || userData.name,
            roles: profileData.roles || userData.roles,
            mfaMethods: profileData.mfa_methods || [],
          };
        }
      } catch (profileErr) {
        console.warn("Error fetching profile data:", profileErr);
        // Continue with basic user data
      }

      // Add enterprise features
      userData.features = getEnterpriseFeatures();

      // Store auth tokens and user data
      localStorage.setItem("authToken", authData.session.access_token);
      localStorage.setItem("refreshToken", authData.session.refresh_token);
      localStorage.setItem("currentUser", JSON.stringify(userData));
      localStorage.setItem("isAuthenticated", "true");

      // Update auth context with user data
      setCurrentUser(userData);
      setSession(authData.session);
      setUserTier("enterprise");
      setUserFeatures(userData.features);

      return {
        success: true,
        mfaRequired,
        mfaData: mfaRequired ? mfaDetail : null,
        isAdmin:
          userData.roles.includes("admin") ||
          userData.roles.includes("super_admin"),
      };
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Invalid email or password");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setError("");
      setLoading(true);

      // For admin user creating new users
      if (userData.roles) {
        // This is an admin registration
        try {
          const response = await apiService.users.create(userData);
          return response.data;
        } catch (err) {
          throw new Error(err.response?.data?.error || "Registration failed");
        }
      }

      // For self-registration
      // Email domain validation
      if (
        !userData.email.endsWith("@tatt2away.com") &&
        userData.email !== "itsus@tatt2away.com"
      ) {
        throw new Error("Only @tatt2away.com email addresses are allowed");
      }

      // Register with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.name,
          },
        },
      });

      if (error) throw error;

      // Create profile in Supabase
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: data.user.id,
          full_name: userData.name,
          email: userData.email,
          roles: userData.roles || ["user"],
          tier: "enterprise",
        },
      ]);

      if (profileError) throw profileError;

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userData.name,
          roles: userData.roles || ["user"],
        },
        requiresEmailVerification: true,
      };
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Registration failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear local storage
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("sessionId");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isAuthenticated");

      // Clear state
      setCurrentUser(null);
      setSession(null);
      setUserTier("enterprise");
      setUserFeatures({});

      return true;
    } catch (error) {
      console.error("Logout error:", error);
      setError("An error occurred during logout");
      return false;
    }
  };

  // Process token exchange from SSO providers
  const processTokenExchange = async (code) => {
    try {
      setError("");
      setLoading(true);

      // First try processing via Supabase
      try {
        // For Supabase SSO, we don't need to do anything - session should be set automatically
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          // Get user profile
          const { data: userData } = await supabase.auth.getUser();

          if (userData?.user) {
            // Get additional data from profiles
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // Create user object
            let user = {
              id: userData.user.id,
              email: userData.user.email,
              name:
                profileData?.full_name ||
                userData.user.user_metadata?.name ||
                userData.user.email,
              roles: profileData?.roles || ["user"],
              tier: "enterprise",
              mfaMethods: profileData?.mfa_methods || [],
              features: getEnterpriseFeatures(),
            };

            // Special case for super admin
            if (user.email === "itsus@tatt2away.com") {
              user.roles = ["super_admin", "admin", "user"];
            }

            // Store user data
            localStorage.setItem("authToken", sessionData.session.access_token);
            localStorage.setItem(
              "refreshToken",
              sessionData.session.refresh_token
            );
            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("isAuthenticated", "true");

            // Update state
            setCurrentUser(user);
            setSession(sessionData.session);
            setUserTier("enterprise");
            setUserFeatures(user.features);

            return true;
          }
        }
      } catch (supabaseError) {
        console.warn("Supabase SSO processing failed:", supabaseError);
        // Continue with custom API
      }

      // Fall back to custom API for token exchange
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

        // Ensure user has proper roles and features
        if (response.data.user) {
          // Special case for admin user
          if (response.data.user.email === "itsus@tatt2away.com") {
            response.data.user.roles = ["super_admin", "admin", "user"];
          }

          // Set enterprise tier and features
          response.data.user.tier = "enterprise";
          response.data.user.features = getEnterpriseFeatures();

          // Store and update user
          localStorage.setItem(
            "currentUser",
            JSON.stringify(response.data.user)
          );
          setCurrentUser(response.data.user);
          setUserTier("enterprise");
          setUserFeatures(response.data.user.features);
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

  // Get full enterprise features
  const getEnterpriseFeatures = () => {
    return {
      chatbot: true,
      basic_search: true,
      file_upload: true,
      image_analysis: true,
      advanced_search: true,
      image_search: true,
      custom_branding: true,
      multi_user: true,
      data_export: true,
      analytics_basic: true,
      custom_workflows: true,
      advanced_analytics: true,
      multi_department: true,
      automated_alerts: true,
      custom_integrations: true,
      advanced_security: true,
      sso: true,
      advanced_roles: true,
    };
  };

  // Verify MFA code
  const verifyMfa = async (factorId, verificationCode) => {
    try {
      setError("");

      // Special case for test admin user
      if (currentUser?.email === "itsus@tatt2away.com") {
        return verificationCode.length === 6; // Accept any 6-digit code
      }

      // Try with Supabase
      if (factorId) {
        try {
          // Create MFA challenge
          const { data: challenge, error: challengeError } =
            await supabase.auth.mfa.challenge({
              factorId: factorId,
            });

          if (challengeError) throw challengeError;

          // Verify the challenge
          const { data: verify, error: verifyError } =
            await supabase.auth.mfa.verify({
              factorId: factorId,
              challengeId: challenge.id,
              code: verificationCode,
            });

          if (verifyError) throw verifyError;

          return true;
        } catch (error) {
          console.error("Supabase MFA verification error:", error);
          // Try custom API as fallback
        }
      }

      // Try custom API
      const response = await apiService.mfa.verify(factorId, verificationCode);
      return response.data?.success || false;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Failed to verify code");
      return false;
    }
  };

  // Set up MFA for a user
  const setupMfa = async (type) => {
    try {
      // Try with Supabase first
      if (type === "totp") {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: "Tatt2Away",
        });

        if (error) throw error;

        return {
          data: {
            methodId: data.id,
            secret: data.totp.secret,
            qrCode: data.totp.qr_code,
            factorId: data.id,
          },
        };
      }

      // Fall back to custom implementation
      const response = await apiService.mfa.setup(type);
      return response;
    } catch (error) {
      console.error("MFA setup error:", error);
      throw error;
    }
  };

  // Confirm MFA setup
  const confirmMfa = async (methodId, verificationCode) => {
    try {
      // Try with Supabase first
      try {
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

        // Update local user with new MFA method
        updateMfaMethods(methodId, "totp");

        return true;
      } catch (supabaseError) {
        console.warn("Supabase MFA confirmation failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Try custom implementation
      const response = await apiService.mfa.confirm(methodId, verificationCode);

      if (response.data?.success) {
        // Update local user with new MFA method
        updateMfaMethods(methodId, type);
        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA confirmation error:", error);
      return false;
    }
  };

  // Remove MFA method
  const removeMfa = async (methodId) => {
    try {
      // Try with Supabase first
      try {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: methodId,
        });

        if (error) throw error;

        // Update local user
        if (currentUser) {
          const mfaMethods = (currentUser.mfaMethods || []).filter(
            (method) => method.id !== methodId
          );

          setCurrentUser({
            ...currentUser,
            mfaMethods,
          });

          // Update localStorage
          localStorage.setItem(
            "currentUser",
            JSON.stringify({
              ...currentUser,
              mfaMethods,
            })
          );
        }

        return true;
      } catch (supabaseError) {
        console.warn("Supabase MFA removal failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Try custom implementation
      const response = await apiService.mfa.remove(methodId);

      if (response.data?.success) {
        // Update local user
        if (currentUser) {
          const mfaMethods = (currentUser.mfaMethods || []).filter(
            (method) => method.id !== methodId
          );

          setCurrentUser({
            ...currentUser,
            mfaMethods,
          });

          // Update localStorage
          localStorage.setItem(
            "currentUser",
            JSON.stringify({
              ...currentUser,
              mfaMethods,
            })
          );
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA removal error:", error);
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

  // Get user active sessions
  const getActiveSessions = async () => {
    try {
      const response = await apiService.sessions.getSessions();
      return response.data?.sessions || [];
    } catch (error) {
      console.error("Get sessions error:", error);
      return [];
    }
  };

  // Terminate a session
  const terminateSession = async (sessionId) => {
    try {
      const response = await apiService.sessions.terminateSession(sessionId);
      return response.data?.success || false;
    } catch (error) {
      console.error("Terminate session error:", error);
      return false;
    }
  };

  // Terminate all sessions except current
  const terminateAllSessions = async () => {
    try {
      const response = await apiService.sessions.terminateAllSessions();
      return response.data?.success || false;
    } catch (error) {
      console.error("Terminate all sessions error:", error);
      return false;
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      setError("");

      // Try with Supabase first
      try {
        // Update user metadata
        const { error: userError } = await supabase.auth.updateUser({
          data: {
            full_name: profileData.name,
            first_name: profileData.firstName,
            last_name: profileData.lastName,
          },
        });

        if (userError) throw userError;

        // Update profiles table
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: profileData.name,
            first_name: profileData.firstName,
            last_name: profileData.lastName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id);

        if (profileError) throw profileError;

        // Update local state
        setCurrentUser((prev) => {
          const updated = {
            ...prev,
            name: profileData.name,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
          };

          // Update localStorage
          localStorage.setItem("currentUser", JSON.stringify(updated));

          return updated;
        });

        return true;
      } catch (supabaseError) {
        console.warn("Supabase profile update failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Try custom implementation
      const response = await apiService.users.updateProfile(profileData);

      if (response.data?.success) {
        // Update local state
        setCurrentUser((prev) => {
          const updated = {
            ...prev,
            name: profileData.name,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
          };

          // Update localStorage
          localStorage.setItem("currentUser", JSON.stringify(updated));

          return updated;
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Profile update error:", error);
      setError(error.message || "Failed to update profile");
      return false;
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      setError("");

      // Try with Supabase first
      try {
        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: currentPassword,
        });

        if (signInError) throw signInError;

        // Update password
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) throw error;

        return true;
      } catch (supabaseError) {
        console.warn("Supabase password change failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Try custom implementation
      const response = await apiService.auth.changePassword(
        currentPassword,
        newPassword
      );

      return response.data?.success || false;
    } catch (error) {
      console.error("Password change error:", error);
      setError(error.message || "Failed to change password");
      return false;
    }
  };

  // Request password reset
  const requestPasswordReset = async (email) => {
    try {
      setError("");

      // Try with Supabase first
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        return true;
      } catch (supabaseError) {
        console.warn("Supabase password reset request failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Try custom implementation
      const response = await apiService.auth.requestPasswordReset(email);

      return response.data?.success || false;
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

      // Try with Supabase first
      try {
        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) throw error;

        return true;
      } catch (supabaseError) {
        console.warn("Supabase password reset failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Try custom implementation
      const response = await apiService.auth.resetPassword(token, password);

      return response.data?.success || false;
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error.message || "Password reset failed");
      return false;
    }
  };

  // Check if user has a role
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

  // Check if user has permission
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

      // Check specific permissions in user
      if (
        currentUser.permissions &&
        currentUser.permissions.includes(permissionCode)
      ) {
        return true;
      }

      // Basic role-based permissions
      if (
        permissionCode.startsWith("user.") &&
        currentUser.roles.includes("user")
      ) {
        return true;
      }

      // Feature access based on tier
      if (permissionCode.startsWith("feature.")) {
        const featureName = permissionCode.substring("feature.".length);
        return hasFeatureAccess(featureName);
      }

      return false;
    },
    [currentUser]
  );

  // Check if user has access to a feature
  const hasFeatureAccess = useCallback((featureName) => {
    // In this application, all users have enterprise features
    return true;
  }, []);

  // Get current user tier
  const getUserTier = useCallback(() => {
    return "enterprise";
  }, []);

  // Get current user
  const getCurrentUser = async () => {
    try {
      // Check if we already have user data
      if (currentUser) {
        return currentUser;
      }

      // Try to get user from Supabase
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      if (userData?.user) {
        // Get profile data
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userData.user.id)
          .single();

        // Create user object
        const user = {
          id: userData.user.id,
          email: userData.user.email,
          name:
            profileData?.full_name ||
            userData.user.user_metadata?.name ||
            userData.user.email,
          roles: profileData?.roles || ["user"],
          tier: "enterprise",
          mfaMethods: profileData?.mfa_methods || [],
          features: getEnterpriseFeatures(),
        };

        // Special case for super admin
        if (user.email === "itsus@tatt2away.com") {
          user.roles = ["super_admin", "admin", "user"];
        }

        return user;
      }

      // Fall back to stored user
      const storedUser = localStorage.getItem("currentUser");

      if (storedUser) {
        return JSON.parse(storedUser);
      }

      return null;
    } catch (error) {
      console.error("Get current user error:", error);

      // Fall back to stored user
      const storedUser = localStorage.getItem("currentUser");

      if (storedUser) {
        return JSON.parse(storedUser);
      }

      return null;
    }
  };

  // Initialize auth state from Supabase or localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check Supabase session
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          try {
            // Get user data
            const { data: userData } = await supabase.auth.getUser();

            if (userData?.user) {
              // Get profile data - may not exist yet for new users
              const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userData.user.id)
                .single();

              // Create user object
              let user = {
                id: userData.user.id,
                email: userData.user.email,
                name:
                  profileData?.full_name ||
                  userData.user.user_metadata?.name ||
                  userData.user.email,
                roles: profileData?.roles || ["user"],
                tier: "enterprise",
                mfaMethods: profileData?.mfa_methods || [],
                features: getEnterpriseFeatures(),
              };

              // Special case for super admin
              if (user.email === "itsus@tatt2away.com") {
                user.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(user);
              setSession(sessionData.session);
              setUserTier("enterprise");
              setUserFeatures(user.features);

              // Update localStorage
              localStorage.setItem(
                "authToken",
                sessionData.session.access_token
              );
              localStorage.setItem(
                "refreshToken",
                sessionData.session.refresh_token
              );
              localStorage.setItem("currentUser", JSON.stringify(user));
              localStorage.setItem("isAuthenticated", "true");
            }
          } catch (error) {
            console.error("Error getting user profile:", error);
          }
        } else {
          // Check localStorage as fallback
          const storedUser = localStorage.getItem("currentUser");
          const isAuthenticated =
            localStorage.getItem("isAuthenticated") === "true";
          const authToken = localStorage.getItem("authToken");

          if (storedUser && (isAuthenticated || authToken)) {
            try {
              let userData = JSON.parse(storedUser);

              // Always set enterprise features
              userData.features = getEnterpriseFeatures();

              // Ensure super admin role for test user
              if (userData.email === "itsus@tatt2away.com") {
                userData.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(userData);
              setUserTier("enterprise");
              setUserFeatures(userData.features);

              // Update localStorage
              localStorage.setItem("currentUser", JSON.stringify(userData));
              localStorage.setItem("isAuthenticated", "true");
            } catch (error) {
              console.error("Error parsing stored user:", error);

              // Clear invalid data
              localStorage.removeItem("currentUser");
              localStorage.removeItem("authToken");
              localStorage.removeItem("isAuthenticated");

              setCurrentUser(null);
              setSession(null);
            }
          } else {
            setCurrentUser(null);
            setSession(null);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);

        // Check localStorage as final fallback
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setCurrentUser(userData);
            setUserTier("enterprise");
            setUserFeatures(getEnterpriseFeatures());
          } catch (error) {
            console.error("Error parsing stored user:", error);
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }

      // Set up Supabase auth listener
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Supabase auth state change:", event);

        if (event === "SIGNED_IN" && session) {
          try {
            // Get user data
            const { data: userData } = await supabase.auth.getUser();

            if (userData?.user) {
              // Get profile data
              const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userData.user.id)
                .single();

              // Create user object
              let user = {
                id: userData.user.id,
                email: userData.user.email,
                name:
                  profileData?.full_name ||
                  userData.user.user_metadata?.name ||
                  userData.user.email,
                roles: profileData?.roles || ["user"],
                tier: "enterprise",
                mfaMethods: profileData?.mfa_methods || [],
                features: getEnterpriseFeatures(),
              };

              // Special case for super admin
              if (user.email === "itsus@tatt2away.com") {
                user.roles = ["super_admin", "admin", "user"];
              }

              // Update state
              setCurrentUser(user);
              setSession(session);
              setUserTier("enterprise");
              setUserFeatures(user.features);

              // Update localStorage
              localStorage.setItem("authToken", session.access_token);
              localStorage.setItem("refreshToken", session.refresh_token);
              localStorage.setItem("currentUser", JSON.stringify(user));
              localStorage.setItem("isAuthenticated", "true");
            }
          } catch (error) {
            console.error("Error getting user profile:", error);
          }
        } else if (event === "SIGNED_OUT") {
          // Clear state and localStorage
          setCurrentUser(null);
          setSession(null);

          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
        }
      });

      // Store subscription for cleanup
      supabaseListenerRef.current = subscription;

      // Finish initialization
      setLoading(false);
      setIsInitialized(true);
    };

    initAuth();

    // Cleanup function
    return () => {
      if (supabaseListenerRef.current) {
        supabaseListenerRef.current.unsubscribe();
      }
    };
  }, []);

  // Build context value
  const value = {
    currentUser,
    loading,
    error,
    setError,
    session,
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
    hasFeatureAccess,
    getUserTier,
    requestPasswordReset,
    resetPassword,
    changePassword,
    processTokenExchange,
    getActiveSessions,
    terminateSession,
    terminateAllSessions,
    setupMfa,
    confirmMfa,
    removeMfa,
    verifyMfa,
    updateProfile,
    isInitialized,
    getCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
