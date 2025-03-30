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

      // First, try Supabase authentication
      try {
        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (authError) throw authError;

        console.log("Supabase login successful:", authData);

        // Get MFA status
        const { data: mfaData, error: mfaError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        console.log("MFA status:", mfaData);

        // Get roles from profiles
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          console.warn("Error fetching profile:", profileError);
        }

        // Determine roles and tier
        let roles = ["user"];
        let tier = "enterprise";

        if (profileData) {
          roles = profileData.roles || ["user"];

          // Always use enterprise tier in this app
          tier = "enterprise";
        }

        // Special case for super admin
        if (email === "itsus@tatt2away.com") {
          roles = ["super_admin", "admin", "user"];
        }

        // Create user object
        const userData = {
          id: authData.user.id,
          email: authData.user.email,
          name:
            profileData?.full_name ||
            authData.user.user_metadata?.name ||
            email,
          roles,
          tier,
          // Add MFA methods if available
          mfaMethods: profileData?.mfa_methods || [],
        };

        // Store auth tokens and user data
        localStorage.setItem("authToken", authData.session.access_token);
        localStorage.setItem("refreshToken", authData.session.refresh_token);
        localStorage.setItem("currentUser", JSON.stringify(userData));
        localStorage.setItem("isAuthenticated", "true");

        // Update state
        setCurrentUser(userData);
        setSession(authData.session);
        setUserTier(tier);

        // Determine if MFA is required
        const mfaRequired =
          mfaData &&
          mfaData.currentLevel !== mfaData.nextLevel &&
          mfaData.nextLevel === "aal2";

        return {
          success: true,
          mfaRequired,
          mfaData: mfaRequired
            ? {
                factorId: mfaData.currentFactorId,
                nextLevel: mfaData.nextLevel,
                type: "totp",
              }
            : null,
          isAdmin: roles.includes("admin") || roles.includes("super_admin"),
        };
      } catch (supabaseError) {
        console.warn(
          "Supabase login failed, falling back to API:",
          supabaseError
        );
        // Fall through to custom API login
      }

      // If Supabase auth fails, try custom API
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
      console.log("API login response:", data);

      if (data.success) {
        // Store auth tokens
        localStorage.setItem("authToken", data.token);
        if (data.refreshToken)
          localStorage.setItem("refreshToken", data.refreshToken);
        if (data.sessionId) localStorage.setItem("sessionId", data.sessionId);

        // Make sure to set admin role for test user
        if (email === "itsus@tatt2away.com") {
          data.user.roles = ["super_admin", "admin", "user"];
          data.user.tier = "enterprise";
        } else if (!data.user.roles || data.user.roles.length === 0) {
          // Ensure every user has at least the 'user' role
          data.user.roles = ["user"];
        }

        // Always set enterprise tier
        data.user.tier = "enterprise";

        // Add enterprise features
        data.user.features = getEnterpriseFeatures();

        // Store the user object
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        localStorage.setItem("isAuthenticated", "true");

        // Update state
        setCurrentUser(data.user);
        setUserTier("enterprise");
        setUserFeatures(data.user.features || getEnterpriseFeatures());

        // Check for MFA methods
        const hasMfaMethods =
          data.user?.mfaMethods && data.user.mfaMethods.length > 0;

        console.log("MFA check:", {
          hasMfaMethods,
          methods: data.user?.mfaMethods || [],
        });

        // Return login result with MFA status
        return {
          success: true,
          mfaRequired: hasMfaMethods,
          mfaData: hasMfaMethods
            ? {
                methodId: data.user.mfaMethods[0].id,
                type: data.user.mfaMethods[0].type,
                email: data.user.email,
              }
            : null,
          isAdmin:
            data.user.roles.includes("admin") ||
            data.user.roles.includes("super_admin"),
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
        const { data: session } = await supabase.auth.getSession();

        if (session?.session) {
          // Get user profile
          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (userError) throw userError;

          // Get additional data from profiles
          const { data: profileData, error: profileError } = await supabase
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
          };

          // Special case for admin user
          if (user.email === "itsus@tatt2away.com") {
            user.roles = ["super_admin", "admin", "user"];
          }

          // Add enterprise features
          user.features = getEnterpriseFeatures();

          // Store user data
          localStorage.setItem("authToken", session.session.access_token);
          localStorage.setItem("refreshToken", session.session.refresh_token);
          localStorage.setItem("currentUser", JSON.stringify(user));
          localStorage.setItem("isAuthenticated", "true");

          // Update state
          setCurrentUser(user);
          setSession(session.session);
          setUserTier("enterprise");
          setUserFeatures(user.features);

          return true;
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

  const logAuthEvent = async (eventType, metadata = {}) => {
    try {
      await supabase.from("auth_events").insert({
        user_id: currentUser?.id,
        event_type: eventType,
        metadata,
        ip_address: await fetch("https://api.ipify.org?format=json")
          .then((res) => res.json())
          .then((data) => data.ip)
          .catch(() => null),
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Failed to log auth event:", error);
    }
  };

  // Additional function for AuthContext.jsx
  const getUserRoles = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data.roles || ["user"];
    } catch (error) {
      console.error("Error fetching user roles:", error);
      return ["user"]; // Default to basic user role
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
  const verifyMfa = async (methodId, verificationCode) => {
    try {
      setError("");

      // First try with Supabase
      try {
        // If this is a valid factor ID, use Supabase MFA
        if (methodId) {
          const { data: challenge, error: challengeError } =
            await supabase.auth.mfa.challenge({
              factorId: methodId,
            });

          if (challengeError) throw challengeError;

          const { data: verify, error: verifyError } =
            await supabase.auth.mfa.verify({
              factorId: methodId,
              challengeId: challenge.id,
              code: verificationCode,
            });

          if (verifyError) throw verifyError;

          return true;
        }
      } catch (supabaseError) {
        console.warn("Supabase MFA verification failed:", supabaseError);
        // Fall through to custom implementation
      }

      // Custom MFA verification
      console.log("Falling back to custom MFA verification");

      // For testing purposes with our test user
      if (currentUser?.email === "itsus@tatt2away.com") {
        return verificationCode.length === 6; // Accept any 6-digit code
      }

      // Try our custom API
      const response = await fetch(
        `${apiService.utils.getBaseUrl()}/api/mfa/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({
            methodId,
            verificationCode,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Update tokens if provided
        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }

        return true;
      }

      setError(data.error || "Invalid verification code");
      return false;
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
            secret: data.secret,
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
        const { data, error } = await supabase.auth.mfa.verify({
          factorId: methodId,
          code: verificationCode,
        });

        if (error) throw error;

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
        updateMfaMethods(methodId, "totp");
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
    // Everyone has access to enterprise features
    return true;
  }, []);

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

  // Get current user tier
  const getUserTier = useCallback(() => {
    return "enterprise";
  }, []);

  // Get current user from Supabase
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
    // Set up auth state listener
    const initAuth = async () => {
      // First check Supabase session
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session) {
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
            setSession(sessionData.session);
            setUserTier("enterprise");
            setUserFeatures(user.features);

            // Update localStorage
            localStorage.setItem("authToken", sessionData.session.access_token);
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

        if ((storedUser && isAuthenticated) || (storedUser && authToken)) {
          try {
            const userData = JSON.parse(storedUser);

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

      // Set up Supabase auth listener
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Supabase auth state change:", event);

        if (session) {
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

  // Computed properties for admin status
  const isAdmin =
    currentUser?.roles?.includes("admin") ||
    currentUser?.roles?.includes("super_admin") ||
    false;

  const isSuperAdmin = currentUser?.roles?.includes("super_admin") || false;

  // Build context value
  const value = {
    currentUser,
    loading,
    error,
    setError,
    session,
    login,
    logout,
    register: () => {}, // Implementation would go here
    isAdmin,
    isSuperAdmin,
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
