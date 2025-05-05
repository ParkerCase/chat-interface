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

    // Use is_admin_safe RPC function for the current user if no userId is provided
    if (userId === 'current') {
      const { data, error } = await supabase.rpc('is_admin_safe');
      
      if (error) {
        console.error("Error checking admin rights with is_admin_safe:", error);
        return false;
      }
      
      return data || false;
    }
    
    // For a specific user, get their profile using the safe RPC function
    const { data, error } = await supabase.rpc('get_user_profile', { user_id: userId });

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
    
    // Check if profile exists
    const { data: existsData, error: existsError } = await supabase.rpc(
      'check_profile_exists', 
      { user_email: userData.email }
    );
    
    if (existsError) {
      console.error("Error checking if profile exists:", existsError);
    }
    
    // If profile exists, update roles
    if (existsData) {
      const { data, error } = await supabase.rpc(
        'update_admin_roles',
        { 
          profile_id: userId, 
          new_roles: userData.roles || ["user"]
        }
      );
      
      if (error) {
        console.error("Error updating profile roles:", error);
        return { success: false, error };
      }
      
      return { success: true, data };
    } 
    // Otherwise create new profile
    else {
      const { data, error } = await supabase.rpc(
        'create_admin_profile',
        {
          profile_id: userId,
          profile_email: userData.email,
          profile_name: userData.fullName || userData.email,
          profile_roles: userData.roles || ["user"]
        }
      );
      
      if (error) {
        console.error("Error creating profile:", error);
        return { success: false, error };
      }
      
      return { success: true, data };
    }
  } catch (error) {
    console.error("Error upserting profile:", error);
    return { success: false, error };
  }
};

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
