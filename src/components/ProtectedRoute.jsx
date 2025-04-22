// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Protected route component that requires authentication
 */
function ProtectedRoute() {
  // Get the location for redirects
  const location = useLocation();

  // Use the auth context
  const { currentUser, loading, mfaState } = useAuth();

  // Show loading during initialization
  if (loading) {
    return (
      <div className="auth-loading">
        <Loader className="spinner" size={24} />
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

  // All checks passed, render the protected content
  return <Outlet />;
}

export default ProtectedRoute;
