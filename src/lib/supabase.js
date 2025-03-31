import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://rfnglcfyzoyqenofmsev.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg";

console.log("Initializing Supabase client with URL:", SUPABASE_URL);

// Create supabase client with default auth settings
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: "pkce",
    debug: process.env.NODE_ENV === "development",
  },
});

// Enhanced auth methods just for the problematic operations
export const enhancedAuth = {
  mfa: {
    challenge: async (params) => {
      console.log("Starting MFA challenge with params:", params);
      try {
        return await supabase.auth.mfa.challenge(params);
      } catch (error) {
        console.error("MFA challenge error:", error);
        throw error;
      }
    },
    verify: async (params) => {
      console.log("Verifying MFA challenge:", params);
      try {
        const result = await supabase.auth.mfa.verify(params);
        console.log("MFA verify result:", result);
        return result;
      } catch (error) {
        console.error("MFA verify error:", error);
        throw error;
      }
    },
  },
  updateUser: async (params) => {
    console.log("Updating user:", params);
    try {
      return await supabase.auth.updateUser(params);
    } catch (error) {
      console.error("Update user error:", error);
      throw error;
    }
  },
};

// Helper to check if we're on an MFA page
export const isOnMfaPage = () => {
  return (
    window.location.pathname.includes("/mfa") ||
    window.location.pathname.includes("/verify")
  );
};

// Export the supabase client
export { supabase };
