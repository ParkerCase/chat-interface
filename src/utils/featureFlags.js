// src/utils/featureFlags.js - Simplified version

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// Create context
const FeatureFlagContext = createContext({
  features: {},
  isFeatureEnabled: () => false,
  organizationTier: "basic",
});

export function FeatureFlagProvider({ children }) {
  const { currentUser } = useAuth();
  const [features, setFeatures] = useState({});
  const [organizationTier, setOrganizationTier] = useState("basic");

  // Load organization tier when user changes
  useEffect(() => {
    const loadOrganizationTier = async () => {
      if (!currentUser) {
        setOrganizationTier("basic");
        setFeatures(getDefaultFeatures("basic"));
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
            setOrganizationTier(data.tier || "basic");
            setFeatures(
              data.features || getDefaultFeatures(data.tier || "basic")
            );
            return;
          }
        }

        // Fallback to user's tier if no org found
        setOrganizationTier(currentUser.tier || "basic");
        setFeatures(getDefaultFeatures(currentUser.tier || "basic"));
      } catch (err) {
        console.error("Error loading organization tier:", err);
        setOrganizationTier("basic");
        setFeatures(getDefaultFeatures("basic"));
      }
    };

    loadOrganizationTier();
  }, [currentUser]);

  // Check if a feature is enabled for the organization
  const isFeatureEnabled = (featureName) => {
    if (!featureName) return false;

    // If logged out, only show basic features
    if (!currentUser) {
      const basicFeatures = getDefaultFeatures("basic");
      return !!basicFeatures[featureName];
    }

    // Admins have access to all features
    if (
      currentUser.roles?.includes("admin") ||
      currentUser.roles?.includes("super_admin")
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
