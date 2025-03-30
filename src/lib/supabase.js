// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Define the Supabase credentials
// For development, these values can be hardcoded temporarily
// In production, use environment variables properly
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://rfnglcfyzoyqenofmsev.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg";

console.log("Initializing Supabase client with URL:", SUPABASE_URL);

// Create a single supabase client for the entire app
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: "pkce", // Add this for improved security
    debug: process.env.NODE_ENV !== "production", // Enable debugging in development
  },
});

// Helper function to check if supabase is properly configured
export const checkSupabaseConnection = async () => {
  try {
    // Try a simple call
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Supabase connection check failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session };
  } catch (err) {
    console.error("Supabase connection error:", err);
    return { success: false, error: err.message };
  }
};

// Helper function to validate session
export const validateSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (err) {
    console.error("Session validation error:", err);
    return null;
  }
};

// Helper to get current user with role information
export const getCurrentUser = async () => {
  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error) throw error;

    if (!userData?.user) return null;

    // Get profile data with roles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Error fetching profile:", profileError);
    }

    // Combine user data with profile data
    return {
      id: userData.user.id,
      email: userData.user.email,
      ...userData.user.user_metadata,
      ...profile,
    };
  } catch (err) {
    console.error("Error getting current user:", err);
    return null;
  }
};

// Export the supabase client
export { supabase };
