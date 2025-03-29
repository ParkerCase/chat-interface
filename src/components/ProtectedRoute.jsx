// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
        <div className="spinner"></div>
        <p>Authenticating...</p>
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
      return fallback || <Navigate to="/unauthorized" replace />;
    }
  }

  // Check feature requirements if specified
  if (requireFeatures.length > 0) {
    const hasRequiredFeature = requireFeatures.some((feature) =>
      hasFeatureAccess(feature)
    );
    if (!hasRequiredFeature) {
      return fallback || <Navigate to="/unauthorized" replace />;
    }
  }

  // All checks passed, render children
  return <Outlet />;
}

export default ProtectedRoute;
