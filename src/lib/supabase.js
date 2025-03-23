// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://your-supabase-project.supabase.co";
const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY || "your-anon-key";

// Create a single supabase client for the entire app
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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

  switch (tier.toLowerCase()) {
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
