// src/components/FeatureGate.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";

function FeatureGate({
  feature,
  children,
  fallback = null,
  upgradePrompt = false,
}) {
  const { hasFeatureAccess, getUserTier } = useAuth();
  const hasAccess = hasFeatureAccess(feature);

  // If user has access, render children
  if (hasAccess) {
    return children;
  }

  // If upgrade prompt is requested and fallback is not provided
  if (upgradePrompt && !fallback) {
    return (
      <div className="feature-upgrade-prompt">
        <h3>Feature not available</h3>
        <p>This feature requires a higher tier subscription.</p>
        <p>
          Your current tier: <strong>{getUserTier()}</strong>
        </p>
        <button
          className="upgrade-button"
          onClick={() => (window.location.href = "/account/upgrade")}
        >
          Upgrade Account
        </button>
      </div>
    );
  }

  // Return fallback or null
  return fallback || null;
}

export default FeatureGate;
