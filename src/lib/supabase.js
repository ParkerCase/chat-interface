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

// Create a single Supabase client instance
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
      domain: window.location.hostname,
      path: "/",
      sameSite: "Lax",
    },
    oauth: {
      redirectTo: `${window.location.origin}/auth/callback`,
      provider_redirect_url: `${window.location.origin}/auth/callback`,
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
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Development debug helpers
if (process.env.NODE_ENV === "development") {
  window.supabase = supabase;

  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      `[Supabase Debug] Auth state changed: ${event}`,
      session ? `User: ${session.user.email}` : "No session"
    );
  });
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

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
