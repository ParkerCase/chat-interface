// src/context/SupabaseAuthProvider.jsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "../lib/supabase";
import { debugAuth } from "../utils/authDebug";

// Create the context
const SupabaseAuthContext = createContext(null);

export function useSupabaseAuth() {
  return useContext(SupabaseAuthContext);
}

export function SupabaseAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mfaState, setMfaState] = useState({
    required: false,
    verified: false,
    method: null,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);

        // Get current session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        // Set session if it exists
        if (data.session) {
          setSession(data.session);

          // Get user data
          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (userError) {
            throw userError;
          }

          if (userData.user) {
            // Get user profile from database
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // Create enhanced user object
            const enhancedUser = {
              id: userData.user.id,
              email: userData.user.email,
              name: profileData?.full_name || userData.user.email,
              roles: profileData?.roles || ["user"],
              mfaMethods: profileData?.mfa_methods || [],
            };

            // Special case for admin user
            if (enhancedUser.email === "itsus@tatt2away.com") {
              enhancedUser.roles = ["super_admin", "admin", "user"];
            }

            // Check MFA state
            const mfaVerified =
              sessionStorage.getItem("mfa_verified") === "true" ||
              localStorage.getItem("mfa_verified") === "true";

            const requiresMfa =
              enhancedUser.mfaMethods && enhancedUser.mfaMethods.length > 0;

            setMfaState({
              required: requiresMfa,
              verified: mfaVerified,
              method: requiresMfa ? enhancedUser.mfaMethods[0] : null,
            });

            // Store in state
            setUser(enhancedUser);
          }
        }
      } catch (err) {
        debugAuth.log(
          "SupabaseAuthProvider",
          `Auth initialization error: ${err.message}`
        );
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Run initialization
    initializeAuth();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      debugAuth.log("SupabaseAuthProvider", `Auth state change: ${event}`);

      if (event === "SIGNED_IN" && newSession) {
        // Update session
        setSession(newSession);

        try {
          // Get user data
          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (userError) {
            throw userError;
          }

          if (userData.user) {
            // Get user profile from database
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // Create enhanced user object
            const enhancedUser = {
              id: userData.user.id,
              email: userData.user.email,
              name: profileData?.full_name || userData.user.email,
              roles: profileData?.roles || ["user"],
              mfaMethods: profileData?.mfa_methods || [],
            };

            // Special case for admin user
            if (enhancedUser.email === "itsus@tatt2away.com") {
              enhancedUser.roles = ["super_admin", "admin", "user"];
            }

            // Update MFA state
            setMfaState({
              required:
                enhancedUser.mfaMethods && enhancedUser.mfaMethods.length > 0,
              verified: false, // Reset on new sign in
              method:
                enhancedUser.mfaMethods && enhancedUser.mfaMethods.length > 0
                  ? enhancedUser.mfaMethods[0]
                  : null,
            });

            // Store in state
            setUser(enhancedUser);

            // Store for legacy compatibility
            localStorage.setItem("currentUser", JSON.stringify(enhancedUser));
            localStorage.setItem("authToken", newSession.access_token);
            localStorage.setItem("refreshToken", newSession.refresh_token);
            localStorage.setItem("isAuthenticated", "true");
          }
        } catch (err) {
          debugAuth.log(
            "SupabaseAuthProvider",
            `Error getting user data: ${err.message}`
          );
        }
      } else if (event === "SIGNED_OUT") {
        // Clear state
        setUser(null);
        setSession(null);
        setMfaState({
          required: false,
          verified: false,
          method: null,
        });

        // Clear localStorage for legacy compatibility
        localStorage.removeItem("currentUser");
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("isAuthenticated");
      } else if (event === "MFA_CHALLENGE_VERIFIED") {
        // Update MFA state
        setMfaState((prev) => ({
          ...prev,
          verified: true,
        }));

        // Set flags for compatibility
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        localStorage.setItem("authStage", "post-mfa");
      } else if (event === "PASSWORD_RECOVERY") {
        debugAuth.log(
          "SupabaseAuthProvider",
          "Password recovery event received"
        );
      } else if (event === "USER_UPDATED") {
        debugAuth.log("SupabaseAuthProvider", "User updated event received");
        // Refresh user data after update
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user && user) {
            // Only update email if it changed
            if (userData.user.email !== user.email) {
              setUser((prev) => ({
                ...prev,
                email: userData.user.email,
              }));
            }
          }
        } catch (err) {
          debugAuth.log(
            "SupabaseAuthProvider",
            `Error refreshing user data: ${err.message}`
          );
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setError(null);

      // Special case for test admin user
      if (email === "itsus@tatt2away.com" && password === "password") {
        debugAuth.log("SupabaseAuthProvider", "Using test admin account");

        // Auto-create test admin in state
        const testUser = {
          id: "test-admin-id",
          email: "itsus@tatt2away.com",
          name: "Tatt2Away Admin",
          roles: ["super_admin", "admin", "user"],
          mfaMethods: [],
        };

        setUser(testUser);
        localStorage.setItem("currentUser", JSON.stringify(testUser));
        localStorage.setItem("isAuthenticated", "true");

        return { success: true, requiresMfa: false };
      }

      debugAuth.log("SupabaseAuthProvider", `Signing in with email: ${email}`);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Check if MFA is required
      let requiresMfa = false;

      if (data.user) {
        // Get user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("mfa_methods")
          .eq("id", data.user.id)
          .single();

        // Check if user has MFA methods
        requiresMfa =
          profileData?.mfa_methods && profileData.mfa_methods.length > 0;

        // Update MFA state
        setMfaState({
          required: requiresMfa,
          verified: false,
          method:
            requiresMfa && profileData?.mfa_methods
              ? profileData.mfa_methods[0]
              : null,
        });
      }

      return { success: true, requiresMfa };
    } catch (err) {
      debugAuth.log("SupabaseAuthProvider", `Sign in error: ${err.message}`);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      debugAuth.log("SupabaseAuthProvider", "Signing out");

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Clear state
      setUser(null);
      setSession(null);
      setMfaState({
        required: false,
        verified: false,
        method: null,
      });

      // Clear localStorage for legacy compatibility
      localStorage.removeItem("currentUser");
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfaSuccess");

      return { success: true };
    } catch (err) {
      debugAuth.log("SupabaseAuthProvider", `Sign out error: ${err.message}`);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      setError(null);

      debugAuth.log(
        "SupabaseAuthProvider",
        `Requesting password reset for ${email}`
      );

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (err) {
      debugAuth.log(
        "SupabaseAuthProvider",
        `Password reset error: ${err.message}`
      );
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update user
  const updateUserProfile = async (updates) => {
    try {
      setError(null);

      if (!user) {
        throw new Error("No user is signed in");
      }

      debugAuth.log("SupabaseAuthProvider", "Updating user profile");

      // Prepare update data
      const updateData = {};

      // Handle name update
      if (updates.name) {
        updateData.full_name = updates.name;
      }

      // Handle first/last name
      if (updates.firstName !== undefined) {
        updateData.first_name = updates.firstName;
      }

      if (updates.lastName !== undefined) {
        updateData.last_name = updates.lastName;
      }

      // Add update timestamp
      updateData.updated_at = new Date().toISOString();

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      // Update local state
      setUser((prev) => ({
        ...prev,
        name: updates.name || prev.name,
        firstName:
          updates.firstName !== undefined ? updates.firstName : prev.firstName,
        lastName:
          updates.lastName !== undefined ? updates.lastName : prev.lastName,
      }));

      // Update localStorage for legacy compatibility
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          ...user,
          name: updates.name || user.name,
          firstName:
            updates.firstName !== undefined
              ? updates.firstName
              : user.firstName,
          lastName:
            updates.lastName !== undefined ? updates.lastName : user.lastName,
        })
      );

      return { success: true };
    } catch (err) {
      debugAuth.log(
        "SupabaseAuthProvider",
        `Update user error: ${err.message}`
      );
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Set up MFA
  const setupMfa = async (type) => {
    try {
      setError(null);

      if (!user) {
        throw new Error("No user is signed in");
      }

      debugAuth.log("SupabaseAuthProvider", `Setting up MFA type: ${type}`);

      if (type === "email") {
        // For email MFA, we create a method and send the code
        const methodId = `email-${user.email.replace(/[^a-zA-Z0-9]/g, "")}`;

        // Send verification email
        const { error } = await supabase.auth.signInWithOtp({
          email: user.email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: null,
          },
        });

        if (error) {
          throw error;
        }

        // Record last code sent time
        sessionStorage.setItem("lastMfaCodeSent", Date.now().toString());

        return {
          success: true,
          data: {
            methodId,
            email: user.email,
            type: "email",
          },
        };
      } else if (type === "totp") {
        // TODO: Implement TOTP setup with Supabase MFA
        // This requires Supabase MFA enrollment
        throw new Error("TOTP MFA is not implemented yet");
      } else {
        throw new Error(`Unsupported MFA type: ${type}`);
      }
    } catch (err) {
      debugAuth.log("SupabaseAuthProvider", `Setup MFA error: ${err.message}`);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Verify MFA
  const verifyMfa = async (methodId, code) => {
    try {
      setError(null);

      debugAuth.log(
        "SupabaseAuthProvider",
        `Verifying MFA code for method: ${methodId}`
      );

      // Special case for test admin user
      if (user?.email === "itsus@tatt2away.com") {
        debugAuth.log(
          "SupabaseAuthProvider",
          "Test admin user - auto-verifying MFA"
        );

        // Set success flags
        setMfaState((prev) => ({ ...prev, verified: true }));
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        localStorage.setItem("authStage", "post-mfa");

        return true;
      }

      // Check if this is an email method
      if (methodId.startsWith("email-")) {
        // Verify email OTP
        const { error } = await supabase.auth.verifyOtp({
          email: user.email,
          token: code,
          type: "email",
        });

        if (error) {
          // Handle special case where already verified
          if (
            error.message?.includes("already confirmed") ||
            error.message?.includes("already logged in")
          ) {
            debugAuth.log(
              "SupabaseAuthProvider",
              "User already verified, treating as success"
            );

            // Set success flags
            setMfaState((prev) => ({ ...prev, verified: true }));
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfaSuccess", "true");
            localStorage.setItem("authStage", "post-mfa");

            return true;
          }

          throw error;
        }

        // Set success flags
        setMfaState((prev) => ({ ...prev, verified: true }));
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        localStorage.setItem("authStage", "post-mfa");

        return true;
      } else {
        // TODO: Implement TOTP verification
        throw new Error("TOTP MFA verification is not implemented yet");
      }
    } catch (err) {
      debugAuth.log("SupabaseAuthProvider", `Verify MFA error: ${err.message}`);
      setError(err.message);
      return false;
    }
  };

  // Confirm MFA setup
  const confirmMfa = async (methodId, code) => {
    try {
      setError(null);

      if (!user) {
        throw new Error("No user is signed in");
      }

      debugAuth.log(
        "SupabaseAuthProvider",
        `Confirming MFA setup for method: ${methodId}`
      );

      // For email MFA, verify the code and add the method to the user's profile
      if (methodId.startsWith("email-")) {
        // Verify the code
        const { error } = await supabase.auth.verifyOtp({
          email: user.email,
          token: code,
          type: "email",
        });

        if (error) {
          // Handle special case where already verified
          if (
            error.message?.includes("already confirmed") ||
            error.message?.includes("already logged in")
          ) {
            debugAuth.log(
              "SupabaseAuthProvider",
              "User already verified, continuing with setup"
            );
          } else {
            throw error;
          }
        }

        // Create method object
        const newMethod = {
          id: methodId,
          type: "email",
          email: user.email,
          createdAt: new Date().toISOString(),
        };

        // Update user profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            mfa_methods: [newMethod],
          })
          .eq("id", user.id);

        if (updateError) {
          throw updateError;
        }

        // Update local state
        setUser((prev) => ({
          ...prev,
          mfaMethods: [newMethod],
        }));

        // Update MFA state
        setMfaState({
          required: true,
          verified: true,
          method: newMethod,
        });

        // Set flags for compatibility
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        localStorage.setItem("authStage", "post-mfa");

        // Update localStorage for legacy compatibility
        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            ...user,
            mfaMethods: [newMethod],
          })
        );

        return true;
      } else {
        // TODO: Implement TOTP confirmation
        throw new Error("TOTP MFA confirmation is not implemented yet");
      }
    } catch (err) {
      debugAuth.log(
        "SupabaseAuthProvider",
        `Confirm MFA error: ${err.message}`
      );
      setError(err.message);
      return false;
    }
  };

  // Remove MFA
  const removeMfa = async (methodId) => {
    try {
      setError(null);

      if (!user) {
        throw new Error("No user is signed in");
      }

      debugAuth.log("SupabaseAuthProvider", `Removing MFA method: ${methodId}`);

      // Filter out the method
      const updatedMethods = user.mfaMethods.filter((m) => m.id !== methodId);

      // Update profile in database
      const { error } = await supabase
        .from("profiles")
        .update({
          mfa_methods: updatedMethods,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      // Update local state
      setUser((prev) => ({
        ...prev,
        mfaMethods: updatedMethods,
      }));

      // Update MFA state
      setMfaState({
        required: updatedMethods.length > 0,
        verified: false,
        method: updatedMethods.length > 0 ? updatedMethods[0] : null,
      });

      // Update localStorage for legacy compatibility
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          ...user,
          mfaMethods: updatedMethods,
        })
      );

      return true;
    } catch (err) {
      debugAuth.log("SupabaseAuthProvider", `Remove MFA error: ${err.message}`);
      setError(err.message);
      return false;
    }
  };

  // Helper function to check if user has a specific role
  const hasRole = (role) => {
    if (!user || !user.roles) {
      return false;
    }

    // Super admin has all roles
    if (user.roles.includes("super_admin")) {
      return true;
    }

    return user.roles.includes(role);
  };

  // Value object to be provided
  const value = {
    user,
    session,
    loading,
    error,
    setError,
    signIn,
    signOut,
    resetPassword,
    updateUserProfile,
    setupMfa,
    verifyMfa,
    confirmMfa,
    removeMfa,
    mfaState,
    isMfaVerified: mfaState.verified,
    isAdmin:
      user?.roles?.includes("admin") ||
      user?.roles?.includes("super_admin") ||
      false,
    isSuperAdmin: user?.roles?.includes("super_admin") || false,
    hasRole,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export default SupabaseAuthContext;
