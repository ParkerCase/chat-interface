// src/utils/authRecovery.js
import { supabase } from "../lib/supabase";

/**
 * Authentication error recovery system
 * Detects and fixes common authentication errors
 */
export const authRecovery = {
  /**
   * Detect and fix common auth state problems
   * @param {boolean} forceSignOut - Whether to force sign out on critical issues
   * @returns {Promise<Object>} Recovery result
   */
  runRecovery: async (forceSignOut = false) => {
    console.log("Running auth recovery system...");
    const issues = [];
    const fixes = [];
    let criticalIssueDetected = false;

    try {
      // STEP 1: Check for session/token mismatches
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      // Parse stored auth state
      const storedToken = localStorage.getItem("authToken");
      const storedRefreshToken = localStorage.getItem("refreshToken");
      let storedUser = null;

      try {
        const userJson = localStorage.getItem("currentUser");
        if (userJson) {
          storedUser = JSON.parse(userJson);
        }
      } catch (err) {
        issues.push("Corrupted user data in localStorage");
        localStorage.removeItem("currentUser");
        fixes.push("Removed corrupted user data");
      }

      const hasValidSession = !sessionError && sessionData?.session;
      const hasStoredAuth = !!storedToken && !!storedUser;

      // CASE 1: We have session but no stored auth
      if (hasValidSession && !hasStoredAuth) {
        issues.push("Valid session exists but local auth state is missing");

        // Store session data
        localStorage.setItem("authToken", sessionData.session.access_token);
        localStorage.setItem("refreshToken", sessionData.session.refresh_token);
        localStorage.setItem("isAuthenticated", "true");

        // Try to get and store user data
        try {
          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (!userError && userData?.user) {
            // Get profile data
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userData.user.id)
              .single();

            // Create basic user object
            const userObject = {
              id: userData.user.id,
              email: userData.user.email,
              name: profileData?.full_name || userData.user.email,
              roles: profileData?.roles || ["user"],
              tier: "enterprise",
              features: {
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
              },
            };

            localStorage.setItem("currentUser", JSON.stringify(userObject));
            fixes.push("Restored user data from session");
          } else {
            issues.push(
              `Could not restore user data: ${
                userError?.message || "No user in session"
              }`
            );
            criticalIssueDetected = true;
          }
        } catch (userError) {
          issues.push(`Error restoring user data: ${userError.message}`);
          criticalIssueDetected = true;
        }
      }

      // CASE 2: We have stored auth but no valid session
      if (!hasValidSession && hasStoredAuth) {
        issues.push("Stored auth exists but no valid session");

        // Try to refresh the token
        try {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();

          if (!refreshError && refreshData?.session) {
            // Update tokens
            localStorage.setItem("authToken", refreshData.session.access_token);
            localStorage.setItem(
              "refreshToken",
              refreshData.session.refresh_token
            );
            fixes.push("Refreshed expired session");
          } else {
            issues.push(
              `Failed to refresh session: ${
                refreshError?.message || "Unknown error"
              }`
            );
            criticalIssueDetected = true;
          }
        } catch (refreshError) {
          issues.push(`Error refreshing session: ${refreshError.message}`);
          criticalIssueDetected = true;
        }
      }

      // STEP 2: Check for token/user mismatches
      if (hasValidSession && hasStoredAuth) {
        // Validate user ID matches session
        const sessionUserId = sessionData.session.user.id;
        const storedUserId = storedUser?.id;

        if (sessionUserId !== storedUserId) {
          issues.push("User ID mismatch between session and stored user");
          criticalIssueDetected = true;

          // Try to fix by updating stored user
          try {
            const { data: userData, error: userError } =
              await supabase.auth.getUser();

            if (!userError && userData?.user) {
              // Update stored user with correct ID
              storedUser.id = userData.user.id;
              localStorage.setItem("currentUser", JSON.stringify(storedUser));
              fixes.push("Updated stored user with correct ID");
            } else {
              issues.push(
                `Could not get correct user data: ${userError?.message}`
              );
            }
          } catch (userError) {
            issues.push(`Error getting user data: ${userError.message}`);
          }
        }
      }

      // STEP 3: Check for other inconsistencies
      const isAuthenticated =
        localStorage.getItem("isAuthenticated") === "true";
      if (hasStoredAuth && !isAuthenticated) {
        issues.push("Auth tokens exist but isAuthenticated flag is missing");
        localStorage.setItem("isAuthenticated", "true");
        fixes.push("Set isAuthenticated flag");
      }

      const authStage = localStorage.getItem("authStage");
      if (hasStoredAuth && !authStage) {
        issues.push("Auth tokens exist but authStage is missing");
        localStorage.setItem("authStage", "post-mfa"); // Assume post-MFA for existing sessions
        fixes.push("Set authStage to post-mfa");
      }

      // STEP 4: Check for password change flags
      const passwordChanged =
        localStorage.getItem("passwordChanged") === "true";
      const forceLogout = localStorage.getItem("forceLogout") === "true";

      if (passwordChanged || forceLogout) {
        issues.push("Incomplete password change or force logout detected");
        criticalIssueDetected = true;
      }

      // STEP 5: Handle critical issues if requested
      if (criticalIssueDetected && forceSignOut) {
        issues.push("Critical issues detected, forcing sign out");

        // Force a clean sign out
        try {
          await supabase.auth.signOut();

          // Clear all auth-related data
          localStorage.removeItem("authToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
          localStorage.removeItem("authStage");
          localStorage.removeItem("mfa_verified");
          localStorage.removeItem("forceLogout");

          // Keep passwordChanged flag if it exists
          if (passwordChanged) {
            fixes.push("Preserved password change flags for login flow");
          } else {
            localStorage.removeItem("passwordChanged");
            localStorage.removeItem("passwordChangedEmail");
            localStorage.removeItem("passwordChangedAt");
          }

          sessionStorage.clear();
          fixes.push("Forced complete sign out to clean auth state");

          // Return early with redirect recommendation
          return {
            success: true,
            requiresRedirect: true,
            redirectTo: "/login",
            issues,
            fixes,
            timestamp: new Date().toISOString(),
          };
        } catch (signOutError) {
          issues.push(`Error during forced sign out: ${signOutError.message}`);
        }
      }

      // Return recovery result
      return {
        success: fixes.length > 0,
        criticalIssueDetected,
        requiresRedirect: false,
        hasValidSession,
        hasStoredAuth,
        issues,
        fixes,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Auth recovery system error:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Force a complete logout and clean auth state
   * @returns {Promise<Object>} Result of the operation
   */
  forceCleanLogout: async () => {
    try {
      console.log("Forcing clean logout...");

      // Keep email for login form if available
      const userEmail =
        localStorage.getItem("userEmail") ||
        JSON.parse(localStorage.getItem("currentUser") || "{}")?.email;

      // First sign out from Supabase
      await supabase.auth.signOut({ scope: "global" });

      // Clear all auth-related localStorage
      const authKeys = [
        "authToken",
        "refreshToken",
        "currentUser",
        "isAuthenticated",
        "mfa_verified",
        "authStage",
        "passwordChanged",
        "passwordChangedAt",
        "forceLogout",
        "mfaRedirectPending",
        "mfaRedirectTarget",
        "mfaSuccess",
        "mfaVerifiedAt",
      ];

      authKeys.forEach((key) => localStorage.removeItem(key));

      // Clear any auth-related sessionStorage
      sessionStorage.clear();

      // Store email for login if available
      if (userEmail) {
        localStorage.setItem("userEmail", userEmail);
      }

      return {
        success: true,
        message: "Auth state completely cleared",
      };
    } catch (error) {
      console.error("Force logout error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// Export a function to run auth recovery on demand
export const fixAuthState = async (forceSignOut = false) => {
  return await authRecovery.runRecovery(forceSignOut);
};

export default authRecovery;
