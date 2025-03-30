// src/components/AdminRoute.jsx
import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Protects routes that should only be accessible to admin users
 */
const AdminRoute = () => {
  const { currentUser, loading, hasRole, isInitialized } = useAuth();
  const location = useLocation();

  // Log access attempts for security auditing
  useEffect(() => {
    if (currentUser && !loading) {
      console.log(
        `Admin route access attempt by ${
          currentUser.email
        } (${currentUser.roles?.join(", ")})`
      );
    }
  }, [currentUser, loading]);

  // Special handling for test admin user
  const isTestAdmin = currentUser?.email === "itsus@tatt2away.com";

  // Show loading state while checking permissions
  if (loading || !isInitialized) {
    return (
      <div className="auth-loading">
        <Loader2 className="spinner" size={24} />
        <p>Checking admin permissions...</p>
      </div>
    );
  }

  // Ensure user is authenticated
  if (!currentUser) {
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Test admin always has access
  if (isTestAdmin) {
    return <Outlet />;
  }

  // Check for admin roles
  const userIsAdmin = hasRole("admin") || hasRole("super_admin");

  // Redirect to unauthorized page if not admin
  if (!userIsAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is admin, render the protected content
  return <Outlet />;
};

export default AdminRoute;
