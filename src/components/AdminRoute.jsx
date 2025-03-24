// src/components/AdminRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AdminRoute = () => {
  const { currentUser, isAdmin, loading } = useAuth();
  console.log("Admin route check:", { currentUser, isAdmin, loading });

  // Show loading state while checking roles
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Checking permissions...</p>
      </div>
    );
  }

  // Debug what's in localStorage
  console.log("Auth state in AdminRoute:", {
    token: !!localStorage.getItem("authToken"),
    isAuthenticated: localStorage.getItem("isAuthenticated"),
    current: currentUser,
  });

  // Temporary bypass for development if needed
  // const devBypass = process.env.NODE_ENV === 'development';
  // if (devBypass) return <Outlet />;

  // Redirect to dashboard if not admin
  if (!isAdmin) {
    console.log("Not admin, redirecting to dashboard");
    return <Navigate to="/" replace />;
  }

  // Render the child routes
  return <Outlet />;
};

export default AdminRoute;
