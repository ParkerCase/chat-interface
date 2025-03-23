// src/components/FeatureProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "../utils/featureFlags";
import UpgradePrompt from "./UpgradePrompt";

const FeatureProtectedRoute = ({ feature, children, redirectTo = "/" }) => {
  const { isFeatureEnabled } = useFeatureFlags();

  // Check if the feature is enabled for this user
  if (!isFeatureEnabled(feature)) {
    // Option 1: Show upgrade prompt
    return (
      <UpgradePrompt
        feature={feature}
        onClose={() => <Navigate to={redirectTo} />}
      />
    );

    // Option 2: Redirect (uncomment this instead if you prefer redirection)
    // return <Navigate to={redirectTo} replace />;
  }

  // Feature is enabled, render children
  return children;
};

export default FeatureProtectedRoute;
