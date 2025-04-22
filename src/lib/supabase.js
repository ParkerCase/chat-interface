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
  },
  global: {
    headers: {
      "X-Client-Info": "Tatt2Away Admin Panel",
    },
  },
});

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
    // Special case for test admin account
    if (email === "itsus@tatt2away.com") {
      return { success: true };
    }

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
        return { success: true };
      }

      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("MFA verification error:", error);
    return { success: false, error };
  }
};

// Make supabase available in window for debug purposes in dev mode
if (process.env.NODE_ENV === "development") {
  window.supabase = supabase;
}

export { supabase };
