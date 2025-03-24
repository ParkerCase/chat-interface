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

  // Initialize auth state from Supabase session
  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setSession(session);
        const userData = await getUserData();
        setCurrentUser(userData);
        setUserTier(userData?.tier || "basic");
        setTierFeatures(
          userData?.features ||
            getDefaultFeaturesForTier(userData?.tier || "basic")
        );
      } else {
        setCurrentUser(null);
        setSession(null);
        setUserTier("basic");
        setTierFeatures(getDefaultFeaturesForTier("basic"));
      }
      setLoading(false);
    });

    // Initial session check
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          const userData = await getUserData();
          setCurrentUser(userData);
          setUserTier(userData?.tier || "basic");
          setTierFeatures(
            userData?.features ||
              getDefaultFeaturesForTier(userData?.tier || "basic")
          );
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setError("");

      // Handle special dev login
      if (email === "itsus@tatt2away.com") {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: "admin@tatt2away.com",
            password: "adminpassword123", // This should be replaced with the actual admin password
          });

          if (error) throw error;
          return true;
        } catch (error) {
          console.error("Dev login error:", error);
          throw error;
        }
      }

      // Regular login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Store flag for basic auth
      localStorage.setItem("isAuthenticated", "true");

      return true;
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message || "An error occurred during login");
      return false;
    }
  };

  const signInWithSSO = async (provider, options = {}) => {
    try {
      setError("");
      setLoading(true);

      // Default redirect URL
      const redirectTo =
        options.redirectTo || `${window.location.origin}/auth/callback`;

      let response;
      if (provider === "google") {
        response = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            scopes: "email profile",
          },
        });
      } else if (provider === "azure") {
        response = await supabase.auth.signInWithOAuth({
          provider: "azure",
          options: {
            redirectTo,
            scopes: "email profile",
          },
        });
      } else if (provider === "custom_saml") {
        // For SAML providers, Supabase uses a slightly different approach
        response = await supabase.auth.signInWithSSO({
          domain: options.domain || "your-domain",
          options: {
            redirectTo,
          },
        });
      }

      if (response.error) throw response.error;
      return true;
    } catch (error) {
      console.error("SSO sign in error:", error);
      setError(error.message || "Failed to sign in with SSO");
      return false;
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

  // Register function (admin only)
  const register = async (userData) => {
    try {
      setError("");

      // Validate email domain
      if (!userData.email.endsWith("@tatt2away.com")) {
        setError("Only @tatt2away.com email addresses are allowed");
        return false;
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password || undefined, // If password is empty, Supabase will auto-generate one
          email_confirm: true, // Skip email confirmation step
          user_metadata: {
            name: userData.name,
            roles: userData.roles,
          },
        });

      if (authError) throw authError;

      // Add user to profiles table
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: authData.user.id,
          full_name: userData.name,
          tier: userData.tier || "basic",
        },
      ]);

      if (profileError) throw profileError;

      // Add user roles to user_roles table
      const rolePromises = userData.roles.map(async (role) => {
        const { data: roleData, error: roleQueryError } = await supabase
          .from("roles")
          .select("id")
          .eq("name", role)
          .single();

        if (roleQueryError) throw roleQueryError;

        const { error: roleAssignError } = await supabase
          .from("user_roles")
          .insert([
            {
              user_id: authData.user.id,
              role_id: roleData.id,
            },
          ]);

        if (roleAssignError) throw roleAssignError;
      });

      await Promise.all(rolePromises);

      return {
        success: true,
        user: {
          id: authData.user.id,
          name: userData.name,
          email: userData.email,
          roles: userData.roles,
        },
        credentials: authData.user,
      };
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.message || "Registration failed. Please try again.");
      return false;
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

      // Update password_last_changed in profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          password_last_changed: new Date().toISOString(),
        })
        .eq("id", currentUser.id);

      if (updateError)
        console.error("Error updating password_last_changed:", updateError);

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

      // For SSO flows, Supabase handles the token exchange automatically

      return true;
    } catch (error) {
      console.error("Token exchange error:", error);
      setError(error.message || "Authentication failed. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // MFA Functions

  // Setup MFA
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

  // Update the verification function to use Supabase
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

        // Store MFA method in user profile
        await updateUserMfaMethods("totp", methodId);

        return true;
      } else if (methodId === "email") {
        // Verify email OTP
        const { error } = await supabase.auth.verifyOtp({
          email: currentUser.email,
          token: verificationCode,
          type: "email",
        });

        if (error) throw error;

        // Store MFA method in user profile
        await updateUserMfaMethods("email");

        return true;
      }

      return false;
    } catch (error) {
      console.error("MFA verification error:", error);
      setError(error.message || "Failed to verify MFA");
      return false;
    }
  };

  // Update user's MFA methods in the profiles table
  const updateMfaMethods = async (type, id = null) => {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("mfa_methods")
        .eq("id", currentUser.id)
        .single();

      if (fetchError) throw fetchError;

      const mfaMethods = profile.mfa_methods || [];

      // Add the new method if it doesn't exist
      const newMethod = {
        id: id || type,
        type,
        identifier: type === "email" ? currentUser.email : null,
        createdAt: new Date().toISOString(),
      };

      const updatedMethods = [...mfaMethods, newMethod];

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          mfa_methods: updatedMethods,
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      // Update local user state
      setCurrentUser((prev) => ({
        ...prev,
        mfaMethods: updatedMethods,
      }));
    } catch (error) {
      console.error("Error updating MFA methods:", error);
      throw error;
    }
  };

  // Remove MFA method
  const removeMfa = async (methodId) => {
    try {
      // First update the user profile to remove the method
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("mfa_methods")
        .eq("id", currentUser.id)
        .single();

      if (fetchError) throw fetchError;

      const mfaMethods = profile.mfa_methods || [];
      const updatedMethods = mfaMethods.filter(
        (method) => method.id !== methodId
      );

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          mfa_methods: updatedMethods,
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      // If it's a TOTP factor, unenroll it from Supabase
      if (methodId !== "email") {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: methodId,
        });

        if (error) throw error;
      }

      // Update local user state
      setCurrentUser((prev) => ({
        ...prev,
        mfaMethods: updatedMethods,
      }));

      return true;
    } catch (error) {
      console.error("MFA removal error:", error);
      setError(error.message || "Failed to remove MFA method");
      return false;
    }
  };

  // Verify MFA during login
  const verifyMfa = async (verificationCode, methodId) => {
    try {
      // For TOTP verification with Supabase
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

  // Get user sessions
  const getSessions = async () => {
    try {
      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentSessionId = session?.id;

      // Get all sessions for this user from the profiles table
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("sessions")
        .eq("id", currentUser.id)
        .single();

      if (fetchError) throw fetchError;

      const sessions = profile.sessions || [];

      // Mark the current session
      return sessions.map((sess) => ({
        ...sess,
        isCurrent: sess.id === currentSessionId,
      }));
    } catch (error) {
      console.error("Get sessions error:", error);
      setError(error.message || "Failed to retrieve sessions");
      return [];
    }
  };

  // Terminate session
  const terminateSession = async (sessionId) => {
    try {
      // Get current sessions
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("sessions")
        .eq("id", currentUser.id)
        .single();

      if (fetchError) throw fetchError;

      const sessions = profile.sessions || [];
      const updatedSessions = sessions.filter((sess) => sess.id !== sessionId);

      // Update the sessions in the profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          sessions: updatedSessions,
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error("Terminate session error:", error);
      setError(error.message || "Failed to terminate session");
      return false;
    }
  };

  // Terminate all other sessions
  const terminateAllSessions = async () => {
    try {
      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentSessionId = session?.id;

      // Get all sessions
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("sessions")
        .eq("id", currentUser.id)
        .single();

      if (fetchError) throw fetchError;

      const sessions = profile.sessions || [];

      // Keep only the current session
      const currentSession = sessions.find(
        (sess) => sess.id === currentSessionId
      );

      // Update the sessions in the profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          sessions: currentSession ? [currentSession] : [],
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      // Call signOut with scope 'others' to invalidate other sessions
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "others",
      });

      if (signOutError) throw signOutError;

      return true;
    } catch (error) {
      console.error("Terminate all sessions error:", error);
      setError(error.message || "Failed to terminate sessions");
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

      // Update profile in the profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.name,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          // Add other fields as needed
        })
        .eq("id", currentUser.id);

      if (profileError) throw profileError;

      // Update local state
      setCurrentUser((prev) => ({
        ...prev,
        name: profileData.name,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      }));

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
    },
    [currentUser, tierFeatures]
  );

  // Check user tier level
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
