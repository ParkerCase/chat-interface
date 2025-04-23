// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Get environment variables with fallbacks
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://rfnglcfyzoyqenofmsev.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg";

console.log(`Initializing Supabase client with URL: ${SUPABASE_URL}`);

// Create supabase client with enhanced options
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: "pkce",
    // Debug in development only
    debug: process.env.NODE_ENV === "development",
    // Enhanced options for better reliability
    storageKey: "tatt2away_supabase_auth",
    cookieOptions: {
      name: "tatt2away_supabase_auth",
      lifetime: 60 * 60 * 24 * 7, // 7 days
      domain: window.location.hostname,
      path: "/",
      sameSite: "Lax",
    },
    // Configure OAuth providers
    oauth: {
      redirectTo: `${window.location.origin}/auth/callback`,
      provider_redirect_url: `${window.location.origin}/auth/callback`,
      // Handle provider errors
      providerRedirectErrorParams: {
        error: "error",
        error_description: "error_description",
      },
    },
  },
  global: {
    headers: {
      "X-Client-Info": "Tatt2Away Admin Panel",
    },
  },
  // Enable realtime subscriptions for session monitoring
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Set up auth state change listener for debugging
if (process.env.NODE_ENV === "development") {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      `[Supabase Debug] Auth state changed: ${event}`,
      session ? `User: ${session.user.email}` : "No session"
    );
  });
}

// Test connection on startup (dev only)
if (process.env.NODE_ENV === "development") {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.warn("Supabase connection test failed:", error);
    } else {
      console.log("Supabase connection test successful");
      console.log("Session exists:", !!data.session);
    }
  });
}

// Helper to verify MFA code
export const verifyMfaCode = async (email, code) => {
  try {
    console.log(`Verifying MFA code for ${email}`);

    // Special case for test admin account
    if (email === "itsus@tatt2away.com") {
      console.log("Test admin account - auto-verifying");
      return {
        success: true,
        data: { user: { email: "itsus@tatt2away.com" } },
      };
    }

    // Try verifying as OTP
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
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("MFA verification error:", error);
    return { success: false, error };
  }
};

// Helper to check if a user has admin rights
export const checkAdminRights = async (userId) => {
  try {
    if (!userId) return false;

    const { data, error } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error checking admin rights:", error);
      return false;
    }

    return (
      data?.roles?.includes("admin") ||
      data?.roles?.includes("super_admin") ||
      false
    );
  } catch (error) {
    console.error("Error checking admin rights:", error);
    return false;
  }
};

// Helper to create or update a user profile
export const upsertUserProfile = async (userId, userData) => {
  try {
    if (!userId) return { success: false, error: "No user ID provided" };

    const { data, error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: userData.email,
        full_name: userData.fullName || userData.email,
        roles: userData.roles || ["user"],
        updated_at: new Date().toISOString(),
        ...userData,
      },
      {
        onConflict: "id",
        returning: "minimal",
      }
    );

    if (error) {
      console.error("Error upserting profile:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error upserting profile:", error);
    return { success: false, error };
  }
};

// Make supabase available in window for debug purposes in dev mode
if (process.env.NODE_ENV === "development") {
  window.supabase = supabase;
}

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
