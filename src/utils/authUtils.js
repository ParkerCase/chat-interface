// src/utils/authUtils.js
import { supabase } from "../lib/supabase";

/**
 * Utility functions for authentication troubleshooting and recovery
 */
const authUtils = {
  /**
   * Diagnose common authentication issues
   * @returns {Promise<Object>} Diagnostic results
   */
  diagnoseAuthIssues: async () => {
    const results = {
      timestamp: new Date().toISOString(),
      status: "unknown",
      issues: [],
      session: null,
      localStorage: {},
      sessionStorage: {},
    };

    try {
      console.log("Running auth diagnostics...");

      // Check Supabase session
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        results.issues.push(`Session error: ${error.message}`);
      } else {
        results.session = {
          exists: !!data.session,
          user: data.session
            ? {
                id: data.session.user.id,
                email: data.session.user.email,
                lastSignIn: data.session.user.last_sign_in_at,
              }
            : null,
          expiresAt: data.session
            ? new Date(data.session.expires_at * 1000).toISOString()
            : null,
        };
      }

      // Check localStorage
      const authKeys = [
        "authToken",
        "refreshToken",
        "sessionId",
        "currentUser",
        "isAuthenticated",
        "authStage",
        "mfa_verified",
        "pendingVerificationEmail",
        "tatt2away_supabase_auth",
      ];

      authKeys.forEach((key) => {
        const value = localStorage.getItem(key);
        results.localStorage[key] = value
          ? key.includes("Token")
            ? `${value.substring(0, 10)}...`
            : value
          : null;
      });

      // Check sessionStorage
      const sessionKeys = [
        "mfa_verified",
        "lastMfaCodeSent",
        "mfaSuccess",
        "mfaVerifiedAt",
      ];

      sessionKeys.forEach((key) => {
        results.sessionStorage[key] = sessionStorage.getItem(key);
      });

      // Detect state inconsistencies
      const currentUser = localStorage.getItem("currentUser");
      const isAuthenticated =
        localStorage.getItem("isAuthenticated") === "true";
      const hasSession = !!results.session?.exists;

      if (isAuthenticated && !currentUser) {
        results.issues.push("Authenticated flag set but no user data found");
      }

      if (currentUser && !isAuthenticated) {
        results.issues.push("User data exists but not marked as authenticated");
      }

      if (isAuthenticated && !hasSession) {
        results.issues.push(
          "Locally marked as authenticated but no valid Supabase session"
        );
      }

      if (!isAuthenticated && hasSession) {
        results.issues.push(
          "Valid Supabase session exists but not marked as authenticated locally"
        );
      }

      // Check for MFA inconsistencies
      const mfaVerified =
        localStorage.getItem("mfa_verified") === "true" ||
        sessionStorage.getItem("mfa_verified") === "true";
      const authStage = localStorage.getItem("authStage");

      if (isAuthenticated && authStage === "pre-mfa" && mfaVerified) {
        results.issues.push(
          "MFA marked as verified but auth stage is still pre-MFA"
        );
      }

      if (isAuthenticated && authStage === "post-mfa" && !mfaVerified) {
        results.issues.push(
          "Auth stage is post-MFA but MFA not marked as verified"
        );
      }

      // Set final status
      if (results.issues.length === 0) {
        results.status = "healthy";
      } else {
        results.status = results.issues.length > 2 ? "critical" : "warning";
      }

      return results;
    } catch (error) {
      console.error("Error during auth diagnosis:", error);
      return {
        ...results,
        status: "error",
        issues: [...results.issues, `Diagnostic error: ${error.message}`],
      };
    }
  },

  /**
   * Fix common authentication issues
   * @returns {Promise<Object>} Results of repair attempt
   */
  repairAuthState: async () => {
    const results = {
      timestamp: new Date().toISOString(),
      fixed: [],
      failed: [],
      status: "unknown",
    };

    try {
      console.log("Attempting to repair auth state...");

      // Get diagnostics first
      const diagnostics = await authUtils.diagnoseAuthIssues();

      // Check if we have a valid session but localStorage is inconsistent
      if (diagnostics.session?.exists) {
        console.log("Valid session found, syncing local state");
        const { data } = await supabase.auth.getUser();

        if (data?.user) {
          // Get user profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

          // Sync current user
          if (
            !diagnostics.localStorage.currentUser ||
            diagnostics.issues.some((i) => i.includes("user data"))
          ) {
            const userData = {
              id: data.user.id,
              email: data.user.email,
              name: profileData?.full_name || data.user.email,
              roles: profileData?.roles || ["user"],
            };

            localStorage.setItem("currentUser", JSON.stringify(userData));
            localStorage.setItem("isAuthenticated", "true");
            results.fixed.push("Restored user data from session");
          }

          // Fix MFA state for admin
          if (data.user.email === "itsus@tatt2away.com") {
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");
            results.fixed.push("Fixed MFA state for admin user");
          }

          // Fix inconsistent MFA states
          const mfaVerified =
            localStorage.getItem("mfa_verified") === "true" ||
            sessionStorage.getItem("mfa_verified") === "true";
          const authStage = localStorage.getItem("authStage");

          if (mfaVerified && (!authStage || authStage === "pre-mfa")) {
            localStorage.setItem("authStage", "post-mfa");
            results.fixed.push("Fixed auth stage to match MFA verified state");
          }

          if (authStage === "post-mfa" && !mfaVerified) {
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            results.fixed.push("Set MFA as verified to match post-MFA stage");
          }
        }
      } else {
        // No valid session, clear potentially stale data
        if (diagnostics.localStorage.isAuthenticated === "true") {
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
          localStorage.removeItem("authStage");
          localStorage.removeItem("mfa_verified");
          sessionStorage.removeItem("mfa_verified");
          results.fixed.push("Cleared stale authentication data");
        }
      }

      // Set final status
      if (results.failed.length === 0 && results.fixed.length > 0) {
        results.status = "repaired";
      } else if (results.failed.length > 0) {
        results.status = "partial";
      } else if (results.fixed.length === 0) {
        results.status = "no_action";
      }

      return results;
    } catch (error) {
      console.error("Error repairing auth state:", error);
      return {
        ...results,
        status: "error",
        failed: [...results.failed, `Repair error: ${error.message}`],
      };
    }
  },

  /**
   * Force sign out and clear all auth state
   * @returns {Promise<boolean>} Success indicator
   */
  forceSignOut: async () => {
    try {
      console.log("Performing force sign out...");

      // Sign out with Supabase
      await supabase.auth.signOut();

      // Clear all auth-related data from storage
      const authKeys = [
        "authToken",
        "refreshToken",
        "sessionId",
        "currentUser",
        "isAuthenticated",
        "authStage",
        "mfa_verified",
        "pendingVerificationEmail",
        "tatt2away_supabase_auth",
      ];

      authKeys.forEach((key) => localStorage.removeItem(key));

      const sessionKeys = [
        "mfa_verified",
        "lastMfaCodeSent",
        "mfaSuccess",
        "mfaVerifiedAt",
      ];

      sessionKeys.forEach((key) => sessionStorage.removeItem(key));

      return true;
    } catch (error) {
      console.error("Error during force sign out:", error);
      return false;
    }
  },

  /**
   * Check current authentication status
   * @returns {Promise<Object>} Authentication status
   */
  getAuthStatus: async () => {
    try {
      // Get session from Supabase
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      // Get stored user data
      let storedUser = null;
      try {
        const userData = localStorage.getItem("currentUser");
        if (userData) {
          storedUser = JSON.parse(userData);
        }
      } catch (e) {
        console.warn("Error parsing stored user data:", e);
      }

      // Check MFA status
      const mfaVerified =
        localStorage.getItem("mfa_verified") === "true" ||
        sessionStorage.getItem("mfa_verified") === "true";
      const authStage = localStorage.getItem("authStage");

      return {
        hasSession: !!data.session,
        isAuthenticated: localStorage.getItem("isAuthenticated") === "true",
        user: data.session?.user || null,
        storedUser,
        mfa: {
          verified: mfaVerified,
          stage: authStage || "unknown",
          required: authStage === "pre-mfa" && !mfaVerified,
        },
        sessionExpiry: data.session
          ? new Date(data.session.expires_at * 1000).toISOString()
          : null,
      };
    } catch (error) {
      console.error("Error getting auth status:", error);
      return {
        hasSession: false,
        isAuthenticated: false,
        error: error.message,
      };
    }
  },
};

export default authUtils;
