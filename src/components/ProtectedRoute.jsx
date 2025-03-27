// components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ requireRoles = [] }) {
  const { currentUser, loading, hasRole, isInitialized } = useAuth();
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
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Check role requirements
  if (requireRoles.length > 0 && !requireRoles.some((role) => hasRole(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  // All checks passed, render the protected content
  return <Outlet />;
}

export default ProtectedRoute;
