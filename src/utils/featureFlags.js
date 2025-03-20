// src/utils/featureFlags.js

import { useAuth } from "../context/AuthContext";
import React, { createContext, useContext, useMemo } from "react";

// Feature definitions with required tier level
const FEATURE_DEFINITIONS = {
  // Basic tier features
  chatbot: { tier: "basic", description: "Basic AI chatbot functionality" },
  basic_search: { tier: "basic", description: "Simple search capabilities" },
  file_upload: { tier: "basic", description: "Upload files to the chatbot" },
  image_analysis: { tier: "basic", description: "Basic image analysis" },

  // Professional tier features
  advanced_search: {
    tier: "professional",
    description: "Advanced search with filters and sorting",
  },
  image_search: {
    tier: "professional",
    description: "Search by image similarity",
  },
  custom_branding: {
    tier: "professional",
    description: "Custom branding and theming",
  },
  multi_user: { tier: "professional", description: "Multiple user accounts" },
  data_export: {
    tier: "professional",
    description: "Export conversation data",
  },
  analytics_basic: {
    tier: "professional",
    description: "Basic usage analytics",
  },

  // Enterprise tier features
  custom_workflows: {
    tier: "enterprise",
    description: "Customized AI workflows",
  },
  advanced_analytics: {
    tier: "enterprise",
    description: "Advanced analytics and reporting",
  },
  multi_department: {
    tier: "enterprise",
    description: "Multi-department support",
  },
  automated_alerts: {
    tier: "enterprise",
    description: "Automated notifications and alerts",
  },
  custom_integrations: {
    tier: "enterprise",
    description: "Custom third-party integrations",
  },
  advanced_security: {
    tier: "enterprise",
    description: "Advanced security features and compliance",
  },
  sso: { tier: "enterprise", description: "Single Sign-On integration" },
  advanced_roles: {
    tier: "enterprise",
    description: "Advanced role-based access control",
  },
};

// Tier levels with numeric values for comparison
const TIER_LEVELS = {
  basic: 1,
  professional: 2,
  enterprise: 3,
};

// Feature flags context
const FeatureFlagsContext = createContext();

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

export function FeatureFlagsProvider({ children }) {
  const { currentUser, hasRole } = useAuth();

  // Determine user's tier
  const userTier = useMemo(() => {
    if (!currentUser) return "basic";

    // If user has special access, upgrade tier
    if (hasRole("super_admin") || hasRole("admin")) {
      return "enterprise";
    }

    return currentUser.tier || "basic";
  }, [currentUser, hasRole]);

  // Calculate all enabled features based on tier
  const enabledFeatures = useMemo(() => {
    const userTierLevel = TIER_LEVELS[userTier.toLowerCase()] || 1;

    // Start with explicitly enabled features from user object
    const explicitlyEnabled = currentUser?.features || {};

    // Add features enabled by tier level
    const tierEnabled = Object.entries(FEATURE_DEFINITIONS).reduce(
      (acc, [featureKey, featureValue]) => {
        const featureTierLevel =
          TIER_LEVELS[featureValue.tier.toLowerCase()] || 1;
        if (featureTierLevel <= userTierLevel) {
          acc[featureKey] = true;
        }
        return acc;
      },
      {}
    );

    // Combine both sources (explicit settings override tier-based)
    return { ...tierEnabled, ...explicitlyEnabled };
  }, [currentUser, userTier]);

  // Check if a feature is enabled
  const isFeatureEnabled = (featureKey) => {
    // If feature doesn't exist in definitions, assume it's disabled
    if (!FEATURE_DEFINITIONS[featureKey]) {
      console.warn(
        `Feature '${featureKey}' is not defined in feature definitions`
      );
      return false;
    }

    // Return whether feature is enabled
    return !!enabledFeatures[featureKey];
  };

  // Get all feature definitions with enabled status
  const getFeatureDefinitions = () => {
    return Object.entries(FEATURE_DEFINITIONS).map(([key, value]) => ({
      key,
      ...value,
      enabled: !!enabledFeatures[key],
    }));
  };

  // Get user's subscription tier
  const getUserTier = () => userTier;

  // Get feature description
  const getFeatureDescription = (featureKey) => {
    return FEATURE_DEFINITIONS[featureKey]?.description || "Unknown feature";
  };

  // Calculate tier upgrade benefits
  const getTierUpgradeBenefits = (fromTier = "basic") => {
    const fromLevel = TIER_LEVELS[fromTier.toLowerCase()] || 1;

    return Object.entries(FEATURE_DEFINITIONS)
      .filter(([_, value]) => {
        const featureTierLevel = TIER_LEVELS[value.tier.toLowerCase()] || 1;
        return featureTierLevel > fromLevel;
      })
      .reduce((acc, [key, value]) => {
        if (!acc[value.tier]) {
          acc[value.tier] = [];
        }
        acc[value.tier].push({
          key,
          description: value.description,
        });
        return acc;
      }, {});
  };

  // Context value
  const value = {
    isFeatureEnabled,
    enabledFeatures,
    getFeatureDefinitions,
    getUserTier,
    getFeatureDescription,
    getTierUpgradeBenefits,
    TIER_LEVELS,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// Feature-gated component wrapper
export function FeatureGate({ feature, fallback = null, children }) {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled(feature)) {
    return fallback;
  }

  return children;
}

// Hook to conditionally render components based on feature flags
export function useFeature(featureKey) {
  const { isFeatureEnabled, getFeatureDescription } = useFeatureFlags();

  return {
    enabled: isFeatureEnabled(featureKey),
    description: getFeatureDescription(featureKey),
  };
}
