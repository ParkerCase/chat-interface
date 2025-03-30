// src/components/AdminRoute.jsx
import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

const AdminRoute = () => {
  const { currentUser, loading, hasRole, isInitialized } = useAuth();
  const location = useLocation();

  // Improved logging for debugging
  useEffect(() => {
    if (currentUser) {
      console.log("AdminRoute: Checking access for", {
        email: currentUser.email,
        roles: currentUser.roles,
        isAdmin:
          currentUser.roles?.includes("admin") ||
          currentUser.roles?.includes("super_admin"),
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

  // Consistent role checking
  const userIsAdmin =
    currentUser.roles?.includes("admin") ||
    currentUser.roles?.includes("super_admin");

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
