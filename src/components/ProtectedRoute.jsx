// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useContext } from "react";
import AuthContext from "../context/AuthContext";

/**
 * Protected route component that requires authentication
 * Optionally checks for specific roles or features
 */
function ProtectedRoute({
  requireRoles = [],
  requireFeatures = [],
  fallback = null,
}) {
  // Get the location for redirects
  const location = useLocation();

  // Use the auth context directly - ALWAYS at the top level
  const auth = useContext(AuthContext) || {};

  // Safely destructure with defaults to prevent errors
  const currentUser = auth?.currentUser || null;
  const loading = auth?.loading || false;
  const isInitialized = auth?.isInitialized || false;
  const mfaState = auth?.mfaState || { required: false, verified: false };

  // Handle role and feature checking with safety
  const hasRole = (role) => {
    return auth?.hasRole
      ? auth.hasRole(role)
      : auth?.currentUser?.roles?.includes?.(role) || false;
  };

  const hasFeatureAccess = (feature) => {
    return auth?.hasFeatureAccess ? auth.hasFeatureAccess(feature) : false;
  };

  // Show loading during initialization
  if (loading || !isInitialized) {
    return (
      <div className="auth-loading">
        <Loader2 className="spinner" size={24} />
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Check if user is authenticated
  if (!currentUser) {
    // Store the current path for redirection after login
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Check if MFA is required but not completed
  if (mfaState?.required && !mfaState?.verified) {
    // Redirect to MFA verification
    return (
      <Navigate
        to={`/mfa/verify?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Check role requirements if specified
  if (requireRoles.length > 0) {
    const hasRequiredRole = requireRoles.some((role) => hasRole(role));
    if (!hasRequiredRole) {
      // Use fallback or navigate to unauthorized page
      return fallback || <Navigate to="/unauthorized" replace />;
    }
  }

  // Check feature requirements if specified
  if (requireFeatures.length > 0) {
    const hasRequiredFeature = requireFeatures.some((feature) =>
      hasFeatureAccess(feature)
    );
    if (!hasRequiredFeature) {
      // Use fallback or navigate to unauthorized page
      return fallback || <Navigate to="/unauthorized" replace />;
    }
  }

  // All checks passed, render the protected content
  return <Outlet />;
}

export default ProtectedRoute;
