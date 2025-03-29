// src/components/AdminRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AdminRoute = () => {
  const { currentUser, loading } = useAuth();

  console.log("Admin route check:", {
    user: currentUser,
    hasAdminRole:
      currentUser?.roles?.includes("admin") ||
      currentUser?.roles?.includes("super_admin"),
    loading,
  });

  // Show loading state while checking roles
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Checking permissions...</p>
      </div>
    );
  }

  // Check for admin roles
  const isAdmin =
    currentUser &&
    currentUser.roles &&
    (currentUser.roles.includes("admin") ||
      currentUser.roles.includes("super_admin"));

  // Redirect to dashboard if not admin
  if (!isAdmin) {
    console.log("Not admin, redirecting to dashboard");
    return <Navigate to="/" replace />;
  }

  // User is admin, render the protected content
  console.log("Admin access granted");
  return <Outlet />;
};

export default AdminRoute;
