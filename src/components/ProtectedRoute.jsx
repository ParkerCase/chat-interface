// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Protected route component that requires authentication
 * Optionally checks for specific roles or features
 */
function ProtectedRoute({
  requireRoles = [],
  requireFeatures = [],
  fallback = null,
}) {
  const { currentUser, loading, hasRole, hasFeatureAccess, isInitialized } =
    useAuth();
  const location = useLocation();

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
