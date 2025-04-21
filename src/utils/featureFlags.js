// src/utils/featureFlags.js

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// Create context
const FeatureFlagContext = createContext({
  features: {},
  isFeatureEnabled: () => false,
  organizationTier: "enterprise", // Default to enterprise
});

// Get default features for a subscription tier
function getDefaultFeatures(tier) {
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

export function FeatureFlagProvider({ children }) {
  // Add null safety with optional chaining and default empty object
  const auth = useAuth() || {};
  const { currentUser, loading } = auth;

  const [features, setFeatures] = useState(getDefaultFeatures("enterprise")); // Default to enterprise
  const [organizationTier, setOrganizationTier] = useState("enterprise"); // Default to enterprise

  // Load organization tier when user changes
  useEffect(() => {
    const loadOrganizationTier = async () => {
      // If auth is still loading, wait
      if (loading) return;

      // If no user, default to enterprise as per requirements
      if (!currentUser) {
        setOrganizationTier("enterprise");
        setFeatures(getDefaultFeatures("enterprise"));
        return;
      }

      try {
        // Get organization data from the user's organization_id
        if (currentUser.organization_id) {
          const { data, error } = await supabase
            .from("organizations")
            .select("tier, features")
            .eq("id", currentUser.organization_id)
            .single();

          if (!error && data) {
            // For now, always set to enterprise per requirements
            const tier = "enterprise"; // Override data.tier
            setOrganizationTier(tier);
            setFeatures(data.features || getDefaultFeatures(tier));
            return;
          }
        }

        // Fallback to user's tier or enterprise if no org found
        const tier = "enterprise"; // Override currentUser.tier
        setOrganizationTier(tier);
        setFeatures(getDefaultFeatures(tier));
      } catch (err) {
        console.error("Error loading organization tier:", err);
        // Default to enterprise on error
        setOrganizationTier("enterprise");
        setFeatures(getDefaultFeatures("enterprise"));
      }
    };

    loadOrganizationTier();
  }, [currentUser, loading]);

  // Check if a feature is enabled for the organization
  const isFeatureEnabled = (featureName) => {
    if (!featureName) return false;

    // Always enable features for admins
    if (
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin")
    ) {
      return true;
    }

    // Check if feature exists and is enabled
    return features[featureName] === true;
  };

  return (
    <FeatureFlagContext.Provider
      value={{ features, isFeatureEnabled, organizationTier }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

// FeatureGate component for conditional rendering based on feature availability
export function FeatureGate({ feature, children, fallback = null }) {
  const { isFeatureEnabled } = useFeatureFlags();

  if (isFeatureEnabled(feature)) {
    return children;
  }

  return fallback;
}
