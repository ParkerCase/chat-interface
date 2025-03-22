// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  console.log("Protected route check:", {
    currentUser,
    loading,
    path: location.pathname,
    isAuthenticated: localStorage.getItem("isAuthenticated") === "true",
  });

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <p>Authenticating...</p>
      </div>
    );
  }

  // Check if authenticated via token OR basic auth (passcode)
  const isAuthenticated =
    currentUser || localStorage.getItem("isAuthenticated") === "true";

  // Allow access if user has JWT auth OR basic auth (passcode)
  if (!isAuthenticated) {
    console.log("Redirecting to login from protected route");
    // Save the current location for redirect after login
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Render the child routes
  return <Outlet />;
};

export default ProtectedRoute;
