// src/utils/authDebugUtils.js
// Add this file to help debug authentication issues

// Authentication debug utilities
export const authDebugUtils = {
  // Log auth-related actions with timestamps
  log: (component, action, data = null) => {
    if (process.env.NODE_ENV !== "production") {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${component}] ${action}`, data || "");
    }
  },

  // Check current auth state and return detailed diagnostic info
  checkAuthState: () => {
    try {
      const authState = {
        isAuthenticated: localStorage.getItem("isAuthenticated") === "true",
        hasAuthToken: !!localStorage.getItem("authToken"),
        hasRefreshToken: !!localStorage.getItem("refreshToken"),
        user: JSON.parse(localStorage.getItem("currentUser") || "null"),
        authStage: localStorage.getItem("authStage"),
        mfaVerified:
          localStorage.getItem("mfa_verified") === "true" ||
          sessionStorage.getItem("mfa_verified") === "true",
        passwordChanged: localStorage.getItem("passwordChanged") === "true",
        passwordChangedAt: localStorage.getItem("passwordChangedAt"),
        sessionStorageKeys: Object.keys(sessionStorage),
        localStorageKeys: Object.keys(localStorage),
      };

      return authState;
    } catch (error) {
      return {
        error: error.message,
        state: "Error retrieving auth state",
      };
    }
  },

  // Clean up auth state (useful for debugging)
  cleanupAuthState: () => {
    // Auth-related storage keys
    const authKeys = [
      "authToken",
      "refreshToken",
      "currentUser",
      "isAuthenticated",
      "mfa_verified",
      "mfaSuccess",
      "mfaVerifiedAt",
      "mfaRedirectPending",
      "mfaRedirectTarget",
      "passwordChanged",
      "passwordChangedEmail",
      "passwordChangedAt",
      "forceLogout",
      "authStage",
    ];

    // Clear localStorage items
    authKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from localStorage:`, e);
      }
    });

    // Clear sessionStorage items
    authKeys.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key} from sessionStorage:`, e);
      }
    });

    // Clear any Supabase cookies
    document.cookie.split(";").forEach(function (c) {
      if (c.trim().startsWith("sb-")) {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });

    return { success: true, message: "Auth state cleaned up" };
  },

  // Add this to troubleshoot password change issues
  testPasswordChange: async (supabase, email, oldPassword, newPassword) => {
    try {
      // Step 1: Try to sign in with current password
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: oldPassword,
        });

      if (signInError) {
        return {
          success: false,
          stage: "signin",
          error: signInError.message,
          message: "Failed to sign in with old password",
        };
      }

      // Step 2: Try to update password
      const { data: updateData, error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        return {
          success: false,
          stage: "update",
          error: updateError.message,
          message: "Failed to update password",
        };
      }

      // Step 3: Try signing in with new password
      await supabase.auth.signOut();

      const { data: newSignInData, error: newSignInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: newPassword,
        });

      if (newSignInError) {
        return {
          success: false,
          stage: "verify",
          error: newSignInError.message,
          message: "Failed to sign in with new password after change",
        };
      }

      // Success - password changed and verified
      return {
        success: true,
        message: "Password changed and verified successfully",
      };
    } catch (error) {
      return {
        success: false,
        stage: "unknown",
        error: error.message,
        message: "Unknown error during password change test",
      };
    }
  },
};

export default authDebugUtils;
