// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";
import { debugAuth } from "../utils/authDebug";

// Get environment variables with fallbacks
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://rfnglcfyzoyqenofmsev.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg";

debugAuth.log(
  "SupabaseClient",
  `Initializing Supabase client with URL: ${SUPABASE_URL}`
);

// Network timeout for fetch requests in milliseconds
const NETWORK_TIMEOUT = 15000; // 15 seconds

// Add timeout to fetch
const fetchWithTimeout = (url, options = {}) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), NETWORK_TIMEOUT)
    ),
  ]);
};

// Enhanced logging for Supabase events
const logSupabaseEvents = process.env.NODE_ENV === "development" || true;

// Create supabase client with enhanced options
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: "pkce",
    debug: logSupabaseEvents,
    // Enhanced options for better reliability
    storageKey: "tatt2away_supabase_auth",
    cookieOptions: {
      name: "tatt2away_supabase_auth",
      lifetime: 60 * 60 * 24 * 7, // 7 days
      domain: window.location.hostname,
      path: "/",
      sameSite: "Lax",
    },
  },
  global: {
    fetch: fetchWithTimeout,
    headers: {
      "X-Client-Info": "Tatt2Away Admin Panel",
    },
  },
  // Set reasonable timeouts for requests
  realtime: {
    timeout: 10000, // 10 seconds for realtime connections
  },
});

// Listen for auth events to debug issues
if (logSupabaseEvents) {
  supabase.auth.onAuthStateChange((event, session) => {
    debugAuth.log("SupabaseClient", `Auth event: ${event}`, {
      session: session ? "exists" : "none",
    });
  });
}

// Test connection to identify issues early
export const testSupabaseConnection = async () => {
  try {
    const start = Date.now();
    const { data, error } = await supabase.auth.getSession();
    const elapsed = Date.now() - start;

    debugAuth.log(
      "SupabaseClient",
      `Connection test completed in ${elapsed}ms`
    );

    return {
      success: !error,
      latency: elapsed,
      error: error ? error.message : null,
      sessionExists: !!data?.session,
    };
  } catch (error) {
    debugAuth.log("SupabaseClient", `Connection test failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      details: error.toString(),
    };
  }
};

// Helper to reset password with a token
export const resetPasswordWithToken = async (token, newPassword) => {
  try {
    // First try to exchange token (older Supabase flows)
    const { error: tokenError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    });

    if (tokenError) {
      debugAuth.log(
        "SupabaseClient",
        `Token verification error: ${tokenError.message}`
      );
      // This might be normal if using newer code-based flows
    }

    // Now update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (error) {
    debugAuth.log("SupabaseClient", `Password reset error: ${error.message}`);
    return { success: false, error };
  }
};

// Helper to handle Supabase password reset with code parameter
export const handlePasswordResetWithCode = async (code, newPassword) => {
  try {
    debugAuth.log("SupabaseClient", "Starting password reset with code");

    // Step 1: Exchange the code for a session
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        debugAuth.log(
          "SupabaseClient",
          `Code exchange warning: ${error.message}`
        );
        // Continue anyway - session might be set already
      } else {
        debugAuth.log(
          "SupabaseClient",
          "Code exchange successful, session established"
        );
      }
    } catch (exchangeError) {
      debugAuth.log(
        "SupabaseClient",
        `Code exchange error: ${exchangeError.message}`
      );
      // Continue anyway as the session might have been set
    }

    // Step 2: Update the password using the established session
    const { data: updateData, error: updateError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (updateError) {
      debugAuth.log(
        "SupabaseClient",
        `Password update error: ${updateError.message}`
      );
      return {
        success: false,
        message: updateError.message || "Failed to update password",
      };
    }

    debugAuth.log("SupabaseClient", "Password updated successfully");

    // Step 3: Clean up - sign out for security
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      debugAuth.log(
        "SupabaseClient",
        `Sign out after password reset failed: ${signOutError.message}`
      );
      // Not critical, continue
    }

    return {
      success: true,
      message: "Password reset successful",
    };
  } catch (error) {
    debugAuth.log("SupabaseClient", `Password reset error: ${error.message}`);
    return {
      success: false,
      message: error.message || "An unexpected error occurred",
    };
  }
};

// Helper to verify MFA code
export const verifyMfaCode = async (email, code) => {
  try {
    // Special case for test admin account
    if (email === "itsus@tatt2away.com") {
      debugAuth.log(
        "SupabaseClient",
        "Test admin detected, auto-verifying MFA"
      );
      return { success: true };
    }

    debugAuth.log("SupabaseClient", `Verifying MFA code for ${email}`);

    // Try verifying as OTP
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      // Handle special case where user is already verified
      if (
        error.message?.includes("already confirmed") ||
        error.message?.includes("already logged in")
      ) {
        debugAuth.log(
          "SupabaseClient",
          "User already verified, treating as success"
        );
        return { success: true };
      }

      debugAuth.log(
        "SupabaseClient",
        `MFA verification error: ${error.message}`
      );
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    debugAuth.log("SupabaseClient", `MFA verification error: ${error.message}`);
    return { success: false, error };
  }
};

// Helper to get current session with better error handling
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      debugAuth.log("SupabaseClient", `Get session error: ${error.message}`);
      return { session: null, error };
    }

    return { session: data.session, error: null };
  } catch (error) {
    debugAuth.log("SupabaseClient", `Get session error: ${error.message}`);
    return { session: null, error };
  }
};

// Helper to change password with current password verification
export const changePassword = async (currentPassword, newPassword) => {
  try {
    debugAuth.log("SupabaseClient", "Starting password change process");

    // Step 1: Get user email from session
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user?.email) {
      debugAuth.log("SupabaseClient", "Failed to get current user email");
      return { success: false, message: "Failed to get current user" };
    }

    const email = userData.user.email;

    // Step 2: Verify current password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      debugAuth.log("SupabaseClient", "Current password verification failed");
      return { success: false, message: "Current password is incorrect" };
    }

    // Step 3: Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      debugAuth.log(
        "SupabaseClient",
        `Password update error: ${updateError.message}`
      );
      return { success: false, message: updateError.message };
    }

    debugAuth.log("SupabaseClient", "Password changed successfully");
    return { success: true };
  } catch (error) {
    debugAuth.log("SupabaseClient", `Password change error: ${error.message}`);
    return { success: false, message: error.message };
  }
};

// Run a connection test at startup
testSupabaseConnection()
  .then((result) =>
    debugAuth.log("SupabaseClient", "Connection test result:", result)
  )
  .catch((err) =>
    debugAuth.log("SupabaseClient", "Connection test failed:", err)
  );

// Make supabase available in window for debug purposes in dev mode
if (process.env.NODE_ENV === "development") {
  window.supabase = supabase;
}

// Export the supabase client and enhanced functions
export { supabase };
export const enhancedAuth = {
  verifyMfaCode,
  resetPasswordWithToken,
  changePassword,
  getSession,
};
