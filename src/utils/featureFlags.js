// src/utils/featureFlags.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

// Create context
const FeatureFlagContext = createContext({
  features: {},
  isFeatureEnabled: () => false,
  tier: "basic",
});

/**
 * Provider component for feature flags
 */
export function FeatureFlagProvider({ children }) {
  const { currentUser } = useAuth();
  const [features, setFeatures] = useState({});
  const [tier, setTier] = useState("basic");

  // Update features when user changes
  useEffect(() => {
    if (!currentUser) {
      // Reset to basic features if logged out
      setTier("basic");
      setFeatures(getDefaultFeatures("basic"));
      return;
    }

    // Get tier from user
    const userTier = currentUser.tier || "basic";
    setTier(userTier);

    // Get features from user or defaults
    if (currentUser.features) {
      setFeatures(currentUser.features);
    } else {
      setFeatures(getDefaultFeatures(userTier));
    }
  }, [currentUser]);

  // Check if a feature is enabled
  const isFeatureEnabled = (featureName) => {
    if (!featureName) return false;

    // If logged out, only show basic features
    if (!currentUser) {
      const basicFeatures = getDefaultFeatures("basic");
      return !!basicFeatures[featureName];
    }

    // Super admin and admin have access to all features
    if (
      currentUser.roles?.includes("super_admin") ||
      currentUser.roles?.includes("admin")
    ) {
      return true;
    }

    // Check if feature exists and is enabled
    return features[featureName] === true;
  };

  return (
    <FeatureFlagContext.Provider value={{ features, isFeatureEnabled, tier }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook for using feature flags
 */
export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

/**
 * Component that conditionally renders based on feature availability
 */
export function FeatureGate({ feature, fallback = null, children }) {
  const { isFeatureEnabled } = useFeatureFlags();

  if (isFeatureEnabled(feature)) {
    return children;
  }

  return fallback;
}

/**
 * Get default features for a tier
 */
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
