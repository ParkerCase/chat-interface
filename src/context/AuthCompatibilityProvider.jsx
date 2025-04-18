// src/context/AuthCompatibilityProvider.jsx
import React, { createContext, useContext, useEffect } from "react";
import { useSupabaseAuth } from "./SupabaseAuthProvider";
import { debugAuth } from "../utils/authDebug";

// Create a context for the legacy compatibility layer
const AuthCompatibilityContext = createContext(null);

// Hook to use the compatibility layer
export function useAuth() {
  return useContext(AuthCompatibilityContext);
}

/**
 * This provider bridges the gap between the existing AuthContext API
 * and the new Supabase Auth integration. It ensures backward compatibility
 * with existing code that depends on the original AuthContext.
 */
export function AuthCompatibilityProvider({ children }) {
  // Get auth state and methods from Supabase Auth
  const supabaseAuth = useSupabaseAuth();

  // Sync localStorage with Supabase auth state for legacy compatibility
  useEffect(() => {
    if (supabaseAuth.user) {
      localStorage.setItem("currentUser", JSON.stringify(supabaseAuth.user));

      if (supabaseAuth.session) {
        localStorage.setItem("authToken", supabaseAuth.session.access_token);
        localStorage.setItem(
          "refreshToken",
          supabaseAuth.session.refresh_token
        );
      }

      localStorage.setItem("isAuthenticated", "true");

      // Handle MFA state
      if (supabaseAuth.mfaState.verified) {
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");
      } else if (supabaseAuth.mfaState.required) {
        localStorage.setItem("authStage", "pre-mfa");
      }
    } else {
      // Clear auth state in localStorage when logged out
      localStorage.removeItem("currentUser");
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfa_verified");
    }
  }, [supabaseAuth.user, supabaseAuth.session, supabaseAuth.mfaState]);

  // Map login function to Supabase signIn
  const login = async (email, password) => {
    debugAuth.log("AuthCompatibility", `Login attempt for ${email}`);
    return await supabaseAuth.signIn(email, password);
  };

  // Map logout function to Supabase signOut
  const logout = async () => {
    debugAuth.log("AuthCompatibility", "Logging out");
    return await supabaseAuth.signOut();
  };

  // Map register function (unused in this app but included for completeness)
  const register = async (userData) => {
    debugAuth.log(
      "AuthCompatibility",
      "Register not implemented in compatibility layer"
    );
    return {
      success: false,
      error: "Registration through this method is not supported",
    };
  };

  // Map MFA functions
  const setupMfa = async (type) => {
    debugAuth.log("AuthCompatibility", `Setting up MFA type: ${type}`);
    return await supabaseAuth.setupMfa(type);
  };

  const confirmMfa = async (methodId, code) => {
    debugAuth.log(
      "AuthCompatibility",
      `Confirming MFA setup for method: ${methodId}`
    );
    return await supabaseAuth.confirmMfa(methodId, code);
  };

  const verifyMfa = async (methodId, code) => {
    debugAuth.log(
      "AuthCompatibility",
      `Verifying MFA code for method: ${methodId}`
    );
    return await supabaseAuth.verifyMfa(methodId, code);
  };

  const removeMfa = async (methodId) => {
    debugAuth.log("AuthCompatibility", `Removing MFA method: ${methodId}`);
    return await supabaseAuth.removeMfa(methodId);
  };

  // Map profile update function
  const updateProfile = async (updates) => {
    debugAuth.log("AuthCompatibility", "Updating user profile");
    return await supabaseAuth.updateUserProfile(updates);
  };

  // Create value object that matches the original AuthContext API
  const value = {
    currentUser: supabaseAuth.user,
    loading: supabaseAuth.loading,
    error: supabaseAuth.error,
    setError: supabaseAuth.setError,
    login,
    logout,
    register,
    setupMfa,
    confirmMfa,
    verifyMfa,
    removeMfa,
    updateProfile,
    isAdmin: supabaseAuth.isAdmin,
    isSuperAdmin: supabaseAuth.isSuperAdmin,
    hasRole: supabaseAuth.hasRole,
    isInitialized: !supabaseAuth.loading,
    mfaState: supabaseAuth.mfaState,

    // Add these functions as empty stubs to prevent errors
    getActiveSessions: async () => {
      debugAuth.log("AuthCompatibility", "getActiveSessions not implemented");
      return [];
    },
    terminateSession: async () => {
      debugAuth.log("AuthCompatibility", "terminateSession not implemented");
      return { success: false };
    },
    terminateAllSessions: async () => {
      debugAuth.log(
        "AuthCompatibility",
        "terminateAllSessions not implemented"
      );
      return { success: false };
    },
  };

  return (
    <AuthCompatibilityContext.Provider value={value}>
      {children}
    </AuthCompatibilityContext.Provider>
  );
}
