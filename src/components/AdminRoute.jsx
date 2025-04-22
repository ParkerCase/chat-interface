// src/components/AdminRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Route that requires admin privileges
 */
function AdminRoute() {
  // Use the auth context
  const { currentUser, loading, isAdmin, mfaState } = useAuth();

  // Get location for redirects
  const location = useLocation();

  // Show loading during initialization
  if (loading) {
    return (
      <div className="auth-loading">
        <Loader className="spinner" size={24} />
        <p>Checking admin permissions...</p>
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

  // Check if MFA is required but not completed
  if (mfaState?.required && !mfaState?.verified) {
    return (
      <Navigate
        to={`/mfa/verify?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Special handling for test admin user
  if (currentUser.email === "itsus@tatt2away.com") {
    return <Outlet />;
  }

  // Check if user has admin role
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is admin, render protected content
  return <Outlet />;
}

export default AdminRoute;
