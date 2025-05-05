// src/utils/authDiagnostics.js
import { supabase } from "../lib/supabase";

/**
 * Utility to diagnose authentication issues and repair broken auth state
 */
export const authDiagnostics = {
  /**
   * Run a full diagnostics check on the authentication state
   * @returns {Object} Diagnostic results
   */
  runDiagnostics: async () => {
    console.log("Running auth diagnostics...");

    // Capture all auth-related localStorage and sessionStorage items
    const authStorage = {
      localStorage: {
        authToken: localStorage.getItem("authToken"),
        refreshToken: localStorage.getItem("refreshToken"),
        currentUser: localStorage.getItem("currentUser"),
        isAuthenticated: localStorage.getItem("isAuthenticated"),
        mfa_verified: localStorage.getItem("mfa_verified"),
        authStage: localStorage.getItem("authStage"),
        pendingVerificationEmail: localStorage.getItem(
          "pendingVerificationEmail"
        ),
      },
      sessionStorage: {
        mfa_verified: sessionStorage.getItem("mfa_verified"),
        lastMfaCodeSent: sessionStorage.getItem("lastMfaCodeSent"),
      },
    };

    // Check Supabase session
    let sessionData = null;
    let sessionError = null;
    try {
      const response = await supabase.auth.getSession();
      sessionData = response.data;
      sessionError = response.error;
    } catch (error) {
      sessionError = error;
    }

    // Parse currentUser if it exists
    let parsedUser = null;
    try {
      if (authStorage.localStorage.currentUser) {
        parsedUser = JSON.parse(authStorage.localStorage.currentUser);
      }
    } catch (error) {
      console.error("Error parsing currentUser:", error);
    }

    // Detect inconsistencies
    const issues = [];

    // Session exists but no auth token
    if (sessionData?.session && !authStorage.localStorage.isAuthenticated) {
      issues.push("Session exists but isAuthenticated flag is not set");
    }

    // Session exists but MFA not verified
    if (
      sessionData?.session &&
      !authStorage.localStorage.mfa_verified &&
      !authStorage.sessionStorage.mfa_verified
    ) {
      issues.push("Session exists but MFA not marked as verified");
    }

    // Auth token exists but no session
    if (
      authStorage.localStorage.isAuthenticated === "true" &&
      !sessionData?.session
    ) {
      issues.push("isAuthenticated is true but no valid session exists");
    }

    // User in localStorage but not the right format
    if (
      authStorage.localStorage.currentUser &&
      (!parsedUser || !parsedUser.email || !parsedUser.roles)
    ) {
      issues.push("currentUser in localStorage is invalid or incomplete");
    }

    return {
      timestamp: new Date().toISOString(),
      authStorage,
      sessionData,
      sessionError,
      parsedUser,
      issues,
      hasIssues: issues.length > 0,
    };
  },

  /**
   * Fix common authentication issues
   * @returns {Object} Result of repair operations
   */
  repairAuthState: async () => {
    console.log("Attempting to repair auth state...");
    const fixes = [];

    // Check if we have a valid session first
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error getting session:", error);
      return { success: false, error };
    }

    if (data?.session) {
      console.log("Valid session found for", data.session.user.email);

      // We have a valid session, make sure all flags are set
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("authStage", "post-mfa");
      localStorage.setItem("mfa_verified", "true");
      sessionStorage.setItem("mfa_verified", "true");
      fixes.push("Set authentication flags based on valid session");

      // Check if we need to get the user profile
      let currentUser = null;
      try {
        const userJson = localStorage.getItem("currentUser");
        if (userJson) {
          currentUser = JSON.parse(userJson);
        }
      } catch (e) {
        console.warn("Error parsing currentUser:", e);
      }

      // If no valid currentUser, try to retrieve from profile
      if (!currentUser || !currentUser.roles) {
        try {
          console.log("Retrieving user profile from Supabase");
          const { data: userData } = await supabase.auth.getUser();

          if (userData?.user) {
            // Use the safe RPC function to get user profile
          const { data: profileData } = await supabase
              .rpc("get_user_profile", { user_id: userData.user.id });

            // Create a repaired user object
            const repairedUser = {
              id: userData.user.id,
              email: userData.user.email,
              name: profileData?.full_name || userData.user.email,
              roles: profileData?.roles || ["user"],
              tier: profileData?.tier || "enterprise",
            };

            // Special case for known admin users
            if (
              repairedUser.email === "itsus@tatt2away.com" ||
              repairedUser.email === "parker@tatt2away.com"
            ) {
              console.log("Admin account detected, ensuring admin roles");
              repairedUser.roles = ["super_admin", "admin", "user"];
            }

            // Save the repaired user
            localStorage.setItem("currentUser", JSON.stringify(repairedUser));
            fixes.push("Reconstructed user profile from Supabase data");
          }
        } catch (profileError) {
          console.error("Error retrieving profile:", profileError);
        }
      }

      return {
        success: true,
        fixes,
        sessionUser: data.session.user.email,
      };
    } else {
      // No valid session, clear any invalid auth state
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("mfa_verified");
      sessionStorage.removeItem("mfa_verified");
      fixes.push(
        "Cleared invalid authentication state - no valid session found"
      );

      return {
        success: true,
        fixes,
        requiresLogin: true,
      };
    }
  },

  /**
   * Force admin rights for a user - ONLY USE FOR DEBUGGING!
   */
  forceAdminRights: () => {
    try {
      console.log("Forcing admin rights for debugging");
      const currentUserJson = localStorage.getItem("currentUser");

      if (currentUserJson) {
        const currentUser = JSON.parse(currentUserJson);

        // Ensure admin roles are set
        if (!currentUser.roles) {
          currentUser.roles = [];
        }

        if (!currentUser.roles.includes("admin")) {
          currentUser.roles.push("admin");
        }

        if (!currentUser.roles.includes("super_admin")) {
          currentUser.roles.push("super_admin");
        }

        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        console.log("Admin rights granted to", currentUser.email);

        return { success: true, user: currentUser };
      } else {
        return { success: false, error: "No current user found" };
      }
    } catch (error) {
      console.error("Error forcing admin rights:", error);
      return { success: false, error };
    }
  },

  /**
   * Apply emergency fix for admin authentication
   * Call this function from the console to fix admin auth issues
   */
  emergencyAdminFix: async () => {
    console.warn("Applying emergency admin authentication fix");

    try {
      // Check for a valid session first
      const { data } = await supabase.auth.getSession();

      if (data?.session) {
        const email = data.session.user.email;
        console.log("Found active session for:", email);

        const isAdminEmail =
          email === "itsus@tatt2away.com" || email === "parker@tatt2away.com";

        if (isAdminEmail) {
          console.log("Admin email detected, applying full fix");

          // Set all required auth flags
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          // Create or update admin user in localStorage
          const adminUser = {
            id: data.session.user.id,
            email: email,
            name:
              email === "itsus@tatt2away.com"
                ? "Tatt2Away Admin"
                : "Parker Admin",
            roles: ["super_admin", "admin", "user"],
            tier: "enterprise",
          };

          localStorage.setItem("currentUser", JSON.stringify(adminUser));

          console.log("Emergency fix applied successfully");
          console.log("Reload the page for changes to take effect");

          return {
            success: true,
            message: "Admin authentication fixed. Reload the page.",
          };
        } else {
          console.log("Not an admin email, setting regular user flags");

          // Set regular auth flags
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          return {
            success: true,
            message: "User authentication fixed. Reload the page.",
          };
        }
      } else {
        console.log("No active session found");
        return {
          success: false,
          message: "No active session found. Please login first.",
        };
      }
    } catch (error) {
      console.error("Emergency fix failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// Export a simplified version for console usage
export const fixAuth = async () => {
  try {
    return await authDiagnostics.emergencyAdminFix();
  } catch (e) {
    console.error("Fix failed:", e);
    return { success: false, error: e.message };
  }
};

// Make authDiagnostics globally available in dev mode
if (process.env.NODE_ENV === "development") {
  window.authDiagnostics = authDiagnostics;
  window.fixAuth = fixAuth;
  console.log("Auth diagnostics available as window.authDiagnostics");
  console.log("Quick fix available as window.fixAuth()");
}

export default authDiagnostics;
