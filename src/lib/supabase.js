// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Get environment variables with strict requirement
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Ensure environment variables are defined
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Error: Supabase URL and Anon Key are required. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment."
  );

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase configuration missing - application cannot start"
    );
  }
}

// Create a single Supabase client instance with enhanced PKCE configuration
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: "pkce",
    debug: process.env.NODE_ENV === "development",
    storageKey: "tatt2away_supabase_auth",
    cookieOptions: {
      name: "tatt2away_supabase_auth",
      lifetime: 60 * 60 * 24 * 7, // 7 days
      domain: window.location.hostname === 'localhost' ? undefined : window.location.hostname,
      path: "/",
      sameSite: "Lax",
      secure: window.location.protocol === 'https:',
    },
    oauth: {
      redirectTo: `${window.location.origin}/login`,
      provider_redirect_url: `${window.location.origin}/login`,
      providerRedirectErrorParams: {
        error: "error",
        error_description: "error_description",
      },
    },
  },
  global: {
    headers: {
      "X-Client-Info": "Tatt2Away Admin Panel",
      "X-Client-Version": "1.0.0",
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Enhanced debugging and PKCE helpers
if (process.env.NODE_ENV === "development") {
  window.supabase = supabase;

  // Enhanced auth state debugging
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      `[Supabase Debug] Auth state changed: ${event}`,
      session ? `User: ${session.user.email}` : "No session"
    );
    
    // Log PKCE data when available
    if (event === 'SIGNED_IN' && session) {
      console.log('[Supabase Debug] Session details:', {
        access_token: session.access_token ? 'present' : 'missing',
        refresh_token: session.refresh_token ? 'present' : 'missing',
        provider_token: session.provider_token ? 'present' : 'missing',
        provider_refresh_token: session.provider_refresh_token ? 'present' : 'missing',
      });
    }
  });
  
  // Debug PKCE storage
  window.debugPKCE = () => {
    const authKey = 'tatt2away_supabase_auth';
    const stored = localStorage.getItem(authKey);
    console.log('PKCE Storage Debug:', {
      hasStoredAuth: !!stored,
      storedData: stored ? JSON.parse(stored) : null,
      currentURL: window.location.href,
      urlParams: Object.fromEntries(new URLSearchParams(window.location.search))
    });
  };
}

// Helper to verify MFA code
export const verifyMfaCode = async (email, code) => {
  try {
    console.log(`Verifying MFA code for ${email}`);

    const { data, error } = await supabase.auth.verifyOtp({
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
        console.log("User already verified, treating as success");
        return {
          success: true,
          data: {
            user: { email },
          },
        };
      }

      console.error("MFA verification error:", error);
      return { success: false, error };
    }

    console.log("MFA verification successful");
    return { success: true, data };
  } catch (error) {
    console.error("MFA verification error:", error);
    return { success: false, error };
  }
};

// Helper to check admin rights
export const checkAdminRights = async (userId = "current") => {
  // Try to get user from context or localStorage
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("currentUser"));
  } catch {}
  if (!user) return false;

  return (
    user.roles?.includes("admin") ||
    user.roles?.includes("super_admin") ||
    false
  );
};

// Helper to create or update a user profile
export const upsertUserProfile = async (userId, userData) => {
  try {
    if (!userId) return { success: false, error: "No user ID provided" };

    // Check if profile exists
    const { data: existingProfile, error: existsError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (existsError && existsError.code !== "PGRST116") {
      // PGRST116: No rows found
      console.error("Error checking if profile exists:", existsError);
      return { success: false, error: existsError };
    }

    if (existingProfile) {
      // Update roles and other fields
      const { error } = await supabase
        .from("profiles")
        .update({
          roles: userData.roles || ["user"],
          full_name: userData.fullName || userData.email,
          email: userData.email,
        })
        .eq("id", userId);
      if (error) {
        console.error("Error updating profile:", error);
        return { success: false, error };
      }
      return { success: true };
    } else {
      // Insert new profile
      const { error } = await supabase.from("profiles").insert([
        {
          id: userId,
          roles: userData.roles || ["user"],
          full_name: userData.fullName || userData.email,
          email: userData.email,
        },
      ]);
      if (error) {
        console.error("Error creating profile:", error);
        return { success: false, error };
      }
      return { success: true };
    }
  } catch (error) {
    console.error("Error upserting profile:", error);
    return { success: false, error };
  }
};

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
