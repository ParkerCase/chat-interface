// src/utils/authRecovery.js
import { supabase } from "../lib/supabase";

/**
 * Auth recovery utility for handling authentication edge cases,
 * recovering from auth errors, and providing emergency fixes
 */
export const authRecovery = {
  /**
   * Run a full recovery sequence to fix auth state
   * @param {boolean} forceLogout Whether to force logout at the end
   * @returns {Promise<{success: boolean, message: string}>}
   */
  runRecovery: async (forceLogout = false) => {
    console.log("Starting auth recovery sequence");

    try {
      // 1. Check for active session
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        console.log("No active session found during recovery");

        // 1a. If no session, try to recover from localStorage
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
          console.log(
            "Found stored user but no session, clearing localStorage"
          );

          // Clear auth data since it's invalid
          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
          localStorage.removeItem("authStage");
          sessionStorage.removeItem("mfa_verified");
          sessionStorage.removeItem("mfaSuccess");

          return {
            success: false,
            message: "No valid session found, cleared invalid local data",
          };
        }

        return {
          success: false,
          message: "No active session found",
        };
      }

      // 2. Found active session, get user data
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        console.log("Session exists but failed to get user data:", userError);

        if (forceLogout) {
          await supabase.auth.signOut();
          return {
            success: false,
            message: "Session corrupted, forced logout",
          };
        }

        return {
          success: false,
          message: "Session exists but user data unavailable",
        };
      }

      // 3. Get profile data from database
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      // 4. Reconstruct user data and store in localStorage
      const user = {
        id: userData.user.id,
        email: userData.user.email,
        name:
          profileData?.full_name ||
          userData.user.user_metadata?.full_name ||
          userData.user.email,
        roles: profileData?.roles || ["user"],
        tier: "enterprise",
        mfaMethods: profileData?.mfa_methods || [],
      };

      // 5. Update localStorage with fresh data
      localStorage.setItem("authToken", sessionData.session.access_token);
      localStorage.setItem("refreshToken", sessionData.session.refresh_token);
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("isAuthenticated", "true");

      // 6. Check/fix MFA state
      const authStage = localStorage.getItem("authStage");
      const mfaVerified =
        sessionStorage.getItem("mfa_verified") === "true" ||
        localStorage.getItem("mfa_verified") === "true";

      if (mfaVerified) {
        localStorage.setItem("authStage", "post-mfa");
      } else if (!authStage) {
        localStorage.setItem("authStage", "pre-mfa");
      }

      // 7. Forced logout if requested
      if (forceLogout) {
        await supabase.auth.signOut();

        return {
          success: true,
          message: "Recovery complete followed by requested logout",
        };
      }

      return {
        success: true,
        message: "Auth state successfully recovered",
      };
    } catch (error) {
      console.error("Auth recovery error:", error);

      if (forceLogout) {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn("Failed to sign out during recovery:", e);
        }
      }

      return {
        success: false,
        message: `Recovery failed: ${error.message}`,
      };
    }
  },

  /**
   * Force clean logout and clear all auth state
   * @returns {Promise<{success: boolean, message: string}>}
   */
  forceCleanLogout: async () => {
    console.log("Forcing clean logout");

    try {
      // 1. Sign out from Supabase
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn("Error during signOut:", signOutError);
        // Continue anyway
      }

      // 2. Clear all localStorage items related to auth
      const authKeys = [
        "authToken",
        "refreshToken",
        "sessionId",
        "currentUser",
        "isAuthenticated",
        "mfa_verified",
        "authStage",
      ];

      authKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key} from localStorage:`, e);
        }
      });

      // 3. Clear all sessionStorage items related to auth
      authKeys.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key} from sessionStorage:`, e);
        }
      });

      // 4. Clear any Supabase cookies
      document.cookie.split(";").forEach(function (c) {
        if (c.trim().startsWith("sb-")) {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(
              /=.*/,
              "=;expires=" + new Date().toUTCString() + ";path=/"
            );
        }
      });

      return {
        success: true,
        message: "Clean logout completed",
      };
    } catch (error) {
      console.error("Clean logout error:", error);

      // Try minimal cleanup as fallback
      try {
        localStorage.removeItem("authToken");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isAuthenticated");
      } catch (e) {
        console.error("Minimal cleanup failed:", e);
      }

      return {
        success: false,
        message: `Clean logout failed: ${error.message}`,
      };
    }
  },

  /**
   * Fix inconsistent MFA state
   * @returns {Promise<{success: boolean, message: string}>}
   */
  fixMfaState: async () => {
    console.log("Fixing MFA state inconsistencies");

    try {
      // Get all potential MFA flags
      const sessionMfaVerified =
        sessionStorage.getItem("mfa_verified") === "true";
      const localMfaVerified = localStorage.getItem("mfa_verified") === "true";
      const mfaSuccess = sessionStorage.getItem("mfaSuccess") === "true";
      const authStage = localStorage.getItem("authStage");

      // Determine the correct MFA state
      const isMfaVerified =
        sessionMfaVerified ||
        localMfaVerified ||
        mfaSuccess ||
        authStage === "post-mfa";

      // Set all flags to be consistent
      if (isMfaVerified) {
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        localStorage.setItem("authStage", "post-mfa");
      } else {
        sessionStorage.removeItem("mfa_verified");
        localStorage.removeItem("mfa_verified");
        sessionStorage.removeItem("mfaSuccess");
        localStorage.setItem("authStage", "pre-mfa");
      }

      return {
        success: true,
        message: isMfaVerified
          ? "MFA state fixed as verified"
          : "MFA state fixed as unverified",
      };
    } catch (error) {
      console.error("Fix MFA state error:", error);
      return {
        success: false,
        message: `Failed to fix MFA state: ${error.message}`,
      };
    }
  },

  /**
   * Check if there are any auth inconsistencies
   * @returns {Promise<{hasInconsistencies: boolean, issues: string[]}>}
   */
  checkAuthConsistency: async () => {
    console.log("Checking authentication consistency");

    const issues = [];

    try {
      // 1. Check if localStorage has auth token but no user
      const hasToken = !!localStorage.getItem("authToken");
      const hasUser = !!localStorage.getItem("currentUser");

      if (hasToken && !hasUser) {
        issues.push("Auth token exists but no user data found");
      }

      if (!hasToken && hasUser) {
        issues.push("User data exists but no auth token found");
      }

      // 2. Check if Supabase has active session
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data?.session;

      if (hasToken && !hasSession) {
        issues.push(
          "Auth token in localStorage but no active Supabase session"
        );
      }

      if (!hasToken && hasSession) {
        issues.push(
          "Active Supabase session but no auth token in localStorage"
        );
      }

      // 3. Check MFA state consistency
      const sessionMfaVerified =
        sessionStorage.getItem("mfa_verified") === "true";
      const localMfaVerified = localStorage.getItem("mfa_verified") === "true";
      const mfaSuccess = sessionStorage.getItem("mfaSuccess") === "true";
      const authStage = localStorage.getItem("authStage");

      if (
        (sessionMfaVerified || localMfaVerified || mfaSuccess) &&
        authStage !== "post-mfa"
      ) {
        issues.push(
          "MFA flags indicate verification but authStage is not post-mfa"
        );
      }

      if (
        !(sessionMfaVerified || localMfaVerified || mfaSuccess) &&
        authStage === "post-mfa"
      ) {
        issues.push(
          "AuthStage is post-mfa but MFA verification flags are not set"
        );
      }

      return {
        hasInconsistencies: issues.length > 0,
        issues,
      };
    } catch (error) {
      console.error("Auth consistency check error:", error);
      issues.push(`Error checking auth consistency: ${error.message}`);

      return {
        hasInconsistencies: true,
        issues,
      };
    }
  },
};

export default authRecovery;
