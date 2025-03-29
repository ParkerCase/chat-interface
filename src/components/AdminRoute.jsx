// src/components/AdminRoute.jsx
import React, { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AdminRoute = () => {
  const { currentUser, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Debug log for admin role check
  useEffect(() => {
    console.log("Admin route check:", {
      user: currentUser,
      email: currentUser?.email,
      roles: currentUser?.roles,
      hasAdminRole:
        currentUser?.roles?.includes("admin") ||
        currentUser?.roles?.includes("super_admin"),
      isAdminFromContext: isAdmin,
      loading,
    });

    // Special case for our test user
    if (currentUser?.email === "itsus@tatt2away.com") {
      console.log("Test admin user detected, ensuring admin access");
    }
  }, [currentUser, isAdmin, loading]);

  // Show loading state while checking roles
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Checking permissions...</p>
      </div>
    );
  }

  // Special case for test user
  if (currentUser?.email === "itsus@tatt2away.com") {
    console.log("Granting admin access to test user");
    return <Outlet />;
  }

  // Check for admin roles
  const userIsAdmin =
    currentUser &&
    currentUser.roles &&
    (currentUser.roles.includes("admin") ||
      currentUser.roles.includes("super_admin"));

  // Redirect to dashboard if not admin
  if (!userIsAdmin && !isAdmin) {
    console.log("Not admin, redirecting to dashboard");
    return <Navigate to="/" replace />;
  }

  // User is admin, render the protected content
  console.log("Admin access granted");
  return <Outlet />;
};

export default AdminRoute;
