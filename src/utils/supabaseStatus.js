// src/utils/supabaseStatus.js
import { supabase } from "../lib/supabase";

/**
 * Utility to check Supabase connection status and diagnose issues
 */
export const supabaseStatus = {
  /**
   * Test basic Supabase connectivity
   * @returns {Promise<Object>} Status object
   */
  testConnection: async () => {
    try {
      console.log("Testing Supabase connection...");
      const startTime = Date.now();

      // Simple ping test - just query a small amount of data
      const { data, error } = await supabase
        .from("profiles")
        .select("count")
        .limit(1)
        .timeout(10000); // 10 second timeout

      const elapsed = Date.now() - startTime;

      if (error) {
        console.error("Supabase connection test failed:", error);
        return {
          success: false,
          latency: elapsed,
          error: error.message,
          code: error.code,
          details: error,
        };
      }

      return {
        success: true,
        latency: elapsed,
        data,
      };
    } catch (error) {
      console.error("Supabase connection test error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  },

  /**
   * Test authentication-specific functionality
   * @returns {Promise<Object>} Status object
   */
  testAuth: async () => {
    try {
      console.log("Testing Supabase auth services...");
      const startTime = Date.now();

      // Get current session
      const { data, error } = await supabase.auth.getSession();

      const elapsed = Date.now() - startTime;

      if (error) {
        console.error("Supabase auth test failed:", error);
        return {
          success: false,
          latency: elapsed,
          error: error.message,
          code: error.code,
          details: error,
        };
      }

      return {
        success: true,
        latency: elapsed,
        hasSession: !!data?.session,
      };
    } catch (error) {
      console.error("Supabase auth test error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  },

  /**
   * Do a comprehensive check of all Supabase services
   * @returns {Promise<Object>} Comprehensive status object
   */
  checkAll: async () => {
    try {
      console.log("Running comprehensive Supabase health check...");
      const startTime = Date.now();

      // Run all tests in parallel
      const [connectionResult, authResult] = await Promise.all([
        supabaseStatus.testConnection(),
        supabaseStatus.testAuth(),
      ]);

      const elapsed = Date.now() - startTime;

      // Check local storage for token issues
      const localStorageCheck = {
        success: true,
        issues: [],
      };

      const authToken = localStorage.getItem("authToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const currentUser = localStorage.getItem("currentUser");

      if (!authToken && (refreshToken || currentUser)) {
        localStorageCheck.success = false;
        localStorageCheck.issues.push(
          "Auth token missing but other auth data exists"
        );
      }

      if (authToken && !refreshToken) {
        localStorageCheck.success = false;
        localStorageCheck.issues.push(
          "Auth token exists but refresh token is missing"
        );
      }

      if (authToken && !currentUser) {
        localStorageCheck.success = false;
        localStorageCheck.issues.push(
          "Auth token exists but user data is missing"
        );
      }

      // Overall success is determined by all tests passing
      const overallSuccess =
        connectionResult.success &&
        authResult.success &&
        localStorageCheck.success;

      return {
        success: overallSuccess,
        totalTime: elapsed,
        connection: connectionResult,
        auth: authResult,
        localStorage: localStorageCheck,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Supabase health check failed:", error);
      return {
        success: false,
        error: error.message,
        details: error,
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Initiate self-healing recovery for common auth issues
   * @returns {Promise<Object>} Result of recovery attempt
   */
  recoverAuthState: async () => {
    try {
      console.log("Attempting to recover auth state...");
      const issues = [];
      const fixes = [];

      // First check for session on Supabase
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        issues.push(`Session fetch failed: ${sessionError.message}`);
      }

      const hasValidSession = !sessionError && sessionData?.session;

      // Check local storage state
      const authToken = localStorage.getItem("authToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const currentUserJson = localStorage.getItem("currentUser");

      // Detect issues
      if (hasValidSession && !authToken) {
        issues.push("Missing auth token despite valid session");

        // Fix: Store the token
        localStorage.setItem("authToken", sessionData.session.access_token);
        localStorage.setItem("refreshToken", sessionData.session.refresh_token);
        fixes.push("Restored missing auth tokens from session");
      }

      if (!hasValidSession && authToken) {
        issues.push("Auth token exists but no valid session");

        // Fix: Clear invalid tokens
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        fixes.push("Cleared invalid auth tokens");
      }

      if (hasValidSession && !currentUserJson) {
        issues.push("Missing user data despite valid session");

        // Fix: Try to get user data and store it
        try {
          const { data: userData, error: userError } =
            await supabase.auth.getUser();

          if (!userError && userData?.user) {
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
            };

            localStorage.setItem("currentUser", JSON.stringify(userObject));
            fixes.push("Restored missing user data from session");
          } else {
            issues.push(
              `Could not restore user data: ${
                userError?.message || "No user in session"
              }`
            );
          }
        } catch (userError) {
          issues.push(`Error restoring user data: ${userError.message}`);
        }
      }

      // Handle corrupted data
      if (currentUserJson) {
        try {
          JSON.parse(currentUserJson);
        } catch (e) {
          issues.push("Corrupted user data in localStorage");
          localStorage.removeItem("currentUser");
          fixes.push("Removed corrupted user data");
        }
      }

      // Did we fix anything?
      const success = fixes.length > 0;

      return {
        success,
        issues,
        fixes,
        sessionRecovered: hasValidSession,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Auth recovery failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// Export a function to run a quick check on demand
export const checkSupabaseHealth = async () => {
  return await supabaseStatus.checkAll();
};

// Auto-run a check when this module is imported
checkSupabaseHealth()
  .then((result) => {
    if (!result.success) {
      console.warn("Supabase health check detected issues:", result);
      // Auto-recovery for auth issues
      return supabaseStatus.recoverAuthState();
    }
    return { autoRecovery: false };
  })
  .then((recoveryResult) => {
    if (recoveryResult.success) {
      console.log("Auto-recovery fixed some issues:", recoveryResult);
    }
  })
  .catch((err) => console.error("Health check error:", err));

export default supabaseStatus;
