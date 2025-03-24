// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Explicitly define the Supabase credentials
// For development, you can hardcode these values temporarily
// In production, use environment variables properly
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://rfnglcfyzoyqenofmsev.supabase.co"; // Replace with your actual URL

const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmbmdsY2Z5em95cWVub2Ztc2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTE2OTIsImV4cCI6MjA0NjUyNzY5Mn0.kkCRc648CuROFmGqsQVjtZ_y6n4y4IX9YXswbt81dNg"; // Replace with your actual key

console.log("Supabase Configuration:", {
  url: SUPABASE_URL.replace(/^https:\/\//, "").substring(0, 10) + "...",
  keyLength: SUPABASE_ANON_KEY?.length || 0,
});

// Create a single supabase client for the entire app
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// Helper function to check if supabase is properly configured
export const checkSupabaseConnection = async () => {
  try {
    // Try a simple call that should always work if credentials are correct
    const { error } = await supabase
      .from("roles")
      .select("count", { count: "exact" })
      .limit(1);

    return { success: !error, error: error?.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// Helper function to get current user
const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

// Helper function to get user metadata including roles and tier
const getUserData = async () => {
  try {
    // Get the current authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Get additional user data from profiles table
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    // Get user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role_id, roles(name, permissions)")
      .eq("user_id", user.id);

    if (rolesError) throw rolesError;

    // Format roles into a simple array
    const roles = userRoles.map((ur) => ur.roles.name);
    const permissions = userRoles.flatMap((ur) => ur.roles.permissions || []);

    // Combine auth user with profile data and roles
    return {
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.user_metadata?.name || user.email,
      roles,
      permissions,
      tier: profile?.tier || "basic",
      mfaMethods: profile?.mfa_methods || [],
      features:
        profile?.features ||
        getDefaultFeaturesForTier(profile?.tier || "basic"),
      passwordLastChanged: profile?.password_last_changed,
      ...profile,
    };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
};

// Helper function to get default features for a tier
function getDefaultFeaturesForTier(tier) {
  // Basic tier features
  const basicFeatures = {
    chatbot: true,
    basic_search: true,
    file_upload: true,
    image_analysis: true,
  };

  // Professional tier features
  const professionalFeatures = {
    ...basicFeatures,
    advanced_search: true,
    image_search: true,
    custom_branding: true,
    multi_user: true,
    data_export: true,
    analytics_basic: true,
  };

  // Enterprise tier features
  const enterpriseFeatures = {
    ...professionalFeatures,
    custom_workflows: true,
    advanced_analytics: true,
    multi_department: true,
    automated_alerts: true,
    custom_integrations: true,
    advanced_security: true,
    sso: true,
    advanced_roles: true,
  };

  switch (tier?.toLowerCase()) {
    case "enterprise":
      return enterpriseFeatures;
    case "professional":
      return professionalFeatures;
    case "basic":
    default:
      return basicFeatures;
  }
}

export { supabase, getCurrentUser, getUserData, getDefaultFeaturesForTier };
