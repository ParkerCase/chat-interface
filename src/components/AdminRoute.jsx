// src/components/AdminRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * A wrapper around routes that require admin privileges
 * Redirects to dashboard if user is not an admin
 */
const AdminRoute = () => {
  const { currentUser, loading, isAdmin } = useAuth();

  // Show loading state while checking roles
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Checking permissions...</p>
      </div>
    );
  }

  // Redirect to dashboard if not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Render the child routes
  return <Outlet />;
};

export default AdminRoute;
