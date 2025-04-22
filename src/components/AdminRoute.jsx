// src/components/AdminRoute.jsx
import React, { useEffect, useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthContext from "../context/AuthContext";

const AdminRoute = () => {
  // Use the auth context directly - ALWAYS at the top level
  const auth = useContext(AuthContext) || {};

  // Safely extract values with fallbacks
  const currentUser = auth?.currentUser || null;
  const loading = auth?.loading || false;
  const isInitialized = auth?.isInitialized || false;

  // Get the location for redirects
  const location = useLocation();

  // Direct role checking function for safety
  const hasAdminRole = (user) => {
    if (!user || !user.roles) return false;
    return user.roles.includes("admin") || user.roles.includes("super_admin");
  };

  // Improved logging for debugging
  useEffect(() => {
    if (currentUser) {
      console.log("AdminRoute: Checking access for", {
        email: currentUser.email,
        roles: currentUser.roles,
        isAdmin: hasAdminRole(currentUser),
      });
    }
  }, [currentUser]);

  // Enhanced loading state
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
    console.log("AdminRoute: No user, redirecting to login");
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Special handling for test admin user - clearly documented
  if (currentUser.email === "itsus@tatt2away.com") {
    console.log("AdminRoute: Test admin user detected, granting access");
    return <Outlet />;
  }

  // Check if user has admin role either via auth context or directly
  const userIsAdmin =
    (typeof auth.hasRole === "function" &&
      (auth.hasRole("admin") || auth.hasRole("super_admin"))) ||
    hasAdminRole(currentUser);

  console.log("AdminRoute: Admin check result =", userIsAdmin);

  // Redirect if not an admin
  if (!userIsAdmin) {
    console.log("AdminRoute: Access denied - not an admin");
    return <Navigate to="/unauthorized" replace />;
  }

  // User is admin, render protected content
  return <Outlet />;
};

export default AdminRoute;
